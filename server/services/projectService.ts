import {
  AppAction,
  AppSubject,
  assertCan,
  defineGlobalAbility,
  defineProjectAbility,
} from "../auth/ability";
import { appError } from "../lib/errors";
import {
  ProjectMemberWithUserRow,
  ProjectRow,
  ProjectSummaryRow,
  projectRepository,
} from "../repositories/projectRepository";
import { participantRepository } from "../repositories/participantRepository";
import { expenseRepository } from "../repositories/expenseRepository";
import { rateRepository } from "../repositories/rateRepository";
import { userRepository } from "../repositories/userRepository";
import { authRepository } from "../repositories/authRepository";
import {
  AuthUser,
  Currency,
  GraphQLContext,
  MemberRole,
  SplitMode,
} from "../types";
import { assertCurrency } from "./domainUtils";

type GraphQLUser = {
  id: string;
  displayName: string;
  email: string;
  accountRole: MemberRole;
};

type GraphQLProjectMember = {
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: GraphQLUser;
};

type GraphQLParticipant = {
  id: string;
  projectId: string;
  userId: string | null;
  name: string;
  createdAt: string;
};

type GraphQLExpense = {
  id: string;
  projectId: string;
  payerId: string;
  payer: GraphQLParticipant | null;
  amount: number;
  currency: Currency;
  splitMode: SplitMode;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  splits: Array<{
    participantId: string;
    participant: GraphQLParticipant | null;
    amount: number | null;
    shares: number | null;
  }>;
};

type GraphQLAgreedRate = {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  updatedAt: string;
};

type GraphQLProject = {
  id: string;
  name: string;
  targetCurrency: string;
  agreedRateFirst: boolean;
  status: string;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  participantCount: number;
  expenseCount: number;
  members: GraphQLProjectMember[];
  participants: GraphQLParticipant[];
  expenses: GraphQLExpense[];
  agreedRates: GraphQLAgreedRate[];
  createdAt: string;
  updatedAt: string;
};

type GraphQLProjectSummary = {
  id: string;
  name: string;
  targetCurrency: string;
  agreedRateFirst: boolean;
  status: string;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  viewerRole: MemberRole;
  createdAt: string;
  updatedAt: string;
};

type GraphQLProjectPage = {
  items: GraphQLProjectSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const projectInviteLink = (inviteCode: string) =>
  `https://fairshare.app/join?code=${inviteCode}`;

const mapMemberUser = (row: ProjectMemberWithUserRow): GraphQLUser => ({
  id: row.user_id,
  displayName: row.display_name,
  email: row.email,
  accountRole: row.app_role,
});

const mapParticipant = (row: {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  created_at: string;
}): GraphQLParticipant => ({
  id: row.id,
  projectId: row.project_id,
  userId: row.user_id,
  name: row.name,
  createdAt: row.created_at,
});

const mapExpense = (
  row: {
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
  },
  participantsById: Map<string, GraphQLParticipant>
): GraphQLExpense => ({
  id: row.id,
  projectId: row.project_id,
  payerId: row.payer_participant_id,
  payer: participantsById.get(row.payer_participant_id) ?? null,
  amount: Number(row.amount),
  currency: row.currency,
  splitMode: row.split_mode,
  description: row.description,
  occurredAt: row.occurred_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  splits: [],
});

const mapAgreedRate = (row: {
  from_currency: Currency;
  to_currency: Currency;
  rate: string;
  updated_at: string;
}): GraphQLAgreedRate => ({
  fromCurrency: row.from_currency,
  toCurrency: row.to_currency,
  rate: Number(row.rate),
  updatedAt: row.updated_at,
});

const requireViewer = (context: GraphQLContext) => {
  if (!context.viewer) {
    throw appError("Authentication required.", "UNAUTHENTICATED");
  }
  return context.viewer;
};

const requireProject = async (projectId: string) => {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw appError("Project not found.", "NOT_FOUND");
  }
  return project;
};

const requireMember = async (projectId: string, userId: string) => {
  const member = await projectRepository.findMember(projectId, userId);
  if (!member) {
    throw appError("You are not a member of this project.", "FORBIDDEN");
  }
  return member;
};

