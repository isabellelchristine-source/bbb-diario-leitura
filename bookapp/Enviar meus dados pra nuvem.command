#!/bin/bash
# Dá dois cliques neste arquivo pra enviar tudo que está no seu computador (livros, cartas,
# sua senha de verdade) pro site publicado (Turso/Render). Rode sempre que adicionar algo
# localmente e quiser que o site publicado fique igual.
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi

echo "Cole aqui a Database URL do Turso (algo como libsql://...) e aperte Enter:"
read -r TURSO_URL
echo "Cole aqui o Auth Token do Turso e aperte Enter:"
read -r TURSO_TOKEN

TURSO_DATABASE_URL="$TURSO_URL" TURSO_AUTH_TOKEN="$TURSO_TOKEN" node sync-para-nuvem.js

echo ""
read -p "Pressione Enter para fechar..."
