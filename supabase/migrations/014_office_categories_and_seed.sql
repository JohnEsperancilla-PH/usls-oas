-- Add office category for grouping (accordion) on the booking form and /offices page
ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN offices.category IS 'Office category used to group offices on the booking form and the offices directory';

-- Seed offices grouped by category (idempotent: skips names that already exist).
-- Emails are placeholders (dummy@gmail.com) and phone numbers are samples; edit in Admin > Offices.
INSERT INTO offices (name, email, operating_hours, capacity_per_slot, contact_email, contact_phone, category, active)
SELECT v.name, 'dummy@gmail.com', '8:00 AM - 5:00 PM', 1, 'dummy@gmail.com', v.phone, v.category, true
FROM (VALUES
  -- Vice Chancellor for Finance
  ('Office of the VCF', '(034) 434-1201', 'Vice Chancellor for Finance'),
  ('Disbursement', '(034) 434-1202', 'Vice Chancellor for Finance'),
  -- Vice Chancellor for Administration
  ('Coliseum', '(034) 434-1203', 'Vice Chancellor for Administration'),
  ('University Press', '(034) 434-1204', 'Vice Chancellor for Administration'),
  ('Campus Development', '(034) 434-1205', 'Vice Chancellor for Administration'),
  ('Engineering Services Director', '(034) 434-1206', 'Vice Chancellor for Administration'),
  ('General Services Director', '(034) 434-1207', 'Vice Chancellor for Administration'),
  ('Campus Internal Security and Safety Office', '(034) 434-1208', 'Vice Chancellor for Administration'),
  ('Health Services', '(034) 434-1209', 'Vice Chancellor for Administration'),
  ('Human Resource and Development Services', '(034) 434-1210', 'Vice Chancellor for Administration'),
  ('Procurement Services', '(034) 434-1211', 'Vice Chancellor for Administration'),
  -- Vice Chancellor for Mission and Development
  ('BALAYAN Social Development Center', '(034) 434-1212', 'Vice Chancellor for Mission and Development'),
  ('Center of Alumni Relations', '(034) 434-1213', 'Vice Chancellor for Mission and Development'),
  ('Center for Lasallian Ministries (CELAM)', '(034) 434-1214', 'Vice Chancellor for Mission and Development'),
  ('Center for Linkages and International Affairs', '(034) 434-1215', 'Vice Chancellor for Mission and Development'),
  ('Center for Marketing and Communications', '(034) 434-1216', 'Vice Chancellor for Mission and Development'),
  ('Institutional Varsity Sports Office (IVSO)', '(034) 434-1217', 'Vice Chancellor for Mission and Development'),
  ('Museo De La Salle', '(034) 434-1218', 'Vice Chancellor for Mission and Development'),
  ('Vocation Ministry', '(034) 434-1219', 'Vice Chancellor for Mission and Development'),
  -- Vice Chancellor for Academic Affairs
  ('Career Development Center (Internship/Job Placement)', '(034) 434-1220', 'Vice Chancellor for Academic Affairs'),
  ('Center for Research & Engagement (CRE)', '(034) 434-1221', 'Vice Chancellor for Academic Affairs'),
  ('Institutional Research & Engagement Office (IREO)', '(034) 434-1222', 'Vice Chancellor for Academic Affairs'),
  ('Publication Office (PO)', '(034) 434-1223', 'Vice Chancellor for Academic Affairs'),
  ('Research Ethics Review Office (RERO)', '(034) 434-1224', 'Vice Chancellor for Academic Affairs'),
  ('College of Arts & Sciences (CAS)', '(034) 434-1225', 'Vice Chancellor for Academic Affairs'),
  ('College of Education (CED)', '(034) 434-1226', 'Vice Chancellor for Academic Affairs'),
  ('College of Engineering (CoE)', '(034) 434-1227', 'Vice Chancellor for Academic Affairs'),
  ('College of Law (COL)', '(034) 434-1228', 'Vice Chancellor for Academic Affairs'),
  ('College of Medicine (COM)', '(034) 434-1229', 'Vice Chancellor for Academic Affairs'),
  ('College of Nursing (CON)', '(034) 434-1230', 'Vice Chancellor for Academic Affairs'),
  ('Graduate School of Management (GSM)', '(034) 434-1231', 'Vice Chancellor for Academic Affairs'),
  ('Guidance and Evaluation', '(034) 434-1232', 'Vice Chancellor for Academic Affairs'),
  ('Institute for Culinary Arts (ICA) Admin Office', '(034) 434-1233', 'Vice Chancellor for Academic Affairs'),
  ('Instructional Media Center (IMC)', '(034) 434-1234', 'Vice Chancellor for Academic Affairs'),
  ('Life Skills', '(034) 434-1235', 'Vice Chancellor for Academic Affairs'),
  ('NSTP', '(034) 434-1236', 'Vice Chancellor for Academic Affairs'),
  ('Office for Student Affairs (OSA)', '(034) 434-1237', 'Vice Chancellor for Academic Affairs'),
  ('Discipline Officer', '(034) 434-1238', 'Vice Chancellor for Academic Affairs'),
  ('Parent Teachers Council (PTC)', '(034) 434-1239', 'Vice Chancellor for Academic Affairs'),
  ('PESAR', '(034) 434-1240', 'Vice Chancellor for Academic Affairs'),
  -- Basic Education Unit (Kinder to Grade 12)
  ('Basic Education Principal Main Office', '(034) 434-1241', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Vice Principal for Academics Office', '(034) 434-1242', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Vice Principal for Student Affairs Office', '(034) 434-1243', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Vice Principal for Support Services Office', '(034) 434-1244', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Guidance Services', '(034) 434-1245', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Research Office', '(034) 434-1246', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Science Laboratory', '(034) 434-1247', 'Basic Education Unit (Kinder to Grade 12)'),
  ('Student Activities Center', '(034) 434-1248', 'Basic Education Unit (Kinder to Grade 12)'),
  -- President
  ('Center for Advancement', '(034) 434-1249', 'President'),
  ('Data Privacy Officer', '(034) 434-1250', 'President'),
  ('Quality Assurance Management Officer', '(034) 434-1251', 'President'),
  ('Strategic Planning Officer', '(034) 434-1252', 'President'),
  ('Compliance Officer', '(034) 434-1253', 'President'),
  ('Risk, Compliance and Audit (RCA)', '(034) 434-1254', 'President'),
  -- Executive / principal offices (VX Offices)
  ('Office of the VCA', '(034) 434-1255', 'Vice Chancellor for Administration'),
  ('Office of the VCMD', '(034) 434-1256', 'Vice Chancellor for Mission and Development'),
  ('Office of the VCAA', '(034) 434-1257', 'Vice Chancellor for Academic Affairs'),
  ('Office of the University President', '(034) 434-1258', 'President')
) AS v(name, phone, category)
WHERE NOT EXISTS (SELECT 1 FROM offices o WHERE o.name = v.name);