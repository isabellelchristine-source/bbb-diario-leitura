#!/bin/bash
# Dá dois cliques neste arquivo pra corrigir, no site publicado (Turso/Render), as notas,
# os anos e o status (Lido/Abandonei) de cada livro da Bia — usando os dados reais do
# diário de leitura dela. Não mexe em cartas, comentários, diário ou capas de ninguém.
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi

echo "Cole aqui a Database URL do Turso (algo como libsql://...) e aperte Enter:"
read -r TURSO_URL
echo "Cole aqui o Auth Token do Turso e aperte Enter:"
read -r TURSO_TOKEN

TURSO_DATABASE_URL="$TURSO_URL" TURSO_AUTH_TOKEN="$TURSO_TOKEN" node corrigir-notas-bia.js

echo ""
read -p "Pressione Enter para fechar..."
