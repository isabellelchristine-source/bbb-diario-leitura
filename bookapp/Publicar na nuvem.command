#!/bin/bash
# Dá dois cliques neste arquivo pra colocar o BBB num servidor sempre ligado (Railway),
# pra você e a Bia acessarem de qualquer lugar sem depender do computador de ninguém.
# Rode este arquivo de novo sempre que eu fizer alguma atualização — ele publica de novo.
cd "$(dirname "$0")"

echo "===== Publicando o BBB na nuvem ====="
echo ""

if ! command -v railway >/dev/null 2>&1; then
  echo "Instalando a ferramenta da Railway (só na primeira vez)..."
  npm install -g @railway/cli
fi

if ! railway whoami >/dev/null 2>&1; then
  echo ""
  echo "Vai abrir o navegador pra você entrar (ou criar sua conta) na Railway."
  read -p "Pressione Enter para continuar..."
  railway login
fi

FIRST_TIME=false
if ! railway status >/dev/null 2>&1; then
  FIRST_TIME=true
fi

echo ""
if [ "$FIRST_TIME" = true ]; then
  echo "Criando o projeto e publicando pela primeira vez (pode demorar um pouco)..."
  railway up -y
else
  echo "Publicando a atualização mais recente..."
  railway up
fi

if [ "$FIRST_TIME" = true ]; then
  echo ""
  echo "Configurando o armazenamento permanente (pra nada se perder)..."
  railway volume add --mount-path /data
  railway variable set DATA_DIR=/data

  if [ -f "server/data/bookapp.db" ]; then
    echo "Copiando os livros e cartas que você já tem pra nuvem..."
    railway volume files upload server/data/bookapp.db /bookapp.db --overwrite
  fi

  echo ""
  echo "Gerando o endereço público..."
  railway domain

  echo ""
  echo "Publicando de novo agora que o armazenamento está configurado..."
  railway up
fi

echo ""
echo "===================================================================="
echo "  Pronto! O endereço do seu BBB (algo como"
echo "  https://bbb-production-xxxx.up.railway.app) está em alguma"
echo "  linha aqui em cima. Esse link é fixo — não muda mais, e funciona"
echo "  mesmo com o computador desligado. Pode mandar pra Bia."
echo ""
echo "  Se aparecer algum aviso pedindo pra adicionar forma de pagamento,"
echo "  acesse https://railway.app/account/plans, ative o plano Hobby,"
echo "  e rode este arquivo de novo."
echo "===================================================================="
read -p "Pressione Enter para fechar..."
