# ⚔️ GuildWork - The Office Quest

Bem-vindo à GuildWork! Um sistema de gestão de tarefas gamificado que transforma o fluxo de trabalho diário (estilo Jira/Trello) em uma experiência de RPG. Os funcionários (Aventureiros) ganham XP, sobem de nível e acumulam Ouro (Gold) para trocar por itens reais na Forja (Loja), enquanto o Mestre da Guilda (Admin) monitora o desempenho e o SLA de cada entrega.

## 🛠️ Stack Tecnológico

A arquitetura é leve, stateless e com autoridade no servidor para regras de economia e gamificação:

* **Front-end:** HTML5, CSS3 (variáveis globais e animações customizadas) e Vanilla JavaScript. Estética em Pixel Art servida via `npx serve`.
* **Back-end:** Node.js (v18+) com Express. Arquitetura RESTful e stateless.
* **Banco de Dados:** MongoDB via Docker + Mongoose 9.x com schemas estritos.
* **Segurança:** JWT (8h de expiração), bcryptjs para hash de senha, validação de todas as regras de negócio exclusivamente no servidor.

## 📂 Arquitetura de Diretórios

```
GUILDWORK/
├── mongo-init/
│   └── init-db.js         # Seed: cria usuários padrão na primeira inicialização do container
├── src/
│   ├── backend/
│   │   ├── controllers/   # Lógica de negócio (gamificação, economia, auth)
│   │   ├── middleware/    # Proteção de rotas (JWT + Role-based access)
│   │   ├── models/        # Schemas do Mongoose (User, Quest, QuestCompletion, LootItem)
│   │   ├── routes/        # Roteamento RESTful da API
│   │   ├── .env           # Variáveis de ambiente (NÃO COMMITADO — ver abaixo)
│   │   ├── package.json
│   │   └── server.js      # Entry point do servidor
│   └── frontend/
│       ├── assets/imgs/   # Sprites e texturas pixel art
│       ├── css/           # style.css modularizado por componente
│       ├── js/            # mural.js, admin.js, loja.js, login.js, utils.js
│       ├── package.json
│       └── *.html         # login, index (board), admin, loja
├── .gitignore
└── docker-compose.yml     # MongoDB com autenticação
```

## 📜 Regras de Negócio (Core Mechanics)

1. **Economia Blindada (Server-Side Authority):** O front-end nunca dita recompensas. Envia apenas o `questId`; o back-end consulta XP e Gold reais, aplica multiplicadores e devolve o novo saldo.
2. **SLA e A Maldição:** Missões têm tempo limite dinâmico (`sla_seconds`). Estourar o SLA coloca o aventureiro em estado de "Amaldiçoado" (resolvido no servidor).
3. **Penalidade Rigorosa:** Concluir uma missão enquanto amaldiçoado corta XP e Gold pela metade — calculado e aplicado no back-end.
4. **Prevenção de Exploit na Loja:** O servidor recebe IDs dos itens, recalcula o total pelo banco e só então debita o saldo.
5. **WIP Limit:** Máximo de 3 quests `in_progress` por aventureiro — validado no servidor.

## 🚀 Como Rodar o Projeto

> Você vai precisar de **dois terminais** (ou três, se preferir o MongoDB via Docker).

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) com WSL2 habilitado (Windows) ou Engine nativa (Linux/Mac)

---

### Terminal 1 — Banco de Dados (MongoDB via Docker)

Na raiz do projeto:

```bash
docker compose up -d
```

> Na primeira execução, o script `mongo-init/init-db.js` cria o banco e duas contas padrão:
> - **admin** / senha `123`
> - **funcionario** / senha `123` (guilda: Produto)

---

### Terminal 2 — Back-end (Node.js / Express)

```bash
cd src/backend
npm install        # apenas na primeira vez
npm run dev        # inicia com nodemon (hot-reload)
```

O servidor sobe na porta **3001**.

