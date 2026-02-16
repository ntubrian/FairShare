import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { appError } from "../lib/errors";
import { Currency, MemberRole, ProjectStatus } from "../types";
import { getDb } from "../db/pool";
import { appUser, project, projectMember } from "../db/schema";
import { authRepository } from "./authRepository";

export type ProjectRow = {
  id: string;
  name: string;
  target_currency: Currency;
  agreed_rate_first: boolean;
  status: ProjectStatus;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMemberWithUserRow = {
  user_id: string;
  role: MemberRole;
  joined_at: string;
  display_name: string;
  email: string;
  app_role: MemberRole;
  avatar_url: string | null;
};

export type ProjectSummaryRow = {
  id: string;
  name: string;
  target_currency: Currency;
  agreed_rate_first: boolean;
  status: ProjectStatus;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  viewer_role: MemberRole;
  member_count: number;
};

const makeInviteCode = () =>
  Math.random().toString(36).slice(2, 10).toUpperCase();

const projectSelect = {
  id: project.id,
  name: project.name,
  target_currency: project.targetCurrency,
  agreed_rate_first: project.agreedRateFirst,
  status: project.status,
  invite_code: project.inviteCode,
  created_by: project.createdBy,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
};

export const projectRepository = {
  async listForUser(userId: string) {
    const db = getDb();
    return db
      .select(projectSelect)
      .from(project)
      .innerJoin(projectMember, eq(projectMember.projectId, project.id))
      .where(eq(projectMember.userId, userId))
      .orderBy(desc(project.updatedAt));
  },

  async findById(projectId: string) {
    const db = getDb();
    const [row] = await db
      .select(projectSelect)
      .from(project)
      .where(eq(project.id, projectId));
    return row ?? null;
  },

  async findByInviteCode(inviteCode: string) {
    const db = getDb();
    const [row] = await db
      .select(projectSelect)
      .from(project)
      .where(eq(project.inviteCode, inviteCode));
    return row ?? null;
  },

  async listForUserPage(input: {
    userId: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ items: ProjectSummaryRow[]; total: number }> {
    const db = getDb();
    const offset = (input.page - 1) * input.pageSize;
    const normalizedSearch = input.search?.trim();
    const whereClause = normalizedSearch
      ? and(
          eq(projectMember.userId, input.userId),
          ilike(project.name, `%${normalizedSearch}%`)
        )
      : eq(projectMember.userId, input.userId);

    const [countRow, items] = await Promise.all([
      db
        .select({ count: count() })
        .from(project)
        .innerJoin(projectMember, eq(projectMember.projectId, project.id))
        .where(whereClause)
        .then((rows) => rows[0]),
      db
        .select({
          ...projectSelect,
          viewer_role: projectMember.role,
          member_count: sql<number>`(
            select count(*)::int
            from project_member pm
            where pm.project_id = ${project.id}
          )`,
        })
        .from(project)
        .innerJoin(projectMember, eq(projectMember.projectId, project.id))
        .where(whereClause)
        .orderBy(desc(project.updatedAt))
        .limit(input.pageSize)
        .offset(offset),
    ]);

    return {
      items,
      total: Number(countRow?.count ?? 0),
    };
  },

  async createProject(input: {
    name: string;
    targetCurrency: Currency;
    agreedRateFirst: boolean;
    createdBy: string;
  }) {
    const db = getDb();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = makeInviteCode();
      try {
        const createdProject = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(project)
            .values({
              name: input.name,
              targetCurrency: input.targetCurrency,
              agreedRateFirst: input.agreedRateFirst,
              status: "ACTIVE",
              inviteCode,
              createdBy: input.createdBy,
            })
            .returning(projectSelect);

          await tx.insert(projectMember).values({
            projectId: row.id,
            userId: input.createdBy,
            role: "OWNER",
          });

          return row;
        });
        await authRepository.syncProjectProfileAssignment(
          input.createdBy,
          createdProject.id,
          "OWNER"
        );
        return createdProject;
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError.code === "23505") {
          continue;
        }
        throw error;
      }
    }

    throw appError(
      "Failed to generate invite code. Please retry.",
      "INTERNAL_SERVER_ERROR"
    );
  },

  async updateProject(
    projectId: string,
    updates: {
      name?: string;
      targetCurrency?: Currency;
      agreedRateFirst?: boolean;
    }
  ) {
    const db = getDb();
    const setValues: Partial<{
      name: string;
      targetCurrency: Currency;
      agreedRateFirst: boolean;
    }> = {};

    if (updates.name !== undefined) {
      setValues.name = updates.name;
    }
    if (updates.targetCurrency !== undefined) {
      setValues.targetCurrency = updates.targetCurrency;
    }
    if (updates.agreedRateFirst !== undefined) {
      setValues.agreedRateFirst = updates.agreedRateFirst;
    }

    if (Object.keys(setValues).length === 0) {
      return this.findById(projectId);
    }

    const [row] = await db
      .update(project)
      .set(setValues)
      .where(eq(project.id, projectId))
      .returning(projectSelect);
    return row ?? null;
  },

  async setStatus(projectId: string, status: ProjectStatus) {
    const db = getDb();
    const [row] = await db
      .update(project)
      .set({ status })
      .where(eq(project.id, projectId))
      .returning(projectSelect);
    return row ?? null;
  },

  async deleteById(projectId: string) {
    const db = getDb();
    const rows = await db
      .delete(project)
      .where(eq(project.id, projectId))
      .returning({ id: project.id });
    return rows.length > 0;
  },

  async findMember(projectId: string, userId: string) {
    const db = getDb();
    const [row] = await db
      .select({
        user_id: projectMember.userId,
        role: projectMember.role,
      })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.userId, userId)
        )
      );
    return row ?? null;
  },

  async listMembers(projectId: string) {
    const db = getDb();
    return db
      .select({
        user_id: projectMember.userId,
        role: projectMember.role,
        joined_at: projectMember.joinedAt,
        display_name: appUser.displayName,
        email: appUser.email,
        app_role: appUser.appRole,
        avatar_url: appUser.avatarUrl,
      })
      .from(projectMember)
      .innerJoin(appUser, eq(appUser.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId))
      .orderBy(asc(projectMember.joinedAt));
  },

  async addMember(
    projectId: string,
    userId: string,
    role: MemberRole = "VIEWER"
  ) {
    const db = getDb();
    const rows = await db
      .insert(projectMember)
      .values({
        projectId,
        userId,
        role,
      })
      .onConflictDoNothing()
      .returning({ user_id: projectMember.userId });
    const inserted = rows.length > 0;
    if (inserted) {
      await authRepository.syncProjectProfileAssignment(
        userId,
        projectId,
        role
      );
    }
    return inserted;
  },

  async removeMember(projectId: string, userId: string) {
    const db = getDb();
    const rows = await db
      .delete(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.userId, userId)
        )
      )
      .returning({ user_id: projectMember.userId });
    const removed = rows.length > 0;
    if (removed) {
      await authRepository.clearProjectProfileAssignments(userId, projectId);
    }
    return removed;
  },

  async setMemberRole(projectId: string, userId: string, role: MemberRole) {
    const db = getDb();
    const rows = await db
      .update(projectMember)
      .set({ role })
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.userId, userId)
        )
      )
      .returning({ user_id: projectMember.userId });
    const updated = rows.length > 0;
    if (updated) {
      await authRepository.syncProjectProfileAssignment(
        userId,
        projectId,
        role
      );
    }
    return updated;
  },

  async countOwners(projectId: string) {
    const db = getDb();
    const [row] = await db
      .select({ count: count() })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.role, "OWNER")
        )
      );
    return Number(row?.count ?? 0);
  },

  async touchProject(projectId: string) {
    const db = getDb();
    await db
      .update(project)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(project.id, projectId));
  },
};
