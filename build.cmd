@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Потрібен Node.js: https://nodejs.org & pause & exit /b 1)
node tools\build.js --run %*
if errorlevel 1 pause
