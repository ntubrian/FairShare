import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getPool } from "../db/pool";

const migrationsDir = resolve(process.cwd(), "server/migrations");

const ensureMigrationsTable = async () => {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getAppliedMigrations = async () => {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id ASC"
  );
  return new Set(rows.map((row) => row.id));
};

const run = async () => {
  await ensureMigrationsTable();

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const applied = await getAppliedMigrations();
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const file of pending) {
    const migrationSql = readFileSync(join(migrationsDir, file), "utf8");
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migrationSql);
      await client.query(
        `
        INSERT INTO schema_migrations (id, applied_at)
        VALUES ($1, NOW())
        ON CONFLICT (id) DO NOTHING
        `,
        [file]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    console.log(`Applied migration: ${file}`);
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed.", error);
    process.exit(1);
  });
