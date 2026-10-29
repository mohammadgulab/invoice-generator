const request = require('supertest');
const { makeApp, sampleClient, sampleInvoice } = require('./helpers');

describe('Invoices API', () => {
  let app;
  beforeEach(async () => {
    ({ app } = makeApp());
    await request(app).post('/api/clients').send(sampleClient);
    await request(app).post('/api/clients').send({ name: 'Second Client', company: 'Blue Ltd' });
  });

  test('creates an invoice with server side totals and an auto number', async () => {
    const res = await request(app).post('/api/invoices').send(sampleInvoice(1)).expect(201);
    expect(res.headers.location).toBe('/api/invoices/1');
    expect(res.body).toMatchObject({
      number: 'INV-2026-0001',
      currency: 'SAR',
      vat_rate: 15,
      subtotal: 40099,
      vat: 6015,
      total: 46114,
      status: 'Draft',
    });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ position: 1, quantity: 2, unit_price: 15050, amount: 30100 });
    expect(res.body.client.company).toBe('Test Company LLC');
  });

  test('ignores totals sent by the client', async () => {
    const res = await request(app).post('/api/invoices').send({ ...sampleInvoice(1), total: 1, subtotal: 1 }).expect(201);
    expect(res.body.total).toBe(46114);
  });

  test('numbers count up per year', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    const second = await request(app).post('/api/invoices').send(sampleInvoice(2));
    const nextYear = await request(app).post('/api/invoices').send(sampleInvoice(1, { issue_date: '2027-01-03', due_date: '2027-01-17' }));
    expect(second.body.number).toBe('INV-2026-0002');
    expect(nextYear.body.number).toBe('INV-2027-0001');
  });

  test('lists invoices with client names and filters by status and search', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    await request(app).post('/api/invoices').send(sampleInvoice(2, { status: 'Paid' }));

    const all = await request(app).get('/api/invoices').expect(200);
    expect(all.body).toHaveLength(2);
    expect(all.body[0]).toHaveProperty('client_name');

    const paid = await request(app).get('/api/invoices?status=Paid').expect(200);
    expect(paid.body).toHaveLength(1);
    expect(paid.body[0].client_company).toBe('Blue Ltd');

    const search = await request(app).get('/api/invoices?q=Test%20Company').expect(200);
    expect(search.body).toHaveLength(1);

    await request(app).get('/api/invoices?status=Lost').expect(400);
  });

  test('updates an invoice and recalculates totals', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    const res = await request(app)
      .put('/api/invoices/1')
      .send(sampleInvoice(2, { items: [{ description: 'New line', quantity: 3, unit_price: '100' }], status: 'Sent' }))
      .expect(200);
    expect(res.body).toMatchObject({ number: 'INV-2026-0001', client_id: 2, subtotal: 30000, vat: 4500, total: 34500, status: 'Sent' });
    expect(res.body.items).toHaveLength(1);
  });

  test('changes status with PATCH', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    const res = await request(app).patch('/api/invoices/1/status').send({ status: 'Paid' }).expect(200);
    expect(res.body.status).toBe('Paid');
    await request(app).patch('/api/invoices/1/status').send({ status: 'Unknown' }).expect(400);
  });

  test('stats sum totals per status', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    await request(app).post('/api/invoices').send(sampleInvoice(1, { status: 'Paid' }));
    const res = await request(app).get('/api/invoices/stats').expect(200);
    expect(res.body.draft).toEqual({ count: 1, total: 46114 });
    expect(res.body.paid).toEqual({ count: 1, total: 46114 });
    expect(res.body.sent).toEqual({ count: 0, total: 0 });
  });

  test('deletes an invoice and its items', async () => {
    await request(app).post('/api/invoices').send(sampleInvoice(1));
    await request(app).delete('/api/invoices/1').expect(204);
    await request(app).get('/api/invoices/1').expect(404);
    await request(app).delete('/api/invoices/1').expect(404);
  });

  test('returns 404 for unknown invoices', async () => {
    await request(app).get('/api/invoices/77').expect(404);
    await request(app).put('/api/invoices/77').send(sampleInvoice(1)).expect(404);
    await request(app).patch('/api/invoices/77/status').send({ status: 'Paid' }).expect(404);
  });

  test('uses VAT_RATE and CURRENCY from the environment', async () => {
    const custom = makeApp({ VAT_RATE: '5', CURRENCY: 'aed' }).app;
    await request(custom).post('/api/clients').send(sampleClient);
    const res = await request(custom)
      .post('/api/invoices')
      .send(sampleInvoice(1, { items: [{ description: 'x', quantity: 1, unit_price: '200' }] }))
      .expect(201);
    expect(res.body).toMatchObject({ currency: 'AED', vat_rate: 5, vat: 1000, total: 21000 });
  });
});
