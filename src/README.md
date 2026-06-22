# ⚔️ GuildWork - The Office Quest

Bem-vindo à GuildWork! Este é um sistema de gestão de tarefas gamificado projetado para transformar o fluxo de trabalho diário (estilo Jira/Trello) em uma experiência de RPG. Os funcionários (Aventureiros) ganham XP, sobem de nível e acumulam Ouro (Gold) para trocar por itens reais na Forja (Loja), enquanto o Mestre da Guilda (Admin) monitora o desempenho e o SLA de cada entrega.

## 🛠️ Stack Tecnológico

A arquitetura foi desenhada para ser leve, rápida e com forte validação de regras no Back-end (orientada a Qualidade e Segurança):

* **Front-end:** HTML5, CSS3 (variáveis globais e animações customizadas) e Vanilla JavaScript. Estética em Pixel Art.
* **Back-end:** Node.js com Express. Arquitetura RESTful e *stateless*.
* **Banco de Dados:** MongoDB utilizando Mongoose (com esquemas estritos para evitar anomalias de dados).
* **Segurança:** Autenticação via JWT (JSON Web Token) e encriptação de senhas com bcryptjs. O servidor é a única "fonte da verdade" para cálculos de economia e gamificação.

## 📂 Arquitetura de Diretórios

O monolito está dividido em dois grandes reinos:

\`\`\`text
GUILDWORK/
├── src/
│   ├── backend/
│   │   ├── controllers/   # Lógica de negócio (gamificação, economia, auth)
│   │   ├── middleware/    # Proteção de rotas (validação JWT e Role-based access)
│   │   ├── models/        # Schemas do Mongoose (User, Quest, Sprint, LootItem)
│   │   ├── routes/        # Roteamento RESTful da API
│   │   └── server.js      # Ponto de entrada do servidor Node
│   └── frontend/
│       ├── assets/imgs/   # Sprites e texturas
│       ├── css/           # style.css (Modularizado por componentes)
│       ├── js/            # Lógica de interface (mural.js, admin.js, login.js)
│       └── *.html         # Telas (index, admin, loja, login)
├── .env                   # Variáveis de ambiente (NÃO COMITAR)
└── package.json           # Dependências e scripts
\`\`\`

## 📜 Regras de Negócio (Core Mechanics)

1.  **Economia Blindada (Server-Side Authority):** O Front-end não dita recompensas. Quando uma missão é clicada, o Front envia apenas o \`questId\`. O Back-end consulta o valor real da missão, aplica multiplicadores (como a nota CSAT para suporte) e devolve o novo saldo do jogador.
2.  **SLA e A Maldição:** Missões possuem tempo limite dinâmico (\`sla_seconds\`). Se o tempo estourar no Front-end, o jogador entra em estado de "Amaldiçoado".
3.  **Penalidade Rigorosa:** A resolução de uma maldição ocorre exclusivamente no Back-end. Entregar uma missão enquanto amaldiçoado corta os ganhos de XP e Gold pela metade.
4.  **Prevenção de Exploit na Loja:** Compras de itens não aceitam "carrinhos" com preços manipulados. O servidor recebe os IDs dos itens, recalcula o total baseando-se no banco de dados e só então debita do saldo do jogador.

## 🚀 Como Rodar o Projeto (Setup Local)

1.  **Clone e Dependências:**
    Na pasta raiz do projeto, instale as dependências do Node:
    \`\`\`bash
    npm install
    \`\`\`
2.  **Variáveis de Ambiente:**
    Crie um arquivo \`.env\` na raiz do projeto com as seguintes chaves:
    \`\`\`env
    PORT=3001
    MONGODB_URI=mongodb://localhost:27017/guildwork
    JWT_SECRET=sua_chave_super_secreta_aqui
    \`\`\`
3.  **Iniciando a Forja:**
    Utilize o script de desenvolvimento para iniciar o servidor com Nodemon (atualização automática ao salvar arquivos):
    \`\`\`bash
    npm run dev
    \`\`\`
4.  **Acessando:**
    Abra o Front-end em seu navegador local através de uma extensão como o *Live Server* do VS Code apontando para \`src/frontend/login.html\`.

## 🗺️ Backlog e Próximos Épicos (Onde precisamos de ajuda!)

O "Core" do jogo está estabilizado e seguro. Nosso foco agora é refatoração arquitetural para escalabilidade:

* **[ÉPICO 1] Quebra do Monolito Front-end:** Fatiar o gigante \`admin.html\` e \`admin.js\` em telas modulares separadas (\`admin-roster\`, \`admin-quests\`, \`admin-loot\`).
* **[ÉPICO 2] Separação de Domínios no Back-end:** Extrair as rotas de criação de Quests e Loot que atualmente residem em \`admin.js\` e movê-las para seus respectivos controladores de domínio (\`quests.js\` e \`loot.js\`).
* **[ÉPICO 3] Sprints Dinâmicas:** Migrar as variáveis fixas de Meta de Sprint do Front-end para serem consumidas dinamicamente do banco de dados, permitindo gestão real de Sprints pelo Admin.