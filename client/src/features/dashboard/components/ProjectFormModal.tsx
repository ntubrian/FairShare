import React, { FormEvent, useEffect, useState } from "react";
import { PopupMessages } from "../../../components/PopupMessages";
import type { DashboardProject, ProjectFormInput } from "../types";
import styles from "../Dashboard.module.scss";

type ProjectFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  busy: boolean;
  project: DashboardProject | null;
  onClose: () => void;
  onSubmit: (input: ProjectFormInput & { projectId?: string }) => Promise<void>;
};

const DEFAULT_FORM: ProjectFormInput = {
  name: "",
  targetCurrency: "TWD",
  agreedRateFirst: true,
};

export const ProjectFormModal = ({
  open,
  mode,
  busy,
  project,
  onClose,
  onSubmit,
}: ProjectFormModalProps) => {
  const [form, setForm] = useState<ProjectFormInput>(DEFAULT_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && project) {
      setForm({
        name: project.name,
        targetCurrency: project.targetCurrency,
        agreedRateFirst: project.agreedRateFirst,
      });
      return;
    }
    setForm(DEFAULT_FORM);
  }, [mode, open, project]);

  if (!open) {
    return null;
  }

  const title = mode === "create" ? "Create Project" : "Edit Project";
  const popupMessages = validationError
    ? [
        {
          id: `project-form-validation-${validationError}`,
          tone: "warning" as const,
          message: validationError,
          onDismiss: () => setValidationError(null),
        },
      ]
    : [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setValidationError("Project name is required.");
      return;
    }

    await onSubmit({
      projectId: mode === "edit" ? project?.id : undefined,
      name: trimmedName,
      targetCurrency: form.targetCurrency,
      agreedRateFirst: form.agreedRateFirst,
    });
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.modalCard}>
        <PopupMessages messages={popupMessages} />
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <label>
            <span>Project name</span>
            <input
              value={form.name}
              maxLength={50}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Lunch team"
            />
          </label>

          <label>
            <span>Target currency</span>
            <select
              value={form.targetCurrency}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  targetCurrency: event.target.value,
                }))
              }
            >
              <option value="TWD">TWD</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </label>

          <label className={styles.switchRow}>
            <span>Agreed rate first</span>
            <input
              type="checkbox"
              checked={form.agreedRateFirst}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  agreedRateFirst: event.target.checked,
                }))
              }
            />
          </label>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : mode === "create"
                ? "Create Project"
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
