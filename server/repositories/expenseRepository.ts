import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/pool";
import { expense, expenseSplit } from "../db/schema";
import { Currency, SplitMode } from "../types";

export type ExpenseRow = {
  id: string;
  project_id: string;
  payer_participant_id: string;
  amount: string;
  currency: Currency;
  split_mode: SplitMode;
  description: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExpenseSplitRow = {
  expense_id: string;
  participant_id: string;
  amount: string | null;
  shares: string | null;
  created_at: string;
};

type DbExecutor = ReturnType<typeof getDb>;
const resolveDb = (executor?: DbExecutor) => executor ?? getDb();

const expenseSelect = {
  id: expense.id,
  project_id: expense.projectId,
  payer_participant_id: expense.payerParticipantId,
  amount: expense.amount,
  currency: expense.currency,
  split_mode: expense.splitMode,
  description: expense.description,
  occurred_at: expense.occurredAt,
  created_at: expense.createdAt,
  updated_at: expense.updatedAt,
  deleted_at: expense.deletedAt,
};

export const expenseRepository = {
  async listByProject(
    projectId: string,
    includeDeleted: boolean,
    options?: {
      page?: number;
      pageSize?: number;
    },
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const page =
      options?.page && options.page > 0 ? Math.floor(options.page) : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? Math.floor(options.pageSize)
        : 0;
    const baseQuery = db
      .select(expenseSelect)
      .from(expense)
      .where(
        includeDeleted
          ? eq(expense.projectId, projectId)
          : and(eq(expense.projectId, projectId), isNull(expense.deletedAt))
      )
      .orderBy(desc(expense.createdAt));

    if (!pageSize) {
      return baseQuery;
    }

    return baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  },

  async findById(expenseId: string, projectId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const [row] = await db
      .select(expenseSelect)
      .from(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.projectId, projectId)));
    return row ?? null;
  },

  async listSplitsByExpenseIds(
    expenseIds: string[],
    executor?: DbExecutor
  ): Promise<ExpenseSplitRow[]> {
    if (!expenseIds.length) {
      return [];
    }
    const db = resolveDb(executor);
    return db
      .select({
        expense_id: expenseSplit.expenseId,
        participant_id: expenseSplit.participantId,
        amount: expenseSplit.amount,
        shares: expenseSplit.shares,
        created_at: expenseSplit.createdAt,
      })
      .from(expenseSplit)
      .where(inArray(expenseSplit.expenseId, expenseIds));
  },

  async replaceSplits(
    expenseId: string,
    splits: Array<{
      participantId: string;
      amount: number | null;
      shares: number | null;
    }>,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    await db.delete(expenseSplit).where(eq(expenseSplit.expenseId, expenseId));
    if (!splits.length) {
      return;
    }
    await db.insert(expenseSplit).values(
      splits.map((split) => ({
        expenseId,
        participantId: split.participantId,
        amount: split.amount === null ? null : split.amount.toFixed(2),
        shares: split.shares === null ? null : split.shares.toFixed(6),
      }))
    );
  },

  async add(
    input: {
      projectId: string;
      payerParticipantId: string;
      amount: number;
      currency: Currency;
      splitMode: SplitMode;
      description: string | null;
      occurredAt: string;
      createdBy: string;
    },
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .insert(expense)
      .values({
        projectId: input.projectId,
        payerParticipantId: input.payerParticipantId,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        splitMode: input.splitMode,
        description: input.description,
        occurredAt: input.occurredAt,
        createdBy: input.createdBy,
      })
      .returning(expenseSelect);
    return row;
  },

  async update(
    projectId: string,
    expenseId: string,
    updates: {
      payerParticipantId?: string;
      amount?: number;
      currency?: Currency;
      splitMode?: SplitMode;
      description?: string | null;
      occurredAt?: string;
    },
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const setValues: Partial<{
      payerParticipantId: string;
      amount: string;
      currency: Currency;
      splitMode: SplitMode;
      description: string | null;
      occurredAt: string;
    }> = {};

    if (updates.payerParticipantId !== undefined) {
      setValues.payerParticipantId = updates.payerParticipantId;
    }
    if (updates.amount !== undefined) {
      setValues.amount = updates.amount.toFixed(2);
    }
    if (updates.currency !== undefined) {
      setValues.currency = updates.currency;
    }
    if (updates.splitMode !== undefined) {
      setValues.splitMode = updates.splitMode;
    }
    if (updates.description !== undefined) {
      setValues.description = updates.description;
    }
    if (updates.occurredAt !== undefined) {
      setValues.occurredAt = updates.occurredAt;
    }

    if (Object.keys(setValues).length === 0) {
      return this.findById(expenseId, projectId);
    }

    const [row] = await db
      .update(expense)
      .set(setValues)
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning(expenseSelect);
    return row ?? null;
  },

  async softDelete(
    projectId: string,
    expenseId: string,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .update(expense)
      .set({ deletedAt: sql`NOW()` })
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning(expenseSelect);
    return row ?? null;
  },

  async restore(projectId: string, expenseId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const [row] = await db
      .update(expense)
      .set({ deletedAt: null })
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning(expenseSelect);
    return row ?? null;
  },
};
