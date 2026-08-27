-- cPanel MySQL Archive Schema
-- Run this in phpMyAdmin or MySQL CLI on the cPanel server

CREATE TABLE IF NOT EXISTS archived_appointments (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  id_image MEDIUMBLOB,
  visitor_category VARCHAR(50) NOT NULL DEFAULT 'general_public',
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_status (status),
  INDEX idx_office (office_id),
  INDEX idx_archived_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS archived_email_logs (
  id VARCHAR(36) PRIMARY KEY,
  appointment_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  sent_at DATETIME,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointment_id (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS archive_sync_log (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  records_synced INTEGER NOT NULL DEFAULT 0,
  images_synced INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
