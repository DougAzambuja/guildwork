# ⚔️ GuildWork - The Office Quest

Bem-vindo ao GuildWork! Um sistema de gestão de tarefas gamificado que transforma o fluxo de trabalho diário em uma experiência de RPG. Os funcionários (Aventureiros) ganham XP, sobem de nível e acumulam Ouro (Gold) para trocar por itens reais na Forja (Loja), enquanto o Mestre da Guilda (Admin) monitora o desempenho e o SLA de cada entrega.

## 🛠️ Stack Tecnológico

A arquitetura é leve, stateless e com autoridade no servidor para todas as regras de economia e gamificação:

* **Front-end:** HTML5, CSS3 com **Design System de tokens** (25+ variáveis semânticas em `:root` — superfícies, cores, tipografia — eliminando ~350 valores hardcoded) e Vanilla JavaScript. Estética em Pixel Art servida via VS Code Live Server.
* **Back-end:** Node.js (v18+) com Express. Arquitetura RESTful e stateless.
* **Banco de Dados:** MongoDB Atlas (M0 free tier, cluster `GuildWork`, sa-east-1) via Mongoose 9.x com schemas estritos. Docker Compose disponível para uso local via profile `local-db`.
* **Segurança:** JWT (8h de expiração), bcryptjs para hash de senha, validação de todas as regras de negócio exclusivamente no servidor.

## 📂 Arquitetura de Diretórios

```
GUILDWORK/
├── mongo-init/
│   └── init-db.js                  # Seed inicial do banco
├── src/
│   ├── backend/
│   │   ├── controllers/            # Lógica de negócio (gamificação, economia, auth)
│   │   ├── middleware/             # Proteção de rotas (JWT + Role-based access) + errorHandler + requestLogger
│   │   ├── models/                 # Schemas Mongoose (User, Quest, Guild, Sprint, Notification, LootItem...)
│   │   ├── routes/                 # Roteamento RESTful da API
│   │   ├── services/               # notificationService (triggers + conquistas)
│   │   ├── tests/
│   │   │   ├── globalSetup.js      # Inicia MongoDB in-memory (MongoMemoryServer)
│   │   │   ├── globalTeardown.js   # Para MongoDB in-memory após todos os testes
│   │   │   ├── testSetup.js        # Connect/clean/disconnect Mongoose por arquivo de teste
│   │   │   ├── fixtures/index.js   # Helpers: createAdmin, createPlayer, createQuest, createGuild...
│   │   │   ├── integration/        # 13 suítes · 87 testes (auth, players, quests, admin, guild, loot, metrics, notifications, sprint, encounters, event-templates, social-events)
│   │   │   └── unit/               # questController (Group Quest) + notificationService
│   │   ├── app.js                  # Express app (sem MongoDB/server.listen — importado pelo Supertest)
│   │   ├── jest.config.js          # Configuração Jest 29 (globalSetup/Teardown, maxWorkers: 1)
│   │   ├── seed-atlas.js           # Seed completo para o Atlas (dados realistas)
│   │   ├── .env                    # Variáveis de ambiente (NÃO COMMITADO)
│   │   ├── .env.example            # Template de variáveis de ambiente
│   │   └── server.js               # Entry point (importa app.js + inicia MongoDB + SLA job)
│   └── frontend/
│       ├── assets/imgs/            # Sprites e texturas pixel art
│       ├── css/style.css           # CSS modularizado por componente
│       ├── js/                     # mural.js, guild.js, loja.js, perfil.js, leaderboard.js, admin-*.js, admin-header.js, admin-profile.js, notifications.js, utils.js (dicebearUrl + constantes)
│       ├── index.html              # Board Kanban (jogador)
│       ├── guild.html              # Tela da Guilda (ranking + link para perfil público)
│       ├── loja.html               # Loja de itens
│       ├── login.html              # Autenticação
│       ├── perfil.html             # Perfil público do aventureiro (métricas agregadas)
│       ├── leaderboard.html        # Ranking semanal por XP (issues #41/#42)
│       ├── admin.html              # Painel Admin
│       ├── admin-quests.html       # Gestão de Missões
│       ├── admin-roster.html       # Gestão de Membros
│       ├── admin-metrics.html      # Métricas e Dashboards
│       ├── admin-sprints.html      # Gestão de Sprints
│       ├── admin-loot.html         # Gestão da Loja
│       ├── admin-sprint-board.html # Board Kanban da Sprint (admin)
│       ├── admin-events.html       # Aba de Eventos — tabs: ⚡ Eventos Aleatórios (biblioteca + acionar) e 📢 Mural de Avisos (agenda social CRUD)
│       ├── admin-profile.html      # Perfil do Admin (nome, avatar DiceBear, senha)
│       └── change-password.html    # Troca obrigatória de senha no primeiro acesso (#115)
├── scripts/
│   └── backup.sh                   # Dump automático do MongoDB com rotação de 7 backups e log JSON
├── schema.prisma                   # Documentação arquitetural do schema (Prisma — não usado em runtime; Mongoose é o ORM)
├── docker-compose.yml              # MongoDB local (opcional — profile: local-db)
└── docker-compose.test.yml         # MongoDB de testes na porta 27018 + serviço de backup
```

