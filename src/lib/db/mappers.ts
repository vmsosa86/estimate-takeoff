import type {
  AreaShape,
  PageCalibration,
  PdfPage,
  Project,
  ProjectFile,
  ProjectListItem,
} from "@/lib/types";

type TimestampRow = {
  created_at: Date;
  updated_at: Date;
};

export function mapProject(
  row: {
    id: string;
    name: string;
  } & TimestampRow,
): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapProjectListItem(
  row: {
    id: string;
    name: string;
    file_count: string | number;
    page_count: string | number;
  } & TimestampRow,
): ProjectListItem {
  return {
    ...mapProject(row),
    fileCount: Number(row.file_count),
    pageCount: Number(row.page_count),
  };
}

export function mapProjectFile(
  row: {
    id: string;
    project_id: string;
    original_name: string;
    stored_path: string;
    page_count: number;
  } & TimestampRow,
): ProjectFile {
  return {
    id: row.id,
    projectId: row.project_id,
    originalName: row.original_name,
    storedPath: row.stored_path,
    pageCount: row.page_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapPdfPage(
  row: {
    id: string;
    file_id: string;
    page_number: number;
    width_px: number;
    height_px: number;
  } & TimestampRow,
): PdfPage {
  return {
    id: row.id,
    fileId: row.file_id,
    pageNumber: row.page_number,
    widthPx: row.width_px,
    heightPx: row.height_px,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapCalibration(
  row: {
    id: string;
    page_id: string;
    point1_x: number;
    point1_y: number;
    point2_x: number;
    point2_y: number;
    pixel_distance: number;
    real_distance_inches: number;
    inches_per_pixel: number;
  } & TimestampRow,
): PageCalibration {
  return {
    id: row.id,
    pageId: row.page_id,
    point1X: row.point1_x,
    point1Y: row.point1_y,
    point2X: row.point2_x,
    point2Y: row.point2_y,
    pixelDistance: row.pixel_distance,
    realDistanceInches: row.real_distance_inches,
    inchesPerPixel: row.inches_per_pixel,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapAreaShape(
  row: {
    id: string;
    page_id: string;
    name: string;
    kind: AreaShape["kind"];
    operation: AreaShape["operation"];
    color_hex: string;
    group_name: string | null;
    points_jsonb: AreaShape["points"];
    pixel_area: number;
    area_sq_inches: number | null;
    area_sq_feet: number | null;
  } & TimestampRow,
): AreaShape {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    kind: row.kind,
    operation: row.operation,
    colorHex: row.color_hex,
    groupName: row.group_name,
    points: row.points_jsonb,
    pixelArea: row.pixel_area,
    areaSqInches: row.area_sq_inches,
    areaSqFeet: row.area_sq_feet,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