> **Crie o arquivo `src/backend/.env`** com:
> ```env
> PORT=3001
> MONGODB_URI=mongodb://guild_admin:guild_password@localhost:27017/guildwork?authSource=admin
> JWT_SECRET=sua_chave_super_secreta_aqui
> ```

---

### Terminal 3 — Front-end (servidor estático)

```bash
cd src/frontend
npm run dev        # npx serve na porta 3000
```

Acesse **http://localhost:3000/login.html** no navegador.

---

### Resumo rápido

| O quê | Comando |
|---|---|
| MongoDB | `docker compose up -d` (na raiz) |
| Back-end | `cd src/backend && npm run dev` |
| Front-end | `cd src/frontend && npm run dev` |

---

### ⚠️ Conflito de porta 27017 (Windows)

Se você tiver o MongoDB instalado localmente no Windows (`mongod.exe`), ele concorre com o container Docker na porta `27017`. Nesse caso, pare o serviço local antes de subir o Docker:

```powershell
# Opção A — parar o serviço MongoDB local
net stop MongoDB

# Opção B — parar o processo direto (se não for serviço)
taskkill /IM mongod.exe /F
```

Depois suba o Docker normalmente. Se preferir manter os dois rodando, mude a porta do Docker no `docker-compose.yml` para `27018:27017` e ajuste o `MONGODB_URI` no `.env`.

---

## ✨ Funcionalidades Implementadas

| Tela | Feature |
|---|---|
| **Board (Kanban)** | 3 colunas (A Fazer / Em Progresso / Concluído) com WIP limit de 3 |
| **Board** | Auto-refresh a cada 30s com contador regressivo no botão |
| **Board** | SLA timer por quest, maldição ao estourar, penalidade de 50% nos ganhos |
| **Board** | Modal de detalhes da quest (clique no card) |
| **Board** | Animação de Level Up ao subir de nível |
| **Sidebar** | Missões fechadas na sessão, XP/Gold da sessão, slots WIP, saúde da sprint |
| **Loja** | Card de perfil do jogador (avatar, nível, XP, guilda, gold, missões) |
| **Loja** | Itens bloqueados visualmente quando gold insuficiente |
| **Loja** | Preview de saldo pós-compra no carrinho |
| **Admin — Dashboard** | Métricas da sprint + desempenho por guilda |
| **Admin — Missões** | Criação de quests por guilda, SLA restante visível, reset de quest |
| **Admin — Loot** | CRUD de itens da loja |
| **Admin — Membros** | Recrutamento por guilda, edição de funcionário |
| **Guildas** | Quests separadas por guilda — funcionário vê só as da sua guilda |

---

## 🐛 Correções Técnicas Notáveis

| Problema | Causa | Fix |
|---|---|---|
| 500 ao concluir quest | `user.save()` dispara validadores Mongoose 9.x em campos com enum desatualizado | Substituído por `User.findByIdAndUpdate()` que bypassa validadores por padrão |
| 500 ao concluir quest (CSAT) | `min: 1` no schema rejeita `null` no Mongoose 9.x | Substituído por validador customizado `v === null \|\| (v >= 1 && v <= 5)` |
| Timer SLA travando | `const timerId` declarado após a função `tick()` que o referencia (Temporal Dead Zone) | Movido para `let timerId` antes da função |
| Seed criava usuário com role errado | `init-db.js` usava `role: 'player'` (não existe no enum) | Corrigido para `role: 'funcionario'` + `faction: 'Produto'` |

---

## 🗺️ Backlog e Próximos Épicos

* **[ÉPICO 1] Histórico de Missões:** Tela com o registro de quests concluídas pelo aventureiro (data, XP, Gold ganho).
* **[ÉPICO 2] Ranking da Guilda:** Leaderboard de XP dentro de cada guilda.
* **[ÉPICO 3] Sprints Dinâmicas:** Meta de sprint gerenciada pelo Admin via banco de dados.
* **[ÉPICO 4] Quebra do Monolito Front-end:** Modularizar `admin.html/js` em telas menores.
