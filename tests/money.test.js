const { toMinor, lineAmount, computeTotals, formatMoney } = require('../src/money');
const { parseVatRate } = require('../src/config');

describe('toMinor', () => {
  test('converts decimal strings and numbers to integer minor units', () => {
    expect(toMinor('10')).toBe(1000);
    expect(toMinor('10.5')).toBe(1050);
    expect(toMinor('10.05')).toBe(1005);
    expect(toMinor(0.1)).toBe(10);
    expect(toMinor(1250.99)).toBe(125099);
  });

  test('avoids float errors like 1.005 * 100', () => {
    expect(toMinor('1.10')).toBe(110);
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor('0.29')).toBe(29);
  });

  test('rejects bad input', () => {
    expect(() => toMinor('abc')).toThrow();
    expect(() => toMinor('1.234')).toThrow();
    expect(() => toMinor('')).toThrow();
  });
});

describe('lineAmount', () => {
  test('whole quantities multiply exactly', () => {
    expect(lineAmount(3, 1999)).toBe(5997);
  });

  test('fractional quantities round half up to the nearest halala', () => {
    expect(lineAmount(1.5, 333)).toBe(500); // 499.5 -> 500
    expect(lineAmount(0.333, 100)).toBe(33); // 33.3 -> 33
    expect(lineAmount(2.5, 1)).toBe(3); // 2.5 -> 3
  });
});

describe('computeTotals', () => {
  test('adds lines and applies 15% VAT', () => {
    const t = computeTotals(
      [
        { description: 'A', quantity: 2, unit_price: '150.50' },
        { description: 'B', quantity: 1, unit_price: '99.99' },
      ],
      1500
    );
    expect(t.subtotal).toBe(40099);
    expect(t.vat).toBe(6015); // 6014.85 -> 6015
    expect(t.total).toBe(46114);
    expect(t.lines.map((l) => l.amount_minor)).toEqual([30100, 9999]);
  });

  test('VAT rounds a half halala up', () => {
    // 0.10 * 15% = 1.5 halalas -> 2
    expect(computeTotals([{ description: 'x', quantity: 1, unit_price: '0.10' }], 1500).vat).toBe(2);
    // 0.03 * 15% = 0.45 halalas -> 0
    expect(computeTotals([{ description: 'x', quantity: 1, unit_price: '0.03' }], 1500).vat).toBe(0);
  });

  test('sum of many small lines stays exact', () => {
    const items = Array.from({ length: 10 }, () => ({ description: 'x', quantity: 1, unit_price: '0.1' }));
    const t = computeTotals(items, 1500);
    expect(t.subtotal).toBe(100);
    expect(t.vat).toBe(15);
    expect(t.total).toBe(115);
  });

  test('supports other VAT rates and zero VAT', () => {
    expect(computeTotals([{ description: 'x', quantity: 1, unit_price: '100' }], 500).vat).toBe(500);
    expect(computeTotals([{ description: 'x', quantity: 1, unit_price: '100' }], 0).total).toBe(10000);
  });
});

describe('helpers', () => {
  test('formatMoney adds separators and currency', () => {
    expect(formatMoney(123456789, 'SAR')).toBe('SAR 1,234,567.89');
    expect(formatMoney(5)).toBe('0.05');
  });

  test('parseVatRate reads percent values and falls back to 15', () => {
    expect(parseVatRate('15')).toBe(1500);
    expect(parseVatRate('7.5')).toBe(750);
    expect(parseVatRate('nope')).toBe(1500);
    expect(parseVatRate('-1')).toBe(1500);
  });
});
