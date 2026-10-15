@echo off
echo ========================================================
echo Starting Airflow System...
echo ========================================================
echo.

echo [1/3] Starting Docker Desktop...
start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"

echo [2/3] Waiting for Docker Engine to be ready (may take 1-2 minutes)...
:WAIT_DOCKER
docker info >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 >nul
    goto WAIT_DOCKER
)

echo [3/3] Docker is ready! Starting Airflow...
cd /d "%~dp0"
docker-compose up -d

echo.
echo ========================================================
echo SUCCESS!
echo Check the status on your Control Panel.
exit
