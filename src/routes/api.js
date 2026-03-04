const express = require('express');
const router = express.Router();
const { getClientConfig } = require('../data/users');

// Middleware que verifica que el usuario esté logueado
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

// Middleware que determina qué cliente puede ver el usuario
function getClientId(req) {
  if (req.session.user.role === 'admin') {
    return req.query.clientId || 'client1';
  }
  return req.session.user.clientId;
}

// Obtener token Meta: prioriza el token conectado via OAuth en sesión,
// luego cae al token configurado en .env
function getMetaToken(req, client) {
  if (req.session.user && req.session.user.metaToken) {
    return req.session.user.metaToken;
  }
  if (client && client.metaToken && client.metaToken !== 'AQUI_VA_EL_TOKEN') {
    return client.metaToken;
  }
  return null;
}

function getInstagramId(req, client) {
  return (req.session.user && req.session.user.instagramId)
    || (client && client.instagramId)
    || null;
}

// ─── INSTAGRAM DATA ───────────────────────────────────
router.get('/instagram', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client   = getClientConfig(clientId);
    const token    = getMetaToken(req, client);
    const igId     = getInstagramId(req, client);

    // Si no hay token real, indicar que no hay conexión
    if (!token) {
      return res.json({ source: 'none', connected: false });
    }

    // Usar instagramId de sesión o config
    const effectiveIgId = igId || (client && client.instagramId);
    if (!effectiveIgId) {
      return res.json({ source: 'none', connected: false, error: 'No Instagram ID' });
    }
    const metaToken = token; // alias para compatibilidad con bloque original

    const url = `https://graph.facebook.com/v18.0/${effectiveIgId}?fields=followers_count,media_count,profile_picture_url,username,biography&access_token=${metaToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return res.json({ source: 'none', connected: false });
    }

    // Obtener métricas adicionales de insights
    let extra = {};
    try {
      const insUrl = `https://graph.facebook.com/v18.0/${effectiveIgId}/insights?metric=reach,impressions,profile_views&period=month&access_token=${metaToken}`;
      const insRes  = await fetch(insUrl);
      const insData = await insRes.json();
      if (insData.data) {
        insData.data.forEach(m => {
          const v = m.values[m.values.length - 1]?.value || 0;
          if (m.name === 'reach')          extra.reach         = v;
          if (m.name === 'impressions')    extra.impressions    = v;
          if (m.name === 'profile_views')  extra.profile_views  = v;
        });
      }
    } catch(e) { /* insights opcionales */ }

    res.json({
      source:    'live',
      connected: true,
      clientName: (client && client.name) || 'Tu cuenta',
      ...data,
      ...extra
    });

  } catch (error) {
    console.error('Error Instagram:', error);
    res.json({ source: 'none', connected: false });
  }
});

// ─── META ADS DATA ────────────────────────────────────
router.get('/ads', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client   = getClientConfig(clientId);
    const token    = getMetaToken(req, client);

    if (!token) {
      return res.json({ source: 'none', connected: false });
    }

    const adAccountId = (client && client.adAccountId) || null;
    if (!adAccountId) {
      return res.json({ source: 'none', connected: false, error: 'No ad account' });
    }

    const since = req.query.since || getFirstDayOfMonth();
    const until = req.query.until || getTodayDate();

    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=impressions,reach,spend,clicks,ctr,cpc&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.json({ source: 'none', connected: false });
    }

    res.json({ source: 'live', connected: true, ...data });

  } catch (error) {
    console.error('Error Ads:', error);
    res.json({ source: 'none', connected: false });
  }
});

// ─── INSTAGRAM INSIGHTS ───────────────────────────────
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client   = getClientConfig(clientId);
    const token    = getMetaToken(req, client);
    const igId     = getInstagramId(req, client);

    if (!token || !igId) {
      return res.json({ source: 'none', connected: false });
    }

    const url = `https://graph.facebook.com/v18.0/${igId}/insights?metric=impressions,reach,follower_count,profile_views&period=day&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.json({ source: 'none', connected: false });
    }

    res.json({ source: 'live', connected: true, ...data });

  } catch (error) {
    console.error('Error Insights:', error);
    res.json({ source: 'none', connected: false });
  }
});

// ─── INFO DEL CLIENTE ─────────────────────────────────
router.get('/client-info', requireAuth, (req, res) => {
  const clientId = getClientId(req);
  const client   = getClientConfig(clientId);
  const token    = getMetaToken(req, client);
  const hasLive  = !!token;

  res.json({
    id:          client ? client.id   : null,
    name:        client ? client.name : (req.session.user.name || 'Usuario'),
    plan:        client ? client.plan : 'Activo',
    startDate:   client ? client.startDate : null,
    connected:   !!req.session.user.socialConnected,
    hasLiveData: hasLive,
    platform:    req.session.user.connectedPlatform || null
  });
});

// ─── DATOS DEMO — ELIMINADOS ──────────────────────────
// (Ya no se devuelven datos demo; el dashboard muestra estados vacíos)
// Las siguientes funciones son solo para referencia interna del servidor

function getDemoAdsData() {
  return {
    source: 'none',
    impressions: 0,
    reach: 0,
    spend: 0,
    clicks: 1840,
    ctr: 0,
    cpc: 0,
    campaigns: []
  };
}

function getDemoInsightsData() {
  return { source: 'none', data: [] };
}

function getFirstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

module.exports = router;
