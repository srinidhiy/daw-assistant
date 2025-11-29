# Desktop client (Electron + React + TypeScript)

## Development scripts

- `npm install` – install dependencies (requires access to the npm registry).
- `npm run dev` – run Vite for the renderer and Electron (main process) together for live reload.
- `npm run dev:renderer` – start only the Vite dev server for the renderer bundle.
- `npm run dev:electron` – start the Electron main process once the dev server is reachable.
- `npm run typecheck` – run TypeScript type-checking for renderer, shared, and preload code.
- `npm run build:renderer` – produce the renderer bundle in `dist/renderer`.
- `npm run build:main` – compile the main process files to `dist/main`.
- `npm start` – build both bundles and launch Electron using the compiled output.

## File layout

- `src/main` – Electron main-process code.
- `src/renderer` – React renderer app.
- `src/shared` – shared TypeScript types for client/server parity.
- `tsconfig.json` – renderer TypeScript configuration for Vite.
- `tsconfig.main.json` – main-process TypeScript configuration.
- `vite.config.ts` – Vite config for the renderer bundle.

The scaffold currently renders a simple “Hello” view to confirm the toolchain works.
