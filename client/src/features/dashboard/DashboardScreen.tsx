import React, { useMemo, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { JoinProjectModal } from "./components/JoinProjectModal";
import { ProjectActionSheet } from "./components/ProjectActionSheet";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectFormModal } from "./components/ProjectFormModal";
import type {
  DashboardProject,
  DashboardProjectPage,
  ProjectFormInput,
} from "./types";
import { resolveInviteCode } from "./utils";
import styles from "./Dashboard.module.scss";

type DashboardScreenProps = {
  viewerName: string;
  viewerRole: string;
  refreshing: boolean;
  actionBusy: boolean;
  onRefresh: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  canInstall: boolean;
  installed: boolean;
  onInstall: () => Promise<void> | void;
  isOnline: boolean;
  health: string;
  lastSyncedAt: string | null;
  endpoint: string;
  projectPage: DashboardProjectPage;
  projectLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (nextPage: number) => void;
  onCreateProject: (input: ProjectFormInput) => Promise<void>;
  onUpdateProject: (
    input: ProjectFormInput & { projectId: string }
  ) => Promise<void>;
  onJoinProject: (inviteCode: string) => Promise<void>;
  onArchiveProject: (projectId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onLeaveProject: (projectId: string) => Promise<void>;
  error?: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  action: "archive" | "delete" | "leave";
  project: DashboardProject | null;
};

const DEFAULT_CONFIRM_STATE: ConfirmState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "",
  action: "archive",
  project: null,
};

