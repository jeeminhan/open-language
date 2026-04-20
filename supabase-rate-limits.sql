-- Rate limit counters, one row per (user, scope, window_start).
-- The window_start is floored to the nearest N seconds so multiple concurrent
-- requests land on the same row and atomically increment the counter.

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id uuid NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, scope, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON rate_limits(window_start);

-- RLS: service role bypasses; nobody else should read these directly.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_rate_limits" ON rate_limits;
CREATE POLICY "users_read_own_rate_limits" ON rate_limits
  FOR SELECT USING (user_id = auth.uid());

-- Atomic check-and-increment. Returns the post-increment count, limit,
-- and the moment the current window resets.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user uuid,
  p_scope text,
  p_limit integer,
  p_window_sec integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
BEGIN
  -- Floor current time to the window size.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_sec) * p_window_sec
  );
  v_window_end := v_window_start + make_interval(secs => p_window_sec);

  INSERT INTO rate_limits (user_id, scope, window_start, count)
  VALUES (p_user, p_scope, v_window_start, 1)
  ON CONFLICT (user_id, scope, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic cleanup: drop rows older than 1 hour.
  DELETE FROM rate_limits
  WHERE window_start < now() - interval '1 hour';

  RETURN jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'reset_at', v_window_end
  );
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(uuid, text, integer, integer) TO service_role;
