# Auth / Authorization Guard Policy

This policy follows `docs/PRD.md` role rules:

- Unauthenticated users cannot access project data.
- Role model is two-layer:
  - **App-level role** (`app_user.app_role`): global capability such as project creation.
  - **Project-level role** (`project_member.role`): project-scoped capability such as editing expenses or managing members.
  - These two roles are independent. A user can be global `EDITOR` and project `OWNER` at the same time.
- Project role matrix:
  - `OWNER`: full access, including member role management.
  - `EDITOR`: can manage project settings, participants, expenses.
  - `VIEWER`: read-only for project data, can calculate settlement and export PDF.
- Public-only query:
  - `health`
  - `detectLocale`

## Layered guard strategy

1. **Schema-level guard wrapper** (`server/schema.ts`)
   - `withAuth`: blocks unauthenticated requests before resolver execution.
   - `withPublic`: allows public access.
2. **Service-level authorization** (`server/services/*.ts`)
   - App-level checks enforce global capability (`createProject`).
   - `ensureReadable`, `ensureEditable`, `ensureOwned` enforce project role checks.
3. **Repository layer**
   - only data access, no authorization logic.

## RBAC persistence model

- `auth_profile`: stores identity profiles (`GLOBAL_*`, `PROJECT_*`).
- `auth_profile_permission`: stores action/subject permissions for each profile.
- `user_profile_assignment`: assigns users to profiles globally or per project.
- Sync rules:
  - user login/upsert -> sync one `GLOBAL_*` assignment by `app_user.app_role`.
  - project create/member join/role change/member remove -> sync `PROJECT_*` assignment.

## Operation mapping

### Query

- Public:
  - `health`
  - `detectLocale`
- Auth required:
  - `viewer`
  - `users`
  - `projects`
  - `project`
  - `projectByInviteCode`
  - `participants`
  - `expenses`
  - `exchangeRates`
  - `calculateSettlement`
  - `pdfExportPreview`

### Mutation

- Auth required:
  - all mutations
- Additional role checks in service:
  - `setMemberRole`: OWNER only
  - `updateProject`, `addParticipant`, `removeParticipant`, `createExpense`, `updateExpense`, `softDeleteExpense`, `restoreExpense`, `setAgreedRate`: EDITOR/OWNER
  - `archiveProject`, `deleteProject`: OWNER only
  - `createProject`: app role cannot be VIEWER
