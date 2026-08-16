#!/bin/bash
# Dá dois cliques neste arquivo pra preparar tudo que precisa pra hospedar o BBB de graça:
# cria o banco de dados na nuvem (Turso) e sobe o código pro GitHub, pronto pra conectar no Render.
# É seguro rodar de novo — ele pula o que já foi feito.
set -e
cd "$(dirname "$0")"

echo "===== Preparando o BBB pra nuvem gratuita ====="
echo ""

# ---------- 1. Turso (banco de dados) ----------
if ! command -v turso >/dev/null 2>&1; then
  echo "Instalando a ferramenta do Turso (só na primeira vez)..."
  brew tap libsql/sqld >/dev/null 2>&1 || true
  if ! brew install tursodatabase/tap/turso; then
    echo "O Homebrew não conseguiu — tentando o instalador oficial do Turso..."
    curl -sSfL https://get.tur.so/install.sh | bash
    export PATH="$HOME/.turso:$PATH"
  fi
fi

if ! command -v turso >/dev/null 2>&1; then
  echo ""
  echo "Não consegui instalar o Turso automaticamente. Feche esta janela e me avise —"
  echo "vou te passar um jeito manual de instalar."
  read -p "Pressione Enter para fechar..."
  exit 1
fi

if ! turso auth whoami >/dev/null 2>&1; then
  echo ""
  echo "Vai abrir o navegador pra você criar sua conta (ou entrar) no Turso — é grátis, sem cartão."
  read -p "Pressione Enter para continuar..."
  turso auth signup || turso auth login
fi

DB_NAME="bbb-diario"
if ! turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo ""
  echo "Criando seu banco de dados na nuvem..."
  turso db create "$DB_NAME"
fi

TURSO_URL=$(turso db show "$DB_NAME" --url)
TURSO_TOKEN=$(turso db tokens create "$DB_NAME" --expiration never)

echo ""
echo "✅ Banco de dados pronto."
echo ""
echo "Copiando o histórico de leitura que você já tem pra esse banco novo..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
fi
TURSO_DATABASE_URL="$TURSO_URL" TURSO_AUTH_TOKEN="$TURSO_TOKEN" node import-historico.js
cd ..

# ---------- 2. GitHub (código) ----------
if ! command -v gh >/dev/null 2>&1; then
  echo ""
  echo "Instalando a ferramenta do GitHub (só na primeira vez)..."
  brew install gh
fi

if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "Vai abrir o navegador pra você entrar (ou criar conta) no GitHub."
  read -p "Pressione Enter para continuar..."
  gh auth login
fi

if [ ! -d ".git" ]; then
  git init -q
  git add -A
  git commit -q -m "BBB - diário de leitura"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo ""
  echo "Criando o repositório privado no GitHub e enviando o código..."
  gh repo create bbb-diario-leitura --private --source=. --remote=origin --push
else
  git add -A
  git commit -q -m "Atualização do BBB" || echo "(nada novo pra atualizar)"
  git push origin HEAD
fi

echo ""
echo "===================================================================="
echo "  Pronto! Guarde essas duas informações — você vai colar no Render"
echo "  daqui a pouco:"
echo ""
echo "  TURSO_DATABASE_URL = $TURSO_URL"
echo "  TURSO_AUTH_TOKEN   = $TURSO_TOKEN"
echo ""
echo "  Agora siga o passo a passo do README na seção 'Publicar de graça'"
echo "  pra criar o serviço no Render (é só clicar em algumas telas)."
echo "===================================================================="
read -p "Pressione Enter para fechar..."
