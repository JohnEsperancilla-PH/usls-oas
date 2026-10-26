-- 038: Shared rate limiting. The in-memory limiter only counted per server instance and reset on restart;
-- this table is shared by every instance. Only the service role touches it (RLS on, no policies).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically counts one hit for p_key in a fixed window and reports whether it is allowed.
CREATE OR REPLACE FUNCTION hit_rate_limit(p_key TEXT, p_max INTEGER, p_window_ms INTEGER)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_in_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_reset TIMESTAMPTZ;
BEGIN
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_ms / 1000.0) ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset;

  -- Occasional cleanup of long-expired windows.
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day';
  END IF;

  RETURN QUERY SELECT
    v_count <= p_max,
    GREATEST(p_max - v_count, 0),
    GREATEST(0, (EXTRACT(EPOCH FROM (v_reset - now())) * 1000)::INTEGER);
END;
$$;

REVOKE ALL ON FUNCTION hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
