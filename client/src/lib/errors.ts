export const toFriendlyError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Unexpected error";
  }

  const maybeError = error as { message?: unknown };
  const message =
    typeof maybeError.message === "string" ? maybeError.message : "";
  if (message.includes("UNAUTHENTICATED")) {
    return "Authentication required. Please continue with Google sign-in.";
  }

  return message || "Unexpected error";
};
