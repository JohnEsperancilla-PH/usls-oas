ALTER TABLE appointments ADD COLUMN visitor_count INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS appointment_visitors (
  id CHAR(36) PRIMARY KEY,
  appointment_id VARCHAR(36) NOT NULL,
  visitor_number INT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  valid_id VARCHAR(100) NOT NULL,
  is_booker BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_appointment_visitor_number (appointment_id, visitor_number),
  INDEX idx_appointment_visitors_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;