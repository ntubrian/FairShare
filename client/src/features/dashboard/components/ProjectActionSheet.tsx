import React from "react";
import type { DashboardProject } from "../types";
import {
  canArchiveProject,
  canDeleteProject,
  canEditProject,
  canLeaveProject,
  canManageMembers,
} from "../utils";
import styles from "../Dashboard.module.scss";

type ProjectActionSheetProps = {
  project: DashboardProject | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: (project: DashboardProject) => void;
  onCopyInvite: (project: DashboardProject) => void;
  onArchive: (project: DashboardProject) => void;
  onDelete: (project: DashboardProject) => void;
  onLeave: (project: DashboardProject) => void;
};

export const ProjectActionSheet = ({
  project,
  open,
  busy,
  onClose,
  onEdit,
  onCopyInvite,
  onArchive,
  onDelete,
  onLeave,
}: ProjectActionSheetProps) => {
  if (!open || !project) {
    return null;
  }

  const canEdit = canEditProject(project.viewerRole, project.status);
  const canManage = canManageMembers(project.viewerRole, project.status);
  const canArchive = canArchiveProject(project.viewerRole, project.status);
  const canDelete = canDeleteProject(project.viewerRole);
  const canLeave = canLeaveProject(project.viewerRole);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Project actions"
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h3>{project.name}</h3>
          <div className={styles.projectCardTags}>
            <span
              className={`${styles.projectPill} ${styles.projectPillRole} ${
                project.viewerRole === "OWNER"
                  ? styles.roleOwner
                  : project.viewerRole === "EDITOR"
                  ? styles.roleEditor
                  : styles.roleViewer
              }`}
            >
              {project.viewerRole}
            </span>
            <span
              className={`${styles.projectPill} ${styles.projectPillCurrency}`}
            >
              {project.targetCurrency}
            </span>
          </div>
        </div>

        <div className={styles.sheetActions}>
          <button
            type="button"
            className={styles.sheetAction}
            disabled={!canEdit || busy}
            onClick={() => onEdit(project)}
          >
            Edit project
          </button>
          <button type="button" className={styles.sheetAction} disabled>
            {canManage
              ? "Manage members and roles (coming soon)"
              : "Manage members and roles"}
          </button>
          <button
            type="button"
            className={styles.sheetAction}
            disabled={busy}
            onClick={() => onCopyInvite(project)}
          >
            Copy invite link
          </button>
          <button
            type="button"
            className={`${styles.sheetAction} ${styles.sheetActionDanger}`}
            disabled={!canArchive || busy}
            onClick={() => onArchive(project)}
          >
            Archive project
          </button>
          <button
            type="button"
            className={`${styles.sheetAction} ${styles.sheetActionDanger}`}
            disabled={!canDelete || busy}
            onClick={() => onDelete(project)}
          >
            Delete project
          </button>
          <button
            type="button"
            className={`${styles.sheetAction} ${styles.sheetActionDanger}`}
            disabled={!canLeave || busy}
            onClick={() => onLeave(project)}
          >
            Leave project
          </button>
        </div>

        <div className={styles.sheetFooter}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
