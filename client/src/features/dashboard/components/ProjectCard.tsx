import React from "react";
import type { DashboardProject } from "../types";
import { formatRelativeTime } from "../utils";
import styles from "../Dashboard.module.scss";

type ProjectCardProps = {
  project: DashboardProject;
  onOpenActions: (project: DashboardProject) => void;
  onOpenProject: (project: DashboardProject) => void;
};

export const ProjectCard = ({
  project,
  onOpenActions,
  onOpenProject,
}: ProjectCardProps) => (
  <article
    className={`${styles.projectCard} ${styles.projectCardClickable} ${
      project.status === "ARCHIVED" ? styles.projectCardArchived : ""
    }`}
    onClick={() => onOpenProject(project)}
  >
    <button
      type="button"
      className={styles.projectCardMenu}
      aria-label={`Open actions for ${project.name}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpenActions(project);
      }}
    >
      •••
    </button>

    <h3 className={styles.projectCardName}>{project.name}</h3>
    <p className={styles.projectCardMeta}>
      {project.memberCount} members <span aria-hidden>•</span> updated{" "}
      {formatRelativeTime(project.updatedAt)}
    </p>

    <div className={styles.projectCardTags}>
      <span className={`${styles.projectPill} ${styles.projectPillCurrency}`}>
        {project.targetCurrency}
      </span>
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
    </div>

    <p className={styles.projectCardFoot}>
      {project.status === "ARCHIVED"
        ? "Archived project (read-only)."
        : "Data is scoped to this project."}
    </p>
  </article>
);
