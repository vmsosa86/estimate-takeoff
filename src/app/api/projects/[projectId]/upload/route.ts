import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { uploadProjectFile } from "@/lib/projects/service";
import { getAppUrl } from "@/lib/config";
import { buildSearchMessage } from "@/lib/http/navigation";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function getRequestOrigin(request: Request): string {
  const configuredOrigin = new URL(getAppUrl());
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    if (host === configuredOrigin.host) {
      return configuredOrigin.origin;
    }

    const forwardedProto = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");

    return `${protocol}://${host}`;
  }

  return configuredOrigin.origin;
}

function respondToProject(
  request: Request,
  projectId: string,
  options: { error?: string; success?: string },
) {
  const pathname = buildSearchMessage(`/projects/${projectId}`, options);
  const redirectTo = new URL(pathname, getRequestOrigin(request)).toString();

  if (request.headers.get("x-requested-with") === "XMLHttpRequest") {
    return NextResponse.json(
      {
        error: options.error,
        redirectTo,
      },
      { status: options.error ? 400 : 200 },
    );
  }

  return NextResponse.redirect(redirectTo, 303);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { projectId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return respondToProject(request, projectId, {
      error: "Choose a PDF file to upload.",
    });
  }

  const isPdfType = file.type === "application/pdf";
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");

  if (!isPdfType && !isPdfName) {
    return respondToProject(request, projectId, {
      error: "Only PDF files are allowed.",
    });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadProjectFile(projectId, file.name, buffer);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return respondToProject(request, projectId, {
      success: "PDF uploaded.",
    });
  } catch (error) {
    console.error("PDF upload failed", {
      projectId,
      filename: file.name,
      size: file.size,
      error,
    });

    return respondToProject(request, projectId, {
      error: "The PDF could not be processed.",
    });
  }
}
