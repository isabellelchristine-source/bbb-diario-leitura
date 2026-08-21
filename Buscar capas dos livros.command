#!/bin/bash
# Dá dois cliques neste arquivo para tentar buscar automaticamente a capa dos livros
# que ainda não têm (usa a internet — feche o "Abrir BBB.command" antes de rodar).
cd "$(dirname "$0")/server"
if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi
node enrich-covers.js
echo ""
read -p "Pressione Enter para fechar..."
