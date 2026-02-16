# FairShare PWA Design Tokens & Figma Frame Spec (Bento Grid Style)

## 1) Design Direction

- **Product**: FairShare (multi-currency lunch expense splitter for teams).
- **Platform target**: **PWA-first** mobile experience, then tablet/desktop responsive adaptation.
- **Visual style**: **Bento Grid style** — clean compartment layout, rounded bento-box cards, soft color blocks, subtle strokes, and friendly iconography.
- **Design goals from PRD**:
  - Fast project switching and clear project isolation.
  - Easy participant + expense operations.
  - High readability for settlement output (who pays whom).
  - Trustable finance UI (exchange-rate source/timestamp visibility).

---

## 2) PWA Product UI Principles

1. **Mobile-first density**: optimize for 390x844 (iPhone-like) and 360x800 (Android-like).
2. **One-handed interaction**: frequent actions near thumb zone (bottom sheet, floating CTA, sticky footer actions).
3. **Offline-first perception**: show sync status chips (`Offline`, `Syncing`, `Synced`).
4. **Installability clarity**: dedicated “Install App” education banner and standalone launch frame.
5. **Realtime confidence**: subtle updates toast on Pusher events ("Updated just now").

---

## 3) Core Design Tokens (v1)

## 3.1 Color Tokens

### Brand / Semantic

- `color.brand.primary = #2E7D6B` (bento green, primary CTA)
- `color.brand.primary.hover = #276A5A`
- `color.brand.secondary = #F4A259` (warm orange accent)
- `color.brand.tertiary = #DCE8B8` (soft bento garnish green)

### Surface

- `color.surface.base = #FFFDF8` (main background)
- `color.surface.card = #FFFFFF`
- `color.surface.card.alt = #F8F5EC` (bento compartment alt)
- `color.surface.modal = #FFFDF8`
- `color.surface.overlay = rgba(17, 24, 39, 0.45)`

### Text

- `color.text.primary = #1F2937`
- `color.text.secondary = #4B5563`
- `color.text.inverse = #FFFFFF`
- `color.text.muted = #9CA3AF`

### Border / Divider

- `color.border.default = #E5E7EB`
- `color.border.strong = #D1D5DB`
- `color.divider = #ECE7DA`

### Status

- `color.status.success.bg = #E8F7EE`
- `color.status.success.fg = #1E7A46`
- `color.status.warning.bg = #FFF4E5`
- `color.status.warning.fg = #A15C07`
- `color.status.error.bg = #FDECEC`
- `color.status.error.fg = #B42318`
- `color.status.info.bg = #EAF3FF`
- `color.status.info.fg = #175CD3`

### Currency chips

- `color.currency.usd = #D9F7E8`
- `color.currency.twd = #E8F0FF`
- `color.currency.jpy = #FFEDE7`
- `color.currency.eur = #F5ECFF`

## 3.2 Typography Tokens

- `font.family.base = "Inter", "Noto Sans TC", system-ui, sans-serif`
- `font.family.numeric = "Inter", "Roboto Mono", monospace`

- `font.size.display = 32 / line 40 / weight 700`
- `font.size.h1 = 24 / line 32 / weight 700`
- `font.size.h2 = 20 / line 28 / weight 700`
- `font.size.h3 = 18 / line 26 / weight 600`
- `font.size.body.lg = 16 / line 24 / weight 500`
- `font.size.body.md = 14 / line 22 / weight 400`
- `font.size.body.sm = 12 / line 18 / weight 400`
- `font.size.label = 12 / line 16 / weight 600`
- `font.size.button = 14 / line 20 / weight 600`

## 3.3 Spacing Tokens (4pt grid)

- `space.0 = 0`
- `space.1 = 4`
- `space.2 = 8`
- `space.3 = 12`
- `space.4 = 16`
- `space.5 = 20`
- `space.6 = 24`
- `space.8 = 32`
- `space.10 = 40`
- `space.12 = 48`

## 3.4 Radius Tokens (Bento Grid key)

- `radius.xs = 6`
- `radius.sm = 10`
- `radius.md = 14`
- `radius.lg = 18`
- `radius.xl = 24`
- `radius.pill = 999`

Use **`radius.lg`** for main cards to preserve Bento Grid compartment feeling.

