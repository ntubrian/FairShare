import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { GraphQLError, graphql } from "graphql";
import { getDb } from "../db/pool";
import {
  appUser,
  authProfile,
  project,
  userProfileAssignment,
} from "../db/schema";
import { authRepository } from "../repositories/authRepository";
import { getSchema } from "../schema";
import { GraphQLContext, MemberRole } from "../types";

type AuthUserRow = typeof appUser.$inferSelect;

const hasDatabase = Boolean(process.env.DATABASE_URL);
const cleanupProjectIds = new Set<string>();
const cleanupUserIds = new Set<string>();
const schema = getSchema();
const unauthContext: GraphQLContext = {
  viewer: null,
  acceptLanguage: "en",
};

const toContext = (user: AuthUserRow): GraphQLContext => ({
  viewer: {
    id: user.id,
    googleSub: user.googleSub,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    appRole: user.appRole,
    locale: user.locale,
  },
  acceptLanguage: "en",
});

const createUser = async (appRole: MemberRole) => {
  const db = getDb();
  const marker = randomUUID().replace(/-/g, "");
  const [user] = await db
    .insert(appUser)
    .values({
      googleSub: `google-${marker}`,
      email: `user-${marker}@fairshare.test`,
      displayName: `User-${marker.slice(0, 8)}`,
      appRole,
    })
    .returning();
  cleanupUserIds.add(user.id);
  await authRepository.syncGlobalProfileAssignment(user.id, appRole);
  return user;
};

const listAssignedProfileCodes = async (
  userId: string,
  projectId: string | null
) => {
  const db = getDb();
  const rows = await db
    .select({
      code: authProfile.code,
    })
    .from(userProfileAssignment)
    .innerJoin(authProfile, eq(authProfile.id, userProfileAssignment.profileId))
    .where(
      projectId
        ? and(
            eq(userProfileAssignment.userId, userId),
            eq(userProfileAssignment.projectId, projectId)
          )
        : and(
            eq(userProfileAssignment.userId, userId),
            isNull(userProfileAssignment.projectId)
          )
    );

  return rows.map((row) => row.code).sort();
};

const execute = async (
  source: string,
  context: GraphQLContext,
  variableValues?: Record<string, unknown>
) =>
  graphql({
    schema,
    source,
    contextValue: context,
    variableValues,
  });

const expectNoErrors = <T>(result: Awaited<ReturnType<typeof execute>>) => {
  assert.equal(
    result.errors,
    undefined,
    JSON.stringify(result.errors, null, 2)
  );
  assert.ok(result.data);
  return result.data as T;
};

const expectErrorCode = (
  result: Awaited<ReturnType<typeof execute>>,
  code: string
) => {
  assert.ok(result.errors?.length, "Expected GraphQL errors");
  const graphError = result.errors?.[0] as GraphQLError;
  assert.equal(graphError.extensions?.code, code);
};

const mutationCreateProject = `
  mutation CreateProject($name: String!, $targetCurrency: String!, $agreedRateFirst: Boolean!) {
    createProject(name: $name, targetCurrency: $targetCurrency, agreedRateFirst: $agreedRateFirst) {
      id
      name
      targetCurrency
      inviteCode
      memberCount
      status
    }
  }
`;

const mutationJoinProject = `
  mutation JoinProject($inviteCode: String!) {
    joinProject(inviteCode: $inviteCode) {
      id
      inviteCode
      memberCount
    }
  }
`;

const mutationSetMemberRole = `
  mutation SetMemberRole($projectId: ID!, $userId: ID!, $role: MemberRole!) {
    setMemberRole(projectId: $projectId, userId: $userId, role: $role) {
      id
      memberCount
    }
  }
`;

const mutationAddParticipant = `
  mutation AddParticipant($projectId: ID!, $name: String!) {
    addParticipant(projectId: $projectId, name: $name) {
      id
      name
      projectId
    }
  }
`;

const mutationCreateExpense = `
  mutation CreateExpense(
    $projectId: ID!
    $payerId: ID!
    $amount: Float!
    $currency: Currency!
    $description: String
  ) {
    createExpense(
      projectId: $projectId
      payerId: $payerId
      amount: $amount
      currency: $currency
      description: $description
    ) {
      id
      amount
      currency
      payerId
    }
  }
`;

const mutationSetAgreedRate = `
  mutation SetAgreedRate(
    $projectId: ID!
    $fromCurrency: Currency!
    $toCurrency: Currency!
    $rate: Float!
  ) {
    setAgreedRate(
      projectId: $projectId
      fromCurrency: $fromCurrency
      toCurrency: $toCurrency
      rate: $rate
    ) {
      id
      agreedRateFirst
      agreedRates {
        fromCurrency
        toCurrency
        rate
      }
    }
  }
`;

