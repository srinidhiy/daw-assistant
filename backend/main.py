from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from openai import OpenAI
import json
from dotenv import load_dotenv
import os

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
    bbox: list[int]
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

@app.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest) -> AskResponse:
    """Endpoint to handle user queries and generate responses."""
    try:
        client = OpenAI()
        content = []
        
        # Add text prompt with FL Studio context
        system_context = """You are an assistant helping users with FL Studio, with the ability to help them locate UI elements, understand features, or answer questions.
        When identifying UI elements in the screenshot, respond ONLY in JSON format, such as:
        {
        "bbox": [x1, y1, x2, y2],
        "text": "explanation"
        }
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
        
        # Call OpenAI API
        try:
            response = client.chat.completions.create(
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
                response_format={"type": "json_object"},
                stream=False,
            )
        except Exception as e:
            return AskResponse(
                bbox=[],
                text=f"Error calling OpenAI API: {str(e)}",
            )

        raw_content = response.choices[0].message.content

        try:
            parsed = json.loads(raw_content)
        except Exception:
            return AskResponse(
                bbox=[],
                text=str(raw_content),
            )

        return AskResponse(
            bbox=parsed.get("bbox", []),
            text=parsed.get("text", ""),
        )
    except Exception as e:
        # Catch any unhandled exceptions to ensure CORS headers are sent
        return AskResponse(
            bbox=[],
            text=f"Error processing request: {str(e)}",
        )
