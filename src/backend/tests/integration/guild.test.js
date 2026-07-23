const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createGuild } = require('../fixtures');

describe('Guild — GET /api/guild', () => {
    it('deve retornar dados da guilda da facção do jogador', async () => {
        const { token } = await createPlayer({ faction: 'Produto' });
        await createGuild({ faction_key: 'Produto' });

        const res = await request(app)
            .get('/api/guild')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.guild).toHaveProperty('faction_key', 'Produto');
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/guild');
        expect(res.status).toBe(401);
    });
});

describe('Guild — GET /api/guild/all', () => {
    it('admin deve listar todas as guildas', async () => {
        const { token } = await createAdmin();
        await createGuild({ name: 'Guilda Suporte', faction_key: 'Suporte' });

        const res = await request(app)
            .get('/api/guild/all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/guild/all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

describe('Guild — PATCH /api/guild/leader', () => {
    it('admin deve definir líder de guilda', async () => {
        const { token }    = await createAdmin();
        const { user: p }  = await createPlayer({ username: `leader_${Date.now()}`, faction: 'Produto' });
        await createGuild({ faction_key: 'Produto' });

        const res = await request(app)
            .patch('/api/guild/leader')
            .set('Authorization', `Bearer ${token}`)
            .send({ user_id: String(p._id) });

        expect(res.status).toBe(200);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .patch('/api/guild/leader')
            .set('Authorization', `Bearer ${token}`)
            .send({ faction: 'Produto', userId: '000000000000000000000001' });

        expect(res.status).toBe(403);
    });
});

describe('Guild — GET /api/guild/columns', () => {
    it('deve retornar colunas do kanban da guilda', async () => {
        const { token } = await createPlayer({ faction: 'Produto' });
        await createGuild({ faction_key: 'Produto' });

        const res = await request(app)
            .get('/api/guild/columns')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
