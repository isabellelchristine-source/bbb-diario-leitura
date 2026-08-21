# 📖 BBB — diário de leitura

## Como abrir (bem simples)

1. Abra a pasta `bookapp`.
2. Dê **dois cliques** no arquivo **"Abrir BBB.command"**.
3. Vai abrir uma janela preta (Terminal) — é normal, só deixe ela aberta. Depois de alguns segundos o navegador abre sozinho com o app.
4. Na primeira vez, você vai criar seu perfil (nome, @usuário e senha). Depois disso, na tela de login vai ter a opção **"Nova usuária"** para sua amiga criar o perfil dela.

Importante: a janela preta do Terminal precisa continuar aberta enquanto você estiver usando o app. Se fechar ela, o app para de funcionar. Para usar de novo depois, é só dar dois cliques no arquivo de novo.

Se ao clicar aparecer um aviso de segurança do Mac ("desenvolvedor não identificado"), clique com o botão direito no arquivo → **Abrir** → **Abrir** de novo na caixa de confirmação. Isso só é necessário na primeira vez.

Pré-requisito: seu Mac precisa ter o [Node.js](https://nodejs.org) instalado (qualquer versão recente). Se não tiver, baixe nesse site e instale antes do primeiro uso. Na primeira vez que abrir, ele também baixa uma dependência (leva alguns segundos a mais só dessa vez).

## Importar o histórico de leitura de vocês duas

Já preparei a importação do diário de leitura que você tinha (a lista da Belle com notas, e a lista de livros que a Bia já leu). Pra trazer tudo isso pro app de uma vez:

1. Se o BBB estiver aberto, **feche a janela preta do Terminal** primeiro.
2. Dê dois cliques em **"Importar histórico.command"**.
3. Uma janela do Terminal vai mostrar o que foi importado e fecha sozinha quando você apertar Enter.
4. Agora é só abrir o BBB normalmente — os livros já vão estar nas estantes de vocês duas, marcados como lidos (e com as notas da Belle).

Detalhes importantes:
- Se o perfil da Belle já existir (o que você criou), a senha dele **não muda** — a importação só adiciona os livros.
- Como a Bia ainda não tinha perfil, a importação cria um perfil pra ela com usuário **bia** e senha temporária **trocarSenha123**. Assim que ela entrar, pode trocar a senha em "Editar perfil".
- Pode rodar esse importador mais de uma vez sem medo — ele nunca duplica um livro que já foi importado.

## Corrigir as notas da Bia (uma vez só)

A primeira importação da lista da Bia só tinha os títulos dos livros, sem nota, ano ou status — por isso as estatísticas dela apareciam zeradas. Agora com o diário de leitura completo da Bia, dá pra corrigir isso no site publicado:

1. Dê dois cliques em **"Corrigir notas da Bia.command"**.
2. Cole a Database URL e o Auth Token do Turso quando for pedido (os mesmos que você usa em "Enviar meus dados pra nuvem").
3. Aguarde a mensagem de conclusão no Terminal.

Esse script só preenche nota, status (Lido/Abandonei) e ano de término de livros que ainda estavam do jeito que vieram da importação antiga (sem nota e sem resenha escrita). Se a Bia já tiver dado nota ou escrito algo em algum desses livros pelo próprio app, ele pula esse livro e avisa no final — nada de cartas, comentários, diário ou capas é apagado ou sobrescrito. Também pode rodar mais de uma vez sem problema.

## Compartilhar com a Bia (ela está em outro lugar)

O BBB roda no computador de quem estiver com a pasta `bookapp` aberta — essa pessoa "hospeda" o app, e a outra acessa por um link. Como o notebook da Isabelle é corporativo e tem um bloqueio de segurança que impede gerar esse link por lá, a solução é a **Bia hospedar** (rodar o servidor no computador dela) e a Isabelle acessar remotamente. Funciona igual, só troca quem roda o quê:

**No computador da Bia** (precisa ter [Node.js](https://nodejs.org) 22.5+ instalado, igual explicado lá em cima):
1. Isabelle manda a pasta `bookapp` inteira pra Bia (por WeTransfer, Google Drive, AirDrop, etc — ela já vem com todos os livros e cartas que já foram cadastrados).
2. Bia descompacta em qualquer lugar do computador dela.
3. Bia dá dois cliques em **"Gerar link para compartilhar.command"**.
4. Depois de alguns segundos aparece um link tipo `https://alguma-coisa.trycloudflare.com`. Ela manda esse link pra Isabelle.

**Na Isabelle**: só abrir esse link no navegador (ou instalar como app — veja a seção abaixo) e usar normalmente.

Importante:
- Esse link é temporário: toda vez que a Bia rodar esse arquivo de novo, o link muda. Então cada vez que forem usar juntas, ela reenvia o link novo.
- O computador da Bia precisa continuar ligado e com essa janela aberta enquanto a Isabelle estiver usando o app.
- (O arquivo antigo "Compartilhar com a Bia.command" ainda existe na pasta e faz a mesma coisa — pode ignorar ou apagar, o novo tem esse nome mais genérico porque agora é a Bia quem roda essa parte.)

Essa opção acima é uma alternativa gratuita, mas com o "porém" de precisar deixar um computador ligado. O caminho recomendado (decidimos ir de graça, sem depender de computador nenhum ligado) é o próximo:

## Publicar de graça (recomendado — Render + Turso, sempre no ar)

Isso coloca o BBB pra rodar sozinho na internet, 24h, sem depender do computador de ninguém, sem custar nada. Usei duas ferramentas gratuitas: **Turso** (guarda os dados) e **Render** (roda o app).

Como o notebook corporativo bloqueia instalar ferramentas novas de linha de comando (o "Santa" da Nubank), vamos fazer tudo **pelo navegador** — sem instalar nada de novo, só o Terminal pra um comando bem simples no meio.

**Etapa 1 — criar o banco de dados (Turso, pelo navegador):**

1. Acesse [app.turso.tech/signup](https://app.turso.tech/signup) e crie uma conta grátis (dá pra usar GitHub ou Google, sem cartão).
2. No painel, clique em **Create Database** (ou "New Database"). Dê o nome que quiser, ex: `bbb-diario`.
3. Depois de criado, abra os detalhes do banco e procure a **URL de conexão** (começa com `libsql://...`) e a opção de **criar um token** (Create Token / Auth Token). Copie os dois — vai precisar deles daqui a pouco.

**Etapa 2 — subir o código (GitHub, pelo navegador):**

1. Acesse [github.com/new](https://github.com/new) e crie uma conta grátis, se ainda não tiver.
2. Crie um repositório novo, **privado**, com o nome `bbb-diario-leitura` (deixe todas as outras opções como estão) e clique em **Create repository**.
3. Na página que abrir, clique no link **"uploading an existing file"**.
4. No Finder, abra a pasta `bookapp` e arraste a pasta inteira (ou todo o conteúdo dela) pra dentro da página do GitHub no navegador.
5. Espere o envio terminar e clique em **Commit changes**.

**Etapa 3 — copiar seu histórico pro banco novo (um comandinho só):**

1. Abra o Terminal (Spotlight → digite "Terminal" → Enter).
2. Cole esse comando trocando pelos valores que você copiou do Turso, e aperte Enter:

   ```
   cd "/Users/isabelle.santos/Documents/Claude/Projects/BBB/bookapp/server" && npm install && TURSO_DATABASE_URL="cole_a_url_aqui" TURSO_AUTH_TOKEN="cole_o_token_aqui" node import-historico.js
   ```
3. Ele mostra na tela quantos livros foram importados.

Se aparecer algum aviso de segurança bloqueando esse comando (parecido com o do Turso), me manda um print — vamos contornar do mesmo jeito.

**Etapa 4 — criar o serviço no Render (pelo navegador):**

1. Acesse [render.com](https://render.com) e crie uma conta gratuita (pode ser com o GitHub que você acabou de criar).
2. Clique em **New +** → **Web Service**.
3. Conecte sua conta do GitHub e escolha o repositório **bbb-diario-leitura**.
4. Deixe as opções padrão (o Render detecta sozinho que é Node.js) e escolha o plano **Free**.
5. Antes de clicar em criar, procure a seção **Environment Variables** e adicione as mesmas duas de antes:
   - `TURSO_DATABASE_URL` = (a URL que começa com `libsql://...`)
   - `TURSO_AUTH_TOKEN` = (o token)
6. Clique em **Create Web Service**. Espere uns 2-3 minutos — o Render mostra o progresso na tela.
7. Quando terminar, o link do BBB aparece no topo da página (algo como `https://bbb-diario-leitura.onrender.com`). Esse link é fixo — pode mandar pra Bia, instalar como app no celular, usar sempre.

Detalhe: no plano grátis do Render, se ninguém usar o app por 15 minutos, ele "dorme" — a próxima pessoa que abrir espera uns 30-60 segundos na primeira tela antes de carregar. Depois disso funciona normal até dormir de novo.

Sempre que eu fizer algum ajuste no app depois, você vai precisar repetir só a Etapa 2 (subir os arquivos atualizados de novo pelo GitHub) — o Render publica sozinho assim que detectar a mudança.

Se alguma tela parecer diferente do que descrevi (esses sites mudam o design de vez em quando), me manda um print que eu te ajudo a achar o botão certo.

<details>
<summary>Alternativa paga (Railway, ~US$5/mês) — caso prefira no futuro</summary>

Deixei pronta também uma opção paga mais simples de configurar (um clique só): dê dois cliques em **"Publicar na nuvem.command"**. Ele cria conta na Railway, publica o app e mostra um link fixo. Só é cobrado se você ativar o plano Hobby da Railway quando ele pedir.
</details>

## Para usar no celular também

Se vocês publicaram o BBB na nuvem (seção acima), é o jeito mais simples:

1. Abra o link fixo (tipo `https://bbb-diario-leitura.onrender.com`) no navegador do celular.
2. No Safari (iPhone) ou Chrome (Android), toque em compartilhar/menu → **"Adicionar à Tela de Início"** para instalar como um app de verdade, com ícone.

Sem publicar na nuvem, também dá pra usar só na mesma Wi-Fi do computador:

1. Com o BBB aberto no computador, descubra o IP dele: `Ajustes do Sistema → Wi-Fi → Detalhes`.
2. No navegador do celular, digite `http://SEU-IP:4173` (por exemplo `http://192.168.0.12:4173`).
3. Mesma coisa: adicione à Tela de Início pra virar um app.

## Buscar capas dos livros automaticamente

Se muitos livros importados ficaram sem capa (ícone genérico 📖), dá pra tentar buscar automaticamente:

1. Feche o "Abrir BBB.command" se estiver aberto.
2. Dê dois cliques em **"Buscar capas dos livros.command"**.
3. Ele tenta achar a capa de cada livro sem capa (usa Google Books e Open Library, nessa ordem) e mostra o progresso.

Isso depende da internet do computador conseguir acessar essas APIs — se você estiver numa rede de trabalho com bloqueios, pode não funcionar bem; nesse caso, cadastre a capa manualmente (veja abaixo). Pode rodar de novo quando quiser, ele só tenta os livros que ainda não têm capa.

**Adicionando capa manualmente:** na página de qualquer livro sem capa, tem um link "+ adicionar capa". Ele abre uma busca de imagem no Google — é só clicar com o botão direito na imagem certa, "Copiar link da imagem", e colar no campo. O mesmo vale ao cadastrar um livro novo manualmente.

## O que já dá pra fazer

- Cada uma tem seu perfil, com foto/cor, bio e estatísticas próprias
- Estante organizada por: Lendo, Lido, Quero ler, Pausado, Abandonei
- Buscar livro por título/autor (ou cadastrar manualmente, com busca de capa)
- Atualizar a página atual e ver a barra de progresso mudar sozinha
- Escrever no diário de leitura (texto + emoji + página)
- Ver o perfil da amiga: o que ela está lendo, o diário dela, histórico e cartas
- Reagir com emoji e **comentar de verdade** (texto) nas atualizações uma da outra — tudo fica guardado dentro do livro, não solto numa lista
- Quando as duas leem o mesmo livro, uma tela especial compara o progresso lado a lado (e esconde spoiler até você decidir ver)
- **Resenha em formato de carta** ("Querida [nome]..."), com trecho/página favorita e opção de marcar como **pública** (a outra pode ler) ou **privada** (só sua)
- Notinha vermelha na aba "Amiga" contando o que aconteceu ("Bia comentou em...", "Bia terminou..."), que já leva direto pro livro certo ao clicar
- Estatísticas, gráfico de livros lidos por mês, comparação entre vocês duas
- Meta de leitura do ano com barra de progresso

## Sobre notificações no celular

Uma notificação de verdade (que chega mesmo com o app fechado) ainda não existe — o que tem hoje é a notinha vermelha na aba "Amiga" quando abrir o app e ela tiver atualizado algo. Agora que o BBB está publicado na nuvem (endereço público de verdade), dá sim pra implementar notificação push de verdade depois, se vocês quiserem — é só pedir.

## Seus dados

- **Se estiver usando localmente** (pelo "Abrir BBB.command"): tudo fica salvo num arquivo dentro da pasta `server/data`. Não apague essa pasta — de vez em quando vale copiar pro Google Drive/iCloud como backup.
- **Se publicaram na nuvem** (Render + Turso): os dados ficam guardados no Turso, com backup automático deles — não depende de nenhum computador de vocês.

## Se quiser mexer no código depois

O app foi feito só com Node.js e JavaScript puro, sem instalação de pacotes — então dá pra abrir os arquivos e editar direto. Qualquer ajuste (cores, textos, novas funções), é só pedir.
