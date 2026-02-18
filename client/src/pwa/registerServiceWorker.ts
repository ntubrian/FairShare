const enableInDev = process.env.REACT_APP_ENABLE_SW === "true";

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  if (process.env.NODE_ENV !== "production" && !enableInDev) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/sw.js`)
      .catch((error) => {
        console.error("Service worker registration failed.", error);
      });
  });
};
