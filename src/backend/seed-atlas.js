/**
 * seed-atlas.js — Popula o Atlas com dados realistas de demonstração.
 * Uso: node seed-atlas.js
 *
 * Cria: 2 admins, 9 funcionários (3 por guilda), 3 guildas, 3 sprints,
 *       23 quests realistas, completions, colunas kanban e loot.
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const User            = require('./models/user');
const Quest           = require('./models/quest');
const QuestCompletion = require('./models/questCompletion');
const Sprint          = require('./models/sprint');
const LootItem        = require('./models/lootItem');
const Guild           = require('./models/guild');
const KanbanColumn    = require('./models/kanbanColumn');

const ATLAS_URI = process.env.MONGODB_URI;

async function run() {
    await mongoose.connect(ATLAS_URI);
    console.log('✅ Conectado ao Atlas');

    // ===================== LIMPA TUDO =====================
    await Promise.all([
        User.deleteMany({}),
        Quest.deleteMany({}),
        QuestCompletion.deleteMany({}),
        Sprint.deleteMany({}),
        LootItem.deleteMany({}),
        Guild.deleteMany({}),
        KanbanColumn.deleteMany({})
    ]);
    console.log('🗑️  Coleções limpas');

    // ===================== USUÁRIOS =====================
    const users = await User.create([
        // ---- Admins ----
        {
            username: 'douglas_admin', password: '123',
            nome: 'Douglas Azambuja', role: 'admin', faction: 'Produto',
            avatar_url: 'assets/imgs/caneca_pixel.jpg',
            xp: 15400, coins: 2200, level: 5, quests_completed: 24, is_cursed: false
        },
        {
            username: 'daniel_admin', password: '123',
            nome: 'Daniel Admin', role: 'admin', faction: 'Suporte',
            avatar_url: 'assets/imgs/caneca_pixel.jpg',
            xp: 12800, coins: 1900, level: 4, quests_completed: 18, is_cursed: false
        },
        // ---- Produto ----
        {
            username: 'douglas_produto', password: '123',
            nome: 'Douglas Produto', role: 'funcionario', faction: 'Produto',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 9200, coins: 1340, level: 3, quests_completed: 14, is_cursed: false
        },
        {
            username: 'maria_produto', password: '123',
            nome: 'Maria Forjadora', role: 'funcionario', faction: 'Produto',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 6800, coins: 980, level: 2, quests_completed: 9, is_cursed: false
        },
        {
            username: 'pedro_produto', password: '123',
            nome: 'Pedro Explorador', role: 'funcionario', faction: 'Produto',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 3100, coins: 440, level: 1, quests_completed: 4, is_cursed: false
        },
        // ---- Suporte ----
        {
            username: 'carlos_suporte', password: '123',
            nome: 'Carlos Escudeiro', role: 'funcionario', faction: 'Suporte',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 7900, coins: 1100, level: 2, quests_completed: 11, is_cursed: false
        },
        {
            username: 'lucas_suporte', password: '123',
            nome: 'Lucas Paladino', role: 'funcionario', faction: 'Suporte',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 4200, coins: 580, level: 1, quests_completed: 6, is_cursed: false
        },
        {
            username: 'fernanda_suporte', password: '123',
            nome: 'Fernanda Guardiã', role: 'funcionario', faction: 'Suporte',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 2800, coins: 390, level: 1, quests_completed: 3, is_cursed: true
        },
        // ---- Customer Service ----
        {
            username: 'ana_cs', password: '123',
            nome: 'Ana Mensageira', role: 'funcionario', faction: 'Customer Service',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 8500, coins: 1230, level: 3, quests_completed: 12, is_cursed: false
        },
        {
            username: 'rafael_cs', password: '123',
            nome: 'Rafael Viajante', role: 'funcionario', faction: 'Customer Service',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 5600, coins: 790, level: 2, quests_completed: 7, is_cursed: false
        },
        {
            username: 'juliana_cs', password: '123',
            nome: 'Juliana Arqueira', role: 'funcionario', faction: 'Customer Service',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 3400, coins: 470, level: 1, quests_completed: 5, is_cursed: false
        }
    ]);

    const douglasAdmin  = users.find(u => u.username === 'douglas_admin');
    const douglasProd   = users.find(u => u.username === 'douglas_produto');
    const mariaProd     = users.find(u => u.username === 'maria_produto');
    const pedroProd     = users.find(u => u.username === 'pedro_produto');
    const carlosSup     = users.find(u => u.username === 'carlos_suporte');
    const lucasSup      = users.find(u => u.username === 'lucas_suporte');
    const fernandaSup   = users.find(u => u.username === 'fernanda_suporte');
    const anaCS         = users.find(u => u.username === 'ana_cs');
    const rafaelCS      = users.find(u => u.username === 'rafael_cs');
    const julianaCS     = users.find(u => u.username === 'juliana_cs');
    console.log(`👥 ${users.length} usuários criados`);

    // ===================== GUILDAS =====================
    const guilds = await Guild.create([
        { name: 'Guilda do Produto',          faction_key: 'Produto',          icon: '📦', leader_id: douglasProd._id, tax_rate: 0.10 },
        { name: 'Guilda do Suporte',          faction_key: 'Suporte',          icon: '🎧', leader_id: carlosSup._id,   tax_rate: 0.10 },
        { name: 'Guilda de Customer Service', faction_key: 'Customer Service', icon: '📣', leader_id: anaCS._id,       tax_rate: 0.10 }
    ]);
    const guildaProd = guilds.find(g => g.faction_key === 'Produto');
    const guildaSup  = guilds.find(g => g.faction_key === 'Suporte');
    const guildaCS   = guilds.find(g => g.faction_key === 'Customer Service');
    console.log(`🏰 ${guilds.length} guildas criadas`);

    // ===================== SPRINTS =====================
    const today = new Date('2026-07-22T12:00:00Z');
    const d = (offsetDays) => new Date(today.getTime() + offsetDays * 86400000);

    const [sprint1, sprint2, sprint3] = await Sprint.create([
        {
            name: 'Sprint 1 — Kick-off',
            goal: 'Estruturar processos, definir rituais de squad e mapear backlog inicial',
            status: 'completed',
            factions: ['Produto', 'Suporte', 'Customer Service'],
            start_date: d(-59), end_date: d(-46), duration_days: 14,
            created_by: douglasAdmin._id
        },
        {
            name: 'Sprint 2 — Fundação',
            goal: 'Entregar MVP das integrações críticas e reduzir débito técnico em 30%',
            status: 'completed',
            factions: ['Produto', 'Suporte', 'Customer Service'],
            start_date: d(-30), end_date: d(-17), duration_days: 14,
            created_by: douglasAdmin._id
        },
        {
            name: 'Sprint 3 — Estabilização v1.2',
            goal: 'Estabilizar fluxos de checkout e suporte, elevar CSAT para 4.5+',
            status: 'active',
            factions: ['Produto', 'Suporte', 'Customer Service'],
            start_date: d(-3), end_date: d(4), duration_days: 7,
            created_by: douglasAdmin._id
        }
    ]);
    console.log('🏃 3 sprints criadas');

    // ===================== COLUNAS KANBAN =====================
    await KanbanColumn.create([
        // Produto
        { guild_id: guildaProd._id, name: 'A Fazer',      status_map: 'todo',        order: 0, color: '#3498db' },
        { guild_id: guildaProd._id, name: 'Em Análise',   status_map: 'in_progress', order: 1, color: '#f39c12' },
        { guild_id: guildaProd._id, name: 'Em Revisão',   status_map: 'in_progress', order: 2, color: '#9b59b6' },
        { guild_id: guildaProd._id, name: 'Concluído',    status_map: 'done',        order: 3, color: '#27ae60' },
        // Suporte
        { guild_id: guildaSup._id,  name: 'A Atender',         status_map: 'todo',        order: 0, color: '#3498db' },
        { guild_id: guildaSup._id,  name: 'Em Atendimento',    status_map: 'in_progress', order: 1, color: '#e67e22' },
        { guild_id: guildaSup._id,  name: 'Aguardando Cliente', status_map: 'in_progress', order: 2, color: '#8e44ad' },
        { guild_id: guildaSup._id,  name: 'Resolvido',         status_map: 'done',        order: 3, color: '#27ae60' },
        // Customer Service
        { guild_id: guildaCS._id,   name: 'A Fazer',            status_map: 'todo',        order: 0, color: '#3498db' },
        { guild_id: guildaCS._id,   name: 'Em Contato',         status_map: 'in_progress', order: 1, color: '#e74c3c' },
        { guild_id: guildaCS._id,   name: 'Aguardando Retorno', status_map: 'in_progress', order: 2, color: '#f39c12' },
        { guild_id: guildaCS._id,   name: 'Encerrado',          status_map: 'done',        order: 3, color: '#27ae60' }
    ]);
    console.log('📋 12 colunas kanban criadas (4 por guilda)');

    // ===================== QUESTS =====================
    const quests = await Quest.create([

        // ── Sprint 3: Produto ──────────────────────────────────────────
        {
            title: 'Implementar validação de campos no fluxo de checkout',
            type: 'urgent', faction: 'Produto',
            xp_reward: 500, coin_reward: 60,
            status: 'done', assigned_to: douglasProd._id,
            sprint_id: sprint3._id, sla_seconds: 14400,
            started_at: d(-2),
            checklist: [
                { text: 'Validar campos obrigatórios', done: true },
                { text: 'Tratar máscara de CPF/CNPJ', done: true },
                { text: 'Testar em mobile', done: true }
            ],
            comments: [{ user_id: douglasProd._id, text: 'Douglas Produto aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Definir critérios de aceite para módulo de relatórios',
            type: 'normal', faction: 'Produto',
            xp_reward: 300, coin_reward: 35,
            status: 'done', assigned_to: mariaProd._id,
            sprint_id: sprint3._id,
            started_at: d(-3),
            checklist: [
                { text: 'Reunião com stakeholders', done: true },
                { text: 'Rascunho dos critérios', done: true },
                { text: 'Aprovação do PO', done: true }
            ],
            comments: [{ user_id: mariaProd._id, text: 'Maria Forjadora aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Documentar API de notificações para equipe',
            type: 'jira', faction: 'Produto',
            xp_reward: 250, coin_reward: 30,
            status: 'in_progress', assigned_to: pedroProd._id,
            sprint_id: sprint3._id,
            started_at: d(-1),
            checklist: [
                { text: 'Mapear endpoints existentes', done: true },
                { text: 'Escrever exemplos de request/response', done: false },
                { text: 'Publicar no Confluence', done: false }
            ],
            comments: [{ user_id: pedroProd._id, text: 'Pedro Explorador aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Criar wireframes para dashboard de métricas da liderança',
            type: 'normal', faction: 'Produto',
            xp_reward: 400, coin_reward: 50,
            status: 'in_progress', assigned_to: douglasProd._id,
            sprint_id: sprint3._id,
            started_at: d(-1),
            comments: [{ user_id: douglasProd._id, text: 'Douglas Produto aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Revisar backlog da sprint com stakeholders',
            type: 'normal', faction: 'Produto',
            xp_reward: 200, coin_reward: 25,
            status: 'todo', sprint_id: sprint3._id
        },
        {
            title: 'Mapear fluxo de erro na integração de pagamentos (PIX)',
            type: 'urgent', faction: 'Produto',
            xp_reward: 450, coin_reward: 55,
            status: 'todo', sprint_id: sprint3._id,
            sla_seconds: 28800
        },

        // ── Sprint 3: Suporte ──────────────────────────────────────────
        {
            title: 'Resolver ticket #2847 — acesso negado no módulo financeiro',
            type: 'support', faction: 'Suporte',
            xp_reward: 400, coin_reward: 50,
            status: 'done', assigned_to: carlosSup._id,
            sprint_id: sprint3._id, sla_seconds: 7200,
            started_at: d(-2),
            comments: [
                { user_id: carlosSup._id, text: 'Carlos Escudeiro aceitou a missão', type: 'activity' },
                { user_id: carlosSup._id, text: 'Problema identificado: permissão ROLE_FINANCE não atribuída ao usuário. Correção aplicada.', type: 'user' }
            ]
        },
        {
            title: 'Criar FAQ para erros de autenticação SSO',
            type: 'normal', faction: 'Suporte',
            xp_reward: 250, coin_reward: 30,
            status: 'done', assigned_to: fernandaSup._id,
            sprint_id: sprint3._id,
            started_at: d(-3),
            checklist: [
                { text: 'Listar erros mais recorrentes', done: true },
                { text: 'Escrever resoluções passo a passo', done: true },
                { text: 'Revisar com o time técnico', done: true },
                { text: 'Publicar na base de conhecimento', done: true }
            ],
            comments: [{ user_id: fernandaSup._id, text: 'Fernanda Guardiã aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Escalonar tickets P1 sem resposta há 48h',
            type: 'urgent', faction: 'Suporte',
            xp_reward: 500, coin_reward: 60,
            status: 'in_progress', assigned_to: lucasSup._id,
            sprint_id: sprint3._id, sla_seconds: 3600,
            started_at: d(0),
            comments: [{ user_id: lucasSup._id, text: 'Lucas Paladino aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Treinar novos atendentes na ferramenta de CRM',
            type: 'normal', faction: 'Suporte',
            xp_reward: 350, coin_reward: 40,
            status: 'in_progress', assigned_to: carlosSup._id,
            sprint_id: sprint3._id,
            started_at: d(-1),
            checklist: [
                { text: 'Preparar material de treinamento', done: true },
                { text: 'Realizar sessão prática', done: false },
                { text: 'Coletar feedback dos participantes', done: false }
            ],
            comments: [{ user_id: carlosSup._id, text: 'Carlos Escudeiro aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Auditar tickets reabertos do mês de junho',
            type: 'normal', faction: 'Suporte',
            xp_reward: 300, coin_reward: 35,
            status: 'todo', sprint_id: sprint3._id
        },
        {
            title: 'Atualizar base de conhecimento — release v1.2',
            type: 'jira', faction: 'Suporte',
            xp_reward: 200, coin_reward: 25,
            status: 'todo', sprint_id: sprint3._id
        },

        // ── Sprint 3: Customer Service ─────────────────────────────────
        {
            title: 'Contatar clientes churn risk — segmento enterprise',
            type: 'support', faction: 'Customer Service',
            xp_reward: 450, coin_reward: 55,
            status: 'done', assigned_to: anaCS._id,
            sprint_id: sprint3._id, sla_seconds: 10800,
            started_at: d(-3),
            comments: [
                { user_id: anaCS._id, text: 'Ana Mensageira aceitou a missão', type: 'activity' },
                { user_id: anaCS._id, text: '12 clientes contatados. 8 confirmaram renovação. 4 em negociação.', type: 'user' }
            ]
        },
        {
            title: 'Agendar revisão de contratos com contas enterprise Q3',
            type: 'normal', faction: 'Customer Service',
            xp_reward: 300, coin_reward: 35,
            status: 'done', assigned_to: julianaCS._id,
            sprint_id: sprint3._id,
            started_at: d(-2),
            comments: [{ user_id: julianaCS._id, text: 'Juliana Arqueira aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Elaborar relatório NPS do Q2',
            type: 'normal', faction: 'Customer Service',
            xp_reward: 350, coin_reward: 40,
            status: 'in_progress', assigned_to: rafaelCS._id,
            sprint_id: sprint3._id,
            started_at: d(-1),
            checklist: [
                { text: 'Exportar respostas do NPS', done: true },
                { text: 'Calcular score por segmento', done: true },
                { text: 'Montar apresentação', done: false },
                { text: 'Apresentar para liderança', done: false }
            ],
            comments: [{ user_id: rafaelCS._id, text: 'Rafael Viajante aceitou a missão', type: 'activity' }]
        },
        {
            title: 'Campanha de retenção — clientes inativos há 90 dias',
            type: 'support', faction: 'Customer Service',
            xp_reward: 400, coin_reward: 50,
            status: 'todo', sprint_id: sprint3._id,
            sla_seconds: 86400
        },
        {
            title: 'Preparar deck de renovação para contas enterprise',
            type: 'normal', faction: 'Customer Service',
            xp_reward: 250, coin_reward: 30,
            status: 'todo', sprint_id: sprint3._id
        },

        // ── Backlog (sem sprint) ───────────────────────────────────────
        {
            title: 'Implementar autenticação OAuth 2.0 com Google',
            type: 'jira', faction: 'Produto',
            xp_reward: 600, coin_reward: 75, status: 'todo'
        },
        {
            title: 'Redesign da tela de onboarding — novo fluxo de ativação',
            type: 'normal', faction: 'Produto',
            xp_reward: 500, coin_reward: 60, status: 'todo'
        },
        {
            title: 'Migrar relatórios legados para o novo BI interno',
            type: 'jira', faction: 'Produto',
            xp_reward: 550, coin_reward: 65, status: 'todo'
        },
        {
            title: 'Criar pesquisa de satisfação pós-atendimento',
            type: 'normal', faction: 'Suporte',
            xp_reward: 300, coin_reward: 35, status: 'todo'
        },
        {
            title: 'Documentar SLAs por categoria de ticket',
            type: 'normal', faction: 'Suporte',
            xp_reward: 250, coin_reward: 30, status: 'todo'
        },
        {
            title: 'Campanha de upsell — clientes no plano básico há +1 ano',
            type: 'support', faction: 'Customer Service',
            xp_reward: 400, coin_reward: 50, status: 'todo'
        },
        {
            title: 'Mapear oportunidades de cross-sell para Q3',
            type: 'normal', faction: 'Customer Service',
            xp_reward: 350, coin_reward: 40, status: 'todo'
        }
    ]);
    console.log(`⚔️  ${quests.length} quests criadas`);

    // ===================== COMPLETIONS =====================
    const doneQuests = quests.filter(q => q.status === 'done');
    const csatMap = {
        [doneQuests.find(q => q.type === 'support' && q.faction === 'Suporte')?._id]: 5,
        [doneQuests.find(q => q.type === 'support' && q.faction === 'Customer Service')?._id]: 4
    };
    const completionOffset = [2, 3, 1, 2, 3, 2];
    const completions = await QuestCompletion.create(
        doneQuests.map((q, i) => ({
            user_id:      q.assigned_to,
            quest_id:     q._id,
            xp_gained:    q.xp_reward,
            coins_gained: q.coin_reward,
            csat_score:   csatMap[q._id] || null,
            was_cursed:   false,
            completed_at: d(-(completionOffset[i] || 1))
        }))
    );
    console.log(`✅ ${completions.length} quest completions registradas`);

    // ===================== LOOT =====================
    await LootItem.create([
        { name: 'Caneca Pixel Art',       price: 150, image: 'assets/imgs/caneca_pixel.jpg' },
        { name: 'Caneta Mágica',          price: 80,  image: 'assets/imgs/caneta_pixel.jpg' },
        { name: 'Mousepad do Guerreiro',  price: 200, image: 'assets/imgs/caneca_pixel.jpg' },
        { name: 'Headset do Oráculo',     price: 500, image: 'assets/imgs/caneta_pixel.jpg' },
        { name: 'Cadeira do Trono',       price: 999, image: 'assets/imgs/caneca_pixel.jpg' },
        { name: 'Adesivo Épico Pack',     price: 50,  image: 'assets/imgs/caneta_pixel.jpg' },
        { name: 'Camiseta da Guilda',     price: 300, image: 'assets/imgs/caneca_pixel.jpg' },
        { name: 'Garrafa do Aventureiro', price: 120, image: 'assets/imgs/caneta_pixel.jpg' }
    ]);
    console.log('🎁 8 itens de loot criados');

    await mongoose.disconnect();
    console.log('\n🎉 Seed Atlas concluído!\n');
    console.log('  Admin 1:      douglas_admin / 123');
    console.log('  Admin 2:      daniel_admin / 123');
    console.log('  Líder Produto: douglas_produto / 123');
    console.log('  Líder Suporte: carlos_suporte / 123');
    console.log('  Líder CS:      ana_cs / 123');
    console.log('  Sprint ativa: Sprint 3 — Estabilização v1.2');
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
