const request = require('supertest');
const app     = require('../../app');
const { createAdmin, createPlayer } = require('../fixtures');

describe('Auth — POST /api/auth/login', () => {
    it('deve retornar token e dados do usuário com credenciais válidas', async () => {
        await createAdmin({ username: 'admin_login', password: 'Admin@123' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin_login', password: 'Admin@123' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toMatchObject({ username: 'admin_login', role: 'admin' });
        expect(res.body).toHaveProperty('requiresPasswordChange');
    });

    it('deve retornar 401 com senha incorreta', async () => {
        await createAdmin({ username: 'admin_wrong_pass' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin_wrong_pass', password: 'SenhaErrada' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('message');
    });

    it('deve retornar 401 com usuário inexistente', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'nao_existe', password: '123' });

        expect(res.status).toBe(401);
    });

    it('deve incluir requiresPasswordChange: true quando flag está ativa', async () => {
        await createAdmin({ username: 'admin_force_pw', password: 'Admin@123', force_password_change: true });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin_force_pw', password: 'Admin@123' });

        expect(res.status).toBe(200);
        expect(res.body.requiresPasswordChange).toBe(true);
    });
});

describe('Auth — POST /api/auth/register', () => {
    it('deve criar usuário quando chamado por admin autenticado', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${token}`)
            .send({
                username: 'novo_funcionario',
                password: 'Senha@123',
                nome:     'Funcionário Novo',
                role:     'funcionario',
                faction:  'Produto',
            });

        expect(res.status).toBe(201);
        expect(res.body.user).toMatchObject({ username: 'novo_funcionario', role: 'funcionario' });
    });

    it('deve retornar 403 quando chamado por funcionário', async () => {
        const { token } = await createPlayer();

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'outro', password: '123', nome: 'Teste', role: 'funcionario' });

        expect(res.status).toBe(403);
    });

    it('deve retornar 401 sem token', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'test', password: '123', nome: 'Teste' });

        expect(res.status).toBe(401);
    });

    it('deve retornar 400 ao tentar registrar username duplicado', async () => {
        const { token } = await createAdmin();
        await createPlayer({ username: 'usuario_existente' });

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: 'usuario_existente', password: '123', nome: 'Dup', role: 'funcionario' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/já existe/i);
    });

    it('deve criar com force_password_change: true quando solicitado', async () => {
        const { token } = await createAdmin();

        const res = await request(app)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${token}`)
            .send({
                username:              'user_force_pw',
                password:              'Senha@123',
                nome:                  'Force PW User',
                role:                  'funcionario',
                force_password_change: true,
            });

        expect(res.status).toBe(201);
    });
});