## 📜 Regras de Negócio (Core Mechanics)

1. **Economia Blindada (Server-Side Authority):** O front-end nunca dita recompensas. Envia apenas o `questId`; o back-end consulta XP e Gold reais, aplica multiplicadores e devolve o novo saldo.
2. **Progressão de Nível:** Fórmula `xpParaProximoNivel(N) = 200*(N+1) + 300`. XP reseta a cada nível.
3. **WIP Limit:** Máximo de 3 quests `in_progress` por aventureiro — validado no servidor.
4. **Sistema de Maldições:** 3 tipos aplicados automaticamente no servidor:
   - `sla_breach` — SLA estourado: XP pela metade
   - `abandoned` — Quest abandonada pelo admin: Gold pela metade
   - `csat_low` — CSAT ≤ 2★ em suporte: XP e Gold pela metade + urgentes bloqueadas
5. **Buff de XP via CSAT Streak:** Quests de suporte com CSAT 5★ consecutivas concedem:
   - Streak 3 → XP Duplo nas próximas 2 quests
   - Streak 5 → XP Duplo por 24 horas
6. **Tesouro da Guilda:** % do Gold de cada quest concluída vai automaticamente para o tesouro da guilda (tax configurável). Líder pode distribuir para membros.
7. **Streak de Entregas Diárias:** Cada dia com ao menos 1 quest concluída incrementa o streak. Bônus de XP flat (não afetado por buffs/maldições) ao atingir marcos: 3 dias (+50 XP), 7 dias (+150 XP), 14 dias (+300 XP), 30 dias (+500 XP).
8. **Conquistas (Achievements):** Desbloqueadas automaticamente pelo servidor conforme missões concluídas (marcos: 1, 5, 10, 25, 50). Retroativamente concedidas se o usuário já ultrapassou o marco.
9. **Perfil Público:** Cada aventureiro tem uma página de perfil acessível via `/perfil.html#ID` com métricas agregadas (XP total ganho, Gold total, CSAT médio, taxa limpa, streak, conquistas).
10. **Leaderboard Sazonal:** Ranking semanal por XP ganho na semana corrente (segunda a domingo). Reset implícito — sem cron, calculado via agregação em `QuestCompletion` filtrada por `createdAt >= weekStart`. O jogador logado é destacado na tabela e no pódio.
11. **Prevenção de Exploit na Loja:** O servidor recalcula o total pelo banco antes de debitar.
12. **Faixas de Recompensa do Líder:** Líder de guilda cria/edita quests da própria guilda pelo board, mas XP/Gold nunca vêm de valor livre enviado pelo cliente — só de 3 faixas pré-aprovadas no servidor (Pequena: 100 XP/15 Gold, Média: 250 XP/30 Gold, Grande: 450 XP/50 Gold). Facção, tipo, sprint e XP/Gold brutos enviados pelo líder são sempre ignorados silenciosamente pelo backend (`isAdminOrGuildLeader` + validação em `questController`).

