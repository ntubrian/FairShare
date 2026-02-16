import { and, asc, count, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/pool";
import { expense, participant } from "../db/schema";

export type ParticipantRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

export const participantRepository = {
  async listByProject(
    projectId: string,
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
        id: participant.id,
        project_id: participant.projectId,
        name: participant.name,
        created_at: participant.createdAt,
      })
      .from(participant)
      .where(eq(participant.projectId, projectId))
      .orderBy(asc(participant.createdAt));

    if (!pageSize) {
      return baseQuery;
    }

    return baseQuery.limit(pageSize).offset((page - 1) * pageSize);
  },

  async findById(participantId: string) {
    const db = getDb();
    const [row] = await db
      .select({
        id: participant.id,
        project_id: participant.projectId,
        name: participant.name,
        created_at: participant.createdAt,
      })
      .from(participant)
      .where(eq(participant.id, participantId));
    return row ?? null;
  },

  async findByIdInProject(projectId: string, participantId: string) {
    const db = getDb();
    const [row] = await db
      .select({
        id: participant.id,
        project_id: participant.projectId,
        name: participant.name,
        created_at: participant.createdAt,
      })
      .from(participant)
      .where(
        and(
          eq(participant.projectId, projectId),
          eq(participant.id, participantId)
        )
      );
    return row ?? null;
  },

  async add(projectId: string, name: string) {
    const db = getDb();
    const [row] = await db
      .insert(participant)
      .values({
        projectId,
        name,
      })
      .returning({
        id: participant.id,
        project_id: participant.projectId,
        name: participant.name,
        created_at: participant.createdAt,
      });
    return row;
  },

  async remove(participantId: string) {
    const db = getDb();
    const rows = await db
      .delete(participant)
      .where(eq(participant.id, participantId))
      .returning({ id: participant.id });
    return rows.length > 0;
  },

  async hasActiveExpenses(participantId: string) {
    const db = getDb();
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
