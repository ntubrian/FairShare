const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatRelativeTime = (iso: string) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return "unknown";
  }

  const diff = Date.now() - then;
  if (diff < MINUTE) {
    return "just now";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} min ago`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} hr ago`;
  }
  return `${Math.floor(diff / DAY)} day ago`;
};

export const resolveInviteCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("code");
    if (fromQuery) {
      return fromQuery.trim().toUpperCase();
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return (last ?? "").trim().toUpperCase();
  } catch {
    return trimmed.toUpperCase();
  }
};

export const canEditProject = (role: string, status: string) =>
  (role === "OWNER" || role === "EDITOR") && status !== "ARCHIVED";

export const canManageMembers = (role: string, status: string) =>
  role === "OWNER" && status !== "ARCHIVED";

export const canArchiveProject = (role: string, status: string) =>
  role === "OWNER" && status !== "ARCHIVED";

export const canDeleteProject = (role: string) => role === "OWNER";

export const canLeaveProject = (role: string) => role !== "OWNER";
