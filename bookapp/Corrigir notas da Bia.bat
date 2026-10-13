@echo off
chcp 65001 >nul
title BBB - corrigir notas da Bia
REM Corrige notas/anos/status da Bia no site publicado. Nao mexe em cartas, comentarios, diario ou capas.
cd /d "%~dp0server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao esta instalado neste computador.
  echo  Baixe em https://nodejs.org  ^(botao verde, versao LTS^), instale e tente de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  Preparando ^(so na primeira vez^)...
  call npm install
)

echo.
set /p TURSO_DATABASE_URL=Cole aqui a Database URL do Turso (algo como libsql://...) e aperte Enter: 
set /p TURSO_AUTH_TOKEN=Cole aqui o Auth Token do Turso e aperte Enter: 
echo.

node corrigir-notas-bia.js

echo.
pause