## 3.5 Elevation Tokens

- `shadow.1 = 0 1px 2px rgba(16, 24, 40, 0.06)`
- `shadow.2 = 0 4px 10px rgba(16, 24, 40, 0.08)`
- `shadow.3 = 0 10px 24px rgba(16, 24, 40, 0.12)`

## 3.6 Motion Tokens

- `motion.fast = 120ms`
- `motion.normal = 200ms`
- `motion.slow = 280ms`
- `easing.standard = cubic-bezier(0.2, 0, 0, 1)`
- `easing.emphasized = cubic-bezier(0.2, 0.8, 0.2, 1)`

Micro-interactions:

- Card hover/lift: `shadow.1 -> shadow.2`, `duration: motion.fast`
- Modal enter: fade + scale `0.96 -> 1`, `duration: motion.normal`

## 3.7 Component Tokens

- Button height: `40` (default), `48` (primary large CTA)
- Input height: `44`
- List row min-height: `56`
- Header height mobile: `56`
- Bottom nav height: `64`
- Floating action size: `56`

---

## 4) Figma Foundation Setup

## 4.1 Variables (Collections)

Create collections:

1. `Core` (color, spacing, radius, typography references)
2. `Semantic` (success/warn/error/info + currency)
3. `Component` (button/input/list dimensions)

Modes:

- `Light` (required v1)
- `Dark` (optional future; keep placeholders)

## 4.2 Styles

- Color styles: map from `Semantic` and surface/text set.
- Text styles: `Display`, `H1`, `H2`, `Body/MD`, `Body/SM`, `Label`, `Button`.
- Effect styles: `Shadow/1`, `Shadow/2`, `Shadow/3`.

## 4.3 Grids / Layout

- Mobile frame: **390x844**, 4-column, margin 16, gutter 12.
- Tablet frame: **768x1024**, 8-column, margin 24, gutter 16.
- Desktop frame: **1440x1024**, 12-column, margin 80, gutter 24.

---

## 5) Exact Frame Definitions (Aligned with PRD)

> Frame naming format in Figma: `FS-[Platform]-[Feature]-[State]-[Lang]`

## 5.1 Global / App Shell

### Frame 01 — Splash + Auth Gate (Web-only Visual)

- **Name**: `FS-Mobile-Auth-Splash-zhTW`
- **Size**: 390x844
- **Purpose**: entry point before Google login (FR-1).
- **Constraint**: web design only. **Do not embed raster images** (`png/jpg/webp`). **SVG assets are allowed**.
- **Content**:
  - Text-first hero block (product name + one-line value proposition).
  - Optional inline SVG icon/shape for brand accent.
  - Currency support chips: `USD`, `TWD`, `JPY`, `EUR`.
  - Primary CTA: `Continue with Google`.
  - Secondary intent actions: `Create Project`, `Join Project`.
  - Footer text links: privacy + terms.
  - Explicitly exclude `Sign in with Email` from this frame.
- **States**:
  - Loading auth
  - OAuth error toast

### Frame 01 Interaction Rules (Must Match Product Flow)

- Tapping `Continue with Google`:
  - If unauthenticated: start Google OAuth, then go to `Frame 03 — Project List / Switch`.
  - If already authenticated: go directly to `Frame 03 — Project List / Switch`.
- Tapping `Create Project`:
  - If unauthenticated: start Google OAuth first, then open `Frame 04 — Create/Edit Project Modal` in create mode.
  - If already authenticated: open `Frame 04 — Create/Edit Project Modal` directly.
- Tapping `Join Project`:
  - If unauthenticated: start Google OAuth first, then open `Frame 03b — Join Project Entry`.
  - If already authenticated: open `Frame 03b — Join Project Entry` directly.

### Frame 02 — PWA Install Prompt

- **Name**: `FS-Mobile-PWA-InstallPrompt-en`
- **Purpose**: encourage install (PWA behavior).
- **Content**:
  - Dismissible bento card with install icon.
  - CTA `Install App`, secondary `Not now`.

### Frame 03 — Project List / Switch

