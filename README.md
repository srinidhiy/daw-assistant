# daw-assistant

This repository contains an Electron + React + TypeScript desktop shell and a FastAPI backend stub for the DAW assistant MVP.

## Project layout

- `electron-app/` – Electron application scaffold with a simple React renderer.
- `backend/` – FastAPI backend stub with a health endpoint.

## Running the Electron app

1. Install dependencies inside `electron-app`:
   ```bash
   cd electron-app
   npm install
   ```
2. Start the development environment (Vite + Electron):
   ```bash
   npm run dev
   ```

## Running the FastAPI backend

1. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Start the dev server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
3. Verify it is running by visiting `http://localhost:8000/health`.
