@echo off
chcp 65001 >nul
title BBB - diario de leitura
cd /d "%~dp0server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao esta instalado neste computador.
  echo  Baixe em https://nodejs.org  ^(botao verde, versao LTS^), instale,
  echo  feche esta janela e de dois cliques aqui de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Preparando o BBB. So na primeira vez - pode levar um minutinho...
  echo.
  call npm install
)

echo.
echo  Abrindo o BBB... o navegador abre sozinho em alguns segundos.
echo  IMPORTANTE: deixe esta janela aberta enquanto estiver usando o app.
echo.
start "" /min "%~dp0_abrir-navegador.bat"
call npm run dev

echo.
echo  O BBB foi encerrado.
pause
