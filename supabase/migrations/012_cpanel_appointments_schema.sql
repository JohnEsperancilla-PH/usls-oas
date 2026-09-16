-- cPanel MySQL Appointments Schema
-- Run this in phpMyAdmin or MySQL CLI on the cPanel server.
-- Drops the old long-term archive tables and creates a single clean
-- appointments table for finalized appointment records. No email log or
-- sync log tables are kept; appointment data lives here, everything else
-- stays in Supabase.

DROP TABLE IF EXISTS archived_appointments;
DROP TABLE IF EXISTS archived_email_logs;
DROP TABLE IF EXISTS archive_sync_log;

CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  valid_id VARCHAR(100),
  visitor_category VARCHAR(50) NOT NULL DEFAULT 'external',
  purpose_of_visit TEXT,
  office_id VARCHAR(36) NOT NULL,
  office_name VARCHAR(255),
  date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  duration INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  qr_token TEXT,
  qr_used_at DATETIME,
  scanned_at DATETIME,
  decline_reason TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_status (status),
  INDEX idx_office (office_id),
  INDEX idx_archived_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;