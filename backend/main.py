from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
import json
from dotenv import load_dotenv
import os
import re
import base64
from PIL import Image
from io import BytesIO

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="DAW Assistant Backend", version="0.1.0")

# CORS middleware must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using "*" for origins
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)


class HealthResponse(BaseModel):
    status: str

class AskRequest(BaseModel):
    query: str
    screenshot: str | None = None

class AskResponse(BaseModel):
    bbox: list[int] | None = None
    text: str

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint to verify the server is running."""
    return HealthResponse(status="ok")

@app.options("/ask")
async def ask_options():
    """Handle CORS preflight requests."""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

def generate_stream(request: AskRequest):
    """Generator function to stream responses from OpenAI."""
    try:
        client = OpenAI()
        content = []
        
        # Extract screenshot dimensions if provided
        screenshot_width = None
        screenshot_height = None
        if request.screenshot:
            try:
                # Extract image dimensions from base64
                image_data = base64.b64decode(request.screenshot)
                image = Image.open(BytesIO(image_data))
                screenshot_width, screenshot_height = image.size
                import sys
                print(f"DEBUG: Screenshot dimensions: {screenshot_width}x{screenshot_height}", file=sys.stderr)
            except Exception as e:
                import sys
                print(f"DEBUG: Could not extract image dimensions: {e}", file=sys.stderr)
        
        # Add text prompt with FL Studio context
        if request.screenshot:
            dimension_info = ""
            if screenshot_width and screenshot_height:
                dimension_info = f"\n\nSCREENSHOT DIMENSIONS: The screenshot is {screenshot_width} pixels wide and {screenshot_height} pixels tall. All coordinates must be within these bounds (x from 0 to {screenshot_width-1}, y from 0 to {screenshot_height-1})."
            
            system_context = f"""You are an assistant helping users with FL Studio, with the ability to help them locate UI elements, understand features, or answer questions.

IMPORTANT: When the user asks you to locate or point out something on the screen, you MUST include bounding box coordinates at the end of your response.

Response format:
1. Provide your text explanation naturally.
2. If you identified a UI element on screen that the user asked about, you MUST end your response with: [BBOX:x1,y1,x2,y2]
   - x1, y1 are the top-left coordinates (must be >= 0)
   - x2, y2 are the bottom-right coordinates (must be > x1 and > y1)
   - These must be EXACT pixel coordinates from the screenshot
   - Coordinates are in pixels, with (0,0) at the top-left corner
   - x increases to the right, y increases downward{dimension_info}

CRITICAL: ACCURACY IS ESSENTIAL. The coordinates you provide will be used to highlight the exact element on screen.

STEP-BY-STEP PROCESS FOR ACCURATE COORDINATES:
1. CAREFULLY examine the screenshot and locate the UI element the user is asking about
2. Identify the VISUAL BOUNDARIES of the element:
   - Look for edges, borders, shadows, or color changes
   - For buttons: find where the button background starts and ends (including any border/shadow)
   - For text: find the bounding box of the text area (including padding if visible)
   - For icons: find the icon's bounding area
3. Determine the TOP-LEFT corner (x1, y1):
   - Find the leftmost edge of the visible element
   - Find the topmost edge of the visible element
   - This is your (x1, y1) - be precise, not approximate
4. Determine the BOTTOM-RIGHT corner (x2, y2):
   - Find the rightmost edge of the visible element
   - Find the bottommost edge of the visible element
   - This is your (x2, y2) - be precise, not approximate
5. VALIDATE your coordinates:
   - x1 must be < x2 (if not, you made an error)
   - y1 must be < y2 (if not, you made an error)
   - x1 >= 0, y1 >= 0 (coordinates start at top-left)
   - x2 <= screenshot width, y2 <= screenshot height
   - The bbox should tightly wrap the element - not too loose, not cutting off edges

PRECISION TIPS:
- Use the screenshot dimensions to help estimate: if the element is roughly 1/4 from the left and 1/10 from the top, calculate: x ≈ width/4, y ≈ height/10
- But don't just estimate - LOOK at the actual pixel boundaries in the image
- Small elements (buttons, icons) typically have bboxes 20-100 pixels wide/tall
- Medium elements (panels, toolbars) typically have bboxes 100-500 pixels wide/tall
- Large elements (windows, main areas) can be 500+ pixels
- When in doubt, make the bbox slightly larger rather than cutting off the element

Examples:
- User asks "Where is the play button?" → "The play button is in the top toolbar, second button from the left. [BBOX:120,45,165,75]"
- User asks "How do I create a pattern?" → "To create a new pattern, click the pattern selector dropdown and choose 'Create new pattern'. There's no specific UI element to highlight for this general question."

