-- 052: Replace the sample office phone numbers from the seed migrations (014, 017) with the real numbers
-- from the official USLS directory (https://www.usls.edu.ph/directory, read 2026-11-10).
--
-- The seeds gave every office a made-up sequential number, (034) 434-1201 to (034) 434-1258.
-- Only rows that still hold one of those samples are touched, so any number an admin already
-- entered in Admin > Offices is kept.
--
-- Format: direct line(s) first, then the local. Offices with only a local are reached through
-- the trunkline (034) 434-6100. Offices not listed in the directory have their sample cleared.

UPDATE offices AS o
SET contact_phone = v.phone
FROM (VALUES
  -- Vice Chancellor offices (locals supplied by the system owner; not in the public directory)
  ('Office of the VCF', '(034) 434-6100 loc. 163'),
  ('Office of the VCA', '(034) 434-6100 loc. 103'),
  ('Office of the VCMD', '(034) 434-6100 loc. 393'),
  ('Office of the VCAA', '(034) 434-6100 loc. 105'),
  -- Vice Chancellor for Finance
  ('Disbursement', '(034) 434-6100 loc. 477'),
  -- Vice Chancellor for Administration
  ('Coliseum', '(034) 435-0053 loc. 153'),
  ('University Press', '(034) 434-6100 loc. 169'),
  ('Campus Development', '(034) 432-1187 loc. 211'),
  ('Engineering Services Director', '(034) 434-6100 loc. 411'),
  ('General Services Director', '(034) 432-1187 loc. 116'),
  ('Campus Internal Security and Safety Office', '(034) 432-1187 loc. 139'),
  ('Health Services', '(034) 434-6219 loc. 107'),
  ('Human Resource and Development Services', '(034) 432-1190 loc. 118'),
  ('Procurement Services', '(034) 435-2767 loc. 108 / 455'),
  -- Vice Chancellor for Mission and Development
  ('BALAYAN Social Development Center', '(034) 435-3857 loc. 133'),
  ('Center of Alumni Relations', '(034) 433-0307 loc. 179'),
  ('Center for Lasallian Ministries (CELAM)', '(034) 432-1184 loc. 152'),
  ('Center for Linkages and International Affairs', '(034) 435-2594 loc. 458'),
  ('Center for Marketing and Communications', '(034) 434-6100 loc. 146'),
  ('Institutional Varsity Sports Office (IVSO)', '(034) 432-1185 loc. 112'),
  ('Museo De La Salle', '(034) 434-6100 loc. 186'),
  ('Vocation Ministry', '(034) 434-6100 loc. 162'),
  -- Vice Chancellor for Academic Affairs
  ('Career Development Center (Internship/Job Placement)', '(034) 434-6100 loc. 213'),
  ('Center for Research & Engagement (CRE)', '(034) 435-2595 loc. 137'),
  ('Institutional Research & Engagement Office (IREO)', '(034) 434-6100 loc. 137'),
  ('Publication Office (PO)', '(034) 434-6100 loc. 137'),
  ('Research Ethics Review Office (RERO)', '(034) 434-6100 loc. 137'),
  ('College of Arts & Sciences (CAS)', '(034) 432-1183 loc. 130'),
  ('College of Education (CED)', '(034) 432-1186 loc. 123'),
  ('College of Engineering (CoE)', '(034) 434-6941 loc. 132'),
  ('College of Law (COL)', '(034) 432-1189 loc. 157'),
  ('College of Medicine (COM)', '(034) 433-3151 loc. 138'),
  ('College of Nursing (CON)', '(034) 434-4010 loc. 185'),
  ('Graduate School of Management (GSM)', '(034) 432-1189 / 433-1278 loc. 120'),
  ('Guidance and Evaluation', '(034) 432-1182 loc. 173'),
  ('Institute for Culinary Arts (ICA) Admin Office', '(034) 434-6100 loc. 401'),
  ('Instructional Media Center (IMC)', '(034) 432-1186 loc. 129'),
  ('Life Skills', '(034) 434-6100 loc. 231'),
  ('NSTP', '(034) 434-6100 loc. 141'),
  ('Office for Student Affairs (OSA)', '(034) 432-1184 loc. 134'),
  ('Discipline Officer', '(034) 434-6100 loc. 192'),
  ('Parent Teachers Council (PTC)', '(034) 434-6100 loc. 333'),
  ('PESAR', '(034) 432-1183 loc. 128'),
  -- Basic Education Unit (Kinder to Grade 12)
  ('Basic Education Principal Main Office', '(034) 433-9006 loc. 143'),
  ('Vice Principal for Academics Office', '(034) 433-5143 loc. 158'),
  ('Vice Principal for Student Affairs Office', '(034) 433-5143 loc. 147'),
  ('Vice Principal for Support Services Office', '(034) 433-5143 loc. 194'),
  ('Guidance Services', '(034) 434-6100 loc. 145'),
  ('Research Office', '(034) 432-3769'),
  ('Science Laboratory', '(034) 434-6100 loc. 225'),
  ('Student Activities Center', '(034) 434-6100 loc. 223'),
  -- President
  ('Center for Advancement', '(034) 434-6100 loc. 122'),
  ('Data Privacy Officer', '(034) 434-6100 loc. 397'),
  ('Quality Assurance Management Officer', '(034) 434-6100 loc. 397'),
  ('Strategic Planning Officer', '(034) 434-6100 loc. 397'),
  ('Compliance Officer', '(034) 434-6100 loc. 198'),
  ('Risk, Compliance and Audit (RCA)', '(034) 434-6100 loc. 198')
) AS v(name, phone)
WHERE o.name = v.name
  AND o.contact_phone ~ '^\(034\) 434-12[0-5][0-9]$';

-- Offices added after the seed that had no phone yet, where the directory has a clear match.
UPDATE offices AS o
SET contact_phone = v.phone
FROM (VALUES
  ('Center for Research and Engagement', '(034) 435-2595 loc. 137'),
  ('Institutional Research and Engagement Office', '(034) 434-6100 loc. 137'),
  ('Publication and Engagement Office', '(034) 434-6100 loc. 137'),
  -- Locals supplied by the system owner. ASAO's loc. 124 is Admission and Scholarship's, so its
  -- direct line from the directory is included.
  ('ASAO', '(034) 433-7019 loc. 124'),
  ('College of Computing Studies (CCS)', '(034) 434-6100 loc. 200'),
  ('College of Tourism and Hospitality (CTH)', '(034) 434-6100 loc. 195')
) AS v(name, phone)
WHERE o.name = v.name
  AND COALESCE(TRIM(o.contact_phone), '') = '';

-- Numbers typed in by hand in mixed styles ("loc 158", "local 122", "434- 0674"), rewritten in the
-- standard format and checked against the directory (direct line added where the directory lists one).
-- Each row only changes if it still holds exactly the value seen on 2026-11-10.
UPDATE offices AS o
SET contact_phone = v.phone
FROM (VALUES
  ('BEU Guidance Services', '(034) 434-6100 - local 145', '(034) 434-6100 loc. 145'),
  ('IS - Vice Principal for Academics Office (Kinder to Grade 10)', 'loc 158', '(034) 433-5143 loc. 158'),
  ('Liceo - Vice Principal for Academics (Grade 11 - 12)', 'loc 311', '(034) 433-5143 loc. 311'),
  ('Vice Principal for Student Affairs Office', 'loc 147', '(034) 433-5143 loc. 147'),
  ('Office of the University Chancellor', 'loc 222', '(034) 434-6100 loc. 222'),
  ('Center for Advancement', '(034) 434 6100 local 122', '(034) 434-6100 loc. 122'),
  ('Special Projects Office', '(034) 434- 0674', '(034) 434-0674'),
  ('Discipline Officer', 'loc 192', '(034) 434-6100 loc. 192'),
  ('NSTP', 'loc 141', '(034) 434-6100 loc. 141'),
  ('Office for Student Affairs (OSA)', 'loc 134', '(034) 432-1184 loc. 134'),
  ('Balay Kalinungan', 'Loc 159 - 708 1510', '(034) 708-1510 · (034) 434-6100 loc. 159'),
  ('Center for Marketing and Communications', 'loc 146', '(034) 434-6100 loc. 146')
) AS v(name, old_phone, phone)
WHERE o.name = v.name
  AND TRIM(o.contact_phone) = v.old_phone;

-- Anything still holding a sample number (an office not in the directory, or a seeded office that
-- was renamed) is cleared.
UPDATE offices
SET contact_phone = NULL
WHERE contact_phone ~ '^\(034\) 434-12[0-5][0-9]$';
