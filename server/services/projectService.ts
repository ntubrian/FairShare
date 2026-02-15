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
  projectRepository,
} from "../repositories/projectRepository";
import { participantRepository } from "../repositories/participantRepository";
import { expenseRepository } from "../repositories/expenseRepository";
import { rateRepository } from "../repositories/rateRepository";
import { userRepository } from "../repositories/userRepository";
import { AuthUser, Currency, GraphQLContext, MemberRole } from "../types";
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
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
  name: string;
  created_at: string;
}): GraphQLParticipant => ({
  id: row.id,
  projectId: row.project_id,
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
    description: string | null;
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
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
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
    const updated = await projectRepository.updateProject(input.projectId, {
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
    });
    if (!updated) {
      throw appError("Project not found.", "NOT_FOUND");
    }
    return buildProject(updated);
  },

  async archiveProject(projectId: string, context: GraphQLContext) {
    await this.ensureOwned(projectId, context, "archive");
    const updated = await projectRepository.setStatus(projectId, "ARCHIVED");
    if (!updated) {
      throw appError("Project not found.", "NOT_FOUND");
    }
    return buildProject(updated);
  },

  async deleteProject(projectId: string, context: GraphQLContext) {
    await this.ensureOwned(projectId, context, "delete");
    return projectRepository.deleteById(projectId);
  },

  async leaveProject(projectId: string, context: GraphQLContext) {
    const viewer = requireViewer(context);
    await requireProject(projectId);
    const member = await requireMember(projectId, viewer.id);
    if (member.role === "OWNER") {
      throw appError(
        "Owner cannot leave project. Transfer ownership first.",
        "FORBIDDEN"
      );
    }
    const removed = await projectRepository.removeMember(projectId, viewer.id);
    if (removed) {
      await projectRepository.touchProject(projectId);
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
    const added = await projectRepository.addMember(
      project.id,
      viewer.id,
      "VIEWER"
    );
    if (added) {
      await projectRepository.touchProject(project.id);
    }
    const reloaded = await requireProject(project.id);
    return buildProject(reloaded);
  },

  async setMemberRole(
    input: { projectId: string; userId: string; role: MemberRole },
    context: GraphQLContext
  ) {
    await this.ensureOwned(input.projectId, context, "setRole");
    const targetMember = await projectRepository.findMember(
      input.projectId,
      input.userId
    );
    if (!targetMember) {
      throw appError("Target member not found.", "NOT_FOUND");
    }
    if (targetMember.role === "OWNER" && input.role !== "OWNER") {
      const ownerCount = await projectRepository.countOwners(input.projectId);
      if (ownerCount <= 1) {
        throw appError(
          "Project must keep at least one owner.",
          "BAD_USER_INPUT"
        );
      }
    }

    const changed = await projectRepository.setMemberRole(
      input.projectId,
      input.userId,
      input.role
    );
    if (!changed) {
      throw appError("Target member not found.", "NOT_FOUND");
    }
    await projectRepository.touchProject(input.projectId);
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

    await rateRepository.upsert({
      projectId: input.projectId,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      rate: input.rate,
      updatedBy: viewer.id,
    });
    await projectRepository.touchProject(input.projectId);
    const project = await requireProject(input.projectId);
    return buildProject(project);
  },
};
