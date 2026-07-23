const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createQuest, createSprint } = require('../fixtures');

describe('Quests — GET /api/quests', () => {
    it('deve retornar quests da facção do jogador em sprint ativa', async () => {
        const { user, token } = await createPlayer({ faction: 'Produto' });
        const sprint = await createSprint({ factions: ['Produto'] });
        await createQuest({ faction: 'Produto', sprint_id: sprint._id });

        const res = await request(app)
            .get('/api/quests')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/quests');
        expect(res.status).toBe(401);
    });
});

describe('Quests — GET /api/quests/all (admin)', () => {
    it('deve listar todas as quests com paginação', async () => {
        const { token } = await createAdmin();
        await createQuest();
        await createQuest({ title: 'Quest 2' });

        const res = await request(app)
            .get('/api/quests/all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quests');
        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.quests)).toBe(true);
    });

    it('deve filtrar por status', async () => {
        const { token } = await createAdmin();
        await createQuest({ status: 'todo' });
        await createQuest({ title: 'Em Progresso', status: 'in_progress' });

        const res = await request(app)
            .get('/api/quests/all?status=todo')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        res.body.quests.forEach(q => expect(q.status).toBe('todo'));
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/quests/all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

describe('Quests — POST /api/quests', () => {
    it('admin deve criar quest com todos os campos', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/quests')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title:       'Nova Quest Admin',
                description: 'Descrição detalhada',
                type:        'normal',
                xp_reward:   200,
                coin_reward: 25,
                faction:     'Produto',
            });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ title: 'Nova Quest Admin', xp_reward: 200 });
        expect(res.body).toHaveProperty('_id');
    });

    it('deve retornar 400 se titulo estiver faltando', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/quests')
            .set('Authorization', `Bearer ${token}`)
            .send({ xp_reward: 100, coin_reward: 10, faction: 'Produto' });

        expect(res.status).toBe(400);
    });

    it('deve retornar 403 para funcionário sem liderança', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .post('/api/quests')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Tentativa', xp_reward: 100, coin_reward: 10 });

        expect(res.status).toBe(403);
    });
});

describe('Quests — GET /api/quests/:id', () => {
    it('deve retornar detalhe completo da quest para admin', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest();

        const res = await request(app)
            .get(`/api/quests/${quest._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ title: quest.title });
        expect(res.body).toHaveProperty('contributors');
        expect(res.body).toHaveProperty('comments');
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .get('/api/quests/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});

describe('Quests — PATCH /api/quests/:id (update)', () => {
    it('admin deve atualizar titulo e descrição', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest();

        const res = await request(app)
            .patch(`/api/quests/${quest._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Titulo Atualizado', xp_reward: 300 });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Titulo Atualizado');
        expect(res.body.xp_reward).toBe(300);
    });
});

describe('Quests — PATCH /api/quests/:id/assign', () => {
    it('admin deve atribuir quest a um funcionário', async () => {
        const { token } = await createAdmin();
        const { user: player } = await createPlayer({ faction: 'Produto' });
        const quest = await createQuest({ faction: 'Produto' });

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/assign`)
            .set('Authorization', `Bearer ${token}`)
            .send({ userId: player._id });

        expect(res.status).toBe(200);
        expect(String(res.body.assigned_to._id || res.body.assigned_to)).toBe(String(player._id));
    });

    it('deve resetar quest para todo ao passar userId: null', async () => {
        const { token }        = await createAdmin();
        const { user: player } = await createPlayer();
        const quest = await createQuest({ assigned_to: player._id, status: 'in_progress' });

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/assign`)
            .set('Authorization', `Bearer ${token}`)
            .send({ userId: null });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('todo');
        expect(res.body.assigned_to).toBeNull();
    });
});

describe('Quests — DELETE /api/quests/:id', () => {
    it('admin deve deletar quest em status todo', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest({ status: 'todo' });

        const res = await request(app)
            .delete(`/api/quests/${quest._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/removida/i);
    });

    it('deve retornar 400 ao tentar deletar quest in_progress', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest({ status: 'in_progress' });

        const res = await request(app)
            .delete(`/api/quests/${quest._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
    });
});

describe('Quests — PATCH /api/quests/:id/move (aceite pelo jogador)', () => {
    it('funcionário deve aceitar quest todo → in_progress', async () => {
        const { user: player, token } = await createPlayer({ faction: 'Produto' });
        const quest = await createQuest({ faction: 'Produto', status: 'todo' });

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/move`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress' });

        expect(res.status).toBe(200);
        expect(String(res.body.assigned_to._id || res.body.assigned_to)).toBe(String(player._id));
        expect(res.body.status).toBe('in_progress');
    });

    it('deve retornar erro ao tentar aceitar quest já atribuída a outro', async () => {
        const { user: other } = await createPlayer({ username: `other_${Date.now()}` });
        const { token }       = await createPlayer({ username: `second_${Date.now()}` });
        const quest = await createQuest({ assigned_to: other._id, status: 'in_progress' });

        const res = await request(app)
            .patch(`/api/quests/${quest._id}/move`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'in_progress' });

        expect([400, 403]).toContain(res.status);
    });
});

describe('Quests — POST /api/quests/:id/comments', () => {
    it('deve adicionar comentário à quest', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest();

        const res = await request(app)
            .post(`/api/quests/${quest._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'Comentário de teste' });

        expect(res.status).toBe(201);
        expect(res.body.text).toBe('Comentário de teste');
    });

    it('deve retornar 400 com comentário vazio', async () => {
        const { token } = await createAdmin();
        const quest = await createQuest();

        const res = await request(app)
            .post(`/api/quests/${quest._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ text: '   ' });

        expect(res.status).toBe(400);
    });
});