CRITICAL: If the user asks WHERE something is or to POINT OUT something, you MUST include [BBOX:x1,y1,x2,y2] at the very end with accurate coordinates. Take your time to identify the exact pixel boundaries. Do not include the bbox marker if the question is about general features or workflows without a specific on-screen element.
            """
        else:
            system_context = """You are an assistant helping users with FL Studio, answering questions about features, workflows, and general usage.
            Provide helpful, clear responses about FL Studio.
            """
        
        user_message = f"User's question about FL Studio: {request.query}"
        content.append({
            "type": "text",
            "text": user_message
        })
        
        # Add screenshot if provided
        if request.screenshot:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{request.screenshot}"
                }
            })
        
        # Call OpenAI API with streaming
        try:
            import sys
            print("DEBUG: Calling OpenAI API...", file=sys.stderr)
            stream = client.chat.completions.create(
                model="gpt-4o",  # Using gpt-4o for vision support
                messages=[
                    {
                        "role": "system",
                        "content": system_context
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                stream=True,
            )
        except Exception as e:
            error_response = json.dumps({"text": f"Error calling OpenAI API: {str(e)}", "bbox": None, "streaming": False})
            yield f"data: {error_response}\n\n"
            return

        full_response = ""
        accumulated_text = ""
        last_sent_length = 0
        
        # Stream the response character by character
        try:
            for chunk in stream:
                try:
                    # Check if chunk has choices and delta
                    if not chunk.choices or len(chunk.choices) == 0:
                        continue
                    if not hasattr(chunk.choices[0], 'delta') or not chunk.choices[0].delta:
                        continue
                    if not hasattr(chunk.choices[0].delta, 'content') or not chunk.choices[0].delta.content:
                        continue
                    
                    content_chunk = chunk.choices[0].delta.content
                    full_response += content_chunk
                    accumulated_text += content_chunk
                    
                    # Check if we've hit a bbox marker - if so, extract it and send text up to that point
                    bbox_match = re.search(r'\[BBOX:(\d+),(\d+),(\d+),(\d+)\]', accumulated_text)
                    if bbox_match:
                        # Found bbox marker - extract text before it and the bbox
                        bbox_start = bbox_match.start()
                        text_before_bbox = accumulated_text[:bbox_start].strip()
                        bbox = [int(bbox_match.group(1)), int(bbox_match.group(2)), 
                                int(bbox_match.group(3)), int(bbox_match.group(4))]
                        
                        # Send final message with text and bbox
                        yield f"data: {json.dumps({'text': text_before_bbox, 'bbox': bbox, 'streaming': False})}\n\n"
                        return
                    else:
                        # No bbox marker yet - just stream the text
                        # Remove any partial bbox markers that might be forming
                        text_to_send = accumulated_text
                        # Check for incomplete bbox marker at the end and remove it from display
                        incomplete_bbox = re.search(r'\[BBOX:[^\]]*$', text_to_send)
                        if incomplete_bbox:
                            text_to_send = text_to_send[:incomplete_bbox.start()]
                        
                        # Send updates every time we get new content
                        # This ensures real-time streaming
                        if text_to_send and len(text_to_send) > last_sent_length:
                            last_sent_length = len(text_to_send)
                            # Yield immediately to ensure streaming
                            yield f"data: {json.dumps({'text': text_to_send, 'bbox': None, 'streaming': True})}\n\n"
                except Exception as chunk_error:
                    # Continue processing other chunks
                    continue
        except Exception as stream_error:
            error_response = json.dumps({"text": f"Error processing stream: {str(stream_error)}", "bbox": None, "streaming": False})
            yield f"data: {error_response}\n\n"
            return
        
        # After streaming is complete, check for bbox in final response
        # Debug: print the response to see what we got (remove in production)
        
        # First try the [BBOX:...] format
        bbox_match = re.search(r'\[BBOX:(\d+),(\d+),(\d+),(\d+)\]', full_response)
        if bbox_match:
            # Extract text before bbox and the bbox coordinates
            bbox_start = bbox_match.start()
            final_text = full_response[:bbox_start].strip()
            bbox = [int(bbox_match.group(1)), int(bbox_match.group(2)), 
                    int(bbox_match.group(3)), int(bbox_match.group(4))]
            yield f"data: {json.dumps({'text': final_text, 'bbox': bbox, 'streaming': False})}\n\n"
        else:
            # Try to find JSON in the response as fallback
            # Look for complete JSON objects that might be at the end
            try:
                # Try to parse the entire response as JSON first
                parsed = json.loads(full_response)
                if 'bbox' in parsed and isinstance(parsed['bbox'], list) and len(parsed['bbox']) == 4:
                    final_text = parsed.get('text', '')
                    bbox = parsed['bbox']
                    yield f"data: {json.dumps({'text': final_text, 'bbox': bbox, 'streaming': False})}\n\n"
                else:
                    yield f"data: {json.dumps({'text': full_response.strip(), 'bbox': None, 'streaming': False})}\n\n"
            except json.JSONDecodeError:
                # Not valid JSON, try to find JSON-like structures
                # Look for JSON objects with bbox field
                json_patterns = [
                    r'\{[^{}]*"bbox"\s*:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\][^{}]*\}',
                    r'\{[^{}]*"bbox"\s*:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\][^{}]*"text"\s*:\s*"([^"]*)"[^{}]*\}',
                ]
                
                bbox_found = False
                for pattern in json_patterns:
                    match = re.search(pattern, full_response, re.DOTALL)
                    if match:
                        try:
                            bbox = [int(match.group(1)), int(match.group(2)), 
                                   int(match.group(3)), int(match.group(4))]
                            # Try to extract text from the match or use the full response
                            if len(match.groups()) > 4:
                                final_text = match.group(5)
                            else:
                                # Remove the JSON part from the response
                                final_text = full_response[:match.start()].strip()
                            yield f"data: {json.dumps({'text': final_text, 'bbox': bbox, 'streaming': False})}\n\n"
                            bbox_found = True
                            break
                        except (ValueError, IndexError):
                            continue
                
                if not bbox_found:
                    # No bbox found, just send the text
                    yield f"data: {json.dumps({'text': full_response.strip(), 'bbox': None, 'streaming': False})}\n\n"
            
    except Exception as e:
        error_response = json.dumps({"text": f"Error processing request: {str(e)}", "bbox": None})
        yield f"data: {error_response}\n\n"

@app.post("/ask")
async def ask(request: AskRequest):
    """Endpoint to handle user queries and generate streaming responses."""
    return StreamingResponse(
        generate_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )
