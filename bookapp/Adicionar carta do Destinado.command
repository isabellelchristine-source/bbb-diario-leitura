#!/bin/bash
# Dá dois cliques neste arquivo pra colocar, no site publicado, a carta de verdade que a Bia
# escreveu sobre o livro "Destinado" (Carina Rissi) — vinda do Canva. Só mexe na resenha
# desse livro específico; não toca em nota, status, datas ou qualquer outra coisa.
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi

echo "Cole aqui a Database URL do Turso (algo como libsql://...) e aperte Enter:"
read -r TURSO_URL
echo "Cole aqui o Auth Token do Turso e aperte Enter:"
read -r TURSO_TOKEN

TURSO_DATABASE_URL="$TURSO_URL" TURSO_AUTH_TOKEN="$TURSO_TOKEN" node adicionar-carta-destinado.js

echo ""
read -p "Pressione Enter para fechar..."
