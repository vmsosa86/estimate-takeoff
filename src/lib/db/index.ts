import "server-only";

import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import { getDatabaseUrl } from "@/lib/config";

declare global {
  var __estimateTakeoffPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__estimateTakeoffPool) {
    globalThis.__estimateTakeoffPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return globalThis.__estimateTakeoffPool;
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

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
