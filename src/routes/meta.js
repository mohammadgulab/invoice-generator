const express = require('express');

// Small endpoints the frontend needs: health check and app settings.
function metaRouter(config) {
  const router = express.Router();

  router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  router.get('/config', (req, res) =>
    res.json({
      currency: config.currency,
      vat_rate: config.vatRateBp / 100,
      seller: { name: config.seller.name, email: config.seller.email },
    })
  );

  return router;
}

module.exports = metaRouter;
