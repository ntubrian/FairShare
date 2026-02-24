import React, { FormEvent, useEffect, useState } from "react";
import { PopupMessages } from "../../../components/PopupMessages";
import styles from "../Dashboard.module.scss";

type JoinProjectModalProps = {
  open: boolean;
  busy: boolean;
  prefillValue?: string;
  onClose: () => void;
  onJoin: (rawValue: string) => Promise<void>;
};

const looksLikeJoinLink = (value: string) =>
  value.includes("://") ||
  value.startsWith("/join") ||
  value.startsWith("/invite");

export const JoinProjectModal = ({
  open,
  busy,
  prefillValue = "",
  onClose,
  onJoin,
}: JoinProjectModalProps) => {
  const [shareLink, setShareLink] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValidationError(null);
    const normalized = prefillValue.trim();
    if (!normalized) {
      setShareLink("");
      setInviteCode("");
      return;
    }

    if (looksLikeJoinLink(normalized)) {
      setShareLink(normalized);
      setInviteCode("");
      return;
    }

    setInviteCode(normalized);
    setShareLink("");
  }, [open, prefillValue]);

  if (!open) {
    return null;
  }

  const popupMessages = validationError
    ? [
        {
          id: `join-form-validation-${validationError}`,
          tone: "warning" as const,
          message: validationError,
          onDismiss: () => setValidationError(null),
        },
      ]
    : [];

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
        <PopupMessages messages={popupMessages} />
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
