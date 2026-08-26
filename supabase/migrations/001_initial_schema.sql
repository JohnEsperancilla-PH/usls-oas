-- Create offices table
CREATE TABLE IF NOT EXISTS offices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  operating_hours VARCHAR(255) NOT NULL,
  capacity_per_slot INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  id_image_url TEXT NOT NULL,
  office_id UUID NOT NULL REFERENCES offices(id),
  date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (30, 60)),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'completed', 'expired')),
  qr_token TEXT,
  qr_used_at TIMESTAMP WITH TIME ZONE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'office_admin' CHECK (role IN ('super_admin', 'office_admin')),
  office_id UUID REFERENCES offices(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('confirmation', 'admin_alert', 'approval', 'decline')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_office_id ON appointments(office_id);
CREATE INDEX IF NOT EXISTS idx_appointments_archived ON appointments(archived);
CREATE INDEX IF NOT EXISTS idx_email_logs_appointment_id ON email_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_admins_office_id ON admins(office_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for appointments table
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample offices
INSERT INTO offices (name, operating_hours, capacity_per_slot, active) VALUES
  ('Registrar', '8:00 AM - 5:00 PM', 5, true),
  ('Student Affairs', '8:00 AM - 5:00 PM', 3, true),
  ('Finance Office', '8:00 AM - 4:00 PM', 4, true),
  ('Library', '7:00 AM - 8:00 PM', 10, true),
  ('Admissions', '8:00 AM - 5:00 PM', 2, true)
ON CONFLICT DO NOTHING;