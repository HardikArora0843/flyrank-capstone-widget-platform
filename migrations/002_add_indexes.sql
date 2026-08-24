-- Migration 002: Add indexes for tenant isolation, dashboard aggregation, and queue workers

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_widgets_tenant_id ON widgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_id_created_at ON submissions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_widget_id_created_at ON submissions(widget_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_idempotency ON submissions(widget_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run_at ON background_jobs(status, run_at) WHERE status IN ('PENDING', 'PROCESSING');
