"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProject,
  deleteProject,
  renameProject,
} from "@/lib/projects/service";
import { buildSearchMessage } from "@/lib/http/navigation";
import { projectSchema } from "@/lib/validation";

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
