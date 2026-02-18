import React, { FormEvent, useEffect, useState } from "react";
import styles from "./AuthScreen.module.scss";

type AuthScreenProps = {
  googleClientConfigured: boolean;
  googleReady: boolean;
  googleError?: string | null;
  googleButtonRef: React.RefObject<HTMLDivElement>;
  onEntryIntent: (intent: "create" | "join") => void;
  canInstall: boolean;
  onInstall: () => Promise<void> | void;
  showDevBypass: boolean;
  devUserIdInput: string;
  onDevUserIdInputChange: (value: string) => void;
  onUseDevUser: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  viewerLoading: boolean;
  viewerError?: string;
  error?: string;
};

export const AuthScreen = ({
  googleClientConfigured,
  googleReady,
  googleError,
  googleButtonRef,
  onEntryIntent,
  canInstall,
  onInstall,
  showDevBypass,
  devUserIdInput,
  onDevUserIdInputChange,
  onUseDevUser,
  viewerLoading,
  viewerError,
  error,
}: AuthScreenProps) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [entryHint, setEntryHint] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    if (!entryHint) {
      return;
    }
    const timer = window.setTimeout(() => setEntryHint(null), 2400);
    return () => window.clearTimeout(timer);
  }, [entryHint]);

  const onClickEntryAction = (intent: "create" | "join") => {
    onEntryIntent(intent);
    setEntryHint(intent);
    googleButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <main className={`${styles.appShell} ${styles.authShell}`}>
      <section
        className={`${styles.card} ${styles.authCard} ${styles.authHeroCard}`}
      >
        <div className={styles.authBrandRow}>
          <div className={styles.authLogoMark} aria-hidden>
            <span>F</span>
            <span>S</span>
            <i />
          </div>
          <div>
            <h1 className={styles.authBrandTitle}>FairShare</h1>
            <p className={styles.authSubtitle}>Split lunches, settle fast.</p>
          </div>
        </div>

        <p className={styles.authHighlight}>
          Quick, clean, multi-currency splits.
        </p>

        <div className={styles.authCurrencyGrid}>
          <span>USD</span>
          <span>TWD</span>
          <span>JPY</span>
          <span>EUR</span>
        </div>

        <div
          className={`${styles.authGoogleWrapCta} ${
            entryHint ? styles.authGoogleWrapCtaHighlight : ""
          }`}
        >
          {googleClientConfigured ? (
            <>
              <div ref={googleButtonRef} />
              {googleError ? (
                <p className={styles.errorInline}>{googleError}</p>
              ) : null}
              {!googleReady && !googleError ? (
                <p className={styles.hintLine}>Loading Google sign-in...</p>
              ) : null}
            </>
          ) : (
            <p className={styles.hintLine}>
              Missing <code>REACT_APP_GOOGLE_CLIENT_ID</code>. Configure it to
              enable Google login.
            </p>
          )}
        </div>

        <div className={styles.authEntryActions}>
          <button
            type="button"
            className={`${styles.entryActionBtn} ${
              entryHint === "create" ? styles.entryActionBtnActive : ""
            }`}
            onClick={() => onClickEntryAction("create")}
          >
            <span className={styles.dot} />
            Create Project
          </button>
          <button
            type="button"
            className={`${styles.entryActionBtn} ${
              entryHint === "join" ? styles.entryActionBtnActive : ""
            }`}
            onClick={() => onClickEntryAction("join")}
          >
            <span className={styles.dot} />
            Join Project
          </button>
        </div>
        {entryHint ? (
          <p className={styles.entryHintBanner}>
            Sign in with Google first, then{" "}
            {entryHint === "create"
              ? "create a project from the dashboard."
              : "join using an invite code from the dashboard."}
          </p>
        ) : null}

        <button
          type="button"
          className={`${styles.ghostButton} ${styles.authGuideBtn}`}
          onClick={() => setGuideOpen(true)}
        >
          PWA install guide
        </button>

        {showDevBypass ? (
          <details className={styles.devAuthDetails}>
            <summary>Developer bypass</summary>
            <form className={styles.devAuthForm} onSubmit={onUseDevUser}>
              <input
                value={devUserIdInput}
                onChange={(event) => onDevUserIdInputChange(event.target.value)}
                placeholder="Paste app_user.id UUID"
              />
              <button type="submit">Use Dev User</button>
            </form>
            <p className={styles.hintLine}>
              Requires server env <code>ALLOW_DEV_AUTH_BYPASS=true</code>.
            </p>
          </details>
        ) : null}

        {viewerLoading ? (
          <p className={styles.hintLine}>Checking session...</p>
        ) : null}
        {viewerError ? (
          <p className={styles.errorInline}>{viewerError}</p>
        ) : null}
        {error ? <p className={styles.errorInline}>{error}</p> : null}
      </section>

      <footer className={styles.authFooterLinks}>
        <a href="#terms">Terms</a>
        <span aria-hidden>•</span>
        <a href="#privacy">Privacy</a>
      </footer>

      {guideOpen ? (
        <section
          className={styles.installGuideOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Install guide"
        >
          <div className={styles.installGuideSheet}>
            <header className={styles.installGuideHeader}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setGuideOpen(false)}
              >
                Back
              </button>
            </header>

            <div className={styles.installGuideHero}>
              <h2>Install FairShare</h2>
              <p>
                Add FairShare to your home screen for a faster, app-like
                experience.
              </p>
              <div className={styles.installGuideTags}>
                <span>Offline-ready</span>
                <span>One-tap launch</span>
                <span>Sync across devices</span>
              </div>
            </div>

            <section className={styles.installGuideBlock}>
              <h3>iPhone / iPad</h3>
              <ol>
                <li>Open in Safari.</li>
                <li>Tap Share.</li>
                <li>Tap Add to Home Screen.</li>
              </ol>
            </section>

            <section className={styles.installGuideBlock}>
              <h3>Android</h3>
              <ol>
                <li>Open in Chrome.</li>
                <li>Tap menu, then tap Install app.</li>
              </ol>
            </section>

            <footer className={styles.installGuideFooter}>
              <button
                type="button"
                onClick={() => void onInstall()}
                disabled={!canInstall}
                title={
                  !canInstall
                    ? "Install prompt unavailable on this browser right now."
                    : undefined
                }
              >
                Install
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setGuideOpen(false)}
              >
                Not now
              </button>
            </footer>
          </div>
        </section>
      ) : null}
    </main>
  );
};
