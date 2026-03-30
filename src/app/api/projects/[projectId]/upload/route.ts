import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { uploadProjectFile } from "@/lib/projects/service";
import { getAppUrl } from "@/lib/config";
import { buildSearchMessage } from "@/lib/http/navigation";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function redirectToProject(projectId: string, options: { error?: string; success?: string }) {
  const pathname = buildSearchMessage(`/projects/${projectId}`, options);

  return NextResponse.redirect(new URL(pathname, getAppUrl()), 303);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return redirectToProject(projectId, {
      error: "Choose a PDF file to upload.",
    });
  }

  const isPdfType = file.type === "application/pdf";
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");

  if (!isPdfType && !isPdfName) {
    return redirectToProject(projectId, {
      error: "Only PDF files are allowed.",
    });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadProjectFile(projectId, file.name, buffer);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return redirectToProject(projectId, {
      success: "PDF uploaded.",
    });
  } catch (error) {
    console.error("PDF upload failed", {
      projectId,
      filename: file.name,
      size: file.size,
      error,
    });

    return redirectToProject(projectId, {
      error: "The PDF could not be processed.",
    });
  }
}
