import { FormEvent, useState } from "react";
import styles from "../Dashboard.module.scss";

type JoinProjectModalProps = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onJoin: (rawValue: string) => Promise<void>;
};

export const JoinProjectModal = ({
  open,
  busy,
  onClose,
  onJoin,
}: JoinProjectModalProps) => {
  const [shareLink, setShareLink] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    const value = shareLink.trim() || inviteCode.trim();
    if (!value) {
      setValidationError("Please provide a share link or invite code.");
      return;
    }
    await onJoin(value);
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Join project"
    >
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h3>Join Project</h3>
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
            <span>Share link</span>
            <input
              value={shareLink}
              onChange={(event) => setShareLink(event.target.value)}
              placeholder="https://fairshare.app/join?code=..."
            />
          </label>

          <p className={styles.hintLine}>or</p>

          <label>
            <span>Invite code</span>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Enter 6-10 character code"
            />
          </label>

          {validationError ? (
            <p className={styles.errorInline}>{validationError}</p>
          ) : null}

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
              {busy ? "Joining..." : "Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
