const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Public config endpoint (no secrets exposed)
router.get('/config', (req, res) => {
  res.json({
    pixelId: process.env.META_PIXEL_ID || '',
    wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || '',
    calendlyUrl: process.env.CALENDLY_URL || '',
    amountInCents: '25000000',
    currency: 'COP',
    whatsappNumber: process.env.WHATSAPP_NUMBER || ''
  });
});

// Generate Wompi integrity signature server-side (secret key never exposed)
router.post('/checkout-config', (req, res) => {
  const { reference } = req.body;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Referencia inválida' });
  }

  // Sanitize reference
  const sanitizedRef = reference.replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 100);
  if (sanitizedRef.length < 5) {
    return res.status(400).json({ error: 'Referencia inválida' });
  }

  const amountInCents = '25000000'; // 250.000 COP
  const currency = 'COP';
  const integrityKey = process.env.WOMPI_INTEGRITY_KEY;

  if (!integrityKey) {
    return res.status(503).json({ error: 'Pago no configurado. Contacta por WhatsApp.' });
  }

  // SHA256(reference + amountInCents + currency + integrityKey) — Wompi spec
  const rawSignature = `${sanitizedRef}${amountInCents}${currency}${integrityKey}`;
  const signature = crypto.createHash('sha256').update(rawSignature).digest('hex');

  res.json({ signature, reference: sanitizedRef, amountInCents, currency });
});

module.exports = router;
