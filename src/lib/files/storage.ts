import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";

import { getUploadsDir } from "@/lib/config";

function getPdfExtension(filename: string): string {
  const extension = path.extname(filename).toLowerCase();

  return extension === ".pdf" ? ".pdf" : ".pdf";
}

export async function ensureUploadsDir(): Promise<string> {
  const uploadsDir = getUploadsDir();

  await fs.mkdir(uploadsDir, { recursive: true });

  return uploadsDir;
}

export async function savePdfFile(
  projectId: string,
  originalName: string,
  buffer: Buffer,
): Promise<string> {
  const uploadsDir = await ensureUploadsDir();
  const projectDir = path.join(uploadsDir, projectId);

  await fs.mkdir(projectDir, { recursive: true });

  const storedName = `${nanoid(16)}${getPdfExtension(originalName)}`;
  const relativePath = path.join(projectId, storedName);
  const absolutePath = path.join(uploadsDir, relativePath);

  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

export async function deleteStoredFile(relativePath: string): Promise<void> {
  const absolutePath = path.join(getUploadsDir(), relativePath);

  await fs.rm(absolutePath, { force: true });
}

export function resolveStoredPath(relativePath: string): string {
  return path.join(getUploadsDir(), relativePath);
}
