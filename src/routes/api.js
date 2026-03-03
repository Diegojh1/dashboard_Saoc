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

// ─── INSTAGRAM DATA ───────────────────────────────────
router.get('/instagram', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client = getClientConfig(clientId);

    // Si no hay token real, devuelve datos demo
    if (!client.metaToken || client.metaToken === 'AQUI_VA_EL_TOKEN') {
      return res.json(getDemoInstagramData(client.name));
    }

    const url = `https://graph.facebook.com/v18.0/${client.instagramId}?fields=followers_count,media_count,profile_picture_url,username,biography&access_token=${client.metaToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return res.json(getDemoInstagramData(client.name));
    }

    res.json({
      source: 'live',
      clientName: client.name,
      ...data
    });

  } catch (error) {
    console.error('Error Instagram:', error);
    res.json(getDemoInstagramData('Cliente'));
  }
});

// ─── META ADS DATA ────────────────────────────────────
router.get('/ads', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client = getClientConfig(clientId);

    if (!client.metaToken || client.metaToken === 'AQUI_VA_EL_TOKEN') {
      return res.json(getDemoAdsData());
    }

    const since = req.query.since || getFirstDayOfMonth();
    const until = req.query.until || getTodayDate();

    const url = `https://graph.facebook.com/v18.0/act_${client.adAccountId}/insights?fields=impressions,reach,spend,clicks,ctr,cpc&time_range={"since":"${since}","until":"${until}"}&access_token=${client.metaToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.json(getDemoAdsData());
    }

    res.json({ source: 'live', ...data });

  } catch (error) {
    console.error('Error Ads:', error);
    res.json(getDemoAdsData());
  }
});

// ─── INSTAGRAM INSIGHTS ───────────────────────────────
router.get('/insights', requireAuth, async (req, res) => {
  try {
    const clientId = getClientId(req);
    const client = getClientConfig(clientId);

    if (!client.metaToken || client.metaToken === 'AQUI_VA_EL_TOKEN') {
      return res.json(getDemoInsightsData());
    }

    const url = `https://graph.facebook.com/v18.0/${client.instagramId}/insights?metric=impressions,reach,follower_count,profile_views&period=day&access_token=${client.metaToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.json(getDemoInsightsData());
    }

    res.json({ source: 'live', ...data });

  } catch (error) {
    console.error('Error Insights:', error);
    res.json(getDemoInsightsData());
  }
});

// ─── INFO DEL CLIENTE ─────────────────────────────────
router.get('/client-info', requireAuth, (req, res) => {
  const clientId = getClientId(req);
  const client = getClientConfig(clientId);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({
    id: client.id,
    name: client.name,
    plan: client.plan,
    startDate: client.startDate,
    hasLiveData: !!(client.metaToken && client.metaToken !== 'AQUI_VA_EL_TOKEN')
  });
});

// ─── DATOS DEMO (cuando no hay API real) ─────────────
function getDemoInstagramData(clientName) {
  return {
    source: 'demo',
    clientName,
    username: 'tucuenta',
    followers_count: 12840,
    media_count: 284,
    reach: 142600,
    impressions: 198400,
    engagement_rate: 5.9,
    new_followers: 1048,
    profile_views: 3240
  };
}

function getDemoAdsData() {
  return {
    source: 'demo',
    impressions: 48200,
    reach: 32100,
    spend: 4500,
    clicks: 1840,
    ctr: 3.82,
    cpc: 2.45,
    campaigns: [
      { name: 'Campaña Awareness Feb', spend: 1800, reach: 14200, clicks: 620 },
      { name: 'Campaña Conversión Feb', spend: 2700, reach: 17900, clicks: 1220 }
    ]
  };
}

function getDemoInsightsData() {
  const days = [];
  for (let i = 1; i <= 28; i++) {
    days.push({
      day: i,
      reach: Math.floor(3000 + Math.random() * 8000),
      impressions: Math.floor(4000 + Math.random() * 10000),
      followers: Math.floor(30 + Math.random() * 60)
    });
  }
  return { source: 'demo', data: days };
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
