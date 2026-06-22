# ⚔️ GuildWork - The Office Quest

Bem-vindo à GuildWork! Este é um sistema de gestão de tarefas gamificado projetado para transformar o fluxo de trabalho diário (estilo Jira/Trello) em uma experiência de RPG. Os funcionários (Aventureiros) ganham XP, sobem de nível e acumulam Ouro (Gold) para trocar por itens reais na Forja (Loja), enquanto o Mestre da Guilda (Admin) monitora o desempenho e o SLA de cada entrega.

## 🛠️ Stack Tecnológico

A arquitetura foi desenhada para ser leve, rápida e com forte validação de regras no Back-end (orientada a Qualidade e Segurança):

* **Front-end:** HTML5, CSS3 (variáveis globais e animações customizadas) e Vanilla JavaScript. Estética em Pixel Art servido localmente via lite-server.
* **Back-end:** Node.js (v24 LTS) com Express. Arquitetura RESTful e stateless.
* **Banco de Dados:** MongoDB rodando em container Docker utilizando Mongoose (com esquemas estritos para evitar anomalias de dados).
* **Segurança:** Autenticação via JWT (JSON Web Token) e encriptação de senhas com bcryptjs/bcrypt. O servidor é a única "fonte da verdade" para cálculos de economia e gamificação.

## 📂 Arquitetura de Diretórios

A estrutura do projeto está dividida em subprojetos modulares gerenciados de forma independente por seus próprios pacotes npm:

GUILDWORK/
├── mongo-init/
│   └── init-db.js         # Script de carga automática de usuários padrão (Seed)
├── src/
│   ├── backend/
│   │   ├── controllers/   # Lógica de negócio (gamificação, economia, auth)
│   │   ├── middleware/    # Proteção de rotas (validação JWT e Role-based access)
│   │   ├── models/        # Schemas do Mongoose (User, Quest, Sprint, LootItem)
│   │   ├── routes/        # Roteamento RESTful da API
│   │   ├── .env           # Variáveis de ambiente específicas do back-end (NÃO COMITAR)
│   │   ├── package.json   # Dependências e scripts do servidor Node
│   │   └── server.js      # Ponto de entrada do servidor Node
│   └── frontend/
│       ├── assets/imgs/   # Sprites e texturas
│       ├── css/           # style.css (Modularizado por componentes)
│       ├── js/            # Lógica de interface (mural.js, admin.js, login.js)
│       ├── package.json   # Dependências e scripts do servidor estático lite-server
│       └── *.html         # Telas (index, admin, loja, login)
├── .gitignore             # Proteção para não commitar node_modules e arquivos .env
└── docker-compose.yml     # Orquestração do banco de dados MongoDB

## 📜 Regras de Negócio (Core Mechanics)

1. **Economia Blindada (Server-Side Authority):** O Front-end não dita recompensas. Quando uma missão é clicada, o Front envia apenas o questId. O Back-end consulta o valor real da missão, aplica multiplicadores (como a nota CSAT para suporte) e devolve o novo saldo do jogador.
2. **SLA e A Maldição:** Missões possuem tempo limite dinâmico (sla_seconds). Se o tempo estourar no Front-end, o jogador entra em estado de "Amaldiçoado".
3. **Penalidade Rigorosa:** A resolução de uma maldição ocorre exclusivamente no Back-end. Entregar uma missão enquanto amaldiçoado corta os ganhos de XP e Gold pela metade.
4. **Prevenção de Exploit na Loja:** Compras de itens não aceitam "carrinhos" com preços manipulados. O servidor recebe os IDs dos itens, recalcula o total baseando-se no banco de dados e só então debita do saldo do jogador.

## 🚀 Como Rodar o Projeto (Setup Local)

### 1. Inicializando o Banco de Dados (Docker)
Na pasta raiz do projeto (onde está o arquivo docker-compose.yml), execute o comando para subir a instância do MongoDB em segundo plano:
docker compose up -d

Nota: Na primeira execução, o script contido em mongo-init/init-db.js criará automaticamente o banco de dados e populará a coleção users com as contas padrão (admin e funcionario, ambas com a senha 123) já criptografadas de forma idêntica ao ecossistema local.

### 2. Configurando e Inicializando o Back-end
Navegue até o diretório do back-end, garanta a existência das variáveis de ambiente e suba o servidor:
cd src/backend

Crie um arquivo chamado .env nesta pasta com as seguintes chaves:
PORT=3001
MONGODB_URI=mongodb://guild_admin:guild_password@localhost:27017/guildwork?authSource=admin
JWT_SECRET=sua_chave_super_secreta_aqui

Instale os pacotes e inicialize o servidor com atualização automática via Nodemon:
npm install
npm run dev

O servidor back-end iniciará na porta 3001.

### 3. Configurando e Inicializando o Front-end
Abra uma nova aba ou janela do seu terminal, navegue até o diretório do front-end e inicialize o servidor de desenvolvimento estático:
cd src/frontend
npm install
npm run dev

O lite-server será inicializado, disponibilizando a aplicação na porta 3000 e abrindo o navegador automaticamente na página de login (http://localhost:3000).

## 🗺️ Backlog e Próximos Épicos (Onde precisamos de ajuda!)

O "Core" do jogo está estabilizado e seguro. Nosso foco agora é refatoração arquitetural para escalabilidade:

* **[ÉPICO 1] Quebra do Monolito Front-end:** Fatiar o gigante admin.html e admin.js em telas modulares separadas (admin-roster, admin-quests, admin-loot).
* **[ÉPICO 2] Separação de Domínios no Back-end:** Extrair as rotas de criação de Quests e Loot que atualmente residem em admin.js e movê-las para seus respectivos controladores de domínio (quests.js e loot.js).
* **[ÉPICO 3] Sprints Dinâmicas:** Migrar as variáveis fixas de Meta de Sprint do Front-end para serem consumidas dinamicamente do banco de dados, permitindo gestão real de Sprints pelo Admin.