const requireProjectPermission = async (
  projectId: string,
  viewerId: string,
  action: AppAction,
  subject: AppSubject,
  message: string
) => {
  const project = await requireProject(projectId);
  const member = await requireMember(project.id, viewerId);
  const ability = defineProjectAbility(member.role, project.status);
  assertCan(ability, action, subject, message);
  return project;
};

const trimAndRequire = (value: string, fieldName: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw appError(`${fieldName} is required.`, "BAD_USER_INPUT");
  }
  return trimmed;
};

const ensureParticipantForUser = async (
  projectId: string,
  userId: string,
  displayName: string,
  executor?: Parameters<typeof participantRepository.ensureLinkedUser>[3]
) => {
  await participantRepository.ensureLinkedUser(
    projectId,
    userId,
    displayName,
    executor
  );
};

const ensureParticipantsForProjectMembers = async (
  projectId: string,
  executor?: Parameters<typeof participantRepository.ensureLinkedUser>[3]
) => {
  const members = await projectRepository.listMembers(projectId, executor);
  for (const member of members) {
    await ensureParticipantForUser(
      projectId,
      member.user_id,
      member.display_name,
      executor
    );
  }
};

const normalizePage = (page: number | null | undefined) => {
  if (!page || !Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.floor(page);
};

const normalizePageSize = (pageSize: number | null | undefined) => {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return 10;
  }
  return Math.min(50, Math.floor(pageSize));
};

