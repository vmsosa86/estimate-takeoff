import "server-only";

import type { PoolClient } from "pg";

import { deleteStoredFile, savePdfFile } from "@/lib/files/storage";
import {
  calculateMeasuredArea,
  calculatePolygonPixelArea,
  feetAndInchesToInches,
  getPixelDistance,
} from "@/lib/math/measurement";
import { extractPdfMetadata } from "@/lib/pdf/metadata";
import type {
  AreaShape,
  PageCalibration,
  ProjectDetail,
  ProjectFile,
  ProjectListItem,
  ViewerPageData,
  Point,
} from "@/lib/types";
import { withTransaction } from "@/lib/db";
import {
  mapAreaShape,
  mapCalibration,
  mapPdfPage,
  mapProject,
  mapProjectFile,
  mapProjectListItem,
} from "@/lib/db/mappers";

type ProjectRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

type ProjectFileRow = {
  id: string;
  project_id: string;
  original_name: string;
  stored_path: string;
  page_count: number;
  created_at: Date;
  updated_at: Date;
};

type PdfPageRow = {
  id: string;
  file_id: string;
  page_number: number;
  width_px: number;
  height_px: number;
  created_at: Date;
  updated_at: Date;
};

type CalibrationRow = {
  id: string;
  page_id: string;
  point1_x: number;
  point1_y: number;
  point2_x: number;
  point2_y: number;
  pixel_distance: number;
  real_distance_inches: number;
  inches_per_pixel: number;
  created_at: Date;
  updated_at: Date;
};

type ShapeRow = {
  id: string;
  page_id: string;
  name: string;
  points_jsonb: Point[];
  pixel_area: number;
  area_sq_inches: number | null;
  area_sq_feet: number | null;
  created_at: Date;
  updated_at: Date;
};

export async function listProjects(): Promise<ProjectListItem[]> {
  const { rows } = await withTransaction(async (client) =>
    client.query<{
      id: string;
      name: string;
      file_count: number;
      page_count: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT
          projects.*,
          COUNT(DISTINCT project_files.id) AS file_count,
          COALESCE(SUM(project_files.page_count), 0) AS page_count
        FROM projects
        LEFT JOIN project_files ON project_files.project_id = projects.id
        GROUP BY projects.id
        ORDER BY projects.updated_at DESC
      `,
    ),
  );

  return rows.map(mapProjectListItem);
}

export async function createProject(name: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO projects (name)
        VALUES ($1)
      `,
      [name],
    );
  });
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE projects
        SET name = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [projectId, name],
    );
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const storedPaths = await withTransaction(async (client) => {
    const { rows } = await client.query<{ stored_path: string }>(
      `
        SELECT stored_path
        FROM project_files
        WHERE project_id = $1
      `,
      [projectId],
    );

    await client.query("DELETE FROM projects WHERE id = $1", [projectId]);

    return rows.map((row) => row.stored_path);
  });

  await Promise.all(storedPaths.map((storedPath) => deleteStoredFile(storedPath)));
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  return withTransaction(async (client) => {
    const projectResult = await client.query<ProjectRow>(
      `
        SELECT *
        FROM projects
        WHERE id = $1
      `,
      [projectId],
    );

    const projectRow = projectResult.rows[0];

    if (!projectRow) {
      return null;
    }

    const fileResult = await client.query<ProjectFileRow>(
      `
        SELECT *
        FROM project_files
        WHERE project_id = $1
        ORDER BY created_at DESC
      `,
      [projectId],
    );

    return {
      project: mapProject(projectRow),
      files: fileResult.rows.map(mapProjectFile),
    };
  });
}

export async function uploadProjectFile(
  projectId: string,
  originalName: string,
  buffer: Buffer,
): Promise<ProjectFile> {
  const storedPath = await savePdfFile(projectId, originalName, buffer);

  try {
    const metadata = await extractPdfMetadata(buffer);

    return await withTransaction(async (client) => {
      const fileResult = await client.query<ProjectFileRow>(
        `
          INSERT INTO project_files (project_id, original_name, stored_path, page_count)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [projectId, originalName, storedPath, metadata.pageCount],
      );

      const file = fileResult.rows[0];

      for (const page of metadata.pages) {
        await client.query(
          `
            INSERT INTO pdf_pages (file_id, page_number, width_px, height_px)
            VALUES ($1, $2, $3, $4)
          `,
          [file.id, page.pageNumber, page.widthPx, page.heightPx],
        );
      }

      await client.query(
        `
          UPDATE projects
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [projectId],
      );

      return mapProjectFile(file);
    });
  } catch (error) {
    await deleteStoredFile(storedPath);
    throw error;
  }
}

async function getCalibrationForPage(
  client: PoolClient,
  pageId: string,
): Promise<PageCalibration | null> {
  const result = await client.query<CalibrationRow>(
    `
      SELECT *
      FROM page_calibrations
      WHERE page_id = $1
    `,
    [pageId],
  );

  return result.rows[0] ? mapCalibration(result.rows[0]) : null;
}

