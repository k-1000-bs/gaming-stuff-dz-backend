const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');

const testEmail = `test.${Date.now()}@example.com`;
const password = 'MotDePasse123';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Auth — Inscription', () => {
  it('refuse un mot de passe trop faible', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User',
      email: testEmail,
      password: '123456',
    });
    expect(res.statusCode).toBe(422);
  });

  it('crée un compte avec des données valides', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User',
      email: testEmail,
      password,
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.password).toBeUndefined(); // jamais exposé
  });

  it("refuse un e-mail déjà utilisé", async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User',
      email: testEmail,
      password,
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('Auth — Connexion', () => {
  it('refuse un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'MauvaisMotDePasse1',
    });
    expect(res.statusCode).toBe(401);
  });

  it('connecte avec les bons identifiants et renvoie un accessToken', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testEmail, password });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined(); // refresh token en cookie httpOnly
  });
});

describe('Routes protégées', () => {
  it('refuse l\'accès à /api/auth/me sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('autorise l\'accès à /api/auth/me avec un token valide', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: testEmail, password });
    const token = login.body.data.accessToken;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('refuse une route admin à un simple utilisateur', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: testEmail, password });
    const token = login.body.data.accessToken;

    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });
});
