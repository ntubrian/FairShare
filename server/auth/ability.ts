import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from "@casl/ability";
import { appError } from "../lib/errors";
import { MemberRole, ProjectStatus } from "../types";

export type AppAction =
  | "manage"
  | "read"
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "setRole"
  | "join"
  | "calculate"
  | "export";

export type AppSubject =
  | "all"
  | "Project"
  | "Participant"
  | "Expense"
  | "Rate"
  | "Invite"
  | "Settlement"
  | "User";

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

export const defineGlobalAbility = (appRole: MemberRole): AppAbility => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  can("read", "User");
  can("read", "Invite");
  can("join", "Invite");
  can("read", "Project");
  can("read", "Rate");
  can("calculate", "Settlement");
  can("export", "Settlement");

  if (appRole === "OWNER" || appRole === "EDITOR") {
    can("create", "Project");
  }

  return build();
};

export const defineProjectAbility = (
  projectRole: MemberRole,
  projectStatus: ProjectStatus
): AppAbility => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  can("read", "Project");
  can("read", "Participant");
  can("read", "Expense");
  can("read", "Rate");
  can("calculate", "Settlement");
  can("export", "Settlement");

  if (projectRole === "OWNER" || projectRole === "EDITOR") {
    if (projectStatus !== "ARCHIVED") {
      can("update", "Project");
      can("create", "Participant");
      can("update", "Participant");
      can("delete", "Participant");
      can("create", "Expense");
      can("update", "Expense");
      can("delete", "Expense");
      can("update", "Rate");
    }
  }

  if (projectRole === "OWNER") {
    can("delete", "Project");
    if (projectStatus !== "ARCHIVED") {
      can("archive", "Project");
      can("setRole", "Project");
    }
  }

  return build();
};

export const assertCan = (
  ability: AppAbility,
  action: AppAction,
  subject: AppSubject,
  message: string
) => {
  if (!ability.can(action, subject)) {
    throw appError(message, "FORBIDDEN");
  }
};
