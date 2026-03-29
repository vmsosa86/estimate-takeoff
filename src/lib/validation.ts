import { z } from "zod";

const pointSchema = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
});

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
  points: z.array(pointSchema).min(3),
});

export const updateShapeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  points: z.array(pointSchema).min(3).optional(),
});
