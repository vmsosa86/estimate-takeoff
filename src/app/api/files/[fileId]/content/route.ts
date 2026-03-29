import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { resolveStoredPath } from "@/lib/files/storage";
import { getFileDownloadInfo } from "@/lib/projects/service";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { fileId } = await params;
  const file = await getFileDownloadInfo(fileId);

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const buffer = await fs.readFile(resolveStoredPath(file.storedPath));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.originalName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