- **Name**: `FS-Mobile-Project-Switcher-Default-zhTW`
- **Purpose**: create/switch project with isolation hints (FR-2).
- **Content**:
  - Search + list of project cards.
  - `Create Project` FAB.
  - `Join Project` secondary action.
  - Each card: project name, member count, target currency chip, role badge.
  - Isolation hint copy on card: `資料僅限此專案` (en reference: `Data stays within this project`).
  - Trailing overflow trigger (`...`) for project-level secondary actions.

### Frame 03b — Join Project Entry

- **Name**: `FS-Mobile-Project-Join-Entry-en`
- **Purpose**: allow joining project via share link or invite code (FR-2 extension).
- **Content**:
  - Input field: paste share link.
  - Input field: invite code.
  - CTA: `Join`.
  - Success state: show success banner/toast with project name.
  - Info state: already member.
  - Error state: invalid/expired link or code.
  - Retry path without leaving current screen.

### Frame 03b-1 — Join Result Feedback

- **Name**: `FS-Mobile-Project-Join-Feedback-en`
- **Purpose**: define post-join feedback UI for deep-link and manual join flow.
- **Variants**:
  - `success`: `Joined project: {projectName}`
  - `info`: `You are already in this project.`
  - `error`: `Invalid or expired invite code.`
- **Layout rules**:
  - Preferred position: top toast under header, or inline status banner in current card stack.
  - Auto dismiss: 2~3s for success/info; error remains until user dismisses or retries.
  - Success and info use non-destructive style; error uses destructive style.
- **Interaction**:
  - Success after deep-link (`/join?code=...`): navigate to project list and show feedback immediately.
  - Success after manual join modal: close modal, refresh project list, then show feedback.
  - Error keeps user in join context and preserves input for retry.

### Frame 03c — Project Card Actions Sheet

- **Name**: `FS-Mobile-Project-CardActionsSheet-zhTW`
- **Purpose**: expose per-project secondary actions from card overflow (project switch is handled by card tap).
- **Container**: bottom sheet anchored from project card trailing `...`.
- **Content**:
  - Context header: project name + role + target currency.
  - Action `編輯專案` (opens `Frame 04` in edit mode; Owner only).
  - Action `管理成員與角色` (opens `Frame 05`; Owner only).
  - Action `複製邀請連結` (Owner/Editor).
  - Action `離開專案` (non-Owner, destructive).
  - Action `封存專案` or `刪除專案` (Owner only, destructive).
- **States**:
  - Permission-restricted row with helper text: `你目前的角色無法執行此操作`.
  - Network error toast on action failure with retry.

### Frame 03d — Project Action Confirm Dialog

- **Name**: `FS-Mobile-Project-ActionConfirm-zhTW`
- **Purpose**: prevent unintended destructive project actions from `Frame 03c`.
- **Variants**:
  - Leave project confirm: `離開後將無法查看此專案資料，除非再次被邀請`.
  - Archive project confirm: `封存後專案將停止編輯，但可由 Owner 復原`.
  - Delete project confirm: `刪除後資料無法復原` (highest risk, Owner only).
- **Content**:
  - Title + impact description + affected project name.
  - Secondary button `取消`.
  - Primary destructive button (`離開專案` / `封存專案` / `刪除專案`).
  - Inline loading and success/failure feedback.

### Frame 03 Interaction Rules (Card + Overflow)

- Tapping project card body switches active project and enters that project's data scope.
- Tapping trailing `...` opens `Frame 03c — Project Card Actions Sheet` and does not switch project immediately.
- Project switching is only triggered by project card tap, not by any action in `Frame 03c`.
- Any destructive action from `Frame 03c` must require `Frame 03d — Project Action Confirm Dialog`.
- After successful switch/leave/archive/delete, return to `Frame 03` and refresh card list + sync timestamp.
- After join via link/code succeeds, return to `Frame 03` and show `Frame 03b-1 success` feedback.
- If join fails, stay in `Frame 03b` with `Frame 03b-1 error` feedback and keep entered value.

## 5.2 Project Setup & Permissions

### Frame 04 — Create/Edit Project Modal

- **Name**: `FS-Mobile-Project-EditModal-Default-en`
- **Purpose**: project metadata + target currency + exchange strategy (FR-2, FR-6).
- **Fields**:
  - Project name (required)
  - Target currency dropdown (USD/TWD/JPY/EUR)
  - Exchange strategy toggle: `Agreed rate first`
  - Optional agreed rates table

