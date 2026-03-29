import { NextResponse } from "next/server";

import { createAreaShape } from "@/lib/projects/service";
import { createShapeSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { pageId } = await params;
  const payload = await request.json();
  const parsed = createShapeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid polygon payload." },
      { status: 400 },
    );
  }

  try {
    const shape = await createAreaShape({
      pageId,
      ...parsed.data,
    });

    return NextResponse.json({ shape });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Shape could not be saved.",
      },
      { status: 400 },
    );
  }
}
