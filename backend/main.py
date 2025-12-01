from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="DAW Assistant Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str

class AskRequest(BaseModel):
    query: str
    screenshot: str | None = None

class AskResponse(BaseModel):
    response: str

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint to verify the server is running."""
    return HealthResponse(status="ok")

@app.post("/ask")
async def ask(request: AskRequest) -> AskResponse:
    """Endpoint to handle user queries and generate responses."""

    screenshot_info = ""
    if request.screenshot:
        screenshot_info = f"Screenshot size: {len(request.screenshot)} bytes"

    return AskResponse(response=f"Response to the query: {request.query}\n{screenshot_info}")