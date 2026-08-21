#!/bin/bash
# Dá dois cliques neste arquivo pra buscar automaticamente a capa dos livros que ainda não
# têm, só que direto no banco de dados publicado (Turso) — o mesmo que o site no Render usa.
# Diferente do "Buscar capas dos livros.command" (que só mexe na cópia do seu computador),
# este aqui atualiza direto o que vocês duas veem no site de verdade.
# Pode demorar alguns minutos (tem bastante livro sem capa) — é seguro rodar mais de uma vez.
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi

echo "Cole aqui a Database URL do Turso (algo como libsql://...) e aperte Enter:"
read -r TURSO_URL
echo "Cole aqui o Auth Token do Turso e aperte Enter:"
read -r TURSO_TOKEN

TURSO_DATABASE_URL="$TURSO_URL" TURSO_AUTH_TOKEN="$TURSO_TOKEN" node enrich-covers.js

echo ""
echo "Pronto! Abra o site publicado (o link .onrender.com) e dê um F5 pra ver as capas novas."
read -p "Pressione Enter para fechar..."
