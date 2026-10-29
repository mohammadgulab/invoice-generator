const request = require('supertest');
const { makeApp, sampleClient, sampleInvoice, binaryParser } = require('./helpers');

describe('PDF endpoint', () => {
  let app;
  beforeEach(async () => {
    ({ app } = makeApp());
    await request(app).post('/api/clients').send(sampleClient);
    await request(app).post('/api/invoices').send(sampleInvoice(1));
  });

  test('streams a real PDF with the invoice number as file name', async () => {
    const res = await request(app).get('/api/invoices/1/pdf').buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="INV-2026-0001.pdf"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(res.body.length).toBeGreaterThan(1500);
    expect(res.body.subarray(-6).toString()).toMatch(/%%EOF/);
  });

  test('can be shown inline in the browser', async () => {
    const res = await request(app).get('/api/invoices/1/pdf?inline=1').buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
  });

  test('handles long invoices that need more than one page', async () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ description: `Line item number ${i + 1} with a longer description to wrap`, quantity: 1, unit_price: '10' }));
    await request(app).post('/api/invoices').send(sampleInvoice(1, { items })).expect(201);
    const res = await request(app).get('/api/invoices/2/pdf').buffer(true).parse(binaryParser).expect(200);
    const pages = (res.body.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(1);
  });

  test('returns JSON 404 for a missing invoice', async () => {
    const res = await request(app).get('/api/invoices/99/pdf').expect(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
