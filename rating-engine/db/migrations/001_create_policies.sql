-- =====================================================================
-- 001_create_policies.sql
-- Japan Auto Insurance Historical Policies — 80M rows, 2000-2025
-- Branch: issue/1
--
-- How to run:
--   psql -U postgres -d insurance_poc -f 001_create_policies.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum types ────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE age_condition_t AS ENUM ('all','21+','26+','30+','35+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE driver_restriction_t AS ENUM ('none','family','spouse','self');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE km_band_t AS ENUM (
    '〜5,000','5,001〜10,000','10,001〜15,000','15,001〜20,000','20,001〜');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE risk_tier_t AS ENUM ('Low','Medium','High','Very High');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE fuel_type_t AS ENUM ('gasoline','diesel','hybrid','electric','phev');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE gender_t AS ENUM ('M','F','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Main table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS japan_auto_policies (
    -- Identity
    policy_id               BIGSERIAL           PRIMARY KEY,
    policy_number           VARCHAR(20)         NOT NULL UNIQUE,
    policy_year             SMALLINT            NOT NULL CHECK (policy_year BETWEEN 2000 AND 2025),
    start_date              DATE                NOT NULL,
    end_date                DATE                GENERATED ALWAYS AS (start_date + INTERVAL '1 year') STORED,

    -- ── RF training features (must match ml/trainer.py ALL_FEATURES) ─
    ncd_grade               SMALLINT            NOT NULL CHECK (ncd_grade BETWEEN 1 AND 20),
    age_condition           age_condition_t     NOT NULL,
    prefecture_code         CHAR(2)             NOT NULL,
    vehicle_rating_class    SMALLINT            NOT NULL CHECK (vehicle_rating_class IN (1,3,5,7,9,11,13,15)),
    driver_restriction      driver_restriction_t NOT NULL DEFAULT 'none',
    annual_km_band          km_band_t           NOT NULL,
    annual_km               INT                 NOT NULL CHECK (annual_km > 0),
    driver_age              SMALLINT            NOT NULL CHECK (driver_age BETWEEN 18 AND 90),
    years_licensed          SMALLINT            NOT NULL CHECK (years_licensed >= 0),
    num_accidents_5yr       SMALLINT            NOT NULL DEFAULT 0,
    num_violations_5yr      SMALLINT            NOT NULL DEFAULT 0,

    -- ── Driver demographics ──────────────────────────────────────────
    driver_gender           gender_t            NOT NULL DEFAULT 'M',
    is_first_car            BOOLEAN             NOT NULL DEFAULT FALSE,

    -- ── Vehicle attributes ───────────────────────────────────────────
    vehicle_make            VARCHAR(40),         -- Toyota / Honda / Nissan …
    vehicle_model           VARCHAR(60),
    vehicle_year            SMALLINT,
    engine_cc               SMALLINT,
    fuel_type               fuel_type_t         DEFAULT 'gasoline',
    is_kei_car              BOOLEAN             NOT NULL DEFAULT FALSE,

    -- ── Actuarial premium breakdown (¥) ─────────────────────────────
    bi_premium              INT                 NOT NULL DEFAULT 0,  -- 対人 Bodily Injury
    pd_premium              INT                 NOT NULL DEFAULT 0,  -- 対物 Property Damage
    vehicle_premium         INT                 NOT NULL DEFAULT 0,  -- 車両
    passenger_premium       INT                 NOT NULL DEFAULT 0,  -- 搭乗者
    annual_premium_jpy      INT                 NOT NULL CHECK (annual_premium_jpy > 0),
    monthly_premium_jpy     INT GENERATED ALWAYS AS (annual_premium_jpy / 12) STORED,

    -- ── ML target ────────────────────────────────────────────────────
    risk_tier               risk_tier_t         NOT NULL,

    -- ── Claims this period ───────────────────────────────────────────
    had_claim               BOOLEAN             NOT NULL DEFAULT FALSE,
    num_claims              SMALLINT            NOT NULL DEFAULT 0,
    total_claim_amount_jpy  INT                 NOT NULL DEFAULT 0,

    -- ── Audit ────────────────────────────────────────────────────────
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ── Indexes for fast RF training queries ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_polyr_year       ON japan_auto_policies (policy_year);
CREATE INDEX IF NOT EXISTS idx_polyr_pref       ON japan_auto_policies (prefecture_code);
CREATE INDEX IF NOT EXISTS idx_polyr_ncd        ON japan_auto_policies (ncd_grade);
CREATE INDEX IF NOT EXISTS idx_polyr_tier       ON japan_auto_policies (risk_tier);
CREATE INDEX IF NOT EXISTS idx_polyr_prem       ON japan_auto_policies (annual_premium_jpy);
CREATE INDEX IF NOT EXISTS idx_polyr_claim      ON japan_auto_policies (had_claim) WHERE had_claim = TRUE;
CREATE INDEX IF NOT EXISTS idx_polyr_year_pref  ON japan_auto_policies (policy_year, prefecture_code);

-- ── Aggregated stats view (refreshed after seed) ─────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_prefecture_stats AS
SELECT
    prefecture_code,
    policy_year,
    COUNT(*)                                            AS total_policies,
    AVG(annual_premium_jpy)::INT                        AS avg_premium_jpy,
    PERCENTILE_CONT(0.5) WITHIN GROUP
        (ORDER BY annual_premium_jpy)::INT              AS median_premium_jpy,
    ROUND(AVG(ncd_grade)::NUMERIC, 2)                  AS avg_ncd_grade,
    ROUND(100.0 * SUM(had_claim::INT) / COUNT(*), 2)   AS claim_rate_pct
FROM japan_auto_policies
GROUP BY prefecture_code, policy_year
ORDER BY prefecture_code, policy_year;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pref_year
    ON mv_prefecture_stats (prefecture_code, policy_year);

-- ── Fast training-sample helper function ─────────────────────────────
-- Usage: SELECT * FROM sample_for_training(1000000);
CREATE OR REPLACE FUNCTION sample_for_training(n_rows INT DEFAULT 1000000)
RETURNS TABLE (
    ncd_grade               SMALLINT,
    age_condition           TEXT,
    prefecture_code         TEXT,
    vehicle_rating_class    SMALLINT,
    driver_restriction      TEXT,
    annual_km_band          TEXT,
    annual_km               INT,
    driver_age              SMALLINT,
    num_accidents           SMALLINT,
    num_violations          SMALLINT,
    years_licensed          SMALLINT,
    annual_premium_jpy      INT,
    risk_tier               TEXT
) LANGUAGE SQL STABLE AS $$
    SELECT
        ncd_grade,
        age_condition::TEXT,
        prefecture_code::TEXT,
        vehicle_rating_class,
        driver_restriction::TEXT,
        annual_km_band::TEXT,
        annual_km,
        driver_age,
        num_accidents_5yr,
        num_violations_5yr,
        years_licensed,
        annual_premium_jpy,
        risk_tier::TEXT
    FROM japan_auto_policies
    TABLESAMPLE SYSTEM( LEAST( (n_rows::FLOAT / 80000000.0) * 100 + 1, 100 ) )
    LIMIT n_rows;
$$;

COMMENT ON TABLE japan_auto_policies IS
    'Japan auto insurance historical policies 2000-2025 (~80M rows). '
    'Training source for Random Forest rating engine. Branch: issue/1.';
