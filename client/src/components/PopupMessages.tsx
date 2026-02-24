import React from "react";
import styles from "./PopupMessages.module.scss";

export type PopupTone = "error" | "warning" | "info" | "success";

export type PopupMessage = {
  id: string;
  tone: PopupTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
};

type PopupMessagesProps = {
  messages: PopupMessage[];
};

export const PopupMessages = ({ messages }: PopupMessagesProps) => {
  if (!messages.length) {
    return null;
  }

  return (
    <div className={styles.stack} role="region" aria-label="Notifications">
      {messages.map((message) => {
        const popupClassName =
          message.tone === "error"
            ? `${styles.popup} ${styles.popupError}`
            : message.tone === "warning"
            ? `${styles.popup} ${styles.popupWarning}`
            : message.tone === "info"
            ? `${styles.popup} ${styles.popupInfo}`
            : `${styles.popup} ${styles.popupSuccess}`;

        const live =
          message.tone === "error" || message.tone === "warning"
            ? "assertive"
            : "polite";
        const role =
          message.tone === "error" || message.tone === "warning"
            ? "alert"
            : "status";

        return (
          <section
            key={message.id}
            className={popupClassName}
            role={role}
            aria-live={live}
          >
            <p className={styles.message}>{message.message}</p>
            <div className={styles.actions}>
              {message.actionLabel && message.onAction ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={message.onAction}
                >
                  {message.actionLabel}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.dismissButton}
                onClick={message.onDismiss}
              >
                Clear
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
};
