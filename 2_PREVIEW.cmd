@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto failed
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node
call npm run setup
if errorlevel 1 goto failed
call npm run validate
if errorlevel 1 goto failed
echo.
echo Open http://localhost:4000 in your browser after the server starts.
echo Keep this window open. Press Ctrl+C to stop.
call npm run dev
if errorlevel 1 goto failed
popd
pause
exit /b 0

:missing_node
echo [ERROR] Install Node.js 24, then close and reopen this window.
goto failed

:failed
echo.
echo [ERROR] The operation failed. Read the error above.
echo Copy the last lines of this window when asking for help.
popd
pause
exit /b 1
