require('dotenv').config({ quiet: true });

// Read a VAT rate like "15" or "15.5" and turn it into basis points (1500 = 15%).
function parseVatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 1500;
  return Math.round(n * 100);
}

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    dbFile: env.DB_FILE || './data/app.db',
    currency: (env.CURRENCY || 'SAR').toUpperCase(),
    vatRateBp: parseVatRate(env.VAT_RATE ?? '15'),
    seller: {
      name: env.SELLER_NAME || 'Sandline Design Co.',
      address: (env.SELLER_ADDRESS || 'Office 14, Palm Business Center|Al Rawdah District, Jeddah 23435|Saudi Arabia').split('|'),
      email: env.SELLER_EMAIL || 'billing@sandline.example',
      phone: env.SELLER_PHONE || '+966 12 555 0142',
      vatNumber: env.SELLER_VAT || '310000000000003',
      bank: env.SELLER_BANK || 'Demo Bank',
      iban: env.SELLER_IBAN || 'SA00 0000 0000 0000 0000 0000',
    },
  };
}

module.exports = { loadConfig, parseVatRate };
