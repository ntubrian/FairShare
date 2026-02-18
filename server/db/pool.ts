import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

const createPool = () => {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Set it in .env before running server/db scripts."
    );
  }

  const lowerUrl = env.databaseUrl.toLowerCase();
  const useSsl =
    !lowerUrl.includes("localhost") &&
    !lowerUrl.includes("127.0.0.1") &&
    !lowerUrl.includes("sslmode=disable");

  return new Pool({
    connectionString: env.databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
};

export const getPool = () => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const getDb = () => {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
};

export const dbQuery = <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<TRow>> => getPool().query<TRow>(text, params);

export const withTransaction = async <T>(
  runner: (client: PoolClient) => Promise<T>
) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await runner(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
