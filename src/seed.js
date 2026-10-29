// Fills the database with fictional demo clients and invoices.
// Usage: npm run seed   (wipes existing clients and invoices first)
const { loadConfig } = require('./config');
const { openDb } = require('./db');
const { createInvoiceService } = require('./invoiceService');

const clients = [
  { name: 'Faisal Al Harbi', company: 'Red Dune Contracting', email: 'faisal@reddune.example', address: 'King Abdulaziz Road\nAl Zahra District\nJeddah 23425, Saudi Arabia', vat_number: '311111111100003' },
  { name: 'Sara Qureshi', company: 'Bluewave Logistics', email: 'accounts@bluewave.example', address: 'Building 7, Industrial Area 2\nDammam 32234, Saudi Arabia', vat_number: '322222222200003' },
  { name: 'Omar Siddiqui', company: 'Oasis Dental Clinic', email: 'omar@oasisdental.example', address: 'Prince Sultan Street\nAl Muhammadiyah\nJeddah 23617, Saudi Arabia', vat_number: null },
  { name: 'Lina Haddad', company: 'Cedar & Co. Interiors', email: 'lina@cedarco.example', address: 'Olaya Street, Office 305\nRiyadh 12213, Saudi Arabia', vat_number: '333333333300003' },
];

function seed(db, config) {
  const service = createInvoiceService(db, config);
  db.exec('DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM clients; DELETE FROM sqlite_sequence;');
  const ids = clients.map((c) =>
    db.prepare('INSERT INTO clients (name, company, email, address, vat_number) VALUES (?, ?, ?, ?, ?)')
      .run(c.name, c.company, c.email, c.address, c.vat_number).lastInsertRowid
  );

  const invoices = [
    { client_id: ids[0], issue_date: '2026-09-02', due_date: '2026-09-16', status: 'Paid', notes: 'Project document control setup for the Al Zahra villa compound.',
      items: [
        { description: 'Document register setup in Excel with status tracking', quantity: 1, unit_price: '1800' },
        { description: 'Transmittal and RFI templates (Word and Excel)', quantity: 4, unit_price: '250' },
        { description: 'On site training session for the site team', quantity: 3, unit_price: '350' },
      ] },
    { client_id: ids[1], issue_date: '2026-09-20', due_date: '2026-10-04', status: 'Paid', notes: null,
      items: [
        { description: 'Company landing page design and build (5 sections)', quantity: 1, unit_price: '3200' },
        { description: 'Logo refresh and brand colour guide', quantity: 1, unit_price: '950' },
      ] },
    { client_id: ids[2], issue_date: '2026-10-05', due_date: '2026-10-19', status: 'Sent', notes: 'Thank you for choosing us. Payment within 14 days please.',
      items: [
        { description: 'Clinic website with appointment request form', quantity: 1, unit_price: '2400' },
        { description: 'Social media post designs (Instagram, set of 12)', quantity: 12, unit_price: '45' },
        { description: 'Hosting and domain setup', quantity: 1, unit_price: '300' },
      ] },
    { client_id: ids[3], issue_date: '2026-10-12', due_date: '2026-10-26', status: 'Sent', notes: null,
      items: [
        { description: 'Interior portfolio brochure, 16 pages, print ready PDF', quantity: 1, unit_price: '1650' },
        { description: 'Product photo retouching', quantity: 25, unit_price: '18.5' },
      ] },
    { client_id: ids[0], issue_date: '2026-10-22', due_date: '2026-11-05', status: 'Sent', notes: 'Monthly document control support, October 2026.',
      items: [
        { description: 'Document control support (hours)', quantity: 32.5, unit_price: '85' },
        { description: 'Drawing register clean up and revision audit', quantity: 1, unit_price: '600' },
      ] },
    { client_id: ids[1], issue_date: '2026-10-28', due_date: '2026-11-11', status: 'Draft', notes: 'Draft for review. Prices valid for 30 days.',
      items: [
        { description: 'Shipment tracking dashboard (Excel with charts)', quantity: 1, unit_price: '1200' },
        { description: 'Monthly KPI report template', quantity: 1, unit_price: '450' },
        { description: 'Remote support (hours)', quantity: 6, unit_price: '95' },
      ] },
  ];
  invoices.forEach((inv) => service.create(inv));
  return { clients: ids.length, invoices: invoices.length };
}

if (require.main === module) {
  const config = loadConfig();
  const db = openDb(config.dbFile);
  const result = seed(db, config);
  console.log(`Seeded ${result.clients} clients and ${result.invoices} invoices into ${config.dbFile}`);
  db.close();
}

module.exports = { seed };
