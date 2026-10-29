const request = require('supertest');
const { makeApp, sampleClient, sampleInvoice } = require('./helpers');

describe('Validation and errors', () => {
  let app;
  beforeEach(async () => {
    ({ app } = makeApp());
    await request(app).post('/api/clients').send(sampleClient);
  });

  const fields = (res) => res.body.details.map((d) => d.field);

  test('client name is required and email must be valid', async () => {
    const res = await request(app).post('/api/clients').send({ name: '  ', email: 'not-an-email' }).expect(400);
    expect(res.body.error).toBe('Validation failed');
    expect(fields(res)).toEqual(expect.arrayContaining(['name', 'email']));
  });

  test('invoice needs at least one line item', async () => {
    const res = await request(app).post('/api/invoices').send(sampleInvoice(1, { items: [] })).expect(400);
    expect(fields(res)).toContain('items');
  });

  test('line items are checked one by one', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send(sampleInvoice(1, { items: [{ description: '', quantity: 0, unit_price: '12.345' }] }))
      .expect(400);
    expect(fields(res)).toEqual(expect.arrayContaining(['items.0.description', 'items.0.quantity', 'items.0.unit_price']));
  });

  test('negative prices are rejected', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .send(sampleInvoice(1, { items: [{ description: 'x', quantity: 1, unit_price: '-5' }] }))
      .expect(400);
    expect(fields(res)).toContain('items.0.unit_price');
  });

  test('dates must be real and due date cannot be before issue date', async () => {
    let res = await request(app).post('/api/invoices').send(sampleInvoice(1, { issue_date: '2026-02-30' })).expect(400);
    expect(fields(res)).toContain('issue_date');
    res = await request(app).post('/api/invoices').send(sampleInvoice(1, { due_date: '2026-09-01' })).expect(400);
    expect(fields(res)).toContain('due_date');
  });

  test('unknown status is rejected', async () => {
    const res = await request(app).post('/api/invoices').send(sampleInvoice(1, { status: 'Cancelled' })).expect(400);
    expect(fields(res)).toContain('status');
  });

  test('client must exist', async () => {
    const res = await request(app).post('/api/invoices').send(sampleInvoice(42)).expect(400);
    expect(res.body.details[0]).toEqual({ field: 'client_id', message: 'Client does not exist' });
  });

  test('broken JSON gives a clear 400', async () => {
    const res = await request(app).post('/api/clients').set('Content-Type', 'application/json').send('{"name": ').expect(400);
    expect(res.body.error).toMatch(/not valid JSON/);
  });

  test('non numeric ids are rejected', async () => {
    await request(app).get('/api/invoices/abc').expect(400);
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body).toEqual({ error: 'Not found', path: '/api/nope' });
  });
});
