const { createApp } = require('../src/app');
const { openDb } = require('../src/db');
const { loadConfig } = require('../src/config');

// Fresh in memory app for each test file.
function makeApp(env = {}) {
  const config = loadConfig({ CURRENCY: 'SAR', VAT_RATE: '15', ...env });
  const db = openDb(':memory:');
  const app = createApp({ db, config });
  return { app, db, config };
}

const sampleClient = {
  name: 'Test Person',
  company: 'Test Company LLC',
  email: 'test@company.example',
  address: 'Street 1\nJeddah',
  vat_number: '300000000000003',
};

function sampleInvoice(clientId, overrides = {}) {
  return {
    client_id: clientId,
    issue_date: '2026-10-01',
    due_date: '2026-10-15',
    status: 'Draft',
    notes: 'Thanks!',
    items: [
      { description: 'Design work', quantity: 2, unit_price: '150.50' },
      { description: 'Hosting', quantity: 1, unit_price: 99.99 },
    ],
    ...overrides,
  };
}

// Supertest parser that collects a binary body into a Buffer.
function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

module.exports = { makeApp, sampleClient, sampleInvoice, binaryParser };
