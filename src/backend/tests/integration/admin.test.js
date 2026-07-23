const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');

describe('Admin — GET /api/admin/roster', () => {
    it('admin deve listar todos os usuários', async () => {
        const { token } = await createAdmin();
        await createPlayer({ username: `p1_${Date.now()}` });
        await createPlayer({ username: `p2_${Date.now()}` });

        const res = await request(app)
            .get('/api/admin/roster')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/admin/roster')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/admin/roster');
        expect(res.status).toBe(401);
    });

    it('nenhum usuário no roster deve ter a senha exposta', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .get('/api/admin/roster')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        res.body.forEach(u => expect(u).not.toHaveProperty('password'));
    });
});

describe('Admin — PATCH /api/admin/roster/:id', () => {
    it('admin deve atualizar campos do usuário', async () => {
        const { token }    = await createAdmin();
        const { user: p }  = await createPlayer({ username: `upd_player_${Date.now()}` });

        const res = await request(app)
            .patch(`/api/admin/roster/${p._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Nome Atualizado', faction: 'Suporte' });

        expect(res.status).toBe(200);
        expect(res.body.nome).toBe('Nome Atualizado');
        expect(res.body.faction).toBe('Suporte');
    });

    it('admin deve poder ativar force_password_change', async () => {
        const { token }   = await createAdmin();
        const { user: p } = await createPlayer({ username: `fpc_player_${Date.now()}` });

        const res = await request(app)
            .patch(`/api/admin/roster/${p._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ force_password_change: true });

        expect(res.status).toBe(200);
        expect(res.body.force_password_change).toBe(true);
    });

    it('deve retornar 403 quando funcionário tenta atualizar outro usuário', async () => {
        const { token }    = await createPlayer({ username: `attacker_${Date.now()}` });
        const { user: p2 } = await createPlayer({ username: `victim_${Date.now()}` });

        const res = await request(app)
            .patch(`/api/admin/roster/${p2._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Hacker' });

        expect(res.status).toBe(403);
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .patch('/api/admin/roster/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Teste' });

        expect(res.status).toBe(404);
    });
});
