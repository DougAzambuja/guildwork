const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer, createNotification } = require('../fixtures');

describe('Notifications — GET /api/notifications', () => {
    it('deve listar notificações do usuário autenticado', async () => {
        const { user, token } = await createPlayer();
        await createNotification(user._id, { title: 'Notif 1' });
        await createNotification(user._id, { title: 'Notif 2' });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.notifications)).toBe(true);
        expect(res.body.notifications.length).toBe(2);
    });

    it('não deve retornar notificações de outro usuário', async () => {
        const { user: u1 }   = await createPlayer({ username: `u1_${Date.now()}` });
        const { user: u2, token } = await createPlayer({ username: `u2_${Date.now()}` });
        await createNotification(u1._id, { title: 'Notif de u1' });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.notifications.length).toBe(0);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app).get('/api/notifications');
        expect(res.status).toBe(401);
    });
});

describe('Notifications — PATCH /api/notifications/read-all', () => {
    it('deve marcar todas as notificações como lidas', async () => {
        const { user, token } = await createPlayer();
        await createNotification(user._id, { read: false });
        await createNotification(user._id, { read: false, title: 'Outra' });

        const res = await request(app)
            .patch('/api/notifications/read-all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const check = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        check.body.notifications.forEach(n => expect(n.read).toBe(true));
    });
});

describe('Notifications — PATCH /api/notifications/:id/read', () => {
    it('deve marcar uma notificação específica como lida', async () => {
        const { user, token } = await createPlayer();
        const notif = await createNotification(user._id, { read: false });

        const res = await request(app)
            .patch(`/api/notifications/${notif._id}/read`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it('deve retornar 404 para notificação inexistente', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .patch('/api/notifications/000000000000000000000000/read')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });
});
