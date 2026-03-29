import "server-only";

import { Pool, type PoolClient, type QueryResult } from "pg";

import { getDatabaseUrl } from "@/lib/config";

declare global {
  var __estimateTakeoffPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: getDatabaseUrl(),
  });
}

const pool = globalThis.__estimateTakeoffPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__estimateTakeoffPool = pool;
}

export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
