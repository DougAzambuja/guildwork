const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createSprint, createQuest } = require('../fixtures');

describe('Sprint — GET /api/sprints', () => {
    it('usuário autenticado deve listar sprints', async () => {
        const { token } = await createPlayer();
        await createSprint({ name: 'Sprint A' });
        await createSprint({ name: 'Sprint B', status: 'planning' });

        const res = await request(app)
            .get('/api/sprints')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/sprints');
        expect(res.status).toBe(401);
    });
});

describe('Sprint — GET /api/sprints/active', () => {
    it('deve retornar a sprint ativa', async () => {
        const { token } = await createPlayer();
        await createSprint({ status: 'active', name: 'Sprint Ativa' });

        const res = await request(app)
            .get('/api/sprints/active')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });
});

describe('Sprint — POST /api/sprints', () => {
    it('admin deve criar sprint', async () => {
        const { token } = await createAdmin();
        const now    = new Date();
        const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const res = await request(app)
            .post('/api/sprints')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name:          'Nova Sprint',
                status:        'planning',
                factions:      ['Produto'],
                start_date:    now.toISOString(),
                end_date:      future.toISOString(),
                duration_days: 7,
            });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: 'Nova Sprint', duration_days: 7 });
        expect(res.body).toHaveProperty('_id');
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/sprints')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Incompleta' });

        expect(res.status).toBe(400);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();
        const now    = new Date();
        const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const res = await request(app)
            .post('/api/sprints')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name:          'Tentativa Player',
                factions:      ['Produto'],
                start_date:    now,
                end_date:      future,
                duration_days: 7,
            });

        expect(res.status).toBe(403);
    });
});

describe('Sprint — PATCH /api/sprints/:id', () => {
    it('admin deve atualizar nome e goal da sprint', async () => {
        const { token } = await createAdmin();
        const sprint    = await createSprint({ name: 'Sprint Original' });

        const res = await request(app)
            .patch(`/api/sprints/${sprint._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Sprint Atualizada', goal: 'Meta nova' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Sprint Atualizada');
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .patch('/api/sprints/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Teste' });

        expect(res.status).toBe(404);
    });
});

describe('Sprint — DELETE /api/sprints/:id', () => {
    it('admin deve deletar sprint', async () => {
        const { token } = await createAdmin();
        const sprint    = await createSprint({ status: 'planning' });

        const res = await request(app)
            .delete(`/api/sprints/${sprint._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();
        const sprint    = await createSprint();

        const res = await request(app)
            .delete(`/api/sprints/${sprint._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

describe('Sprint — GET /api/sprints/:id/burndown', () => {
    it('deve retornar dados de burndown da sprint', async () => {
        const { token } = await createAdmin();
        const sprint    = await createSprint();

        const res = await request(app)
            .get(`/api/sprints/${sprint._id}/burndown`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('labels');
        expect(res.body).toHaveProperty('ideal_line');
        expect(res.body).toHaveProperty('actual_line');
    });
});
