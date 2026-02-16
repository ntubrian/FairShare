import styles from "../Dashboard.module.scss";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
        </div>
        <p className={styles.hintLine}>{description}</p>
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
