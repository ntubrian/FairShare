import { and, asc, count, eq, isNull } from "drizzle-orm";
import { appError } from "../lib/errors";
import { getDb } from "../db/pool";
import { expense, participant } from "../db/schema";

export type ParticipantRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  created_at: string;
};

type DbExecutor = ReturnType<typeof getDb>;
const resolveDb = (executor?: DbExecutor) => executor ?? getDb();

const participantSelect = {
  id: participant.id,
  project_id: participant.projectId,
  user_id: participant.userId,
  name: participant.name,
  created_at: participant.createdAt,
};

export const participantRepository = {
  async listByProject(
    projectId: string,
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
      .select(participantSelect)
      .from(participant)
      .where(eq(participant.projectId, projectId))
      .orderBy(asc(participant.createdAt));

    if (!pageSize) {
      return baseQuery;
    }

    return baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  },

  async findById(participantId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const [row] = await db
      .select(participantSelect)
      .from(participant)
      .where(eq(participant.id, participantId));
    return row ?? null;
  },

  async findByIdInProject(
    projectId: string,
    participantId: string,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .select(participantSelect)
      .from(participant)
      .where(
        and(
          eq(participant.projectId, projectId),
          eq(participant.id, participantId)
        )
      );
    return row ?? null;
  },

  async findByUserIdInProject(
    projectId: string,
    userId: string,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .select(participantSelect)
      .from(participant)
      .where(
        and(
          eq(participant.projectId, projectId),
          eq(participant.userId, userId)
        )
      );
    return row ?? null;
  },

  async add(projectId: string, name: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const [row] = await db
      .insert(participant)
      .values({
        projectId,
        userId: null,
        name,
      })
      .returning(participantSelect);
    return row;
  },

  async addLinked(
    projectId: string,
    userId: string,
    name: string,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .insert(participant)
      .values({
        projectId,
        userId,
        name,
      })
      .onConflictDoNothing({
        target: [participant.projectId, participant.userId],
      })
      .returning(participantSelect);
    return row ?? null;
  },

  async updateLinkedName(
    participantId: string,
    name: string,
    executor?: DbExecutor
  ) {
    const db = resolveDb(executor);
    const [row] = await db
      .update(participant)
      .set({ name })
      .where(eq(participant.id, participantId))
      .returning(participantSelect);
    return row ?? null;
  },

  async ensureLinkedUser(
    projectId: string,
    userId: string,
    displayName: string,
    executor?: DbExecutor
  ) {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      throw appError("Participant display name is required.", "BAD_USER_INPUT");
    }

    const existing = await this.findByUserIdInProject(
      projectId,
      userId,
      executor
    );
    if (existing) {
      if (existing.name === normalizedName) {
        return existing;
      }
      const updated = await this.updateLinkedName(
        existing.id,
        normalizedName,
        executor
      );
      if (updated) {
        return updated;
      }
      return existing;
    }

    const created = await this.addLinked(
      projectId,
      userId,
      normalizedName,
      executor
    );
    if (created) {
      return created;
    }

    const insertedByOther = await this.findByUserIdInProject(
      projectId,
      userId,
      executor
    );
    if (insertedByOther) {
      return insertedByOther;
    }

    throw appError(
      "Failed to ensure linked participant.",
      "INTERNAL_SERVER_ERROR"
    );
  },

  async remove(participantId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const rows = await db
      .delete(participant)
      .where(eq(participant.id, participantId))
      .returning({ id: participant.id });
    return rows.length > 0;
  },

  async hasActiveExpenses(participantId: string, executor?: DbExecutor) {
    const db = resolveDb(executor);
    const [row] = await db
      .select({ count: count() })
      .from(expense)
      .where(
        and(
          eq(expense.payerParticipantId, participantId),
          isNull(expense.deletedAt)
        )
      );
    return Number(row?.count ?? 0) > 0;
  },
};
