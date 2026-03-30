import { z } from "zod";

const pointSchema = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
});

const colorHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color.");

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const calibrationSchema = z.object({
  point1: pointSchema,
  point2: pointSchema,
  feet: z.number().min(0),
  inches: z.number().min(0).max(11.999),
});

export const createShapeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["polygon", "rectangle"]).default("polygon"),
  operation: z.enum(["add", "deduct"]).default("add"),
  colorHex: colorHexSchema.default("#2c6fbb"),
  groupName: z.string().trim().min(1).max(120).nullable().optional(),
  points: z.array(pointSchema).min(3),
});

export const updateShapeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(["polygon", "rectangle"]).optional(),
  operation: z.enum(["add", "deduct"]).optional(),
  colorHex: colorHexSchema.optional(),
  groupName: z.string().trim().min(1).max(120).nullable().optional(),
  points: z.array(pointSchema).min(3).optional(),
});
