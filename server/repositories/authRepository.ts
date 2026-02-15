import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../db/pool";
import { authProfile, userProfileAssignment } from "../db/schema";
import { MemberRole } from "../types";

const toGlobalProfileCode = (role: MemberRole) => `GLOBAL_${role}` as const;
const toProjectProfileCode = (role: MemberRole) => `PROJECT_${role}` as const;

const listProfilesByScope = async (scope: "GLOBAL" | "PROJECT") => {
  const db = getDb();
  return db
    .select({
      id: authProfile.id,
      code: authProfile.code,
    })
    .from(authProfile)
    .where(eq(authProfile.scope, scope));
};

export const authRepository = {
  async syncGlobalProfileAssignment(userId: string, appRole: MemberRole) {
    const profileCode = toGlobalProfileCode(appRole);
    const profiles = await listProfilesByScope("GLOBAL");

    const targetProfile = profiles.find(
      (profile) => profile.code === profileCode
    );
    if (!targetProfile) {
      return;
    }

    const db = getDb();
    const globalProfileIds = profiles.map((profile) => profile.id);
    if (globalProfileIds.length > 0) {
      await db
        .delete(userProfileAssignment)
        .where(
          and(
            eq(userProfileAssignment.userId, userId),
            isNull(userProfileAssignment.projectId),
            inArray(userProfileAssignment.profileId, globalProfileIds),
            ne(userProfileAssignment.profileId, targetProfile.id)
          )
        );
    }

    await db
      .insert(userProfileAssignment)
      .values({
        userId,
        profileId: targetProfile.id,
        projectId: null,
      })
      .onConflictDoNothing();
  },

  async syncProjectProfileAssignment(
    userId: string,
    projectId: string,
    projectRole: MemberRole
  ) {
    const profileCode = toProjectProfileCode(projectRole);
    const profiles = await listProfilesByScope("PROJECT");
    const targetProfile = profiles.find(
      (profile) => profile.code === profileCode
    );
    if (!targetProfile) {
      return;
    }

    const db = getDb();
    const projectProfileIds = profiles.map((profile) => profile.id);
    if (projectProfileIds.length > 0) {
      await db
        .delete(userProfileAssignment)
        .where(
          and(
            eq(userProfileAssignment.userId, userId),
            eq(userProfileAssignment.projectId, projectId),
            inArray(userProfileAssignment.profileId, projectProfileIds),
            ne(userProfileAssignment.profileId, targetProfile.id)
          )
        );
    }

    await db
      .insert(userProfileAssignment)
      .values({
        userId,
        profileId: targetProfile.id,
        projectId,
      })
      .onConflictDoNothing();
  },

  async clearProjectProfileAssignments(userId: string, projectId: string) {
    const db = getDb();
    await db
      .delete(userProfileAssignment)
      .where(
        and(
          eq(userProfileAssignment.userId, userId),
          eq(userProfileAssignment.projectId, projectId)
        )
      );
  },
};
