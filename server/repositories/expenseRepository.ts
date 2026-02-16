import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/pool";
import { expense } from "../db/schema";
import { Currency } from "../types";

export type ExpenseRow = {
  id: string;
  project_id: string;
  payer_participant_id: string;
  amount: string;
  currency: Currency;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const expenseRepository = {
  async listByProject(
    projectId: string,
    includeDeleted: boolean,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ) {
    const db = getDb();
    const page =
      options?.page && options.page > 0 ? Math.floor(options.page) : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? Math.floor(options.pageSize)
        : 0;
    const baseQuery = db
      .select({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      })
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

  async findById(expenseId: string, projectId: string) {
    const db = getDb();
    const [row] = await db
      .select({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      })
      .from(expense)
      .where(and(eq(expense.id, expenseId), eq(expense.projectId, projectId)));
    return row ?? null;
  },

  async add(input: {
    projectId: string;
    payerParticipantId: string;
    amount: number;
    currency: Currency;
    description: string | null;
    createdBy: string;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(expense)
      .values({
        projectId: input.projectId,
        payerParticipantId: input.payerParticipantId,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        description: input.description,
        createdBy: input.createdBy,
      })
      .returning({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      });
    return row;
  },

  async update(
    projectId: string,
    expenseId: string,
    updates: {
      payerParticipantId?: string;
      amount?: number;
      currency?: Currency;
      description?: string | null;
    }
  ) {
    const db = getDb();
    const setValues: Partial<{
      payerParticipantId: string;
      amount: string;
      currency: Currency;
      description: string | null;
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
    if (updates.description !== undefined) {
      setValues.description = updates.description;
    }

    if (Object.keys(setValues).length === 0) {
      return this.findById(expenseId, projectId);
    }

    const [row] = await db
      .update(expense)
      .set(setValues)
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      });
    return row ?? null;
  },

  async softDelete(projectId: string, expenseId: string) {
    const db = getDb();
    const [row] = await db
      .update(expense)
      .set({ deletedAt: sql`NOW()` })
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      });
    return row ?? null;
  },

  async restore(projectId: string, expenseId: string) {
    const db = getDb();
    const [row] = await db
      .update(expense)
      .set({ deletedAt: null })
      .where(and(eq(expense.projectId, projectId), eq(expense.id, expenseId)))
      .returning({
        id: expense.id,
        project_id: expense.projectId,
        payer_participant_id: expense.payerParticipantId,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        created_at: expense.createdAt,
        updated_at: expense.updatedAt,
        deleted_at: expense.deletedAt,
      });
    return row ?? null;
  },
};
