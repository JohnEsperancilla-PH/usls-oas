-- Health check table for cron-job.org keep-alive pings
CREATE TABLE IF NOT EXISTS app_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source VARCHAR(100) DEFAULT 'cron',
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  region TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_health_created_at ON app_health(created_at DESC);
