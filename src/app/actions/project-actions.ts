"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProject,
  deleteProject,
  renameProject,
  uploadProjectFile,
} from "@/lib/projects/service";
import { projectSchema } from "@/lib/validation";

function buildSearchMessage(
  path: string,
  options: { error?: string; success?: string },
): string {
  const searchParams = new URLSearchParams();

  if (options.error) {
    searchParams.set("error", options.error);
  }

  if (options.success) {
    searchParams.set("success", options.success);
  }

  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirect(
      buildSearchMessage("/projects", {
        error: "Enter a valid project name.",
      }),
    );
  }

  await createProject(parsed.data.name);
  revalidatePath("/projects");
  redirect(
    buildSearchMessage("/projects", {
      success: "Project created.",
    }),
  );
}

export async function renameProjectAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
  });

  if (!projectId || !parsed.success) {
    redirect(
      buildSearchMessage(`/projects/${projectId}`, {
        error: "Project name could not be updated.",
      }),
    );
  }

  await renameProject(projectId, parsed.data.name);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(
    buildSearchMessage(`/projects/${projectId}`, {
      success: "Project updated.",
    }),
  );
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");

  if (!projectId) {
    redirect(
      buildSearchMessage("/projects", {
        error: "Project could not be deleted.",
      }),
    );
  }

  await deleteProject(projectId);
  revalidatePath("/projects");
  redirect(
    buildSearchMessage("/projects", {
      success: "Project deleted.",
    }),
  );
}

export async function uploadProjectFileAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");

  if (!projectId || !(file instanceof File)) {
    redirect(
      buildSearchMessage(`/projects/${projectId}`, {
        error: "Choose a PDF file to upload.",
      }),
    );
  }

  const isPdfType = file.type === "application/pdf";
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");

  if (!isPdfType && !isPdfName) {
    redirect(
      buildSearchMessage(`/projects/${projectId}`, {
        error: "Only PDF files are allowed.",
      }),
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadProjectFile(projectId, file.name, buffer);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    redirect(
      buildSearchMessage(`/projects/${projectId}`, {
        success: "PDF uploaded.",
      }),
    );
  } catch {
    redirect(
      buildSearchMessage(`/projects/${projectId}`, {
        error: "The PDF could not be processed.",
      }),
    );
  }
}
