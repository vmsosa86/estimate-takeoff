CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL UNIQUE,
  page_count INTEGER NOT NULL CHECK (page_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id
  ON project_files(project_id);

CREATE TABLE IF NOT EXISTS pdf_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  width_px DOUBLE PRECISION NOT NULL CHECK (width_px > 0),
  height_px DOUBLE PRECISION NOT NULL CHECK (height_px > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (file_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pdf_pages_file_id
  ON pdf_pages(file_id);

CREATE TABLE IF NOT EXISTS page_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL UNIQUE REFERENCES pdf_pages(id) ON DELETE CASCADE,
  point1_x DOUBLE PRECISION NOT NULL,
  point1_y DOUBLE PRECISION NOT NULL,
  point2_x DOUBLE PRECISION NOT NULL,
  point2_y DOUBLE PRECISION NOT NULL,
  pixel_distance DOUBLE PRECISION NOT NULL CHECK (pixel_distance > 0),
  real_distance_inches DOUBLE PRECISION NOT NULL CHECK (real_distance_inches > 0),
  inches_per_pixel DOUBLE PRECISION NOT NULL CHECK (inches_per_pixel > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_calibrations_page_id
  ON page_calibrations(page_id);

CREATE TABLE IF NOT EXISTS area_shapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pdf_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_jsonb JSONB NOT NULL,
  pixel_area DOUBLE PRECISION NOT NULL CHECK (pixel_area >= 0),
  area_sq_inches DOUBLE PRECISION,
  area_sq_feet DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_area_shapes_page_id
  ON area_shapes(page_id);
