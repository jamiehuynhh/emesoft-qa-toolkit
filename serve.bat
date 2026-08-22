@echo off
REM ============================================================================
REM  AI QA Toolkit - start a local web server and open the toolkit
REM  Serving over http:// is needed for the AI tools (CORS) and Web Crypto.
REM  Opening index.html directly also works for every offline tool.
REM ============================================================================
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python -c "import sys" >nul 2>nul
  if %ERRORLEVEL%==0 (
    echo Serving with Python on http://localhost:8123/
    start "" http://localhost:8123/
    python -m http.server 8123
    goto :eof
  )
)

echo Serving with PowerShell on http://localhost:8123/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8123