## 🚀 Como Rodar o Projeto

> Você vai precisar de **um terminal** + **VS Code Live Server**.

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- VS Code com extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
- Acesso ao cluster MongoDB Atlas `GuildWork` (credenciais no `.env`)

---

### Primeira vez em uma máquina nova

```bash
# 1. Clone o repositório
git clone https://github.com/DougAzambuja/guildwork.git
cd guildwork

# 2. Instale as dependências do backend
cd src/backend && npm install

# 3. Crie o .env (o arquivo não vai pro git por segurança)
cp .env.example .env
```

Edite `src/backend/.env` e preencha com as credenciais reais — peça ao responsável pelo projeto.

---

### Checklist de início de sessão (uso diário)

**1. Instale as dependências** (apenas na primeira vez):
```bash
cd src/backend && npm install
```

**3. Suba o back-end:**
```bash
cd src/backend
npm run dev        # hot-reload via nodemon, porta 3001
```

Você deve ver:
```
✅ MongoDB conectado com sucesso!
```

**4. Suba o front-end** (escolha uma das opções):

**Opção A — VS Code Live Server** (recomendado):
- Abra `src/frontend/index.html` no VS Code → botão direito → **Open with Live Server**
- Acesse **http://127.0.0.1:5500/login.html**

**Opção B — Terminal:**
```bash
cd src/frontend
npm install    # apenas na primeira vez
npm run dev    # serve estático na porta 3000
```
- Acesse **http://localhost:3000/login.html**

---

### Logins de acesso

| Usuário | Senha | Papel |
|---|---|---|
| `douglas_admin` | `123` | Admin (acesso total) |
| `daniel_admin` | `123` | Admin (acesso total) |
| `douglas_produto` | `123` | Líder — Guilda do Produto |
| `carlos_suporte` | `123` | Líder — Guilda do Suporte |
| `ana_cs` | `123` | Líder — Customer Service |
| `maria_produto` | `123` | Funcionária — Produto |

> Para repopular o Atlas do zero: `cd src/backend && node seed-atlas.js`

---

### Resumo rápido

| O quê | Como |
|---|---|
| Back-end | `cd src/backend && npm run dev` |
| Front-end (VS Code) | Live Server em `src/frontend/index.html` → porta 5500 |
| Front-end (terminal) | `cd src/frontend && npm run dev` → porta 3000 |
| Seed Atlas | `cd src/backend && node seed-atlas.js` |
| MongoDB local (opcional) | `docker compose --profile local-db up -d` |

---

### ⚠️ Conflito de porta 27017 (Windows)

Se você tiver o MongoDB instalado localmente, pare o serviço antes de subir o Docker:

```powershell
net stop MongoDB
```

---

## 🧪 Testes

A infraestrutura de testes usa **Jest 29 + Supertest + MongoDB Memory Server** — sem Docker, sem banco real.

### Rodar os testes

```bash
cd src/backend

npm test                    # Todos os testes (sequencial, maxWorkers: 1)
npm run test:unit           # Apenas testes unitários (mocks, sem banco)
npm run test:integration    # Apenas testes de integração (banco in-memory)
npm run test:coverage       # Com relatório de cobertura (coverage/)
npm run test:watch          # Modo watch para desenvolvimento
```

> **Primeira execução:** o `mongodb-memory-server` baixa automaticamente o binário do MongoDB (~70 MB). Pode demorar 1–2 minutos e parece travado — é normal. As próximas execuções são rápidas.

### Arquitetura dos testes