async function recalculateShapesForPage(
  client: PoolClient,
  pageId: string,
  inchesPerPixel: number | null,
): Promise<void> {
  const shapeResult = await client.query<ShapeRow>(
    `
      SELECT *
      FROM area_shapes
      WHERE page_id = $1
    `,
    [pageId],
  );

  for (const shape of shapeResult.rows) {
    const measured = calculateMeasuredArea(shape.pixel_area, inchesPerPixel);

    await client.query(
      `
        UPDATE area_shapes
        SET area_sq_inches = $2,
            area_sq_feet = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [shape.id, measured.areaSqInches, measured.areaSqFeet],
    );
  }
}

export async function getViewerData(
  fileId: string,
  requestedPageNumber?: number,
): Promise<ViewerPageData | null> {
  return withTransaction(async (client) => {
    const fileResult = await client.query<
      ProjectFileRow & {
        project_name: string;
        project_created_at: Date;
        project_updated_at: Date;
      }
    >(
      `
        SELECT
          project_files.*,
          projects.name AS project_name,
          projects.created_at AS project_created_at,
          projects.updated_at AS project_updated_at
        FROM project_files
        INNER JOIN projects ON projects.id = project_files.project_id
        WHERE project_files.id = $1
      `,
      [fileId],
    );

    const fileRow = fileResult.rows[0];

    if (!fileRow) {
      return null;
    }

    const pagesResult = await client.query<PdfPageRow>(
      `
        SELECT *
        FROM pdf_pages
        WHERE file_id = $1
        ORDER BY page_number ASC
      `,
      [fileId],
    );

    const pages = pagesResult.rows.map(mapPdfPage);
    const fallbackPage = pages[0];
    const currentPage =
      pages.find((page) => page.pageNumber === requestedPageNumber) ?? fallbackPage;

    if (!currentPage) {
      return null;
    }

    const calibration = await getCalibrationForPage(client, currentPage.id);
    const shapeResult = await client.query<ShapeRow>(
      `
        SELECT *
        FROM area_shapes
        WHERE page_id = $1
        ORDER BY created_at ASC
      `,
      [currentPage.id],
    );

    return {
      project: {
        id: fileRow.project_id,
        name: fileRow.project_name,
        createdAt: fileRow.project_created_at.toISOString(),
        updatedAt: fileRow.project_updated_at.toISOString(),
      },
      file: mapProjectFile(fileRow),
      pages,
      currentPage,
      calibration,
      shapes: shapeResult.rows.map(mapAreaShape),
    };
  });
}

export async function savePageCalibration(input: {
  pageId: string;
  point1: Point;
  point2: Point;
  feet: number;
  inches: number;
}): Promise<PageCalibration> {
  return withTransaction(async (client) => {
    const pixelDistance = getPixelDistance(input.point1, input.point2);

    if (!pixelDistance) {
      throw new Error("Calibration points must be different.");
    }

    const realDistanceInches = feetAndInchesToInches(input.feet, input.inches);

    if (realDistanceInches <= 0) {
      throw new Error("Calibration distance must be greater than zero.");
    }

    const inchesPerPixel = realDistanceInches / pixelDistance;
    const result = await client.query<CalibrationRow>(
      `
        INSERT INTO page_calibrations (
          page_id,
          point1_x,
          point1_y,
          point2_x,
          point2_y,
          pixel_distance,
          real_distance_inches,
          inches_per_pixel
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (page_id)
        DO UPDATE SET
          point1_x = EXCLUDED.point1_x,
          point1_y = EXCLUDED.point1_y,
          point2_x = EXCLUDED.point2_x,
          point2_y = EXCLUDED.point2_y,
          pixel_distance = EXCLUDED.pixel_distance,
          real_distance_inches = EXCLUDED.real_distance_inches,
          inches_per_pixel = EXCLUDED.inches_per_pixel,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.pageId,
        input.point1.x,
        input.point1.y,
        input.point2.x,
        input.point2.y,
        pixelDistance,
        realDistanceInches,
        inchesPerPixel,
      ],
    );

    await recalculateShapesForPage(client, input.pageId, inchesPerPixel);

    return mapCalibration(result.rows[0]);
  });
}

export async function createAreaShape(input: {
  pageId: string;
  name: string;
  points: Point[];
}): Promise<AreaShape> {
  return withTransaction(async (client) => {
    const calibration = await getCalibrationForPage(client, input.pageId);
    const pixelArea = calculatePolygonPixelArea(input.points);
    const measured = calculateMeasuredArea(
      pixelArea,
      calibration?.inchesPerPixel ?? null,
    );

    const result = await client.query<ShapeRow>(
      `
        INSERT INTO area_shapes (
          page_id,
          name,
          points_jsonb,
          pixel_area,
          area_sq_inches,
          area_sq_feet
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        RETURNING *
      `,
      [
        input.pageId,
        input.name,
        JSON.stringify(input.points),
        pixelArea,
        measured.areaSqInches,
        measured.areaSqFeet,
      ],
    );

    return mapAreaShape(result.rows[0]);
  });
}

export async function updateAreaShape(input: {
  shapeId: string;
  name?: string;
  points?: Point[];
}): Promise<AreaShape> {
  return withTransaction(async (client) => {
    const existingResult = await client.query<ShapeRow>(
      `
        SELECT *
        FROM area_shapes
        WHERE id = $1
      `,
      [input.shapeId],
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error("Shape not found.");
    }

    const nextPoints = input.points ?? existing.points_jsonb;
    const pixelArea = calculatePolygonPixelArea(nextPoints);
    const calibration = await getCalibrationForPage(client, existing.page_id);
    const measured = calculateMeasuredArea(
      pixelArea,
      calibration?.inchesPerPixel ?? null,
    );

    const result = await client.query<ShapeRow>(
      `
        UPDATE area_shapes
        SET name = $2,
            points_jsonb = $3::jsonb,
            pixel_area = $4,
            area_sq_inches = $5,
            area_sq_feet = $6,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        input.shapeId,
        input.name ?? existing.name,
        JSON.stringify(nextPoints),
        pixelArea,
        measured.areaSqInches,
        measured.areaSqFeet,
      ],
    );

    return mapAreaShape(result.rows[0]);
  });
}

export async function deleteAreaShape(shapeId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM area_shapes WHERE id = $1", [shapeId]);
  });
}
