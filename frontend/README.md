# LedgerLines frontend

React 19 + Vite 8 + Tailwind CSS 4, with Recharts for the spending chart.

## Run

```powershell
npm install
npm run dev
```

- Runs on `http://localhost:3000`. The port is fixed (`strictPort` in `vite.config.js`) because the backend CORS config only allows this origin.
- Needs Node `^20.19.0` or `>=22.12.0`.
- The backend must be running at `http://localhost:8000` (see the root [README](../README.md)).

## API client

All requests go through `src/api.js`:
- `API_BASE` is hard-coded to `http://localhost:8000`.
- Every request sends `credentials: "include"` so the refresh cookie is sent.
- On a 401 it calls `POST /auth/refresh` once, shared between parallel requests, and retries with the new access token.
- The access token is kept in `localStorage` under `ll_token`.

## Other scripts

```powershell
npm run build
npm run lint
npm run preview
```
