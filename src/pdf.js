const PDFDocument = require('pdfkit');
const { formatMoney } = require('./money');

const COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  accent: '#0d9488',
  accentSoft: '#ecfdf9',
  head: '#0f172a',
  zebra: '#f8fafc',
};
const STATUS_COLORS = { Draft: '#64748b', Sent: '#2563eb', Paid: '#16a34a' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatQty(q) {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(3)));
}

// Builds the A4 invoice. The caller pipes the document and calls end().
function buildInvoicePdf(invoice, config) {
  const { seller } = config;
  const currency = invoice.currency;
  const money = (m) => formatMoney(m, currency);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 70, left: 50, right: 50 },
    bufferPages: true,
    info: { Title: `Invoice ${invoice.number}`, Author: seller.name, Subject: `Invoice for ${invoice.client.name}` },
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // Accent strip across the top.
  doc.rect(0, 0, doc.page.width, 6).fill(COLORS.accent);

  // Seller block on the left.
  let y = 48;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(18).text(seller.name, left, y, { width: 280 });
  y = doc.y + 4;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  const sellerLines = [...seller.address, seller.email, seller.phone, seller.vatNumber ? `VAT No. ${seller.vatNumber}` : null].filter(Boolean);
  sellerLines.forEach((line) => {
    doc.text(line, left, y, { width: 280 });
    y = doc.y + 1;
  });
  const sellerBottom = y;

  // Title and invoice details on the right.
  const metaX = right - 200;
  doc.font('Helvetica-Bold').fontSize(26).fillColor(COLORS.accent).text('INVOICE', metaX, 44, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink).text(invoice.number, metaX, 76, { width: 200, align: 'right' });

  let my = 98;
  const metaRow = (label, value) => {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(label, metaX, my, { width: 95 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(value, metaX + 95, my, { width: 105, align: 'right' });
    my += 15;
  };
  metaRow('Issue date', formatDate(invoice.issue_date));
  metaRow('Due date', formatDate(invoice.due_date));

  // Status pill.
  const status = invoice.status;
  doc.font('Helvetica-Bold').fontSize(8);
  const pillW = doc.widthOfString(status.toUpperCase()) + 16;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Status', metaX, my + 1, { width: 95 });
  doc.roundedRect(right - pillW, my - 1, pillW, 14, 7).fill(STATUS_COLORS[status] || COLORS.muted);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(status.toUpperCase(), right - pillW, my + 2.5, { width: pillW, align: 'center' });
  my += 18;

  y = Math.max(sellerBottom, my) + 16;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(COLORS.line).stroke();
  y += 18;

  // Bill to on the left, amount due card on the right.
  const c = invoice.client;
  const blockTop = y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.accent).text('BILL TO', left, y, { characterSpacing: 1 });
  y = doc.y + 4;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(c.company || c.name, left, y, { width: 280 });
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  const clientLines = [c.company ? `Attn: ${c.name}` : null, ...(c.address ? c.address.split(/\r?\n/) : []), c.email, c.vat_number ? `VAT No. ${c.vat_number}` : null].filter(Boolean);
  clientLines.forEach((line) => {
    doc.text(line, left, y, { width: 280 });
    y = doc.y + 1;
  });

  const cardW = 200;
  const cardX = right - cardW;
  doc.roundedRect(cardX, blockTop, cardW, 70, 8).fill(COLORS.accentSoft);
  doc.rect(cardX, blockTop, 4, 70).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.accent).text(status === 'Paid' ? 'AMOUNT PAID' : 'AMOUNT DUE', cardX + 16, blockTop + 14, { characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink).text(money(invoice.total), cardX + 16, blockTop + 28, { width: cardW - 28 });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(`Due by ${formatDate(invoice.due_date)}`, cardX + 16, blockTop + 52);

  y = Math.max(y, blockTop + 70) + 26;

  // Items table.
  const cols = [
    { key: 'n', label: '#', w: 26, align: 'left' },
    { key: 'description', label: 'DESCRIPTION', w: width - 26 - 52 - 100 - 100, align: 'left' },
    { key: 'qty', label: 'QTY', w: 52, align: 'right' },
    { key: 'unit', label: 'UNIT PRICE', w: 100, align: 'right' },
    { key: 'amount', label: 'AMOUNT', w: 100, align: 'right' },
  ];
  const pad = 8;

  const drawHeader = () => {
    doc.rect(left, y, width, 24).fill(COLORS.head);
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    cols.forEach((col) => {
      doc.text(col.label, x + pad, y + 8.5, { width: col.w - pad * 2, align: col.align, characterSpacing: 0.5 });
      x += col.w;
    });
    y += 24;
  };
  drawHeader();

  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  invoice.items.forEach((item, i) => {
    const values = {
      n: String(i + 1),
      description: item.description,
      qty: formatQty(item.quantity),
      unit: formatMoney(item.unit_price),
      amount: formatMoney(item.amount),
    };
    doc.font('Helvetica').fontSize(9.5);
    const descH = doc.heightOfString(values.description, { width: cols[1].w - pad * 2 });
    const rowH = Math.max(26, descH + 14);
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    if (i % 2 === 1) doc.rect(left, y, width, rowH).fill(COLORS.zebra);
    let x = left;
    cols.forEach((col) => {
      const isDesc = col.key === 'description';
      doc.font(col.key === 'amount' ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(col.key === 'n' ? COLORS.muted : COLORS.ink);
      doc.text(values[col.key], x + pad, y + 8, { width: col.w - pad * 2, align: col.align, lineBreak: isDesc });
      x += col.w;
    });
    y += rowH;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor(COLORS.line).stroke();
  });

  // Totals.
  if (y + 110 > bottomLimit) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y += 14;
  const tW = 230;
  const tX = right - tW;
  const totalRow = (label, value, strong) => {
    if (strong) {
      doc.rect(tX, y - 6, tW, 30).fill(COLORS.head);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff');
      doc.text(label, tX + 12, y + 3, { width: 100 });
      doc.text(value, tX + 100, y + 3, { width: tW - 112, align: 'right' });
      y += 30;
      return;
    }
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted).text(label, tX + 12, y, { width: 120 });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink).text(value, tX + 100, y, { width: tW - 112, align: 'right' });
    y += 20;
  };
  totalRow('Subtotal', money(invoice.subtotal));
  totalRow(`VAT (${invoice.vat_rate_bp / 100}%)`, money(invoice.vat));
  y += 6;
  totalRow('Total', money(invoice.total), true);

  // Notes and payment details under the table, on the left.
  let ny = y + 20;
  const block = (title, text) => {
    doc.font('Helvetica').fontSize(9);
    const h = doc.heightOfString(text, { width: width }) + 22;
    if (ny + h > bottomLimit) {
      doc.addPage();
      ny = doc.page.margins.top;
    }
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.accent).text(title, left, ny, { characterSpacing: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(text, left, ny + 13, { width: width, lineGap: 2 });
    ny = doc.y + 16;
  };
  if (invoice.notes) block('NOTES', invoice.notes);
  block('PAYMENT DETAILS', `Bank: ${seller.bank}    IBAN: ${seller.iban}\nPlease use ${invoice.number} as the payment reference.`);

  // Footer on every page.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 45;
    doc.moveTo(left, fy - 10).lineTo(right, fy - 10).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text(`Thank you for your business.  ${seller.name}  |  ${seller.email}`, left, fy, { width: width - 80, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, right - 80, fy, { width: 80, align: 'right', lineBreak: false });
    doc.page.margins.bottom = oldBottom;
  }

  return doc;
}

module.exports = { buildInvoicePdf, formatDate };