export const DashboardScreen = ({
  viewerName,
  viewerRole,
  refreshing,
  actionBusy,
  onRefresh,
  onLogout,
  canInstall,
  installed,
  onInstall,
  isOnline,
  health,
  lastSyncedAt,
  endpoint,
  projectPage,
  projectLoading,
  search,
  onSearchChange,
  onPageChange,
  onCreateProject,
  onUpdateProject,
  onJoinProject,
  onArchiveProject,
  onDeleteProject,
  onLeaveProject,
  error,
}: DashboardScreenProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [editProject, setEditProject] = useState<DashboardProject | null>(null);
  const [sheetProject, setSheetProject] = useState<DashboardProject | null>(
    null
  );
  const [confirmState, setConfirmState] = useState<ConfirmState>(
    DEFAULT_CONFIRM_STATE
  );

  const pageCaption = useMemo(() => {
    if (projectPage.total === 0) {
      return "0 results";
    }
    const start = (projectPage.page - 1) * projectPage.pageSize + 1;
    const end = Math.min(
      projectPage.page * projectPage.pageSize,
      projectPage.total
    );
    return `${start}-${end} of ${projectPage.total}`;
  }, [projectPage.page, projectPage.pageSize, projectPage.total]);

  const openConfirm = (
    action: ConfirmState["action"],
    project: DashboardProject,
    title: string,
    description: string,
    confirmLabel: string
  ) => {
    setConfirmState({
      open: true,
      title,
      description,
      confirmLabel,
      action,
      project,
    });
  };

  const closeConfirm = () => setConfirmState(DEFAULT_CONFIRM_STATE);

  const handleConfirm = async () => {
    if (!confirmState.project) {
      closeConfirm();
      return;
    }

    const projectId = confirmState.project.id;
    if (confirmState.action === "archive") {
      await onArchiveProject(projectId);
    } else if (confirmState.action === "delete") {
      await onDeleteProject(projectId);
    } else {
      await onLeaveProject(projectId);
    }
    closeConfirm();
  };

  const handleCreate = async (
    input: ProjectFormInput & { projectId?: string }
  ) => {
    await onCreateProject({
      name: input.name,
      targetCurrency: input.targetCurrency,
      agreedRateFirst: input.agreedRateFirst,
    });
    setCreateOpen(false);
  };

  const handleEdit = async (
    input: ProjectFormInput & { projectId?: string }
  ) => {
    if (!input.projectId) {
      return;
    }
    await onUpdateProject({
      projectId: input.projectId,
      name: input.name,
      targetCurrency: input.targetCurrency,
      agreedRateFirst: input.agreedRateFirst,
    });
    setEditProject(null);
  };

  const handleJoin = async (value: string) => {
    const inviteCode = resolveInviteCode(value);
    await onJoinProject(inviteCode);
    setJoinOpen(false);
  };

  const handleCopyInvite = async (project: DashboardProject) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(project.inviteLink);
    } else {
      window.prompt("Copy invite link", project.inviteLink);
    }
    setSheetProject(null);
  };

  return (
    <main className={`${styles.appShell} ${styles.projectsShell}`}>
      <header className={`${styles.projectsHeader} ${styles.card}`}>
        <div className={styles.projectsTitleWrap}>
          <h1>Projects</h1>
          <p className={styles.hintLine}>
            {viewerName} ({viewerRole})
          </p>
        </div>
        <div className={styles.projectsHeaderActions}>
          <button
            type="button"
            className={styles.statusPill}
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            <span
              className={`${styles.statusDot} ${
                isOnline ? styles.statusDotOnline : styles.statusDotOffline
              }`}
            />
            {refreshing ? "Syncing..." : "Synced"}
          </button>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => void onLogout()}
            aria-label="Logout"
          >
            {viewerName.charAt(0).toUpperCase() || "U"}
          </button>
        </div>
      </header>

      <section className={`${styles.card} ${styles.projectsToolbar}`}>
        <input
          placeholder="Search project name"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search projects"
        />
        <button
          type="button"
          className={`${styles.ghostButton} ${styles.joinTrigger}`}
          onClick={() => setJoinOpen(true)}
        >
          Join...
        </button>
      </section>

      <section className={`${styles.card} ${styles.projectsListCard}`}>
        <div className={styles.sectionTitleRow}>
          <h2>My Projects</h2>
          <span className={styles.count}>{projectPage.total}</span>
        </div>

        {projectLoading ? (
          <p className={styles.empty}>Loading projects...</p>
        ) : null}

        {!projectLoading && projectPage.items.length === 0 ? (
          <p className={styles.empty}>No projects found.</p>
        ) : null}

        <div className={styles.projectList}>
          {projectPage.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenActions={setSheetProject}
            />
          ))}
        </div>

        <footer className={styles.paginationRow}>
          <p className={styles.hintLine}>{pageCaption}</p>
          <div className={styles.paginationActions}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => onPageChange(projectPage.page - 1)}
              disabled={!projectPage.hasPreviousPage || actionBusy}
            >
              Prev
            </button>
            <span className={styles.pageIndicator}>
              Page {projectPage.page}/{projectPage.totalPages}
            </span>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => onPageChange(projectPage.page + 1)}
              disabled={!projectPage.hasNextPage || actionBusy}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      <button
        type="button"
        className={styles.fabCreate}
        aria-label="Create project"
        onClick={() => setCreateOpen(true)}
      >
        +
      </button>

      <section
        className={`${styles.card} ${styles.compactCard} ${styles.endpoint}`}
      >
        <strong>GraphQL endpoint:</strong> <code>{endpoint}</code>
      </section>

      <section className={styles.statusInline}>
        <span>Server: {health}</span>
        <span>
          Last sync:{" "}
          {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "n/a"}
        </span>
        <span>
          PWA:{" "}
          {canInstall
            ? "Install available"
            : installed
            ? "Installed"
            : "Browser mode"}
        </span>
        {canInstall ? (
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => void onInstall()}
          >
            Install app
          </button>
        ) : null}
      </section>

      {error ? <section className={styles.errorCard}>{error}</section> : null}

      <JoinProjectModal
        open={joinOpen}
        busy={actionBusy}
        onClose={() => setJoinOpen(false)}
        onJoin={handleJoin}
      />

      <ProjectFormModal
        open={createOpen}
        mode="create"
        busy={actionBusy}
        project={null}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <ProjectFormModal
        open={Boolean(editProject)}
        mode="edit"
        busy={actionBusy}
        project={editProject}
        onClose={() => setEditProject(null)}
        onSubmit={handleEdit}
      />

      <ProjectActionSheet
        open={Boolean(sheetProject)}
        busy={actionBusy}
        project={sheetProject}
        onClose={() => setSheetProject(null)}
        onEdit={(project) => {
          setEditProject(project);
          setSheetProject(null);
        }}
        onCopyInvite={(project) => {
          void handleCopyInvite(project).catch(() => undefined);
        }}
        onArchive={(project) => {
          setSheetProject(null);
          openConfirm(
            "archive",
            project,
            "Archive project?",
            "Archived projects become read-only for members.",
            "Archive"
          );
        }}
        onDelete={(project) => {
          setSheetProject(null);
          openConfirm(
            "delete",
            project,
            "Delete project?",
            "This action permanently removes data and cannot be undone.",
            "Delete"
          );
        }}
        onLeave={(project) => {
          setSheetProject(null);
          openConfirm(
            "leave",
            project,
            "Leave project?",
            "You will lose access to this project unless invited again.",
            "Leave"
          );
        }}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        busy={actionBusy}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
      />
    </main>
  );
};
