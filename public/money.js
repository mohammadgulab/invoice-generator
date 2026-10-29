// Same integer math as the server (src/money.js) so the live totals match the PDF.
(function () {
  function toMinor(value) {
    const str = String(value ?? '').trim();
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(str);
    if (!m) return null;
    return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  }
  const divRoundHalfUp = (a, b) => Math.floor((2 * a + b) / (2 * b));
  function lineAmount(qty, unitMinor) {
    return divRoundHalfUp(Math.round(Number(qty) * 1000) * unitMinor, 1000);
  }
  function computeTotals(items, vatRate) {
    const bp = Math.round(vatRate * 100);
    let subtotal = 0;
    const amounts = items.map((it) => {
      if (String(it.unit_price ?? '').trim() === '') return 0;
      const unit = toMinor(it.unit_price);
      const qty = Number(it.quantity);
      if (unit === null || !Number.isFinite(qty) || qty <= 0) return null;
      const a = lineAmount(qty, unit);
      subtotal += a;
      return a;
    });
    const vat = divRoundHalfUp(subtotal * bp, 10000);
    return { amounts, subtotal, vat, total: subtotal + vat };
  }
  function format(minor, currency) {
    const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((minor || 0) / 100);
    return currency ? `${currency} ${n}` : n;
  }
  window.Money = { toMinor, computeTotals, format };
})();
