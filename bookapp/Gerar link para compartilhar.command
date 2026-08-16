#!/bin/bash
# Dá dois cliques neste arquivo para gerar um link público (temporário) do BBB,
# pra quem estiver rodando esse arquivo mandar pro outro lado acessar de qualquer lugar.
# Este computador precisa continuar ligado e com esta janela aberta enquanto a outra
# pessoa estiver usando o app.
cd "$(dirname "$0")"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Preciso instalar uma ferrramenta chamada 'cloudflared' primeiro (só na primeira vez)."
  if command -v brew >/dev/null 2>&1; then
    echo "Instalando com o Homebrew..."
    brew install cloudflared
  else
    echo ""
    echo "Não encontrei o Homebrew nesse Mac. Instale o cloudflared manualmente:"
    echo "1. Abra: https://github.com/cloudflare/cloudflared/releases/latest"
    echo "2. Baixe o arquivo 'cloudflared-darwin-amd64.pkg' (ou -arm64 se for Mac M1/M2/M3/M4) e instale."
    echo "3. Depois disso, dê dois cliques neste arquivo de novo."
    read -p "Pressione Enter para fechar..."
    exit 1
  fi
fi

echo ""
echo "Ligando o BBB..."
cd server
npm run dev > /tmp/bbb-server.log 2>&1 &
SERVER_PID=$!
sleep 2

echo "Gerando o link público (pode levar alguns segundos)..."
echo ""
echo "=================================================================="
echo "  Assim que o link aparecer abaixo (algo como https://xxxx.trycloudflare.com),"
echo "  copie e mande pra outra pessoa. Ela só precisa clicar — não instala nada."
echo "=================================================================="
echo ""

cloudflared tunnel --url http://localhost:4173

kill $SERVER_PID 2>/dev/null
