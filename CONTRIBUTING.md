# Contributing

Thanks for your interest in contributing to EV Charge Tracker.

## Development Setup

- Backend: .NET 10 SDK
- Frontend: Node.js 18+
- Vehicle service: Python 3.13+

### Run locally

```bash
# Backend
cd backend/CarCharge.Api

dotnet run
```

```bash
# Frontend
cd frontend
npm install
npm run dev
```

```bash
# Vehicle service
cd vehicle-service
python -m venv .venv
. .venv/bin/activate  # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8100
```

## Pull Requests

- Keep changes focused and explain the rationale.
- Update documentation for user-facing changes.
- Add tests when feasible (especially for new logic).
- Ensure `npm run lint` and `dotnet build` pass before requesting review.
- Ensure `pytest` passes for vehicle service changes.

## Running Tests

```bash
# Backend tests
cd backend
dotnet test CarCharge.Api.Tests/CarCharge.Api.Tests.csproj
```

```bash
# Vehicle service tests
cd vehicle-service
python -m venv .venv
. .venv/bin/activate  # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pytest
pytest tests/
```

## Code Style

- C#: follow standard .NET conventions and nullable reference types.
- React: keep components small and predictable; prefer function components.
- Python: prefer explicit typing where practical; avoid hidden side effects.

## License

By contributing, you agree that your contributions will be licensed under
GPL-3.0-or-later.
