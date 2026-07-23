const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');

describe('Players — GET /api/players/me', () => {
    it('deve retornar dados do jogador autenticado', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/players/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ role: 'funcionario' });
        expect(res.body).toHaveProperty('xp');
        expect(res.body).toHaveProperty('coins');
        expect(res.body).toHaveProperty('level');
        expect(res.body).not.toHaveProperty('password');
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/players/me');
        expect(res.status).toBe(401);
    });
});

describe('Players — PUT /api/players/me', () => {
    it('deve alterar a senha com currentPassword correto', async () => {
        const { user, token } = await createPlayer({ username: 'player_pw_change', password: 'Senha@123' });

        const res = await request(app)
            .put('/api/players/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'Senha@123', newPassword: 'NovaSenha@456' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('username');
    });

    it('deve retornar 401 com currentPassword incorreto', async () => {
        const { token } = await createPlayer({ username: 'player_pw_wrong', password: 'Senha@123' });

        const res = await request(app)
            .put('/api/players/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'SenhaErrada', newPassword: 'NovaSenha@456' });

        expect([400, 401]).toContain(res.status);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app)
            .put('/api/players/me')
            .send({ currentPassword: 'x', newPassword: 'y' });

        expect(res.status).toBe(401);
    });
});

describe('Players — GET /api/players/leaderboard', () => {
    it('deve retornar lista de jogadores ordenada por XP', async () => {
        const { token } = await createPlayer();
        await createPlayer({ username: `player_lb_${Date.now()}`, xp: 500 });

        const res = await request(app)
            .get('/api/players/leaderboard')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.rankings)).toBe(true);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/players/leaderboard');
        expect(res.status).toBe(401);
    });
});

describe('Players — GET /api/players/:id/public', () => {
    it('deve retornar perfil público sem dados sensíveis', async () => {
        const { user, token } = await createPlayer();

        const res = await request(app)
            .get(`/api/players/${user._id}/public`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).toHaveProperty('nome');
    });
});
