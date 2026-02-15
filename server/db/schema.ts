import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { Currency, MemberRole, ProjectStatus } from "../types";

export const appUser = pgTable("app_user", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  appRole: text("app_role").$type<MemberRole>().notNull().default("EDITOR"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const project = pgTable("project", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  targetCurrency: text("target_currency").$type<Currency>().notNull(),
  agreedRateFirst: boolean("agreed_rate_first").notNull().default(true),
  status: text("status").$type<ProjectStatus>().notNull().default("ACTIVE"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUser.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
  })
);

export const participant = pgTable(
  "participant",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    projectNameUnique: uniqueIndex("participant_project_name_unique").on(
      table.projectId,
      sql`lower(${table.name})`
    ),
  })
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    payerParticipantId: uuid("payer_participant_id")
      .notNull()
      .references(() => participant.id),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    currency: text("currency").$type<Currency>().notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => ({
    projectIdx: index("expense_project_index").on(table.projectId),
    projectDeletedIdx: index("expense_project_deleted_index").on(
      table.projectId,
      table.deletedAt
    ),
  })
);

export const agreedRate = pgTable(
  "agreed_rate",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    fromCurrency: text("from_currency").$type<Currency>().notNull(),
    toCurrency: text("to_currency").$type<Currency>().notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => appUser.id),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.projectId, table.fromCurrency, table.toCurrency],
    }),
  })
);

export const authProfile = pgTable("auth_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  scope: text("scope").$type<"GLOBAL" | "PROJECT">().notNull(),
  displayName: text("display_name").notNull(),
  isSystem: boolean("is_system").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const authProfilePermission = pgTable(
  "auth_profile_permission",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => authProfile.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    subject: text("subject").notNull(),
    effect: text("effect").$type<"ALLOW" | "DENY">().notNull().default("ALLOW"),
    conditions: jsonb("conditions"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.profileId, table.action, table.subject, table.effect],
    }),
  })
);

export const userProfileAssignment = pgTable(
  "user_profile_assignment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => authProfile.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("user_profile_assignment_user_id_idx").on(table.userId),
    projectIdIdx: index("user_profile_assignment_project_id_idx").on(
      table.projectId
    ),
    globalUnique: uniqueIndex("user_profile_assignment_global_unique")
      .on(table.userId, table.profileId)
      .where(sql`${table.projectId} IS NULL`),
    projectUnique: uniqueIndex("user_profile_assignment_project_unique")
      .on(table.userId, table.profileId, table.projectId)
      .where(sql`${table.projectId} IS NOT NULL`),
  })
);
