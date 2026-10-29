const path = require('path');
const express = require('express');
const { loadConfig } = require('./config');
const { openDb } = require('./db');
const { createInvoiceService } = require('./invoiceService');
const { notFoundHandler, errorHandler } = require('./errors');
const clientsRouter = require('./routes/clients');
const invoicesRouter = require('./routes/invoices');
const metaRouter = require('./routes/meta');

function createApp({ db, config } = {}) {
  config = config || loadConfig();
  db = db || openDb(config.dbFile);
  const service = createInvoiceService(db, config);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', metaRouter(config));
  app.use('/api/clients', clientsRouter(db));
  app.use('/api/invoices', invoicesRouter(service, config));

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.locals.db = db;
  app.locals.service = service;
  return app;
}

module.exports = { createApp };
