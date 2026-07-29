const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Produits — lecture publique', () => {
  it('liste les produits avec pagination', async () => {
    const res = await request(app).get('/api/products?page=1&limit=2');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('totalPages');
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('filtre par recherche texte', async () => {
    const res = await request(app).get('/api/products?search=casque');
    expect(res.statusCode).toBe(200);
    res.body.data.forEach((p) => {
      const haystack = `${p.name} ${p.brand}`.toLowerCase();
      expect(haystack.includes('casque') || p.description.toLowerCase().includes('casque')).toBe(true);
    });
  });

  it('renvoie 404 pour un produit inexistant', async () => {
    const res = await request(app).get('/api/products/produit-qui-nexiste-pas');
    expect(res.statusCode).toBe(404);
  });

  it('refuse la création de produit sans authentification', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Test' });
    expect(res.statusCode).toBe(401);
  });
});
