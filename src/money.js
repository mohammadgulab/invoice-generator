// All money is kept in integer minor units (halalas / cents) so totals never drift.

// "1250.5" or 1250.5 -> 125050. Parsed from the string so 1.005 style float noise can't sneak in.
function toMinor(value) {
  const str = typeof value === 'number' ? value.toString() : String(value).trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) throw new Error(`Invalid money value: ${value}`);
  const [, minus, whole, frac = ''] = match;
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return minus ? -minor : minor;
}

function fromMinor(minor) {
  return Number((minor / 100).toFixed(2));
}

// Round a non negative ratio a / b to the nearest integer, halves go up.
function divRoundHalfUp(a, b) {
  return Math.floor((2 * a + b) / (2 * b));
}

// Quantities may have up to 3 decimals (e.g. 1.5 hours), so work in thousandths.
function lineAmount(quantity, unitPriceMinor) {
  const qtyMilli = Math.round(Number(quantity) * 1000);
  return divRoundHalfUp(qtyMilli * unitPriceMinor, 1000);
}

function computeTotals(items, vatRateBp) {
  const lines = items.map((item) => {
    const unitPrice = Number.isInteger(item.unit_price_minor) ? item.unit_price_minor : toMinor(item.unit_price);
    return { ...item, unit_price_minor: unitPrice, amount_minor: lineAmount(item.quantity, unitPrice) };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.amount_minor, 0);
  const vat = divRoundHalfUp(subtotal * vatRateBp, 10000);
  return { lines, subtotal, vat, total: subtotal + vat };
}

function formatMoney(minor, currency) {
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  return currency ? `${currency} ${n}` : n;
}

module.exports = { toMinor, fromMinor, lineAmount, computeTotals, formatMoney, divRoundHalfUp };
