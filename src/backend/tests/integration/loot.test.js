const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createLootItem } = require('../fixtures');

describe('Loot — GET /api/loot', () => {
    it('qualquer usuário autenticado deve listar itens', async () => {
        const { user: admin, token } = await createAdmin();
        await createLootItem(admin._id, { name: 'Espada Lendária', price: 100 });
        await createLootItem(admin._id, { name: 'Escudo Raro',     price: 50  });

        const res = await request(app)
            .get('/api/loot')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('funcionário também deve ter acesso', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/loot')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/loot');
        expect(res.status).toBe(401);
    });
});

describe('Loot — POST /api/loot', () => {
    it('admin deve criar item de loot', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/loot')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Cajado Místico', price: 75, is_cosmetic: true });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: 'Cajado Místico', price: 75 });
        expect(res.body).toHaveProperty('_id');
    });

    it('deve retornar 400 sem campos obrigatórios', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/loot')
            .set('Authorization', `Bearer ${token}`)
            .send({ is_cosmetic: true });

        expect(res.status).toBe(400);
    });

    it('deve retornar 400 se price for 0 ou negativo', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/loot')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Item Grátis', price: 0 });

        expect(res.status).toBe(400);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .post('/api/loot')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Tentativa', price: 10 });

        expect(res.status).toBe(403);
    });
});

describe('Loot — PUT /api/loot/:id', () => {
    it('admin deve atualizar item', async () => {
        const { user: admin, token } = await createAdmin();
        const item = await createLootItem(admin._id, { name: 'Item Original', price: 30 });

        const res = await request(app)
            .put(`/api/loot/${item._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Item Atualizado', price: 60 });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Item Atualizado');
        expect(res.body.price).toBe(60);
    });

    it('deve retornar 404 para id inexistente', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .put('/api/loot/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Teste', price: 10 });

        expect(res.status).toBe(404);
    });
});

describe('Loot — DELETE /api/loot/:id', () => {
    it('admin deve deletar item', async () => {
        const { user: admin, token } = await createAdmin();
        const item = await createLootItem(admin._id);

        const res = await request(app)
            .delete(`/api/loot/${item._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it('deve retornar 403 para funcionário', async () => {
        const { user: admin } = await createAdmin();
        const { token }       = await createPlayer();
        const item = await createLootItem(admin._id);

        const res = await request(app)
            .delete(`/api/loot/${item._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});
