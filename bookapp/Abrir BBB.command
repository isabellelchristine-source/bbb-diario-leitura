#!/bin/bash
# Dá dois cliques neste arquivo para abrir o BBB.
cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
  echo "Preparando o BBB (só na primeira vez, pode demorar um minutinho)..."
  npm install
fi

echo "Abrindo o BBB..."
(sleep 1.5 && open "http://localhost:4173") &
npm run dev
