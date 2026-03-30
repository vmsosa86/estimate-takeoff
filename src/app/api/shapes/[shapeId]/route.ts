import { NextResponse } from "next/server";

import { deleteAreaShape, updateAreaShape } from "@/lib/projects/service";
import { updateShapeSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ shapeId: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { shapeId } = await params;
  const payload = await request.json();
  const parsed = updateShapeSchema.safeParse(payload);

  if (
    !parsed.success ||
    (
      parsed.data.name === undefined &&
      parsed.data.points === undefined &&
      parsed.data.kind === undefined &&
      parsed.data.operation === undefined &&
      parsed.data.colorHex === undefined &&
      parsed.data.groupName === undefined
    )
  ) {
    return NextResponse.json(
      { error: "Invalid shape update payload." },
      { status: 400 },
    );
  }

  try {
    const shape = await updateAreaShape({
      shapeId,
      ...parsed.data,
    });

    return NextResponse.json({ shape });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Shape could not be updated.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { shapeId } = await params;

  try {
    await deleteAreaShape(shapeId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Shape could not be deleted." },
      { status: 400 },
    );
  }
}
