@echo off
setlocal
echo ================================================
echo QuadraConverter v4 - Windows setup
echo ================================================
node -v
if errorlevel 1 (
  echo Node.js LTS is required.
  pause
  exit /b 1
)
npm -v
if errorlevel 1 (
  echo npm is required.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example
)
echo Installing frontend dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed. Check your internet connection and Node.js version.
  pause
  exit /b 1
)
echo.
echo Next:
echo 1. Open .env and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
echo 2. Run the SQL migrations in supabase\migrations in Supabase.
echo 3. Enable Google in Supabase Authentication ^> Providers ^> Google.
echo 4. Run START_FRONTEND.bat
echo.
pause
