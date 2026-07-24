const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');

const BASE_PAYLOAD = {
    title:            'Semana Dourada',
    description:      'XP em dobro para todos',
    effect_kind:      'xp_bonus',
    default_value:    0.5,
    default_duration: 4,
    scope_type:       'global',
};

// ─── GET /api/event-templates ────────────────────────────────────────────────

describe('EventTemplates — GET /api/event-templates', () => {
    it('admin deve listar templates', async () => {
        const { token } = await createAdmin();
        await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);

        const res = await request(app)
            .get('/api/event-templates')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[0]).toHaveProperty('title');
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/event-templates');
        expect(res.status).toBe(401);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();
        const res = await request(app)
            .get('/api/event-templates')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });
});

// ─── POST /api/event-templates ───────────────────────────────────────────────

describe('EventTemplates — POST /api/event-templates', () => {
    it('admin deve criar template com campos obrigatórios', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('_id');
        expect(res.body.title).toBe('Semana Dourada');
        expect(res.body.effect_kind).toBe('xp_bonus');
        expect(res.body.default_value).toBe(0.5);
        expect(res.body.default_duration).toBe(4);
        expect(res.body.scope_type).toBe('global');
    });

    it('deve aceitar todos os effect_kinds válidos', async () => {
        const { token } = await createAdmin();
        const kinds = ['xp_bonus', 'gold_bonus', 'xp_penalty', 'gold_penalty', 'slow', 'luck', 'store_discount'];

        for (const kind of kinds) {
            const res = await request(app)
                .post('/api/event-templates')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...BASE_PAYLOAD, title: `Teste ${kind}`, effect_kind: kind });
            expect(res.status).toBe(201);
            expect(res.body.effect_kind).toBe(kind);
        }
    });

    it('deve retornar 400 sem title', async () => {
        const { token } = await createAdmin();
        const { title, ...sem } = BASE_PAYLOAD;
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(sem);
        expect(res.status).toBe(400);
    });

    it('deve retornar 400 com default_value = 0', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...BASE_PAYLOAD, default_value: 0 });
        expect(res.status).toBe(400);
    });

    it('deve retornar 400 com default_value > 1', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...BASE_PAYLOAD, default_value: 1.5 });
        expect(res.status).toBe(400);
    });

    it('deve retornar 400 com default_duration < 1', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...BASE_PAYLOAD, default_duration: 0 });
        expect(res.status).toBe(400);
    });

    it('deve retornar 400 com effect_kind inválido', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...BASE_PAYLOAD, effect_kind: 'invalid_kind' });
        expect(res.status).toBe(400);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).post('/api/event-templates').send(BASE_PAYLOAD);
        expect(res.status).toBe(401);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();
        const res = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);
        expect(res.status).toBe(403);
    });
});

// ─── PATCH /api/event-templates/:id ─────────────────────────────────────────

describe('EventTemplates — PATCH /api/event-templates/:id', () => {
    it('admin deve atualizar template', async () => {
        const { token } = await createAdmin();
        const create = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);
        const id = create.body._id;

        const res = await request(app)
            .patch(`/api/event-templates/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Semana de Ouro', default_duration: 8 });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Semana de Ouro');
        expect(res.body.default_duration).toBe(8);
        expect(res.body.effect_kind).toBe('xp_bonus');
    });

    it('deve retornar 400 ao tentar setar default_value inválido', async () => {
        const { token } = await createAdmin();
        const create = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);

        const res = await request(app)
            .patch(`/api/event-templates/${create.body._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ default_value: 0 });

        expect(res.status).toBe(400);
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .patch('/api/event-templates/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Novo' });
        expect(res.status).toBe(404);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer();
        const create = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(BASE_PAYLOAD);

        const res = await request(app)
            .patch(`/api/event-templates/${create.body._id}`)
            .set('Authorization', `Bearer ${playerToken}`)
            .send({ title: 'Hack' });
        expect(res.status).toBe(403);
    });
});

// ─── DELETE /api/event-templates/:id ────────────────────────────────────────

describe('EventTemplates — DELETE /api/event-templates/:id', () => {
    it('admin deve excluir template', async () => {
        const { token } = await createAdmin();
        const create = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${token}`)
            .send(BASE_PAYLOAD);
        const id = create.body._id;

        const res = await request(app)
            .delete(`/api/event-templates/${id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');

        const check = await request(app)
            .get('/api/event-templates')
            .set('Authorization', `Bearer ${token}`);
        expect(check.body.find(t => t._id === id)).toBeUndefined();
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();
        const res = await request(app)
            .delete('/api/event-templates/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer();
        const create = await request(app)
            .post('/api/event-templates')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(BASE_PAYLOAD);

        const res = await request(app)
            .delete(`/api/event-templates/${create.body._id}`)
            .set('Authorization', `Bearer ${playerToken}`);
        expect(res.status).toBe(403);
    });
});
