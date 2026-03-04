-- =================================================================
-- SAOC DIGITAL — Supabase Schema Completo
-- Pega este archivo completo en el SQL Editor de tu proyecto Supabase
-- =================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- 1. TABLA: profiles
--    Extiende auth.users de Supabase con datos de perfil
-- =================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client', 'viewer')),
  company_id  UUID,
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- 2. TABLA: companies
--    Empresas / clientes de la agencia
-- =================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'standard', 'premium')),
  plan_price  NUMERIC(12,2) DEFAULT 0,
  start_date  DATE DEFAULT CURRENT_DATE,
  active      BOOLEAN DEFAULT TRUE,
  website     TEXT,
  industry    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- FK: profiles.company_id → companies.id
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- =================================================================
-- 3. TABLA: social_accounts
--    Cuentas de Instagram / Facebook conectadas por empresa
-- =================================================================
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'meta')),
  account_id      TEXT,                    -- ID de la cuenta en Meta
  username        TEXT,                    -- @username de Instagram
  page_id         TEXT,                    -- Facebook Page ID
  instagram_id    TEXT,                    -- Instagram Business Account ID
  ad_account_id   TEXT,                    -- Meta Ads Account ID (act_XXXXXXX)
  access_token    TEXT,                    -- Long-lived token (guardar cifrado en prod)
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[],                  -- Permisos concedidos
  connected_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE,
  last_sync_at    TIMESTAMPTZ,
  sync_error      TEXT,
  UNIQUE (company_id, platform)
);

-- =================================================================
-- 4. TABLA: instagram_metrics
--    Snapshot diario de métricas de Instagram
-- =================================================================
CREATE TABLE IF NOT EXISTS public.instagram_metrics (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  social_account_id   UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  recorded_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  followers_count     INTEGER,
  media_count         INTEGER,
  reach               INTEGER,
  impressions         INTEGER,
  engagement_rate     NUMERIC(6,2),
  new_followers       INTEGER,
  profile_views       INTEGER,
  website_clicks      INTEGER,
  email_contacts      INTEGER,
  raw_data            JSONB,              -- Respuesta completa de la API para auditoría
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (social_account_id, recorded_date)
);

-- =================================================================
-- 5. TABLA: daily_insights
--    Datos diarios detallados (para gráficas de alcance día a día)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.daily_insights (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  reach             INTEGER DEFAULT 0,
  impressions       INTEGER DEFAULT 0,
  new_followers     INTEGER DEFAULT 0,
  profile_views     INTEGER DEFAULT 0,
  website_clicks    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (social_account_id, date)
);

-- =================================================================
-- 6. TABLA: ad_campaigns
--    Campañas de Meta Ads sincronizadas
-- =================================================================
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  campaign_id       TEXT NOT NULL,         -- ID de Meta
  name              TEXT NOT NULL,
  status            TEXT,                  -- ACTIVE, PAUSED, DELETED
  objective         TEXT,                  -- AWARENESS, TRAFFIC, CONVERSIONS
  spend             NUMERIC(12,2) DEFAULT 0,
  budget_daily      NUMERIC(12,2),
  budget_lifetime   NUMERIC(12,2),
  reach             INTEGER DEFAULT 0,
  impressions       INTEGER DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  ctr               NUMERIC(6,3) DEFAULT 0,
  cpc               NUMERIC(10,2) DEFAULT 0,
  conversions       INTEGER DEFAULT 0,
  date_start        DATE,
  date_stop         DATE,
  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  raw_data          JSONB,
  UNIQUE (social_account_id, campaign_id)
);

-- =================================================================
-- 7. TABLA: monthly_reports
--    Reportes mensuales generados para cada empresa
-- =================================================================
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_year     SMALLINT NOT NULL,
  period_month    SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  summary         JSONB,                  -- Resumen del mes en JSON
  pdf_url         TEXT,                   -- URL al PDF en Supabase Storage
  generated_by    UUID REFERENCES auth.users(id),
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, period_year, period_month)
);

