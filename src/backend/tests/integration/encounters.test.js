const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createQuest, createGuild, createSprint } = require('../fixtures');
const RandomEncounter = require('../../models/randomEncounter');

// ─── helpers ────────────────────────────────────────────────────────────────

async function triggerEncounter(adminToken, overrides = {}) {
    return request(app)
        .post('/api/encounters/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            title:  'Incidente em Produção',
            type:   'global',
            effect: { kind: 'xp_penalty', value: 0.5, duration_hours: 2 },
            ...overrides,
        });
}

// ─── POST /api/encounters/trigger ───────────────────────────────────────────

describe('Encounters — POST /api/encounters/trigger', () => {
    it('admin deve acionar encontro global', async () => {
        const { token } = await createAdmin();

        const res = await triggerEncounter(token);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('_id');
        expect(res.body.active).toBe(true);
        expect(res.body.effect.kind).toBe('xp_penalty');
        expect(res.body.type).toBe('global');
        expect(res.body).toHaveProperty('active_until');
    });

    it('deve acionar encontro de facção com affected_faction', async () => {
        const { token } = await createAdmin();

        const res = await triggerEncounter(token, {
            title:            'Suporte em Chamas',
            type:             'faction',
            affected_faction: 'Suporte',
            effect:           { kind: 'xp_bonus', value: 0.3, duration_hours: 1 },
        });

        expect(res.status).toBe(201);
        expect(res.body.type).toBe('faction');
        expect(res.body.affected_faction).toBe('Suporte');
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/encounters/trigger')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Sem efeito' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message');
    });

    it('deve retornar 400 se duration_hours <= 0', async () => {
        const { token } = await createAdmin();

        const res = await triggerEncounter(token, {
            effect: { kind: 'xp_penalty', value: 0.5, duration_hours: 0 },
        });

        expect(res.status).toBe(400);
    });

    it('deve retornar 400 se type=faction sem affected_faction', async () => {
        const { token } = await createAdmin();

        const res = await triggerEncounter(token, { type: 'faction', affected_faction: undefined });

        expect(res.status).toBe(400);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await triggerEncounter(token);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).post('/api/encounters/trigger');
        expect(res.status).toBe(401);
    });
});

// ─── GET /api/encounters/active ─────────────────────────────────────────────

describe('Encounters — GET /api/encounters/active', () => {
    it('deve retornar encontros globais ativos', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await triggerEncounter(adminToken, {
            title: 'Evento Global',
            type:  'global',
            effect: { kind: 'xp_bonus', value: 0.2, duration_hours: 1 },
        });

        const res = await request(app)
            .get('/api/encounters/active')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].title).toBe('Evento Global');
    });

    it('deve retornar encontro da facção correta', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await triggerEncounter(adminToken, {
            title:            'Evento Produto',
            type:             'faction',
            affected_faction: 'Produto',
            effect:           { kind: 'gold_bonus', value: 0.1, duration_hours: 1 },
        });

        const res = await request(app)
            .get('/api/encounters/active')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].affected_faction).toBe('Produto');
    });

    it('não deve retornar encontro de outra facção', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await triggerEncounter(adminToken, {
            title:            'Evento Suporte',
            type:             'faction',
            affected_faction: 'Suporte',
            effect:           { kind: 'xp_penalty', value: 0.5, duration_hours: 1 },
        });

        const res = await request(app)
            .get('/api/encounters/active')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    it('não deve retornar encontro expirado (active=false)', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        const created = await triggerEncounter(adminToken, {
            title: 'Evento Expirado',
            effect: { kind: 'xp_penalty', value: 0.5, duration_hours: 1 },
        });

        // Forçar expiração
        await RandomEncounter.findByIdAndUpdate(created.body._id, { active: false });

        const res = await request(app)
            .get('/api/encounters/active')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/encounters/active');
        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/encounters/:id ─────────────────────────────────────────────

describe('Encounters — DELETE /api/encounters/:id', () => {
    it('admin deve encerrar encontro antecipadamente', async () => {
        const { token } = await createAdmin();

        const created = await triggerEncounter(token, {
            title:  'Evento a Encerrar',
            effect: { kind: 'gold_penalty', value: 0.3, duration_hours: 4 },
        });

        const res = await request(app)
            .delete(`/api/encounters/${created.body._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.encounter.active).toBe(false);
        expect(res.body).toHaveProperty('message');
    });

    it('encerrado não deve aparecer em /active', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        const created = await triggerEncounter(adminToken, {
            effect: { kind: 'xp_bonus', value: 0.5, duration_hours: 2 },
        });

        await request(app)
            .delete(`/api/encounters/${created.body._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        const check = await request(app)
            .get('/api/encounters/active')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(check.body.length).toBe(0);
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .delete('/api/encounters/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer();

        const created = await triggerEncounter(adminToken, {
            effect: { kind: 'xp_bonus', value: 0.1, duration_hours: 1 },
        });

        const res = await request(app)
            .delete(`/api/encounters/${created.body._id}`)
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).delete('/api/encounters/000000000000000000000000');
        expect(res.status).toBe(401);
    });
});

// ─── Efeito na conclusão de quest ───────────────────────────────────────────

describe('Encounters — Efeito na conclusão de quest', () => {
    it('xp_penalty reduz XP ao concluir quest', async () => {
        const { token: adminToken } = await createAdmin();
        const { user, token } = await createPlayer({ faction: 'Produto', coins: 0, xp: 0 });
        await createGuild({ faction_key: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });

        // Ativar penalidade de 50%
        await triggerEncounter(adminToken, {
            title:  'XP Penalizado',
            type:   'global',
            effect: { kind: 'xp_penalty', value: 0.5, duration_hours: 2 },
        });

        const quest = await createQuest({
            faction:          'Produto',
            sprint_id:        sprint._id,
            xp_reward:        200,
            coin_reward:      20,
            status:           'in_progress',
            assigned_to:      user._id,
            last_assigned_at: new Date(),
            contributors:     [{ user_id: user._id, action: 'accepted', time_held_secs: 0 }],
        });

        const res = await request(app)
            .post('/api/quests/complete')
            .set('Authorization', `Bearer ${token}`)
            .send({ questId: String(quest._id) });

        expect(res.status).toBe(200);
        // Com penalidade de 50%: XP ≤ 200 (exatamente 100 se sem buff)
        expect(res.body.xpGained).toBeLessThan(200);
    });

    it('sem encontro ativo: comportamento idêntico ao atual', async () => {
        const { user, token } = await createPlayer({ faction: 'Produto', coins: 0, xp: 0 });
        await createGuild({ faction_key: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });

        const quest = await createQuest({
            faction:          'Produto',
            sprint_id:        sprint._id,
            xp_reward:        100,
            coin_reward:      10,
            status:           'in_progress',
            assigned_to:      user._id,
            last_assigned_at: new Date(),
            contributors:     [{ user_id: user._id, action: 'accepted', time_held_secs: 0 }],
        });

        const res = await request(app)
            .post('/api/quests/complete')
            .set('Authorization', `Bearer ${token}`)
            .send({ questId: String(quest._id) });

        expect(res.status).toBe(200);
        expect(res.body.xpGained).toBe(100);
        expect(res.body.coinsGained).toBe(10);
    });
});
