-- Visitor categories now exclude student and faculty/staff (they identify via
-- their school-issued ID instead of the visitor category picker).
COMMENT ON COLUMN appointments.visitor_category IS 'Category of visitor: external, parents, alumni, vendor';