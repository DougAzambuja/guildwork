const request    = require('supertest');
const app        = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');
const SocialEvent = require('../../models/socialEvent');

// ─── helpers ────────────────────────────────────────────────────────────────

function futureDate(hoursFromNow = 24) {
    return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

async function createEvent(adminToken, overrides = {}) {
    return request(app)
        .post('/api/social-events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            title:      'Happy Hour da Sprint',
            description: 'Barzinho do time, todos convidados!',
            event_date:  futureDate(48),
            ...overrides,
        });
}

// ─── POST /api/social-events ─────────────────────────────────────────────────

describe('SocialEvents — POST /api/social-events', () => {
    it('admin deve criar evento global', async () => {
        const { token } = await createAdmin();

        const res = await createEvent(token);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('_id');
        expect(res.body.title).toBe('Happy Hour da Sprint');
        expect(res.body.faction).toBeNull();
        expect(res.body.is_active).toBe(true);
    });

    it('admin deve criar evento por facção', async () => {
        const { token } = await createAdmin();

        const res = await createEvent(token, {
            title:   'Reunião de Suporte',
            faction: 'Suporte',
        });

        expect(res.status).toBe(201);
        expect(res.body.faction).toBe('Suporte');
    });

    it('deve retornar 400 sem title', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/social-events')
            .set('Authorization', `Bearer ${token}`)
            .send({ event_date: futureDate() });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('message');
    });

    it('deve retornar 400 sem event_date', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/social-events')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Evento sem data' });

        expect(res.status).toBe(400);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await createEvent(token);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).post('/api/social-events');
        expect(res.status).toBe(401);
    });
});

// ─── GET /api/social-events ──────────────────────────────────────────────────

describe('SocialEvents — GET /api/social-events', () => {
    it('funcionário vê eventos globais', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, { title: 'Evento Global' });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].title).toBe('Evento Global');
    });

    it('funcionário vê evento da sua facção', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, { title: 'Evento Produto', faction: 'Produto' });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].faction).toBe('Produto');
    });

    it('funcionário não vê evento de outra facção', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, { title: 'Evento Suporte', faction: 'Suporte' });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    it('admin vê todos os eventos (global + todas as facções)', async () => {
        const { token: adminToken } = await createAdmin();

        await createEvent(adminToken, { title: 'Global', faction: undefined });
        await createEvent(adminToken, { title: 'Produto', faction: 'Produto' });
        await createEvent(adminToken, { title: 'Suporte', faction: 'Suporte' });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
    });

    it('evento passado tem is_past=true mas ainda aparece na listagem', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, {
            title:      'Evento Passado',
            event_date: new Date(Date.now() - 3_600_000).toISOString(),
        });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].is_past).toBe(true);
    });

    it('evento removido (is_active=false) não aparece', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        const created = await createEvent(adminToken, { title: 'Evento Removido' });
        await SocialEvent.findByIdAndUpdate(created.body._id, { is_active: false });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/social-events');
        expect(res.status).toBe(401);
    });
});

// ─── PATCH /api/social-events/:id ────────────────────────────────────────────

describe('SocialEvents — PATCH /api/social-events/:id', () => {
    it('admin deve editar título e data do evento', async () => {
        const { token } = await createAdmin();
        const created = await createEvent(token);

        const novaData = futureDate(72);

        const res = await request(app)
            .patch(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Happy Hour Atualizado', event_date: novaData });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Happy Hour Atualizado');
        expect(new Date(res.body.event_date).getTime()).toBeCloseTo(
            new Date(novaData).getTime(),
            -3,
        );
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .patch('/api/social-events/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Novo Título' });

        expect(res.status).toBe(404);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer();

        const created = await createEvent(adminToken);

        const res = await request(app)
            .patch(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${playerToken}`)
            .send({ title: 'Hacker' });

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app)
            .patch('/api/social-events/000000000000000000000000')
            .send({ title: 'x' });
        expect(res.status).toBe(401);
    });
});

// ─── display_until ───────────────────────────────────────────────────────────

describe('SocialEvents — display_until', () => {
    it('is_past usa display_until quando definido (evento no passado mas display_until no futuro)', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, {
            event_date:    new Date(Date.now() - 3_600_000).toISOString(),
            display_until: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].is_past).toBe(false);
    });

    it('is_past=true quando display_until também passou', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, {
            event_date:    new Date(Date.now() - 4 * 3_600_000).toISOString(),
            display_until: new Date(Date.now() - 3_600_000).toISOString(),
        });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body[0].is_past).toBe(true);
    });

    it('sem display_until cai back em event_date para is_past', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        await createEvent(adminToken, {
            event_date: new Date(Date.now() - 3_600_000).toISOString(),
        });

        const res = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(200);
        expect(res.body[0].is_past).toBe(true);
    });

    it('admin deve atualizar display_until via PATCH', async () => {
        const { token } = await createAdmin();
        const created = await createEvent(token);

        const newUntil = new Date(Date.now() + 48 * 3_600_000).toISOString();

        const res = await request(app)
            .patch(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ display_until: newUntil });

        expect(res.status).toBe(200);
        expect(new Date(res.body.display_until).getTime()).toBeCloseTo(
            new Date(newUntil).getTime(),
            -3,
        );
    });

    it('admin deve limpar display_until via PATCH (null)', async () => {
        const { token } = await createAdmin();
        const created = await createEvent(token, {
            display_until: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        });

        const res = await request(app)
            .patch(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ display_until: null });

        expect(res.status).toBe(200);
        expect(res.body.display_until).toBeNull();
    });
});

// ─── DELETE /api/social-events/:id ───────────────────────────────────────────

describe('SocialEvents — DELETE /api/social-events/:id', () => {
    it('admin deve remover evento (soft delete)', async () => {
        const { token } = await createAdmin();
        const created = await createEvent(token);

        const res = await request(app)
            .delete(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.event.is_active).toBe(false);
    });

    it('evento removido não aparece em GET', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer({ faction: 'Produto' });

        const created = await createEvent(adminToken);

        await request(app)
            .delete(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        const check = await request(app)
            .get('/api/social-events')
            .set('Authorization', `Bearer ${playerToken}`);

        expect(check.body.length).toBe(0);
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .delete('/api/social-events/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token: adminToken } = await createAdmin();
        const { token: playerToken } = await createPlayer();

        const created = await createEvent(adminToken);

        const res = await request(app)
            .delete(`/api/social-events/${created.body._id}`)
            .set('Authorization', `Bearer ${playerToken}`);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).delete('/api/social-events/000000000000000000000000');
        expect(res.status).toBe(401);
    });
});
