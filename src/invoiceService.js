const { computeTotals } = require('./money');
const { notFound, HttpError } = require('./errors');

// Data access and business rules for invoices, kept out of the routes.
function createInvoiceService(db, config) {
  const getClient = db.prepare('SELECT * FROM clients WHERE id = ?');

  function nextNumber(issueDate) {
    const year = issueDate.slice(0, 4);
    const row = db
      .prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1")
      .get(`INV-${year}-%`);
    const last = row ? Number(row.number.split('-')[2]) : 0;
    return `INV-${year}-${String(last + 1).padStart(4, '0')}`;
  }

  function assertClient(clientId) {
    if (!getClient.get(clientId)) {
      throw new HttpError(400, 'Validation failed', [{ field: 'client_id', message: 'Client does not exist' }]);
    }
  }

  const insertItem = db.prepare(
    `INSERT INTO invoice_items (invoice_id, position, description, quantity, unit_price, amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  function writeItems(invoiceId, lines) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    lines.forEach((l, i) => insertItem.run(invoiceId, i + 1, l.description, l.quantity, l.unit_price_minor, l.amount_minor));
  }

  function shape(row) {
    if (!row) return null;
    const items = db
      .prepare('SELECT id, position, description, quantity, unit_price, amount FROM invoice_items WHERE invoice_id = ? ORDER BY position')
      .all(row.id);
    const client = getClient.get(row.client_id);
    return { ...row, vat_rate: row.vat_rate_bp / 100, items, client };
  }

  function get(id) {
    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!row) throw notFound('Invoice');
    return shape(row);
  }

  function list({ status, client_id: clientId, q } = {}) {
    const where = [];
    const params = {};
    if (status) { where.push('i.status = @status'); params.status = status; }
    if (clientId) { where.push('i.client_id = @clientId'); params.clientId = Number(clientId); }
    if (q) { where.push('(i.number LIKE @q OR c.name LIKE @q OR c.company LIKE @q)'); params.q = `%${q}%`; }
    const sql = `SELECT i.*, c.name AS client_name, c.company AS client_company
      FROM invoices i JOIN clients c ON c.id = i.client_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY i.issue_date DESC, i.id DESC`;
    return db.prepare(sql).all(params);
  }

  const create = db.transaction((data) => {
    assertClient(data.client_id);
    const { lines, subtotal, vat, total } = computeTotals(data.items, config.vatRateBp);
    const number = nextNumber(data.issue_date);
    const info = db
      .prepare(
        `INSERT INTO invoices (number, client_id, issue_date, due_date, status, notes, currency, vat_rate_bp, subtotal, vat, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(number, data.client_id, data.issue_date, data.due_date, data.status, data.notes ?? null,
        config.currency, config.vatRateBp, subtotal, vat, total);
    writeItems(info.lastInsertRowid, lines);
    return get(info.lastInsertRowid);
  });

  const update = db.transaction((id, data) => {
    const existing = get(id);
    assertClient(data.client_id);
    // Keep the VAT rate the invoice was created with, so old invoices don't change.
    const { lines, subtotal, vat, total } = computeTotals(data.items, existing.vat_rate_bp);
    db.prepare(
      `UPDATE invoices SET client_id = ?, issue_date = ?, due_date = ?, status = ?, notes = ?,
         subtotal = ?, vat = ?, total = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(data.client_id, data.issue_date, data.due_date, data.status, data.notes ?? null, subtotal, vat, total, id);
    writeItems(id, lines);
    return get(id);
  });

  function setStatus(id, status) {
    get(id);
    db.prepare("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return get(id);
  }

  function remove(id) {
    const info = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    if (!info.changes) throw notFound('Invoice');
  }

  function stats() {
    const rows = db.prepare('SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM invoices GROUP BY status').all();
    const out = { currency: config.currency };
    for (const s of ['Draft', 'Sent', 'Paid']) {
      const r = rows.find((x) => x.status === s);
      out[s.toLowerCase()] = { count: r ? r.count : 0, total: r ? r.total : 0 };
    }
    const overdue = db
      .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM invoices WHERE status = 'Sent' AND due_date < date('now')")
      .get();
    out.overdue = overdue;
    return out;
  }

  return { list, get, create, update, setStatus, remove, stats, nextNumber };
}

module.exports = { createInvoiceService };
