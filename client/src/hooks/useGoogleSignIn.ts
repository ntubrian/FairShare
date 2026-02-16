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
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
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

export const useGoogleSignIn = ({
  clientId,
  targetRef,
  target,
  enabled,
  onCredential,
}: UseGoogleSignInArgs) => {
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!enabled || !clientId) {
      setGoogleReady(false);
      return;
    }

    const renderGoogleButton = () => {
      const targetElement = targetRef?.current ?? target ?? null;
      if (!window.google || !targetElement) {
        return;
      }

      targetElement.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            return;
          }
          await onCredential(response.credential);
        },
      });
      window.google.accounts.id.renderButton(targetElement, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 280,
      });
      setGoogleReady(true);
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const scriptId = "google-identity-service";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", renderGoogleButton);
    return () => {
      script?.removeEventListener("load", renderGoogleButton);
    };
  }, [clientId, enabled, onCredential, targetRef, target]);

  return { googleReady };
};
