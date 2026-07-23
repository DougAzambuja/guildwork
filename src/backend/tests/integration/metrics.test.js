const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');

describe('Metrics — GET /api/metrics', () => {
    it('admin deve receber métricas do sistema', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .get('/api/metrics')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
    });

    it('deve retornar 403 para funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .get('/api/metrics')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/metrics');
        expect(res.status).toBe(401);
    });
});
