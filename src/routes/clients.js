const express = require('express');
const { clientSchema, idParam } = require('../validation');
const { notFound, HttpError } = require('../errors');

function clientsRouter(db) {
  const router = express.Router();

  const find = (id) => {
    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!row) throw notFound('Client');
    return row;
  };

  router.get('/', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = q
      ? db.prepare('SELECT * FROM clients WHERE name LIKE ? OR company LIKE ? OR email LIKE ? ORDER BY name').all(`%${q}%`, `%${q}%`, `%${q}%`)
      : db.prepare('SELECT * FROM clients ORDER BY name').all();
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    res.json(find(idParam.parse(req.params.id)));
  });

  router.post('/', (req, res) => {
    const c = clientSchema.parse(req.body);
    const info = db
      .prepare('INSERT INTO clients (name, company, email, address, vat_number) VALUES (?, ?, ?, ?, ?)')
      .run(c.name, c.company ?? null, c.email ?? null, c.address ?? null, c.vat_number ?? null);
    res.status(201).json(find(info.lastInsertRowid));
  });

  router.put('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    find(id);
    const c = clientSchema.parse(req.body);
    db.prepare(
      `UPDATE clients SET name = ?, company = ?, email = ?, address = ?, vat_number = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(c.name, c.company ?? null, c.email ?? null, c.address ?? null, c.vat_number ?? null, id);
    res.json(find(id));
  });

  router.delete('/:id', (req, res) => {
    const id = idParam.parse(req.params.id);
    find(id);
    const used = db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?').get(id).n;
    if (used) throw new HttpError(409, `This client has ${used} invoice(s). Delete those first.`);
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.status(204).end();
  });

  return router;
}

module.exports = clientsRouter;