| Camada | Arquivo | O que faz |
|---|---|---|
| Setup global | `tests/globalSetup.js` | Sobe MongoDB in-memory, injeta `MONGODB_TEST_URI`, `JWT_SECRET` e `NODE_ENV=test` |
| Teardown global | `tests/globalTeardown.js` | Para o MongoDB in-memory após todos os testes |
| Setup por arquivo | `tests/testSetup.js` | `beforeAll` conecta, `afterEach` limpa coleções, `afterAll` desconecta |
| Fixtures | `tests/fixtures/index.js` | `createAdmin`, `createPlayer`, `createQuest`, `createGuild`, `createSprint`, `createLootItem`, `createNotification` |
| Integração (9 rotas) | `tests/integration/*.test.js` | Supertest importa `app.js` diretamente — sem porta, sem banco real |
| Unitários | `tests/unit/*.test.js` | `questController` (Group Quest) e `notificationService` (com mocks Mongoose) |

### Cobertura atual

| Suite | Cenários testados |
|---|---|
| `auth` | Login válido, senha errada, usuário inexistente, `force_password_change`, registro admin/player, duplicata |
| `players` | GET `/me`, troca de senha, leaderboard, perfil público |
| `quests` | CRUD, atribuição, mover, concluir, comentários, WIP limit |
| `admin` | Roster list, update com `force_password_change`, 403/401 |
| `guild` | GET guilda, todas (admin), set leader, colunas |
| `loot` | CRUD com auth |
| `metrics` | GET métricas admin/403/401 |
| `notifications` | List, mark-all-read, mark-one-read, 404 |
| `sprint` | CRUD, sprint ativa, burndown |
| `encounters` | Trigger global/facção, campos obrigatórios, efeito na conclusão de quest, GET active (admin bypass de facção), PATCH editar término, DELETE encerrar antecipado, agendamento via `start_at` |
| `event-templates` | CRUD completo, validação de effect_kind/default_value/default_duration, 403/401 |
| `questController (unit)` | Solo share, party bonus, accepted/rejected tracking, admin crash test |
| `notificationService (unit)` | Todos os triggers com mocks Mongoose |

---

## ✨ Funcionalidades Implementadas

