# Backend (FastAPI)

A minimal FastAPI backend scaffold with a `/health` endpoint.

## Setup

1. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the server

Start a local development server with auto-reload:
```bash
uvicorn main:app --reload --port 8000
```

Once running, check the health endpoint at `http://localhost:8000/health` to confirm the server is available.
