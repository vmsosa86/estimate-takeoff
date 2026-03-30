export function buildSearchMessage(
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
