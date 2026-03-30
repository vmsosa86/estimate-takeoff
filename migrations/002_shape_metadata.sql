ALTER TABLE area_shapes
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'polygon',
  ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT 'add',
  ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#2c6fbb',
  ADD COLUMN IF NOT EXISTS group_name TEXT;

ALTER TABLE area_shapes
  DROP CONSTRAINT IF EXISTS area_shapes_kind_check;

ALTER TABLE area_shapes
  ADD CONSTRAINT area_shapes_kind_check
  CHECK (kind IN ('polygon', 'rectangle'));

ALTER TABLE area_shapes
  DROP CONSTRAINT IF EXISTS area_shapes_operation_check;

ALTER TABLE area_shapes
  ADD CONSTRAINT area_shapes_operation_check
  CHECK (operation IN ('add', 'deduct'));

CREATE INDEX IF NOT EXISTS idx_area_shapes_page_group_name
  ON area_shapes(page_id, group_name);
