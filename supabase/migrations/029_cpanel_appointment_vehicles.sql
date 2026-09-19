ALTER TABLE appointments ADD COLUMN vehicle_count INT NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN is_invitation BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS appointment_vehicles (
  id CHAR(36) PRIMARY KEY,
  appointment_id VARCHAR(36) NOT NULL,
  vehicle_number INT NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  make_model VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_appointment_vehicle_number (appointment_id, vehicle_number),
  INDEX idx_appointment_vehicles_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
