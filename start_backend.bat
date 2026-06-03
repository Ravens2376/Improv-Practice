@echo off
echo Starting Improv Practice backend...
cd /d "%~dp0backend"
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt -q
echo.
echo Backend running at http://localhost:8000
echo Press Ctrl+C to stop.
uvicorn main:app --reload --port 8000
