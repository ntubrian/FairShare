import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/pool";
import { agreedRate } from "../db/schema";
import { Currency } from "../types";

export type AgreedRateRow = {
  project_id: string;
  from_currency: Currency;
  to_currency: Currency;
  rate: string;
  updated_by: string;
  updated_at: string;
};

type DbExecutor = ReturnType<typeof getDb>;
const resolveDb = (executor?: DbExecutor) => executor ?? getDb();

export const rateRepository = {
  async listByProject(projectId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    return db
      .select({
        project_id: agreedRate.projectId,
        from_currency: agreedRate.fromCurrency,
        to_currency: agreedRate.toCurrency,
        rate: agreedRate.rate,
        updated_by: agreedRate.updatedBy,
        updated_at: agreedRate.updatedAt,
      })
      .from(agreedRate)
      .where(eq(agreedRate.projectId, projectId))
      .orderBy(asc(agreedRate.fromCurrency), asc(agreedRate.toCurrency));
  },

  async upsert(
    input: {
      projectId: string;
      fromCurrency: Currency;
      toCurrency: Currency;
      rate: number;
      updatedBy: string;
    },
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .insert(agreedRate)
      .values({
        projectId: input.projectId,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rate: input.rate.toFixed(8),
        updatedBy: input.updatedBy,
      })
      .onConflictDoUpdate({
        target: [
          agreedRate.projectId,
          agreedRate.fromCurrency,
          agreedRate.toCurrency,
        ],
        set: {
          rate: input.rate.toFixed(8),
          updatedBy: input.updatedBy,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        project_id: agreedRate.projectId,
        from_currency: agreedRate.fromCurrency,
        to_currency: agreedRate.toCurrency,
        rate: agreedRate.rate,
        updated_by: agreedRate.updatedBy,
        updated_at: agreedRate.updatedAt,
      });
    return row;
  },
};
