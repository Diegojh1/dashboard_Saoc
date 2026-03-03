const express = require('express');
const router = express.Router();
const { getAllClients, getClientConfig } = require('../data/users');

// Solo el admin puede acceder a estas rutas
function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// Ver todos los clientes
router.get('/clients', requireAdmin, (req, res) => {
  const clients = getAllClients();
  res.json({ clients });
});

// Ver un cliente específico
router.get('/clients/:clientId', requireAdmin, (req, res) => {
  const client = getClientConfig(req.params.clientId);
  if (!client) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  res.json({ client });
});

// Resumen general para el admin
router.get('/summary', requireAdmin, (req, res) => {
  const clients = getAllClients();
  res.json({
    totalClients: clients.length,
    clients: clients.map(c => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      hasLiveData: !!(c.metaToken && c.metaToken !== 'AQUI_VA_EL_TOKEN')
    }))
  });
});

module.exports = router;