### 🎮 Board Kanban (Jogador)
| Feature | Detalhe |
|---|---|
| Colunas personalizadas | Guilds configuram suas próprias colunas via modal ⚙️; posição define automaticamente o status (INÍCIO=todo, MEIO=in_progress, FIM=done) — retrocompatível com quests existentes (#72/#73) |
| 3 colunas padrão | A Fazer / Em Progresso / Concluído criados automaticamente para novas guilds |
| SLA Timer | Contador regressivo por quest; maldição ao estourar |
| Modal de Quest | Detalhes, checklist, timeline de atividade e comentários |
| Auto-refresh | Board atualiza a cada 30s com contador regressivo |
| Animação Level Up | Overlay ao subir de nível |
| Acesso ao Perfil | Clique no avatar da top bar → modal "Seu Herói" → link para perfil completo |
| Conquistas | Badges desbloqueados por marcos de missões concluídas |

### 🏰 Tela da Guilda
| Feature | Detalhe |
|---|---|
| Header | Ícone, nome, facção, chips de estatísticas (aventureiros, nível médio, XP total) |
| Ranking | Tabela de membros com medalhas, XP bar, maldição e coroa do líder |
| Tesouro | Saldo comum, taxa de contribuição automática por missão |
| Distribuição | Líder pode enviar Gold para qualquer membro da guilda |
| Link Sazonal | Botão direto para o Leaderboard Sazonal no painel de ranking |
| Avatar clicável (#127) | Avatar na top bar navega para `/perfil.html` |
| Max-width (#125) | Layout limitado a 1400px e centralizado — sem esticamento em monitores largos |

### 👑 Líder de Guilda
| Feature | Detalhe |
|---|---|
| Criar missão | Botão "+ Nova Missão" no board principal (só visível pro líder) — título, descrição, SLA, responsável (restrito a membros da própria guilda), checklist inicial e tamanho (Pequena/Média/Grande, define XP/Gold) |
| Editar missão | No modal de detalhes: título, descrição, SLA, tamanho e checklist editáveis inline; checklist com click-to-edit (clique no item pra editar o texto, adicionar/remover itens) |
| Criar subtask | Botão "+ Subtask" sempre visível no modal de quest (líder de guilda) — título, responsável, XP e Gold configuráveis; breadcrumb de quest pai quando visualizando subtask |
| Rascunho local | Edições ficam só na memória do navegador até clicar SALVAR; modal de confirmação avisa se o usuário tentar fechar/cancelar com alterações pendentes |
| Excluir missão | Restrito a quests da própria guilda que não estejam `in_progress` |
| Isolamento de guilda | Líder só enxerga/gerencia quests e atribui responsáveis dentro da própria guilda — validado no middleware `isAdminOrGuildLeader`, nunca confiando no front-end |

### 🏆 Leaderboard Sazonal
| Feature | Detalhe |
|---|---|
| Pódio Top 3 | Cards estilizados com ouro/prata/bronze, avatar e XP semanal |
| Ranking completo | Tabela com barra de XP proporcional, missões concluídas e nível |
| Destaque próprio | Linha/card "VOCÊ" destacado em laranja para o jogador logado |
| Semana atual | Cabeçalho com período (segunda a domingo), reset implícito sem cron |
| Link para perfil | Nome de cada aventureiro é clicável e abre o perfil público |

### 🧙 Perfil do Aventureiro
| Feature | Detalhe |
|---|---|
| Perfil público | Página `/perfil.html#ID` acessível por qualquer membro com barra de XP, facção e banner de maldição |
| Hub de edição (próprio perfil) | Nome editável, seletor de classe avatar, Guarda-Roupa de cosméticos, URL personalizada e botão "Salvar Herói" (único `PUT /api/players/me`) |
| Stats agregados | Missões concluídas, conquistas desbloqueadas, streak de dias, XP total ganho, Gold atual e CSAT médio |
| Conquistas | Todos os achievements com estado desbloqueado/bloqueado e data de desbloqueio |

### 🏪 Loja de Itens
| Feature | Detalhe |
|---|---|
| Vitrine | Itens com preço, imagem e disponibilidade |
| Carrinho | Preview de saldo pós-compra, bloqueio visual quando gold insuficiente |
| Card de perfil | Avatar (clicável → perfil), nível, XP, guilda, gold, missões e conquistas |
| Header completo (#126) | Player info (avatar, nome, nível, XP, gold) no topo + links de navegação (Mural, Guilda, Ranking) |
| Max-width (#125) | Layout limitado a 1400px e centralizado — sem esticamento em monitores largos |
| Cosméticos | Admin marca itens como cosmético (`🎭`); compra adiciona ao Guarda-Roupa do jogador |
| Guarda-Roupa | Seção no próprio perfil com cosméticos comprados; clique equipa como avatar |
| Perfil como hub de edição | Próprio perfil permite editar nome, avatar (classe ou cosmético), URL customizada e salvar tudo com um clique em "Salvar Herói" |
| Modal preview | Modal "Seu Herói" no board exibe snapshot rápido com link para o perfil completo |

### 🔔 Notificações
| Feature | Detalhe |
|---|---|
| Sininho | Badge com contador de não lidas na top bar |
| Tipos | Quest atribuída, Level Up, Conquista desbloqueada, SLA em risco, Alerta admin |
| Polling | Atualização automática a cada 30s |

### ⚡ Sistema de Buffs (CSAT Streak)
| Streak | Buff |
|---|---|
| 3× CSAT 5★ consecutivos | XP Duplo nas próximas 2 quests |
| 5× CSAT 5★ consecutivos | XP Duplo por 24 horas |
| Indicador visual | Banner na sidebar com tipo e tempo/quests restantes |

### 🎖️ Conquistas
| Conquista | Requisito |
|---|---|
| 🎖️ Aventureiro Estreante | 1 missão concluída |
| ⚔️ Guerreiro Dedicado | 5 missões concluídas |
| 🛡️ Veterano da Guilda | 10 missões concluídas |
| 👑 Herói Lendário | 25 missões concluídas |
| 🌟 Mestre das Missões | 50 missões concluídas |

### 🛡️ Painel Admin
| Tela | Feature |
|---|---|
| **Dashboard** | Métricas da sprint com seletor (todas as sprints, padrão: ativa), desempenho por facção, totais gerais; header fixo ao scrollar |
| **Missões** | CRUD de quests, filtros por facção/sprint/status, paginação, atribuição, cópia; seção SUBTASKS com progresso, criação inline (título, responsável, XP, Gold), badge SUB na tabela e breadcrumb de quest pai |
| **Membros (Roster)** | Recrutamento, edição, paginação, ícone 👑 para líderes de guilda |
| **Sprints** | Criação de sprints, board kanban, gráfico burndown (linha ideal para toda a sprint, linha real até hoje com dias futuros em null); dashboard selecionável por sprint (qualquer sprint, não só a ativa); top performers com avatar e XP; quests do backlog para adicionar à sprint ativa |
| **Loot** | CRUD de itens da loja |
| **Métricas** | Gráficos de maldição, economia, SLA e CSAT com Canvas puro |
| **Board da Sprint** | Visão admin do kanban com filtro de guilda server-side (`?guild_id=`); estado persiste na sessão; cards compactos com scroll por coluna; modal de detalhes com edição, checklist (inclui adicionar itens inline), comentários e subtasks (XP, Gold, breadcrumb pai, seta ↗ maior); badge `[done/total]` no card; kanban do player exibe apenas quests de sprints ativas; **colunas personalizadas por guilda** (#72/#73) — admin edita via modal ⚙️ ao selecionar uma guilda; **seletor de coluna no modal** (#103) — admin move qualquer quest para qualquer coluna (bypass de in_progress para done); **color picker nas colunas** (#102) — cor persiste no PATCH; stale column_id corrigido (#102); **responsável limpo ao mover para A Fazer** (#108) — quest fica disponível para qualquer aventureiro aceitar; validação client-side no modal do líder impede mover todo→done exibindo toast antes de fechar o modal; **seletor de responsável no modal** (#108) — admin e líder trocam o aventureiro sem mover o card; layout admin limitado a 1440px centrado (#106); **board admin com scroll horizontal interno** — colunas rolam dentro do container sem vazar (#106); **DnD para Em Progresso auto-atribui** quem moveu quando assigned_to era null — mesmo comportamento do botão ACEITAR (#108); **DnD entre colunas** (#104) — arrastar card entre qualquer coluna do board admin, zona de drop expandida para a coluna inteira (cabeçalho + corpo), highlight tracejado azul; **DnD reordenação dentro da coluna** (#104) — arrastar card para cima/baixo dentro da mesma coluna como no Jira, indicador visual de inserção, ordem persistida via `card_order` (PATCH `/quests/reorder-in-column`); **ordenação por coluna** (#104) — select `⇅` no cabeçalho de cada coluna (A→Z, Z→A, XP ↓/↑, Gold ↓/↑), estado preservado entre re-renders; **admin pode editar/excluir colunas de qualquer guilda** (#104) — bug corrigido: PATCH e DELETE de coluna não filtravam mais pela guilda da facção do admin; **regra: coluna com missões não pode ser excluída** — backend bloqueia e exibe toast com mensagem de erro; **filtro por responsável (#105)** — barra de chips acima do board com avatar e nome de cada membro com quests na sprint; filtro client-side instantâneo sem nova requisição; botão "Todos" reseta; reset automático ao trocar de guilda |
| **Missões (paginação)** | Select de itens por página sempre visível (#99) — botões de navegação ocultados quando tudo cabe em uma página, mas o select permanece acessível |
| **Perfil do Admin (#114)** | Tela `/admin-profile.html` — editar nome, avatar (DiceBear pixel art gerado pelo username ou URL personalizada) e alterar senha; header atualiza ao vivo sem reload |
| **Força Troca de Senha (#115)** | Flag `force_password_change` no modelo de usuário; admin ativa a flag no momento do recrutamento ou via edição de membro; login detecta a flag (`requiresPasswordChange: true`) e redireciona para `/change-password.html` antes de liberar o sistema; página exclusiva sem opção de cancelar — campos: senha atual, nova senha, confirmação; após salvar, flag zerada no backend e usuário redirecionado para a tela correta (admin ou board); roster redesenhado: formulário de recrutamento movido para modal "⚔️ Recrutar", cabeçalho substituído por barra de busca (por nome/@username) + filtro por guilda; tag "🔑 Troca pendente" visível na listagem para membros com flag ativa |
| **Aniversários e perfil (#134+)** | Campo `birth_date` (Date, nullable) adicionado ao modelo `User`; admin edita via modal do roster — campo `date-field` estilizado (fundo escuro, ícone calendário visível, monospace) consistente com os pickers do módulo de eventos; funcionário informa sua própria data de nascimento na tela de perfil (`PUT /api/players/me` aceita `birth_date`); painel admin de Mural de Avisos lista aniversariantes do mês com atalho para criar aviso; classe CSS global `.date-field` centraliza estilo de todos os campos de data da aplicação |
| **Customização DiceBear (#116)** | Modal de personalização de avatar em ambas as telas de perfil (aventureiro e admin): 9 categorias (pele, cabelo, olhos, boca, barba, óculos, chapéu, roupa, acessórios), grid de thumbnails ao vivo por categoria, swatches de cores, preview grande em tempo real; seed extraído do avatar salvo para preservar o rosto; módulo `dicebear-customizer.js` auto-contido (IIFE) |
| **Loading Screen / FOUC (#119)** | Overlay fullscreen `#loading-overlay` em todas as telas do funcionário (board, perfil, loja, ranking, guilda) — cobre o FOUC enquanto os fetches assíncronos completam; emoji e texto temáticos por tela; barra de progresso animada; fade-out suave (350ms) ao concluir; `hideLoadingOverlay()` adicionado a `utils.js` como utilitário compartilhado |
| **Group Quest (#109)** | Distribuição de XP e Gold entre todos que trabalharam na quest — proporcional ao tempo de posse (`time_held_secs`); quorum mínimo de 10% do tempo total; Party Bonus de +15% no pool quando 2+ contribuidores válidos; buffs e maldições aplicados individualmente por contribuidor; novas maldições (`sla_breach`, `csat_low`) apenas para quem concluiu; admin excluído do registro de contribuidores; badge `↩ N×` no card quando a quest foi devolvida ao backlog; seção "👥 Contribuidores" no modal com avatar, nome, tempo de posse e % de contribuição; notificação individual para cada contribuidor não-completer com sua parcela de XP e Gold |
| **Mural de Avisos (#134)** | Eventos sociais informativos (happy hour, comemorações, avisos) sem mecânica de recompensa. Admin gerencia na tab "📢 MURAL DE AVISOS" em `admin-events.html` — CRUD completo: título, descrição, data/hora do evento, `display_until` opcional (até quando exibir no mural — sem ele some na hora do evento), facção (global ou específica). Painel "📋 MURAL DE AVISOS" na coluna direita explica o funcionamento ao admin em linguagem clara. Player visualiza card "AGENDA SOCIAL" na sidebar do board com próximos eventos em destaque (verde) e passados em faded; máximo de 5 visíveis; auto-refresh a cada 15s. `is_past` usa `display_until ?? event_date`, permitindo que avisos de eventos já iniciados continuem visíveis pelo período configurado. Filtro de facção server-side. Soft delete (`is_active`). Validação de datas: `min` setado no picker para acinzentar passadas nativamente + hint inline vermelho no `change`. Testes: 27 cenários (CRUD, filtros, soft delete, admin bypass, `display_until`, autenticação) |
| **Eventos Aleatórios — Biblioteca (#85)** | Sistema de buffs/debuffs passivos acionados pelo admin como Mestre do Jogo. Admin gerencia tudo na aba dedicada `admin-events.html`: **biblioteca de templates** (título, descrição, tipo de efeito, valor %, duração padrão, escopo global/facção) + lista de eventos ativos com ✏️ editar término e ✕ encerrar. Ao acionar um template, dois modos de configuração: **Duração** (horas + início imediato ou agendado) e **Período** (datetime início + datetime término com preview de duração calculada). Campo `start_at` no model suporta agendamento futuro — o evento fica salvo mas invisível aos jogadores até o horário. Admin vê todos os eventos independente de facção; players veem apenas global + própria facção. Efeitos: `xp_bonus`, `xp_penalty`, `gold_bonus`, `gold_penalty`, `luck` (2× XP), `slow` (SLA reduzido), `store_discount` (desconto na Loja). **UX do player:** sidebar exibe pill clicável neutro "⚡ EVENTO(S) ATIVO(S)" — 1 evento positivo → card inline com cor/ícone do efeito (não revela debuffs passivamente); negativo ou múltiplos → pill neutro dourado; clique abre modal com detalhes completos (efeito %, alcance, tempo restante com timer por minuto). Loja exibe preço original riscado quando `store_discount` ativo. Endpoints: `GET/POST/PATCH/DELETE /api/event-templates` + `POST /api/encounters/trigger` + `GET /api/encounters/active` + `PATCH /api/encounters/:id` + `DELETE /api/encounters/:id` |

> Todas as telas do painel compartilham `admin-header.js` (header + nav gerados dinamicamente, aba ativa detectada pela URL) e `notifications.js` (sino com polling de 30s).

---

## 🎨 Design System

O `style.css` é organizado em torno de um sistema de tokens declarado no `:root`:

| Grupo | Tokens | Propósito |
|---|---|---|
| Superfícies | `--surface-page`, `--surface-0..4`, `--surface-card`, `--surface-light`, `--surface-paper` | Backgrounds em camadas (do mais escuro ao mais claro) |
| Cores semânticas | `--color-success`, `--color-danger`, `--color-warning`, `--color-info`, `--color-special`, `--color-link` | Estados e ações com significado |
| Ouro / Destaque | `--color-gold`, `--color-accent` | Identidade visual pixel RPG |
| Tipografia | `--text-primary`, `--text-secondary`, `--text-muted` | Hierarquia de texto |
| Bordas | `--border-subtle`, `--border-thin`, `--border-color-subtle` | Separadores sutis |
| Legados | `--coin-color`, `--paper-color`, `--danger-color`, `--header-bg` | Aliases retrocompatíveis → novos tokens |

Fases planejadas:
- ✅ **Fase 1 — Tokens:** `:root` com ~25 tokens; substituição sistemática de ~350 valores hardcoded
- 🔄 **Fase 2 — Botões:** Unificar 8+ variantes de `.btn-pixel` e classes ad-hoc
- ⬜ **Fase 3 — Inputs:** Padronizar 4 variações de inputs escuros sob `.pixel-input`
- ⬜ **Fase 4 — Títulos:** Unificar `.section-title` e variantes
- ⬜ **Fase 5 — Modais e z-index:** 3 valores de z-index para modais + deduplicação de HTML (~120 linhas repetidas entre `admin.html` e `admin-sprint-board.html`)

---

## 🗺️ Backlog — Próximas Features

* **Boss Fight de Sprint (#30/#31):** Evento especial ao fechar uma sprint com metas cumpridas.
* **Árvore de Talentos (#32/#33):** Bônus passivos por facção desbloqueados com XP.
* **Avatares Pixelados (#57) ✅:** DiceBear pixel-art integrado — `dicebearUrl(username)` em `utils.js` gera URL para `api.dicebear.com/9.x/pixel-art/svg`; avatares aparecem no mural, leaderboard, modal de quest, tela de perfil do aventureiro e perfil do admin.
