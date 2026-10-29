const request = require('supertest');
const { makeApp, sampleClient, sampleInvoice } = require('./helpers');

describe('Clients API', () => {
  let app;
  beforeEach(() => ({ app } = makeApp()));

  test('creates, reads, lists, updates and deletes a client', async () => {
    const created = await request(app).post('/api/clients').send(sampleClient).expect(201);
    expect(created.body).toMatchObject({ id: 1, name: 'Test Person', company: 'Test Company LLC' });

    const one = await request(app).get('/api/clients/1').expect(200);
    expect(one.body.email).toBe('test@company.example');

    await request(app).post('/api/clients').send({ name: 'Another' }).expect(201);
    const list = await request(app).get('/api/clients').expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((c) => c.name)).toEqual(['Another', 'Test Person']);

    const updated = await request(app).put('/api/clients/1').send({ ...sampleClient, company: 'Renamed Co' }).expect(200);
    expect(updated.body.company).toBe('Renamed Co');

    await request(app).delete('/api/clients/1').expect(204);
    await request(app).get('/api/clients/1').expect(404);
  });

  test('search filters by name, company or email', async () => {
    await request(app).post('/api/clients').send(sampleClient);
    await request(app).post('/api/clients').send({ name: 'Zed', company: 'Blue Ltd' });
    const res = await request(app).get('/api/clients?q=blue').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Zed');
  });

  test('empty optional fields are stored as null', async () => {
    const res = await request(app).post('/api/clients').send({ name: 'Solo', company: '', email: '' }).expect(201);
    expect(res.body.company).toBeNull();
    expect(res.body.email).toBeNull();
  });

  test('returns 404 for unknown clients', async () => {
    await request(app).get('/api/clients/999').expect(404);
    await request(app).put('/api/clients/999').send(sampleClient).expect(404);
    await request(app).delete('/api/clients/999').expect(404);
  });

  test('refuses to delete a client that has invoices', async () => {
    await request(app).post('/api/clients').send(sampleClient);
    await request(app).post('/api/invoices').send(sampleInvoice(1)).expect(201);
    const res = await request(app).delete('/api/clients/1').expect(409);
    expect(res.body.error).toMatch(/1 invoice/);
  });
});
