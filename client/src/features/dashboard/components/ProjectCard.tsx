import type { DashboardProject } from "../types";
import { formatRelativeTime } from "../utils";
import styles from "../Dashboard.module.scss";

type ProjectCardProps = {
  project: DashboardProject;
  onOpenActions: (project: DashboardProject) => void;
};

export const ProjectCard = ({ project, onOpenActions }: ProjectCardProps) => (
  <article
    className={`${styles.projectCard} ${
      project.status === "ARCHIVED" ? styles.projectCardArchived : ""
    }`}
  >
    <button
      type="button"
      className={styles.projectCardMenu}
      aria-label={`Open actions for ${project.name}`}
      onClick={() => onOpenActions(project)}
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
