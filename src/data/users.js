const bcrypt = require('bcryptjs');
const users = [
  { id: 1, name: 'Admin SAOC', email: 'admin@saocdigital.com', password: '$2b$10$gna1RCntQ97ym.LhbYsx5ul6BYbKfsmDCpdze.qbaofBTvusoyYXO', role: 'admin', clientId: null },
  { id: 2, name: 'Malfi IPS', email: 'cliente@malfiips.com', password: '$2b$10$cocV0zp.CDZ/Tk.mMi.cJeSk4K6S6B.I.bEEwJmATgBs1pXY7YzBe', role: 'client', clientId: 'client1' },
  { id: 3, name: 'Carbros', email: 'cliente@carbros.com', password: '$2b$10$cocV0zp.CDZ/Tk.mMi.cJeSk4K6S6B.I.bEEwJmATgBs1pXY7YzBe', role: 'client', clientId: 'client2' }
];
const clients = {
  client1: { id: 'client1', name: process.env.CLIENT1_NAME || 'Malfi IPS', metaToken: process.env.CLIENT1_META_TOKEN, instagramId: process.env.CLIENT1_INSTAGRAM_ID, gaProperty: process.env.CLIENT1_GA_PROPERTY, plan: 'Premium', startDate: 'Febrero 2025' },
  client2: { id: 'client2', name: process.env.CLIENT2_NAME || 'Carbros', metaToken: process.env.CLIENT2_META_TOKEN, instagramId: process.env.CLIENT2_INSTAGRAM_ID, gaProperty: process.env.CLIENT2_GA_PROPERTY, plan: 'Estandar', startDate: 'Febrero 2025' }
};
function findUserByEmail(email) { return users.find(u => u.email === email) || null; }
function findUserById(id) { return users.find(u => u.id === id) || null; }
function getClientConfig(clientId) { return clients[clientId] || null; }
function getAllClients() { return Object.values(clients); }
module.exports = { findUserByEmail, findUserById, getClientConfig, getAllClients };