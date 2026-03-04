const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const router  = express.Router();
const { findUserByEmail } = require('../data/users');

// ─── LOGIN ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    req.session.user = {
      id:       user.id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      clientId: user.clientId
    };

    res.json({ success: true, user: req.session.user });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── LOGOUT ────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─── ME ────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
});

// ─── META OAUTH: INICIAR CONEXIÓN ──────────────────────
// GET /auth/meta/connect?platform=instagram|facebook&clientId=optional
router.get('/meta/connect', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const appId    = process.env.META_APP_ID;
  const redirect = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/meta/callback`;
  const platform = req.query.platform || 'facebook';
  const clientId = req.query.clientId || req.session.user.clientId || '';

  if (!appId) {
    // Si no hay APP_ID configurado, mostrar error amigable
    return res.redirect(`/dashboard?connect_error=no_app_id`);
  }

  // Generar state anti-CSRF
  const state = crypto.randomBytes(16).toString('hex');
  req.session.metaOAuthState = state;
  req.session.metaOAuthPlatform = platform;
  req.session.metaOAuthClientId = clientId;

  // Scopes necesarios para métricas de Instagram + Ads
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_manage_insights',
    'ads_read',
    'business_management',
    'read_insights'
  ].join(',');

  const authUrl = [
    'https://www.facebook.com/v18.0/dialog/oauth?',
    `client_id=${appId}`,
    `&redirect_uri=${encodeURIComponent(redirect)}`,
    `&scope=${scopes}`,
    `&state=${state}`,
    `&response_type=code`
  ].join('');

  res.redirect(authUrl);
});

// ─── META OAUTH: CALLBACK ──────────────────────────────
// GET /auth/meta/callback?code=xxx&state=xxx
router.get('/meta/callback', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const { code, state, error } = req.query;

  // Verificar error de OAuth (usuario canceló)
  if (error) {
    console.warn('Meta OAuth cancelado:', error);
    return res.redirect('/dashboard?connect_status=cancelled');
  }

  // Verificar state anti-CSRF
  if (!state || state !== req.session.metaOAuthState) {
    console.error('Meta OAuth: state inválido');
    return res.redirect('/dashboard?connect_error=invalid_state');
  }

  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirect  = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/meta/callback`;
  const platform  = req.session.metaOAuthPlatform || 'facebook';
  const clientId  = req.session.metaOAuthClientId;

  // Limpiar state de sesión
  delete req.session.metaOAuthState;
  delete req.session.metaOAuthPlatform;
  delete req.session.metaOAuthClientId;

  try {
    // 1. Intercambiar code por access token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes  = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Meta token error:', tokenData.error);
      return res.redirect('/dashboard?connect_error=token_failed');
    }

    const shortToken = tokenData.access_token;

    // 2. Extender a token de larga duración
    const extendUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
    const extendRes  = await fetch(extendUrl);
    const extendData = await extendRes.json();
    const longToken  = extendData.access_token || shortToken;

    // 3. Obtener info del usuario / páginas
    const meUrl  = `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${longToken}`;
    const meRes  = await fetch(meUrl);
    const meData = await meRes.json();

    // 4. Buscar cuenta de Instagram asociada a las páginas
    let instagramId = null;
    let pageId      = null;
    try {
      const pagesUrl  = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longToken}`;
      const pagesRes  = await fetch(pagesUrl);
      const pagesData = await pagesRes.json();

      if (pagesData.data && pagesData.data.length > 0) {
        pageId = pagesData.data[0].id;
        const igUrl  = `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${longToken}`;
        const igRes  = await fetch(igUrl);
        const igData = await igRes.json();
        if (igData.instagram_business_account) {
          instagramId = igData.instagram_business_account.id;
        }
      }
    } catch (igErr) {
      console.warn('No se pudo obtener Instagram ID:', igErr.message);
    }

    // 5. Guardar en sesión del usuario
    req.session.user.metaToken    = longToken;
    req.session.user.metaUserId   = meData.id;
    req.session.user.instagramId  = instagramId;
    req.session.user.pageId       = pageId;
    req.session.user.socialConnected = true;
    req.session.user.connectedPlatform = platform;

    // 6. Actualizar env/config del cliente si aplica
    // En producción: guardar en Supabase tabla social_accounts
    // Por ahora: log informativo
    console.log(`✅ Meta conectado para user ${req.session.user.id}:`, {
      metaUserId:  meData.id,
      instagramId,
      pageId,
      platform,
      clientId
    });

    return res.redirect('/dashboard?connect_status=success');

  } catch (err) {
    console.error('Meta callback error:', err);
    return res.redirect('/dashboard?connect_error=server_error');
  }
});

// ─── ESTADO DE CONEXIÓN SOCIAL ─────────────────────────
router.get('/social-status', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  res.json({
    connected:         !!req.session.user.socialConnected,
    platform:          req.session.user.connectedPlatform || null,
    instagramId:       req.session.user.instagramId || null,
    pageId:            req.session.user.pageId || null
  });
});

module.exports = router;