const mutationRemoveParticipant = `
  mutation RemoveParticipant($projectId: ID!, $participantId: ID!) {
    removeParticipant(projectId: $projectId, participantId: $participantId)
  }
`;

const queryCalculateSettlement = `
  query CalculateSettlement($projectId: ID!) {
    calculateSettlement(projectId: $projectId) {
      rateSource
      instructions {
        fromParticipantId
        toParticipantId
        amount
        currency
      }
    }
  }
`;

const queryPdfPreview = `
  query PdfPreview($projectId: ID!) {
    pdfExportPreview(projectId: $projectId) {
      projectName
      instructionCount
      expenseCount
      targetCurrency
    }
  }
`;

const queryDetectLocale = `
  query DetectLocale($acceptLanguage: String!) {
    detectLocale(acceptLanguage: $acceptLanguage)
  }
`;

const queryProjectByInviteCode = `
  query ProjectByInviteCode($inviteCode: String!) {
    projectByInviteCode(inviteCode: $inviteCode) {
      ok
      message
    }
  }
`;

test("guard policy: unauthenticated access is blocked except public query", async () => {
  const projectsResult = await execute(
    `query { projects { id } }`,
    unauthContext
  );
  expectErrorCode(projectsResult, "UNAUTHENTICATED");

  const exchangeRatesResult = await execute(
    `query { exchangeRates(baseCurrency: TWD) { baseCurrency } }`,
    unauthContext
  );
  expectErrorCode(exchangeRatesResult, "UNAUTHENTICATED");

  const inviteValidationResult = await execute(
    queryProjectByInviteCode,
    unauthContext,
    { inviteCode: "ANY" }
  );
  expectErrorCode(inviteValidationResult, "UNAUTHENTICATED");

  const localeResult = await execute(queryDetectLocale, unauthContext, {
    acceptLanguage: "en-US,en;q=0.9",
  });
  const localeData = expectNoErrors<{ detectLocale: string }>(localeResult);
  assert.equal(localeData.detectLocale, "EN");
});

