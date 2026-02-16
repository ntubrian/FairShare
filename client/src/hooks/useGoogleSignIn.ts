import { RefObject, useEffect, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            auto_select?: boolean;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type UseGoogleSignInArgs = {
  clientId?: string;
  targetRef?: RefObject<HTMLDivElement>;
  target?: HTMLDivElement | null;
  enabled: boolean;
  onCredential: (credential: string) => Promise<void> | void;
};

const GOOGLE_SCRIPT_ID = "google-identity-service";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_RENDER_RETRY_MS = 120;
const GOOGLE_RENDER_TIMEOUT_MS = 10_000;

export const useGoogleSignIn = ({
  clientId,
  targetRef,
  target,
  enabled,
  onCredential,
}: UseGoogleSignInArgs) => {
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setGoogleReady(false);
      setGoogleError(null);
      return;
    }

    if (!clientId) {
      setGoogleReady(false);
      setGoogleError("Missing REACT_APP_GOOGLE_CLIENT_ID.");
      return;
    }

    let cancelled = false;
    let promptRequested = false;
    let retryTimer: number | undefined;
    let timeoutTimer: number | undefined;

    const stopRetryTimer = () => {
      if (typeof retryTimer === "number") {
        window.clearInterval(retryTimer);
        retryTimer = undefined;
      }
    };

    const stopTimeoutTimer = () => {
      if (typeof timeoutTimer === "number") {
        window.clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
    };

    const clearTimers = () => {
      stopRetryTimer();
      stopTimeoutTimer();
    };

    const getTargetElement = () => targetRef?.current ?? target ?? null;

    const renderGoogleButton = () => {
      if (cancelled) {
        return true;
      }

      const targetElement = getTargetElement();
      if (!window.google || !targetElement) {
        return false;
      }

      try {
        targetElement.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: true,
          callback: async (response) => {
            if (!response.credential) {
              if (!cancelled) {
                setGoogleError("Google sign-in did not return a credential.");
              }
              return;
            }

            try {
              await onCredential(response.credential);
            } catch (error) {
              if (cancelled) {
                return;
              }
              const message =
                error instanceof Error
                  ? error.message
                  : "Google sign-in failed.";
              setGoogleError(message);
            }
          },
        });
        window.google.accounts.id.renderButton(targetElement, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 280,
        });
        if (!promptRequested) {
          promptRequested = true;
          window.google.accounts.id.prompt();
        }
        setGoogleReady(true);
        setGoogleError(null);
        return true;
      } catch {
        setGoogleReady(false);
        setGoogleError("Failed to initialize Google sign-in.");
        return true;
      }
    };

    const scriptLoadError = () => {
      if (cancelled) {
        return;
      }
      setGoogleReady(false);
      setGoogleError("Failed to load Google sign-in script.");
      clearTimers();
    };

    let script = document.getElementById(
      GOOGLE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", renderGoogleButton);
    script.addEventListener("error", scriptLoadError);

    if (window.google) {
      renderGoogleButton();
    }

    retryTimer = window.setInterval(() => {
      const rendered = renderGoogleButton();
      if (rendered) {
        stopRetryTimer();
      }
    }, GOOGLE_RENDER_RETRY_MS);

    timeoutTimer = window.setTimeout(() => {
      const rendered = renderGoogleButton();
      if (rendered) {
        return;
      }
      setGoogleReady(false);
      setGoogleError(
        "Google sign-in is unavailable right now. Please refresh and try again."
      );
      stopRetryTimer();
    }, GOOGLE_RENDER_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimers();
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", scriptLoadError);
    };
  }, [clientId, enabled, onCredential, targetRef, target]);

  return { googleReady, googleError };
};
