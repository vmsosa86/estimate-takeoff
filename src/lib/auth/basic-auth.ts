export function isBasicAuthEnabled(): boolean {
  return process.env.BASIC_AUTH_ENABLED === "true";
}

export function getBasicAuthCredentials(): {
  username: string;
  password: string;
} | null {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}
