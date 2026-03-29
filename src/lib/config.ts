import path from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function getDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}

export function getUploadsDir(): string {
  const configured = process.env.UPLOADS_DIR ?? "./uploads";

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