const mapProjectSummary = (row: ProjectSummaryRow): GraphQLProjectSummary => ({
  id: row.id,
  name: row.name,
  targetCurrency: row.target_currency,
  agreedRateFirst: row.agreed_rate_first,
  status: row.status,
  inviteCode: row.invite_code,
  inviteLink: projectInviteLink(row.invite_code),
  memberCount: row.member_count,
  viewerRole: row.viewer_role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildProject = async (
  projectRow: ProjectRow
): Promise<GraphQLProject> => {
  const [members, participants, expenses, agreedRates] = await Promise.all([
    projectRepository.listMembers(projectRow.id),
    participantRepository.listByProject(projectRow.id),
    expenseRepository.listByProject(projectRow.id, false),
    rateRepository.listByProject(projectRow.id),
  ]);

  const mappedParticipants = participants.map(mapParticipant);
  const participantsById = new Map(
    mappedParticipants.map((participant) => [participant.id, participant])
  );
  const mappedExpenses = expenses.map((expense) =>
    mapExpense(expense, participantsById)
  );

  return {
    id: projectRow.id,
    name: projectRow.name,
    targetCurrency: projectRow.target_currency,
    agreedRateFirst: projectRow.agreed_rate_first,
    status: projectRow.status,
    inviteCode: projectRow.invite_code,
    inviteLink: projectInviteLink(projectRow.invite_code),
    memberCount: members.length,
    participantCount: mappedParticipants.length,
    expenseCount: mappedExpenses.length,
    members: members.map((member) => ({
      userId: member.user_id,
      role: member.role,
      joinedAt: member.joined_at,
      user: mapMemberUser(member),
    })),
    participants: mappedParticipants,
    expenses: mappedExpenses,
    agreedRates: agreedRates.map(mapAgreedRate),
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
  };
};

export const projectService = {
  requireViewer,

  toGraphQLViewer(viewer: AuthUser): GraphQLUser {
    return {
      id: viewer.id,
      displayName: viewer.displayName,
      email: viewer.email,
      accountRole: viewer.appRole,
    };
  },

  async listUsers(context: GraphQLContext) {
    requireViewer(context);
    const users = await userRepository.listAll();
    return users.map((user) => this.toGraphQLViewer(user));
  },

  async ensureReadable(projectId: string, context: GraphQLContext) {
    const viewer = requireViewer(context);
    const project = await requireProjectPermission(
      projectId,
      viewer.id,
      "read",
      "Project",
      "You are not allowed to read this project."
    );
    return project;
  },

  async ensureEditable(
    projectId: string,
    context: GraphQLContext,
    subject: AppSubject = "Project",
    action: AppAction = "update"
  ) {
    const viewer = requireViewer(context);
    const project = await requireProjectPermission(
      projectId,
      viewer.id,
      action,
      subject,
      "You do not have required project permission."
    );
    return project;
  },

  async ensureOwned(
    projectId: string,
    context: GraphQLContext,
    action: AppAction = "setRole"
  ) {
    const viewer = requireViewer(context);
    const project = await requireProjectPermission(
      projectId,
      viewer.id,
      action,
      "Project",
      "Owner permission required."
    );
    return project;
  },

  async listProjects(context: GraphQLContext) {
    const viewer = requireViewer(context);
    const projects = await projectRepository.listForUser(viewer.id);
    return Promise.all(projects.map((project) => buildProject(project)));
  },

  async listProjectSummaries(
    context: GraphQLContext,
    input: {
      page?: number | null;
      pageSize?: number | null;
      search?: string | null;
    }
  ): Promise<GraphQLProjectPage> {
    const viewer = requireViewer(context);
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(input.pageSize);
    const search = input.search?.trim();

    const { items, total } = await projectRepository.listForUserPage({
      userId: viewer.id,
      page,
      pageSize,
      search,
    });

    const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

    return {
      items: items.map(mapProjectSummary),
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  },

  async getProject(projectId: string, context: GraphQLContext) {
    const project = await this.ensureReadable(projectId, context);
    return buildProject(project);
  },

  async validateInvite(inviteCode: string) {
    const normalized = inviteCode.trim().toUpperCase();
    const project = await projectRepository.findByInviteCode(normalized);
    if (!project) {
      return {
        ok: false,
        message: "Invalid or expired invite code.",
        projectId: null,
        projectName: null,
      };
    }
    return {
      ok: true,
      message: "Invite code is valid.",
      projectId: project.id,
      projectName: project.name,
    };
  },

  async createProject(
    input: { name: string; targetCurrency: string; agreedRateFirst: boolean },
    context: GraphQLContext
  ) {
    const viewer = requireViewer(context);
    const globalAbility = defineGlobalAbility(viewer.appRole);
    assertCan(
      globalAbility,
      "create",
      "Project",
      "Viewer cannot create projects."
    );

    const project = await projectRepository.createProject({
      name: trimAndRequire(input.name, "Project name"),
      targetCurrency: assertCurrency(input.targetCurrency),
      agreedRateFirst: input.agreedRateFirst,
      createdBy: viewer.id,
    });
    await projectRepository.withProjectWriteLock(project.id, async (tx) => {
      await ensureParticipantForUser(
        project.id,
        viewer.id,
        viewer.displayName,
        tx
      );
    });
    return buildProject(project);
  },

  async updateProject(
    input: {
      projectId: string;
      name?: string | null;
      targetCurrency?: string | null;
      agreedRateFirst?: boolean | null;
    },
    context: GraphQLContext
  ) {
    await this.ensureEditable(input.projectId, context);
    const updated = await projectRepository.withProjectWriteLock(
      input.projectId,
      (tx) =>
        projectRepository.updateProject(
          input.projectId,
          {
            name:
              typeof input.name === "string"
                ? trimAndRequire(input.name, "Project name")
                : undefined,
            targetCurrency:
              typeof input.targetCurrency === "string"
                ? assertCurrency(input.targetCurrency)
                : undefined,
            agreedRateFirst:
              typeof input.agreedRateFirst === "boolean"
                ? input.agreedRateFirst
                : undefined,
          },
          tx
        )
    );
    if (!updated) {
      throw appError("Project not found.", "NOT_FOUND");
    }
    return buildProject(updated);
  },

  async archiveProject(projectId: string, context: GraphQLContext) {
    await this.ensureOwned(projectId, context, "archive");
    const updated = await projectRepository.withProjectWriteLock(
      projectId,
      (tx) => projectRepository.setStatus(projectId, "ARCHIVED", tx)
    );
    if (!updated) {
      throw appError("Project not found.", "NOT_FOUND");
    }
    return buildProject(updated);
  },

  async deleteProject(projectId: string, context: GraphQLContext) {
    await this.ensureOwned(projectId, context, "delete");
    return projectRepository.withProjectWriteLock(projectId, (tx) =>
      projectRepository.deleteById(projectId, tx)
    );
  },

  async leaveProject(projectId: string, context: GraphQLContext) {
    const viewer = requireViewer(context);
    const removed = await projectRepository.withProjectWriteLock(
      projectId,
      async (tx) => {
        const lockedProject = await projectRepository.findById(projectId, tx);
        if (!lockedProject) {
          throw appError("Project not found.", "NOT_FOUND");
        }
        const member = await projectRepository.findMember(
          projectId,
          viewer.id,
          tx
        );
        if (!member) {
          throw appError("You are not a member of this project.", "FORBIDDEN");
        }
        if (member.role === "OWNER") {
          throw appError(
            "Owner cannot leave project. Transfer ownership first.",
            "FORBIDDEN"
          );
        }
        const changed = await projectRepository.removeMember(
          projectId,
          viewer.id,
          tx
        );
        if (changed) {
          await projectRepository.touchProject(projectId, tx);
        }
        return changed;
      }
    );
    if (removed) {
      await authRepository.clearProjectProfileAssignments(viewer.id, projectId);
    }
    return removed;
  },

  async joinProject(inviteCode: string, context: GraphQLContext) {
    const viewer = requireViewer(context);
    const normalized = inviteCode.trim().toUpperCase();
    const project = await projectRepository.findByInviteCode(normalized);
    if (!project) {
      throw appError("Invalid or expired invite code.", "BAD_USER_INPUT");
    }
    const added = await projectRepository.withProjectWriteLock(
      project.id,
      async (tx) => {
        const lockedProject = await projectRepository.findById(project.id, tx);
        if (!lockedProject) {
          throw appError("Project not found.", "NOT_FOUND");
        }
        const changed = await projectRepository.addMember(
          project.id,
          viewer.id,
          "VIEWER",
          tx
        );
        await ensureParticipantsForProjectMembers(project.id, tx);
        if (changed) {
          await projectRepository.touchProject(project.id, tx);
        }
        return changed;
      }
    );
    if (added) {
      await authRepository.syncProjectProfileAssignment(
        viewer.id,
        project.id,
        "VIEWER"
      );
    }
    const reloaded = await requireProject(project.id);
    return buildProject(reloaded);
  },

  async setMemberRole(
    input: { projectId: string; userId: string; role: MemberRole },
    context: GraphQLContext
  ) {
    await this.ensureOwned(input.projectId, context, "setRole");
    const changed = await projectRepository.withProjectWriteLock(
      input.projectId,
      async (tx) => {
        const targetMember = await projectRepository.findMember(
          input.projectId,
          input.userId,
          tx
        );
        if (!targetMember) {
          throw appError("Target member not found.", "NOT_FOUND");
        }
        if (targetMember.role === "OWNER" && input.role !== "OWNER") {
          const ownerCount = await projectRepository.countOwners(
            input.projectId,
            tx
          );
          if (ownerCount <= 1) {
            throw appError(
              "Project must keep at least one owner.",
              "BAD_USER_INPUT"
            );
          }
        }
        const roleUpdated = await projectRepository.setMemberRole(
          input.projectId,
          input.userId,
          input.role,
          tx
        );
        if (roleUpdated) {
          await projectRepository.touchProject(input.projectId, tx);
        }
        return roleUpdated;
      }
    );
    if (!changed) {
      throw appError("Target member not found.", "NOT_FOUND");
    }
    await authRepository.syncProjectProfileAssignment(
      input.userId,
      input.projectId,
      input.role
    );
    const project = await requireProject(input.projectId);
    return buildProject(project);
  },

  async setAgreedRate(
    input: {
      projectId: string;
      fromCurrency: Currency;
      toCurrency: Currency;
      rate: number;
    },
    context: GraphQLContext
  ) {
    const viewer = requireViewer(context);
    await this.ensureEditable(input.projectId, context, "Rate", "update");
    if (input.rate <= 0) {
      throw appError("Rate must be greater than 0.", "BAD_USER_INPUT");
    }
    if (input.fromCurrency === input.toCurrency) {
      throw appError(
        "From and to currency must be different.",
        "BAD_USER_INPUT"
      );
    }

    await projectRepository.withProjectWriteLock(
      input.projectId,
      async (tx) => {
        await rateRepository.upsert(
          {
            projectId: input.projectId,
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            rate: input.rate,
            updatedBy: viewer.id,
          },
          tx
        );
        await projectRepository.touchProject(input.projectId, tx);
      }
    );
    const project = await requireProject(input.projectId);
    return buildProject(project);
  },
};
