@echo off
chcp 65001 >nul
title BBB - buscar capas
rem Feche a janela do "Abrir BBB.bat" antes de rodar este aqui. Precisa de internet.
cd /d "%~dp0server"
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js nao esta instalado. Baixe em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo  Preparando. So na primeira vez...
  call npm install
)
node enrich-covers.js
echo.
pause
