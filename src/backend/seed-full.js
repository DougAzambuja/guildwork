/**
 * seed-full.js — Popula o banco com dados de demonstração completos.
 * Uso: node seed-full.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User            = require('./models/user');
const Quest           = require('./models/quest');
const QuestCompletion = require('./models/questCompletion');
const Sprint          = require('./models/sprint');
const LootItem        = require('./models/lootItem');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // ===================== LIMPA TUDO =====================
    await Promise.all([
        User.deleteMany({}),
        Quest.deleteMany({}),
        QuestCompletion.deleteMany({}),
        Sprint.deleteMany({}),
        LootItem.deleteMany({})
    ]);
    console.log('🗑️  Coleções limpas');

    // ===================== USUÁRIOS =====================
    const users = await User.create([
        {
            username: 'admin',
            password: '123',
            nome: 'Mestre da Guilda',
            role: 'admin',
            faction: 'Produto',
            avatar_url: 'assets/imgs/caneca_pixel.jpg',
            xp: 8450, coins: 1200, level: 3,
            quests_completed: 12, is_cursed: false
        },
        {
            username: 'joao_produto',
            password: '123',
            nome: 'João Artesão',
            role: 'funcionario',
            faction: 'Produto',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 7200, coins: 980, level: 2,
            quests_completed: 9, is_cursed: false
        },
        {
            username: 'maria_produto',
            password: '123',
            nome: 'Maria Forjadora',
            role: 'funcionario',
            faction: 'Produto',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 5100, coins: 720, level: 2,
            quests_completed: 6, is_cursed: false
        },
        {
            username: 'carlos_suporte',
            password: '123',
            nome: 'Carlos Escudeiro',
            role: 'funcionario',
            faction: 'Suporte',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 4300, coins: 540, level: 1,
            quests_completed: 5, is_cursed: false
        },
        {
            username: 'ana_cs',
            password: '123',
            nome: 'Ana Mensageira',
            role: 'funcionario',
            faction: 'Customer Service',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 3800, coins: 460, level: 1,
            quests_completed: 4, is_cursed: true
        },
        {
            username: 'lucas_suporte',
            password: '123',
            nome: 'Lucas Paladino',
            role: 'funcionario',
            faction: 'Suporte',
            avatar_url: 'assets/imgs/caneta_pixel.jpg',
            xp: 2100, coins: 310, level: 1,
            quests_completed: 2, is_cursed: false
        }
    ]);
    const adminUser  = users.find(u => u.username === 'admin');
    const joao       = users.find(u => u.username === 'joao_produto');
    const maria      = users.find(u => u.username === 'maria_produto');
    const carlos     = users.find(u => u.username === 'carlos_suporte');
    const ana        = users.find(u => u.username === 'ana_cs');
    const lucas      = users.find(u => u.username === 'lucas_suporte');
    console.log(`👥 ${users.length} usuários criados`);

    // ===================== SPRINT ATIVA =====================
    const today     = new Date();
    const startDate = new Date(today); startDate.setDate(today.getDate() - 5);
    const endDate   = new Date(today); endDate.setDate(today.getDate() + 9);

    const sprintAtiva = await Sprint.create({
        name: 'Sprint Julho — Estabilidade',
        goal: 'Reduzir bugs críticos em 80% e expandir o catálogo de missões',
        status: 'active',
        factions: ['Produto', 'Suporte', 'Customer Service'],
        start_date: startDate,
        end_date: endDate,
        duration_days: 14,
        created_by: adminUser._id
    });

    // Sprint antiga (concluída)
    const startOld = new Date(today); startOld.setDate(today.getDate() - 30);
    const endOld   = new Date(today); endOld.setDate(today.getDate() - 16);
    const sprintOld = await Sprint.create({
        name: 'Sprint Junho — Fundação',
        goal: 'Estruturar o sistema de quests e onboarding',
        status: 'completed',
        factions: ['Produto', 'Suporte'],
        start_date: startOld,
        end_date: endOld,
        duration_days: 14,
        created_by: adminUser._id
    });
    console.log('🏃 2 sprints criadas');

    // ===================== QUESTS =====================
    const quests = await Quest.create([
        // --- Sprint ativa: Produto ---
        {
            title: 'Corrigir bug no fluxo de checkout',
            type: 'urgent',
            faction: 'Produto',
            xp_reward: 500, coin_reward: 60,
            status: 'done',
            assigned_to: joao._id,
            sprint_id: sprintAtiva._id,
            sla_seconds: 7200,
            started_at: new Date(today.getTime() - 4 * 86400000)
        },
        {
            title: 'Mapear jornada do usuário na tela de perfil',
            type: 'normal',
            faction: 'Produto',
            xp_reward: 350, coin_reward: 40,
            status: 'in_progress',
            assigned_to: maria._id,
            sprint_id: sprintAtiva._id,
            started_at: new Date(today.getTime() - 2 * 86400000)
        },
        {
            title: 'Criar documentação de release v2.0',
            type: 'jira',
            faction: 'Produto',
            xp_reward: 200, coin_reward: 25,
            status: 'todo',
            sprint_id: sprintAtiva._id
        },
        {
            title: 'Revisar fluxo de onboarding com stakeholders',
            type: 'normal',
            faction: 'Produto',
            xp_reward: 300, coin_reward: 35,
            status: 'todo',
            sprint_id: sprintAtiva._id
        },

        // --- Sprint ativa: Suporte ---
        {
            title: 'Responder tickets críticos — Lote 07',
            type: 'support',
            faction: 'Suporte',
            xp_reward: 400, coin_reward: 50,
            status: 'done',
            assigned_to: carlos._id,
            sprint_id: sprintAtiva._id,
            sla_seconds: 3600,
            started_at: new Date(today.getTime() - 3 * 86400000)
        },
        {
            title: 'Atualizar base de conhecimento de FAQ',
            type: 'normal',
            faction: 'Suporte',
            xp_reward: 250, coin_reward: 30,
            status: 'in_progress',
            assigned_to: lucas._id,
            sprint_id: sprintAtiva._id,
            started_at: new Date(today.getTime() - 1 * 86400000)
        },
        {
            title: 'Escalonar tickets P1 sem resposta há 48h',
            type: 'urgent',
            faction: 'Suporte',
            xp_reward: 450, coin_reward: 55,
            status: 'todo',
            sprint_id: sprintAtiva._id,
            sla_seconds: 14400
        },

        // --- Sprint ativa: Customer Service ---
        {
            title: 'Contatar clientes churn risk — segmento B',
            type: 'support',
            faction: 'Customer Service',
            xp_reward: 380, coin_reward: 45,
            status: 'done',
            assigned_to: ana._id,
            sprint_id: sprintAtiva._id,
            sla_seconds: 10800,
            started_at: new Date(today.getTime() - 4 * 86400000)
        },
        {
            title: 'Elaborar relatório NPS do trimestre',
            type: 'normal',
            faction: 'Customer Service',
            xp_reward: 300, coin_reward: 35,
            status: 'todo',
            sprint_id: sprintAtiva._id
        },

        // --- Backlog (sem sprint) ---
        {
            title: 'Criar dashboard de métricas para liderança',
            type: 'normal',
            faction: 'Produto',
            xp_reward: 600, coin_reward: 75,
            status: 'todo'
        },
        {
            title: 'Implementar dark mode na interface',
            type: 'jira',
            faction: 'Produto',
            xp_reward: 450, coin_reward: 55,
            status: 'todo'
        },
        {
            title: 'Treinar equipe em nova ferramenta de suporte',
            type: 'normal',
            faction: 'Suporte',
            xp_reward: 350, coin_reward: 40,
            status: 'todo'
        }
    ]);
    console.log(`⚔️  ${quests.length} quests criadas`);

    // ===================== COMPLETIONS =====================
    const doneQuests = quests.filter(q => q.status === 'done');
    const completionDays = [4, 3, 4]; // dias atrás de cada conclusão

    const completions = await QuestCompletion.create(
        doneQuests.map((q, i) => ({
            user_id:      q.assigned_to,
            quest_id:     q._id,
            xp_gained:    q.xp_reward,
            coins_gained: q.coin_reward,
            csat_score:   q.type === 'support' ? 4 : null,
            was_cursed:   false,
            completed_at: new Date(today.getTime() - (completionDays[i] || 2) * 86400000)
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
        { name: 'Adesivo Épico Pack',     price: 50,  image: 'assets/imgs/caneta_pixel.jpg' }
    ]);
    console.log('🎁 6 itens de loot criados');

    await mongoose.disconnect();
    console.log('\n🎉 Seed completo! Banco populado com sucesso.');
    console.log('   Login admin:     admin / 123');
    console.log('   Login membro:    joao_produto / 123');
    console.log('   Sprint ativa:    Sprint Julho — Estabilidade');
}

run().catch(err => { console.error(err); process.exit(1); });
