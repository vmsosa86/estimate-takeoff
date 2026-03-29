import type { Point } from "@/lib/types";

export function feetAndInchesToInches(
  feet: number,
  inches: number,
): number {
  return feet * 12 + inches;
}

export function formatSqFt(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${value.toFixed(2)} sq ft`;
}

export function getPixelDistance(point1: Point, point2: Point): number {
  return Math.hypot(point2.x - point1.x, point2.y - point1.y);
}

export function calculatePolygonPixelArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let sum = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum) / 2;
}

export function pixelAreaToSqInches(
  pixelArea: number,
  inchesPerPixel: number,
): number {
  return pixelArea * inchesPerPixel ** 2;
}

export function sqInchesToSqFeet(areaSqInches: number): number {
  return areaSqInches / 144;
}

export function calculateMeasuredArea(
  pixelArea: number,
  inchesPerPixel: number | null,
): { areaSqInches: number | null; areaSqFeet: number | null } {
  if (!inchesPerPixel) {
    return {
      areaSqInches: null,
      areaSqFeet: null,
    };
  }

  const areaSqInches = pixelAreaToSqInches(pixelArea, inchesPerPixel);

  return {
    areaSqInches,
    areaSqFeet: sqInchesToSqFeet(areaSqInches),
  };
}
