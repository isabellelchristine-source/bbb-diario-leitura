#!/bin/bash
# Dá dois cliques neste arquivo para importar o histórico de leitura (as listas da Belle e da Bia).
# IMPORTANTE: feche a janela do "Abrir BBB.command" antes de rodar este aqui, se estiver aberta.
cd "$(dirname "$0")/server"
if [ ! -d "node_modules" ]; then
  echo "Preparando (só na primeira vez)..."
  npm install
fi
node import-historico.js
echo ""
echo "Pode fechar esta janela e abrir o BBB normalmente."
read -p "Pressione Enter para fechar..."
