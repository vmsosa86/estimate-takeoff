import { NextResponse } from "next/server";

import { savePageCalibration } from "@/lib/projects/service";
import { calibrationSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ pageId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { pageId } = await params;
  const payload = await request.json();
  const parsed = calibrationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid calibration payload." },
      { status: 400 },
    );
  }

  try {
    const calibration = await savePageCalibration({
      pageId,
      ...parsed.data,
    });

    return NextResponse.json({ calibration });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Calibration could not be saved.",
      },
      { status: 400 },
    );
  }
}