### Frame 05 — Role Management

- **Name**: `FS-Mobile-Project-Roles-OwnerView-en`
- **Purpose**: show Owner/Editor/Viewer permissions (Section 5).
- **Content**:
  - Member rows + role dropdown (Owner-only editable)
  - Inline helper text for restricted actions.

## 5.3 Participant Management

### Frame 06 — Participants List

- **Name**: `FS-Mobile-Participants-List-Default-zhTW`
- **Purpose**: add/remove participants with constraints (FR-3).
- **Content**:
  - Participant chips or rows with avatar initials.
  - `Add participant` input + CTA.
  - Remove action on row trailing side.

### Frame 07 — Remove Blocked State

- **Name**: `FS-Mobile-Participants-RemoveBlocked-zhTW`
- **Purpose**: validation feedback for member with expenses (AC-2).
- **Content**:
  - Warning dialog: “Cannot remove participant with active expenses.”
  - Quick link CTA: `View related expenses`.

## 5.4 Expense Management

### Frame 08 — Expense List Default

- **Name**: `FS-Mobile-Expense-List-Default-en`
- **Purpose**: display expense feed by project (FR-4).
- **Content**:
  - Bento-grouped cards by date.
  - Row fields: payer, amount, currency chip, description, updated time.
  - Top filters: currency, payer.

### Frame 09 — Add Expense Bottom Sheet

- **Name**: `FS-Mobile-Expense-AddSheet-Default-en`
- **Purpose**: create expense quickly (FR-4).
- **Fields**:
  - Payer select
  - Amount numeric input (with localized formatting)
  - Currency segmented control (USD/TWD/JPY/EUR)
  - Description optional
  - Primary CTA `Save Expense`

### Frame 10 — Validation Error State

- **Name**: `FS-Mobile-Expense-AddSheet-Validation-en`
- **Purpose**: immediate field-level errors (FR-4).
- **Cases**:
  - missing payer
  - amount <= 0
  - unsupported currency

### Frame 11 — Expense Edit/Delete/Restore

- **Name**: `FS-Mobile-Expense-RowActions-zhTW`
- **Purpose**: mistake correction flow (FR-5).
- **Content**:
  - Swipe actions: Edit / Soft Delete.
  - Soft-deleted card style: muted + “Deleted” badge + `Restore` CTA.

## 5.5 Settlement & Exchange

### Frame 12 — Settlement Control Panel

- **Name**: `FS-Mobile-Settlement-Controls-en`
- **Purpose**: trigger calculation and explain rates used (FR-6).
- **Content**:
  - Selected target currency.
  - Rate source badge:
    - `Agreed rate`
    - `Live API`
  - Last sync timestamp.
  - Primary CTA `Calculate`.

### Frame 13 — Settlement Result Modal

- **Name**: `FS-Mobile-Settlement-ResultModal-en`
- **Purpose**: show who pays whom list (FR-7).
- **Content**:
  - Header: project + target currency.
  - Instruction list: “Alice pays Bob 520 TWD”.
  - Calculation timestamp.
  - CTA: `Export PDF`.

### Frame 14 — Empty Settlement State

- **Name**: `FS-Mobile-Settlement-EmptyState-zhTW`
- **Purpose**: no transactions required.
- **Content**:
  - Friendly illustration + copy: “All settled 🎉”.

## 5.6 Realtime, PDF, Localization

### Frame 15 — Realtime Update Toast

- **Name**: `FS-Mobile-Realtime-Toast-en`
- **Purpose**: indicate Pusher update arrival (FR-8).
- **Content**:
  - Toast: `Expense list updated just now`.

### Frame 16 — PDF Export Confirm

- **Name**: `FS-Mobile-PDF-ExportConfirm-en`
- **Purpose**: export setup and included sections (FR-9).
- **Content**:
  - Checklist of included fields (project name, export time, target currency, rate snapshot, settlements, expense detail).
  - Toggle: include soft-deleted expenses.

### Frame 17 — Language Auto Detect

