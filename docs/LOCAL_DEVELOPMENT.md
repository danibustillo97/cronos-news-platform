# Local Development

## Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

## FastAPI compatibility server

```powershell
cd backend
Copy-Item .env.example .env
.\venv\Scripts\python.exe -m uvicorn app.presentation.main:app --reload --port 8000
```

FastAPI is a local compatibility server, not a production permanence requirement.

## Workers

```powershell
cd backend
Copy-Item ..\automation\.env.example ..\automation\.env
.\venv\Scripts\python.exe ..\automation\run_scheduled_publications.py
```

Local processes read and write Supabase. Filesystem paths are temporary or LAB outputs, never alternate business persistence.
