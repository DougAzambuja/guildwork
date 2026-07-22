# ⚔️ GuildWork - The Office Quest

Bem-vindo ao GuildWork! Um sistema de gestão de tarefas gamificado que transforma o fluxo de trabalho diário em uma experiência de RPG. Os funcionários (Aventureiros) ganham XP, sobem de nível e acumulam Ouro (Gold) para trocar por itens reais na Forja (Loja), enquanto o Mestre da Guilda (Admin) monitora o desempenho e o SLA de cada entrega.

## 🛠️ Stack Tecnológico

A arquitetura é leve, stateless e com autoridade no servidor para todas as regras de economia e gamificação:

* **Front-end:** HTML5, CSS3 (variáveis globais e animações customizadas) e Vanilla JavaScript. Estética em Pixel Art servida via `npx serve`.
* **Back-end:** Node.js (v18+) com Express. Arquitetura RESTful e stateless.
* **Banco de Dados:** MongoDB via Docker + Mongoose 9.x com schemas estritos.
* **Segurança:** JWT (8h de expiração), bcryptjs para hash de senha, validação de todas as regras de negócio exclusivamente no servidor.

## 📂 Arquitetura de Diretórios

```
GUILDWORK/
├── mongo-init/
│   └── init-db.js                  # Seed inicial do banco
├── src/
│   ├── backend/
│   │   ├── controllers/            # Lógica de negócio (gamificação, economia, auth)
│   │   ├── middleware/             # Proteção de rotas (JWT + Role-based access)
│   │   ├── models/                 # Schemas Mongoose (User, Quest, Guild, Sprint, Notification, LootItem...)
│   │   ├── routes/                 # Roteamento RESTful da API
│   │   ├── services/               # notificationService (triggers + conquistas)
│   │   ├── .env                    # Variáveis de ambiente (NÃO COMMITADO)
│   │   └── server.js               # Entry point
│   └── frontend/
│       ├── assets/imgs/            # Sprites e texturas pixel art
│       ├── css/style.css           # CSS modularizado por componente
│       ├── js/                     # mural.js, guild.js, loja.js, perfil.js, leaderboard.js, admin-*.js, admin-header.js (header compartilhado do painel), notifications.js, utils.js (constantes compartilhadas)
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
│       └── admin-sprint-board.html # Board Kanban da Sprint (admin)
├── .gitignore
└── docker-compose.yml              # MongoDB com autenticação
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

> Você vai precisar de **dois terminais**.

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) com WSL2 habilitado (Windows) ou Engine nativa (Linux/Mac)

---

### Terminal 1 — Banco de Dados (MongoDB via Docker)

```bash
docker compose up -d
```

> Na primeira execução, o script `mongo-init/init-db.js` cria o banco e contas padrão:
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

Se você tiver o MongoDB instalado localmente, pare o serviço antes de subir o Docker:

```powershell
net stop MongoDB
```

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
| Card de perfil | Avatar, nível, XP, guilda, gold, missões e conquistas |
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
| **Board da Sprint** | Visão admin do kanban com filtro de guilda server-side (`?guild_id=`); estado persiste na sessão; cards compactos com scroll por coluna; modal de detalhes com edição, checklist (inclui adicionar itens inline), comentários e subtasks (XP, Gold, breadcrumb pai, seta ↗ maior); badge `[done/total]` no card; kanban do player exibe apenas quests de sprints ativas; **colunas personalizadas por guilda** (#72/#73) — admin edita via modal ⚙️ ao selecionar uma guilda; **seletor de coluna no modal** (#103) — admin move qualquer quest para qualquer coluna (bypass de in_progress para done); **color picker nas colunas** (#102) — cor persiste no PATCH; stale column_id corrigido (#102); **responsável limpo ao mover para A Fazer** (#108) — quest fica disponível para qualquer aventureiro aceitar; validação client-side no modal do líder impede mover todo→done exibindo toast antes de fechar o modal |
| **Missões (paginação)** | Select de itens por página sempre visível (#99) — botões de navegação ocultados quando tudo cabe em uma página, mas o select permanece acessível |

> Todas as telas do painel compartilham `admin-header.js` (header + nav gerados dinamicamente, aba ativa detectada pela URL) e `notifications.js` (sino com polling de 30s).

---

## 🗺️ Backlog — Próximas Features

* **Boss Fight de Sprint (#30/#31):** Evento especial ao fechar uma sprint com metas cumpridas.
* **Árvore de Talentos (#32/#33):** Bônus passivos por facção desbloqueados com XP.
* **Avatares Pixelados (#57):** Estudo de ferramentas (DiceBear, Morphic, Piskel) para geração procedural de personagens.
