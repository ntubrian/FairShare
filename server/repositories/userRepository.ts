import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/pool";
import { appUser } from "../db/schema";
import { authRepository } from "./authRepository";
import { AuthUser, MemberRole } from "../types";

type UserRow = {
  id: string;
  google_sub: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  app_role: MemberRole;
  locale: string | null;
};

const toAuthUser = (row: UserRow): AuthUser => ({
  id: row.id,
  googleSub: row.google_sub,
  email: row.email,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  appRole: row.app_role,
  locale: row.locale,
});

export const userRepository = {
  async upsertGoogleUser(input: {
    googleSub: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    locale?: string | null;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(appUser)
      .values({
        googleSub: input.googleSub,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl ?? null,
        locale: input.locale ?? null,
      })
      .onConflictDoUpdate({
        target: appUser.googleSub,
        set: {
          email: input.email,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl ?? null,
          locale: sql`COALESCE(EXCLUDED.locale, ${appUser.locale})`,
        },
      })
      .returning({
        id: appUser.id,
        google_sub: appUser.googleSub,
        email: appUser.email,
        display_name: appUser.displayName,
        avatar_url: appUser.avatarUrl,
        app_role: appUser.appRole,
        locale: appUser.locale,
      });

    const user = toAuthUser(row);
    await authRepository.syncGlobalProfileAssignment(user.id, user.appRole);
    return user;
  },

  async findById(userId: string) {
    const db = getDb();
    const [row] = await db
      .select({
        id: appUser.id,
        google_sub: appUser.googleSub,
        email: appUser.email,
        display_name: appUser.displayName,
        avatar_url: appUser.avatarUrl,
        app_role: appUser.appRole,
        locale: appUser.locale,
      })
      .from(appUser)
      .where(eq(appUser.id, userId));
    if (!row) {
      return null;
    }
    return toAuthUser(row);
  },

  async listAll() {
    const db = getDb();
    const rows = await db
      .select({
        id: appUser.id,
        google_sub: appUser.googleSub,
        email: appUser.email,
        display_name: appUser.displayName,
        avatar_url: appUser.avatarUrl,
        app_role: appUser.appRole,
        locale: appUser.locale,
      })
      .from(appUser)
      .orderBy(appUser.createdAt);
    return rows.map(toAuthUser);
  },
};