test(
  "GraphQL functional flow: roles, participants, expenses, settlement, pdf",
  { skip: !hasDatabase },
  async () => {
    const ownerUser = await createUser("EDITOR");
    const viewerAccount = await createUser("VIEWER");
    const collaborator = await createUser("EDITOR");

    const ownerGlobalProfiles = await listAssignedProfileCodes(
      ownerUser.id,
      null
    );
    assert.deepEqual(ownerGlobalProfiles, ["GLOBAL_EDITOR"]);

    const viewerCreateProjectResult = await execute(
      mutationCreateProject,
      toContext(viewerAccount),
      {
        name: "Should Fail",
        targetCurrency: "TWD",
        agreedRateFirst: true,
      }
    );
    expectErrorCode(viewerCreateProjectResult, "FORBIDDEN");

    const createProjectResult = await execute(
      mutationCreateProject,
      toContext(ownerUser),
      {
        name: `Project-${randomUUID().slice(0, 8)}`,
        targetCurrency: "TWD",
        agreedRateFirst: true,
      }
    );
    const createProjectData = expectNoErrors<{
      createProject: {
        id: string;
        inviteCode: string;
        status: string;
      };
    }>(createProjectResult);

    const projectId = createProjectData.createProject.id;
    const inviteCode = createProjectData.createProject.inviteCode;
    cleanupProjectIds.add(projectId);
    assert.equal(createProjectData.createProject.status, "ACTIVE");
    const ownerProjectProfiles = await listAssignedProfileCodes(
      ownerUser.id,
      projectId
    );
    assert.deepEqual(ownerProjectProfiles, ["PROJECT_OWNER"]);

    const joinProjectResult = await execute(
      mutationJoinProject,
      toContext(collaborator),
      {
        inviteCode,
      }
    );
    const joinProjectData = expectNoErrors<{
      joinProject: { id: string; memberCount: number };
    }>(joinProjectResult);
    assert.equal(joinProjectData.joinProject.id, projectId);
    assert.equal(joinProjectData.joinProject.memberCount, 2);
    assert.deepEqual(
      await listAssignedProfileCodes(collaborator.id, projectId),
      ["PROJECT_VIEWER"]
    );

    const promoteToEditorResult = await execute(
      mutationSetMemberRole,
      toContext(ownerUser),
      {
        projectId,
        userId: collaborator.id,
        role: "EDITOR",
      }
    );
    expectNoErrors(promoteToEditorResult);
    assert.deepEqual(
      await listAssignedProfileCodes(collaborator.id, projectId),
      ["PROJECT_EDITOR"]
    );

    const setRoleResult = await execute(
      mutationSetMemberRole,
      toContext(ownerUser),
      {
        projectId,
        userId: collaborator.id,
        role: "VIEWER",
      }
    );
    expectNoErrors(setRoleResult);
    assert.deepEqual(
      await listAssignedProfileCodes(collaborator.id, projectId),
      ["PROJECT_VIEWER"]
    );

    const participantAResult = await execute(
      mutationAddParticipant,
      toContext(ownerUser),
      {
        projectId,
        name: "Alice",
      }
    );
    const participantAData = expectNoErrors<{
      addParticipant: { id: string };
    }>(participantAResult);
    const participantAId = participantAData.addParticipant.id;

    const participantBResult = await execute(
      mutationAddParticipant,
      toContext(ownerUser),
      {
        projectId,
        name: "Bob",
      }
    );
    const participantBData = expectNoErrors<{
      addParticipant: { id: string };
    }>(participantBResult);
    const participantBId = participantBData.addParticipant.id;

    const setAgreedRateResult = await execute(
      mutationSetAgreedRate,
      toContext(ownerUser),
      {
        projectId,
        fromCurrency: "USD",
        toCurrency: "TWD",
        rate: 30,
      }
    );
    expectNoErrors(setAgreedRateResult);

    const createExpenseResult = await execute(
      mutationCreateExpense,
      toContext(ownerUser),
      {
        projectId,
        payerId: participantAId,
        amount: 100,
        currency: "USD",
        description: "Lunch",
      }
    );
    expectNoErrors(createExpenseResult);

    const removeParticipantResult = await execute(
      mutationRemoveParticipant,
      toContext(ownerUser),
      {
        projectId,
        participantId: participantAId,
      }
    );
    expectErrorCode(removeParticipantResult, "BAD_USER_INPUT");

    const viewerEditExpenseResult = await execute(
      mutationCreateExpense,
      toContext(collaborator),
      {
        projectId,
        payerId: participantBId,
        amount: 1,
        currency: "TWD",
        description: "Should Fail",
      }
    );
    expectErrorCode(viewerEditExpenseResult, "FORBIDDEN");

    const settlementResult = await execute(
      queryCalculateSettlement,
      toContext(collaborator),
      {
        projectId,
      }
    );
    const settlementData = expectNoErrors<{
      calculateSettlement: {
        rateSource: string;
        instructions: Array<{
          fromParticipantId: string;
          toParticipantId: string;
          amount: number;
          currency: string;
        }>;
      };
    }>(settlementResult);

    assert.equal(settlementData.calculateSettlement.rateSource, "AGREED");
    assert.equal(settlementData.calculateSettlement.instructions.length, 1);
    assert.equal(
      settlementData.calculateSettlement.instructions[0]?.fromParticipantId,
      participantBId
    );
    assert.equal(
      settlementData.calculateSettlement.instructions[0]?.toParticipantId,
      participantAId
    );
    assert.equal(
      settlementData.calculateSettlement.instructions[0]?.amount,
      1500
    );

    const pdfPreviewResult = await execute(
      queryPdfPreview,
      toContext(collaborator),
      {
        projectId,
      }
    );
    const pdfPreviewData = expectNoErrors<{
      pdfExportPreview: {
        instructionCount: number;
        expenseCount: number;
        targetCurrency: string;
      };
    }>(pdfPreviewResult);
    assert.equal(pdfPreviewData.pdfExportPreview.instructionCount, 1);
    assert.equal(pdfPreviewData.pdfExportPreview.expenseCount, 1);
    assert.equal(pdfPreviewData.pdfExportPreview.targetCurrency, "TWD");

    const detectLocaleResult = await execute(
      queryDetectLocale,
      toContext(collaborator),
      {
        acceptLanguage: "zh-TW,zh;q=0.9,en;q=0.8",
      }
    );
    const detectLocaleData = expectNoErrors<{ detectLocale: string }>(
      detectLocaleResult
    );
    assert.equal(detectLocaleData.detectLocale, "ZH_TW");

    const invalidInviteResult = await execute(
      queryProjectByInviteCode,
      toContext(collaborator),
      { inviteCode: "INVALID01" }
    );
    const invalidInviteData = expectNoErrors<{
      projectByInviteCode: { ok: boolean };
    }>(invalidInviteResult);
    assert.equal(invalidInviteData.projectByInviteCode.ok, false);
  }
);

test("cleanup inserted data", { skip: !hasDatabase }, async () => {
  const db = getDb();
  for (const projectId of cleanupProjectIds) {
    await db.delete(project).where(eq(project.id, projectId));
  }
  for (const userId of cleanupUserIds) {
    await db.delete(appUser).where(eq(appUser.id, userId));
  }
});
