const express = require('express');
const { invoiceSchema, statusSchema, idParam, STATUSES } = require('../validation');
const { HttpError } = require('../errors');
const { buildInvoicePdf } = require('../pdf');

function invoicesRouter(service, config) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status, client_id: clientId, q } = req.query;
    if (status && !STATUSES.includes(status)) {
      throw new HttpError(400, `Status must be one of ${STATUSES.join(', ')}`);
    }
    res.json(service.list({ status, client_id: clientId, q }));
  });

  router.get('/stats', (req, res) => res.json(service.stats()));

  router.get('/:id', (req, res) => res.json(service.get(idParam.parse(req.params.id))));

  router.post('/', (req, res) => {
    const invoice = service.create(invoiceSchema.parse(req.body));
    res.status(201).location(`/api/invoices/${invoice.id}`).json(invoice);
  });

  router.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(service.update(id, invoiceSchema.parse(req.body)));
  });

  router.patch('/:id/status', (req, res) => {
    const id = idParam.parse(req.params.id);
    res.json(service.setStatus(id, statusSchema.parse(req.body).status));
  });

  router.delete('/:id', (req, res) => {
    service.remove(idParam.parse(req.params.id));
    res.status(204).end();
  });

  router.get('/:id/pdf', (req, res) => {
    const invoice = service.get(idParam.parse(req.params.id));
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.number}.pdf"`);
    const doc = buildInvoicePdf(invoice, config);
    doc.pipe(res);
    doc.end();
  });

  return router;
}

module.exports = invoicesRouter;