- **Name**: `FS-Mobile-i18n-Autodetect-Compare`
- **Purpose**: compare `zh-TW` and `en` layout/length robustness (FR-10).
- **Content**:
  - Side-by-side strings for key screens.

## 5.7 Desktop Key Frames

### Frame 18 — Desktop Dashboard

- **Name**: `FS-Desktop-Dashboard-Default-en`
- **Size**: 1440x1024
- **Purpose**: multi-pane productivity view.
- **Layout**:
  - Left: project navigation.
  - Middle: participants + expense list.
  - Right: settlement preview panel.

### Frame 19 — Desktop Settlement Modal

- **Name**: `FS-Desktop-Settlement-Result-en`
- **Purpose**: larger modal with print-ready hierarchy.

---

## 6) Component Inventory for Figma (Must Build)

1. App bar (mobile/desktop variants)
2. Project card
3. Participant row
4. Expense row (default, deleted)
5. Currency chip (USD/TWD/JPY/EUR)
6. Role badge (Owner/Editor/Viewer)
7. Buttons (primary, secondary, ghost, destructive)
8. Inputs (text, number, select, segmented control)
9. Toast (info/success/error)
10. Dialog/Modal shell
11. Bottom sheet shell
12. Empty state module
13. Exchange rate source badge
14. Sync status chip (`Offline`, `Syncing`, `Synced`)
15. Join result feedback component (success/info/error toast or inline banner)

---

## 7) Prompt Templates for Image Generation Check

Use these prompts to generate visual references for stakeholder review.

### Prompt A — Mobile Dashboard (Bento Grid)

"Design a mobile PWA finance app UI in Bento Grid style for team lunch expense splitting. Use soft warm background (#FFFDF8), rounded bento cards, green primary CTA (#2E7D6B), orange accents (#F4A259), and clean sans-serif typography. Show project switcher, participant summary, expense list with currency chips (USD/TWD/JPY/EUR), and sticky calculate button. Friendly, trustworthy, minimal, high readability."

### Prompt B — Settlement Modal

"Create a mobile modal UI for a bill-splitting app showing settlement results in target currency. Bento Grid style with rounded compartments, subtle dividers, clear hierarchy, and list rows like 'Alice pays Bob 520 TWD'. Include calculation timestamp, exchange-rate source badge, and export PDF button."

### Prompt C — Expense Add Sheet

"Create a bottom sheet interface for adding expenses in a PWA app. Include payer selector, amount input, currency segmented control (USD/TWD/JPY/EUR), optional description, inline validation errors, and primary save button. Bento Grid visual style with soft card surfaces and concise spacing."

### Prompt D — Frame 01 Auth Splash (Production Aligned)

"Design a 390x844 mobile web screen for FairShare in Bento Grid style, using only vector-like UI elements (no raster photo/image). Show a clean hero card with app logo, title 'FairShare', and subtitle 'Split lunches, settle fast.' Include currency chips for USD, TWD, JPY, EUR. Primary button: 'Continue with Google'. Secondary intent buttons: 'Create Project' and 'Join Project'. Do not include email sign-in. Add tiny footer text links for Terms and Privacy. Use warm background (#FFFDF8), rounded cards, green primary CTA (#2E7D6B), orange accent (#F4A259), readable sans-serif type, and generous spacing."

### Prompt E — Join Success/Error Feedback

"Design a mobile project-list screen in Bento Grid style showing post-join feedback states. Include one success toast (`Joined project: Lunch Crew`), one info toast (`You are already in this project.`), and one error banner (`Invalid or expired invite code.`). Keep clear semantic colors: success green soft background, info blue soft background, error red soft background, with accessible contrast and rounded bento corners."

---

## 8) Handoff Notes for Engineering

- Implement tokens as CSS variables under `:root`, then map to component-level variables.
- Keep numeric amounts in a monospaced fallback for better scanability.
- Ensure all modal and bottom-sheet components are keyboard accessible.
- Keep AC-related UI states explicit (blocked remove, deleted/restore, rate source).
- For PWA readiness, reserve UI slots for install prompt and sync status.
- For MCP-driven implementation workflow, follow `docs/FIGMA_MCP_WORKFLOW.md`.
- For reusable MCP instruction prompts, use `docs/FIGMA_MCP_PROMPT_TEMPLATE.md`.
