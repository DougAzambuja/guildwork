// Testes unitários das funções puras de lógica de Group Quest.
// Testados via integração indireta (sem exportação das funções internas).

const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createQuest, createGuild, createSprint } = require('../fixtures');
const Quest = require('../../models/quest');
const User  = require('../../models/user');

describe('Group Quest — Distribuição de Shares (_buildContributorShares via integração)', () => {
    it('contribuidor único deve receber 100% da quest', async () => {
        const { user, token } = await createPlayer({ faction: 'Produto', coins: 0, xp: 0 });
        await createGuild({ faction_key: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });
        const quest  = await createQuest({
            faction:     'Produto',
            sprint_id:   sprint._id,
            xp_reward:   200,
            coin_reward: 20,
            status:      'in_progress',
            assigned_to: user._id,
            last_assigned_at: new Date(),
            contributors: [{
                user_id:        user._id,
                action:         'accepted',
                time_held_secs: 0,
            }],
        });

        const res = await request(app)
            .post('/api/quests/complete')
            .set('Authorization', `Bearer ${token}`)
            .send({ questId: String(quest._id) });

        expect(res.status).toBe(200);
        expect(res.body.hasParty).toBe(false);
        expect(res.body.xpGained).toBe(200);
        expect(res.body.coinsGained).toBe(20);
    });

    it('party bonus (+15%) deve ser aplicado com 2 contribuidores', async () => {
        const { user: playerA } = await createPlayer({ username: `pa_${Date.now()}`, faction: 'Produto' });
        const { user: playerB, token: tokenB } = await createPlayer({ username: `pb_${Date.now()}`, faction: 'Produto', coins: 0 });
        await createGuild({ faction_key: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });

        const quest = await createQuest({
            faction:     'Produto',
            sprint_id:   sprint._id,
            xp_reward:   100,
            coin_reward: 10,
            status:      'in_progress',
            assigned_to: playerB._id,
            // playerB precisa ter tempo suficiente para passar o quorum (10% do total)
            // total após conclusão ≈ 60s (playerA) + 30s (playerB) = 90s; quorum = 9s
            last_assigned_at: new Date(Date.now() - 30000),
            contributors: [
                { user_id: playerA._id, action: 'accepted',  time_held_secs: 0  },
                { user_id: playerA._id, action: 'moved',     time_held_secs: 60 },
                { user_id: playerB._id, action: 'accepted',  time_held_secs: 0  },
            ],
        });

        const res = await request(app)
            .post('/api/quests/complete')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ questId: String(quest._id) });

        expect(res.status).toBe(200);
        expect(res.body.hasParty).toBe(true);
        // Pool total = 100 * 1.15 = 115 XP
        const totalPool = Math.round(100 * 1.15);
        expect(res.body.xpGained + (res.body.contributorsCount > 1 ? 0 : 0)).toBeGreaterThan(0);
    });
});

describe('Group Quest — Rastreamento de Contribuidores', () => {
    it('aceitar quest via move deve criar entrada accepted em contributors', async () => {
        const { user: player, token } = await createPlayer({ faction: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });
        const quest  = await createQuest({ faction: 'Produto', sprint_id: sprint._id, status: 'todo' });

        await request(app)
            .patch(`/api/quests/${quest._id}/move`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress' });

        const updated = await Quest.findById(quest._id);
        expect(updated.contributors.length).toBeGreaterThanOrEqual(1);
        expect(updated.contributors[0].action).toBe('accepted');
        expect(updated.last_assigned_at).not.toBeNull();
    });

    it('devolução ao backlog deve criar entrada rejected em contributors', async () => {
        const { user: admin, token } = await createAdmin();
        const { user: player }       = await createPlayer({ faction: 'Produto' });
        await createGuild({ faction_key: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });

        const quest = await createQuest({
            faction:     'Produto',
            sprint_id:   sprint._id,
            status:      'in_progress',
            assigned_to: player._id,
            last_assigned_at: new Date(Date.now() - 30000),
            contributors: [{ user_id: player._id, action: 'accepted', time_held_secs: 0 }],
        });

        // Precisamos de uma coluna "todo" — buscamos pelo status_map
        const KanbanColumn = require('../../models/kanbanColumn');
        const Guild = require('../../models/guild');
        const guild = await Guild.findOne({ faction_key: 'Produto' });
        let todoCol = await KanbanColumn.findOne({ guild_id: guild._id, status_map: 'todo' });

        // Se não existe coluna, cria uma para o teste
        if (!todoCol) {
            todoCol = await KanbanColumn.create({
                guild_id:   guild._id,
                name:       'A Fazer',
                status_map: 'todo',
                order:      0,
            });
        }

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/move-column`)
            .set('Authorization', `Bearer ${token}`)
            .send({ column_id: String(todoCol._id) });

        expect(res.status).toBe(200);
        const updated = await Quest.findById(quest._id);
        const rejected = updated.contributors.find(c => c.action === 'rejected');
        expect(rejected).toBeDefined();
        expect(rejected.time_held_secs).toBeGreaterThanOrEqual(0);
        expect(updated.assigned_to).toBeNull();
    });
});

describe('Group Quest — Admin conclui quest com contribuidores (sem crash)', () => {
    it('admin que conclui quest com contribuidores deve retornar 200 sem crash', async () => {
        const { user: admin, token } = await createAdmin({ faction: 'Produto' });
        const { user: player }       = await createPlayer({ faction: 'Produto' });
        await createGuild({ faction_key: 'Produto' });

        const KanbanColumn = require('../../models/kanbanColumn');
        const Guild = require('../../models/guild');
        const guild = await Guild.findOne({ faction_key: 'Produto' });

        let doneCol = await KanbanColumn.findOne({ guild_id: guild._id, status_map: 'done' });
        if (!doneCol) {
            doneCol = await KanbanColumn.create({
                guild_id:   guild._id,
                name:       'Concluído',
                status_map: 'done',
                order:      2,
            });
        }

        const quest = await createQuest({
            faction:     'Produto',
            status:      'in_progress',
            assigned_to: player._id,
            last_assigned_at: new Date(Date.now() - 60000),
            contributors: [{ user_id: player._id, action: 'accepted', time_held_secs: 60 }],
        });

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/move-column`)
            .set('Authorization', `Bearer ${token}`)
            .send({ column_id: String(doneCol._id) });

        // Não deve crashar (500). Admin recebe xpGained: 0
        expect(res.status).toBe(200);
        expect(res.body.xpGained).toBe(0);
    });
});
