const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const path    = require('path');
require('dotenv').config();

const authRoutes    = require('./routes/auth');
const apiRoutes     = require('./routes/api');
const adminRoutes   = require('./routes/admin');
const landingRoutes = require('./routes/landing');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'saoc_secret_change_in_production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000  // 7 días
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// Rutas
app.use('/auth',    authRoutes);
app.use('/api',     apiRoutes);
app.use('/admin',   adminRoutes);
app.use('/landing', landingRoutes);

// Landing / diagnóstico
app.get('/diagnostico', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

app.get('/gracias', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/gracias.html'));
});

// Root: si está logueado va al dashboard, sino al login
app.get('/', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  } else {
    res.sendFile(path.join(__dirname, '../public/login.html'));
  }
});

// Dashboard protegido
app.get('/dashboard', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
  } else {
    res.redirect('/');
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SAOC Dashboard corriendo en http://localhost:${PORT}`);
  if (!process.env.META_APP_ID) {
    console.warn('⚠️  META_APP_ID no configurado — conexión de cuentas deshabilitada');
  }
});