-- =================================================================
-- 8. TABLA: audit_log
--    Registro de acciones del sistema
-- =================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id  UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- ÍNDICES para performance
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_company      ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email        ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_social_company        ON public.social_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_ig_metrics_account    ON public.instagram_metrics(social_account_id);
CREATE INDEX IF NOT EXISTS idx_ig_metrics_date       ON public.instagram_metrics(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_insights_acct   ON public.daily_insights(social_account_id);
CREATE INDEX IF NOT EXISTS idx_daily_insights_date   ON public.daily_insights(date DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_account     ON public.ad_campaigns(social_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_company         ON public.audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON public.audit_log(created_at DESC);

-- =================================================================
-- TRIGGER: updated_at automático
-- =================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_companies_updated
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =================================================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- ROW LEVEL SECURITY (RLS)
-- =================================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;

-- ── Función auxiliar: saber si el usuario actual es admin ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── Función auxiliar: company_id del usuario actual ──
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ── PROFILES ──
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()                -- propio perfil
    OR public.is_admin()           -- admin ve todos
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR public.is_admin());

-- ── COMPANIES ──
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (
    id = public.my_company_id()   -- cliente ve su empresa
    OR public.is_admin()           -- admin ve todas
  );

DROP POLICY IF EXISTS "companies_all_admin" ON public.companies;
CREATE POLICY "companies_all_admin" ON public.companies
  FOR ALL USING (public.is_admin());

-- ── SOCIAL_ACCOUNTS ──
DROP POLICY IF EXISTS "social_select" ON public.social_accounts;
CREATE POLICY "social_select" ON public.social_accounts
  FOR SELECT USING (
    company_id = public.my_company_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "social_all_admin" ON public.social_accounts;
CREATE POLICY "social_all_admin" ON public.social_accounts
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "social_insert_client" ON public.social_accounts;
CREATE POLICY "social_insert_client" ON public.social_accounts
  FOR INSERT WITH CHECK (
    company_id = public.my_company_id()
    OR public.is_admin()
  );

-- ── INSTAGRAM_METRICS ──
DROP POLICY IF EXISTS "ig_metrics_select" ON public.instagram_metrics;
CREATE POLICY "ig_metrics_select" ON public.instagram_metrics
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM public.social_accounts
      WHERE company_id = public.my_company_id()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "ig_metrics_all_admin" ON public.instagram_metrics;
CREATE POLICY "ig_metrics_all_admin" ON public.instagram_metrics
  FOR ALL USING (public.is_admin());

-- ── DAILY_INSIGHTS ──
DROP POLICY IF EXISTS "daily_select" ON public.daily_insights;
CREATE POLICY "daily_select" ON public.daily_insights
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM public.social_accounts
      WHERE company_id = public.my_company_id()
    )
    OR public.is_admin()
  );

-- ── AD_CAMPAIGNS ──
DROP POLICY IF EXISTS "campaigns_select" ON public.ad_campaigns;
CREATE POLICY "campaigns_select" ON public.ad_campaigns
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM public.social_accounts
      WHERE company_id = public.my_company_id()
    )
    OR public.is_admin()
  );

-- ── MONTHLY_REPORTS ──
DROP POLICY IF EXISTS "reports_select" ON public.monthly_reports;
CREATE POLICY "reports_select" ON public.monthly_reports
  FOR SELECT USING (
    company_id = public.my_company_id()
    OR public.is_admin()
  );

-- ── AUDIT_LOG ──
DROP POLICY IF EXISTS "audit_admin" ON public.audit_log;
CREATE POLICY "audit_admin" ON public.audit_log
  FOR ALL USING (public.is_admin());

-- =================================================================
-- DATOS INICIALES
-- =================================================================

-- Empresas base (IDs fijos para coherencia con variables de entorno)
INSERT INTO public.companies (id, name, slug, plan, start_date, active)
VALUES
  ('00000000-0000-0000-0001-000000000001', 'Malfi IPS',  'malfi-ips', 'premium',  '2025-02-01', true),
  ('00000000-0000-0000-0001-000000000002', 'Carbros',     'carbros',   'standard', '2025-02-01', true)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- VISTAS ÚTILES
-- =================================================================

-- Vista: resumen de clientes para el admin
CREATE OR REPLACE VIEW public.v_clients_summary AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.plan,
  c.active,
  c.start_date,
  COUNT(DISTINCT p.id)  AS total_users,
  COUNT(DISTINCT sa.id) AS connected_accounts,
  MAX(im.recorded_date) AS last_metrics_date
FROM public.companies c
LEFT JOIN public.profiles        p  ON p.company_id    = c.id
LEFT JOIN public.social_accounts sa ON sa.company_id   = c.id AND sa.is_active = true
LEFT JOIN public.instagram_metrics im ON im.social_account_id = sa.id
GROUP BY c.id, c.name, c.slug, c.plan, c.active, c.start_date;

-- Vista: últimas métricas de Instagram por empresa
CREATE OR REPLACE VIEW public.v_latest_ig_metrics AS
SELECT DISTINCT ON (sa.company_id)
  sa.company_id,
  c.name            AS company_name,
  sa.username,
  im.recorded_date,
  im.followers_count,
  im.reach,
  im.impressions,
  im.engagement_rate,
  im.new_followers,
  im.profile_views
FROM public.social_accounts sa
JOIN public.companies c ON c.id = sa.company_id
JOIN public.instagram_metrics im ON im.social_account_id = sa.id
WHERE sa.platform IN ('instagram', 'meta') AND sa.is_active = true
ORDER BY sa.company_id, im.recorded_date DESC;

-- =================================================================
-- STORAGE BUCKET para reportes PDF (ejecutar separado si aplica)
-- =================================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('reports', 'reports', false)
-- ON CONFLICT DO NOTHING;

-- =================================================================
-- INSTRUCCIONES DE CONFIGURACIÓN
-- =================================================================
-- 1. Ve a tu proyecto Supabase → SQL Editor → New Query
-- 2. Pega todo este archivo y ejecuta
-- 3. En Authentication → Settings → activa "Email Auth"
-- 4. Crea el usuario admin manualmente en Authentication → Users
--    Email: admin@saocdigital.com / Password que prefieras
-- 5. Una vez creado el usuario admin, ejecuta:
--    UPDATE public.profiles SET role = 'admin'
--    WHERE email = 'admin@saocdigital.com';
-- 6. Crea usuarios cliente del mismo modo y asígnalos a su empresa:
--    UPDATE public.profiles SET company_id = '00000000-0000-0000-0001-000000000001'
--    WHERE email = 'cliente@malfiips.com';
-- 7. En tu .env agrega:
--    SUPABASE_URL=https://xxxx.supabase.co
--    SUPABASE_ANON_KEY=eyJ...
--    SUPABASE_SERVICE_ROLE_KEY=eyJ...
--    META_APP_ID=...
--    META_APP_SECRET=...
--    META_REDIRECT_URI=https://tudominio.com/auth/meta/callback
-- =================================================================
