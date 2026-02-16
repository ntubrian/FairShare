import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthScreen } from "./features/auth/AuthScreen";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import type {
  DashboardProjectPage,
  ProjectFormInput,
} from "./features/dashboard/types";
import { resolveInviteCode } from "./features/dashboard/utils";
import { ExpensesScreen } from "./features/expenses/ExpensesScreen";
import styles from "./App.module.scss";
import { authStorage, graphqlEndpoint } from "./graphql/apolloClient";
import {
  ArchiveProjectDocument,
  CreateProjectDocument,
  DeleteProjectDocument,
  HealthDocument,
  JoinProjectDocument,
  LeaveProjectDocument,
  ProjectSummariesDocument,
  UpdateProjectDocument,
  ViewerDocument,
} from "./graphql/generated";
import { useGoogleSignIn } from "./hooks/useGoogleSignIn";
import { toFriendlyError } from "./lib/errors";
import { useInstallPrompt } from "./pwa/useInstallPrompt";

const PAGE_SIZE = 6;

const EMPTY_PAGE: DashboardProjectPage = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

type JoinFeedbackTone = "success" | "info" | "error";

type JoinFeedback = {
  tone: JoinFeedbackTone;
  message: string;
  actionLabel?: string;
  actionType?: "RETRY_LINK" | "OPEN_JOIN";
  inviteCode?: string;
};

type JoinOutcome = {
  status: "joined" | "already_member";
  projectName: string;
};

const getInviteCodeFromPath = (pathname: string, search: string) => {
  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0] ?? "";
  const isJoinPath = root === "join" || root === "invite";
  if (!isJoinPath) {
    return "";
  }

  const fromPath = segments[1] ?? "";
  if (fromPath) {
    return resolveInviteCode(fromPath);
  }

  const params = new URLSearchParams(search);
  return resolveInviteCode(params.get("code") ?? "");
};

export default function App() {
  const apolloClient = useApolloClient();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const [health, setHealth] = useState("loading...");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authHint, setAuthHint] = useState(() =>
    authStorage.hasAuthCredentials()
  );
  const [devUserIdInput, setDevUserIdInput] = useState(() =>
    authStorage.getDevUserId()
  );
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [consumedInviteCode, setConsumedInviteCode] = useState("");
  const [joinFeedback, setJoinFeedback] = useState<JoinFeedback | null>(null);
  const [openJoinSignal, setOpenJoinSignal] = useState(0);
  const [inviteLinkJoinPendingCount, setInviteLinkJoinPendingCount] =
    useState(0);

  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const showDevBypass = process.env.REACT_APP_ENABLE_DEV_BYPASS === "true";

  const {
    data: healthData,
    error: healthError,
    refetch: refetchHealth,
  } = useQuery(HealthDocument, {
    fetchPolicy: "network-only",
  });

  const {
    data: viewerData,
    loading: viewerLoading,
    error: viewerError,
    refetch: refetchViewer,
  } = useQuery(ViewerDocument, {
    skip: !authHint,
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });

  const isAuthenticated = authHint && Boolean(viewerData?.viewer);
  const isAuthRoute = location.pathname === "/auth";
  const expenseRouteMatch = useMemo(
    () => location.pathname.match(/^\/projects\/([^/]+)\/expenses\/?$/),
    [location.pathname]
  );
  const expenseProjectId = useMemo(() => {
    const raw = expenseRouteMatch?.[1];
    if (!raw) {
      return "";
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [expenseRouteMatch]);
  const isExpensesRoute = Boolean(expenseProjectId);
  const inviteCodeFromLink = useMemo(
    () => getInviteCodeFromPath(location.pathname, location.search),
    [location.pathname, location.search]
  );
  const isAuthChecking = authHint && (viewerLoading || initializing);
  const inviteLinkBusy = inviteLinkJoinPendingCount > 0;
  const inviteBaseUrl = useMemo(() => {
    const configured = process.env.REACT_APP_INVITE_BASE_URL?.trim();
    if (configured) {
      return configured.replace(/\/+$/, "");
    }
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:3000";
  }, []);
  const toInviteLink = useCallback(
    (inviteCode: string) =>
      `${inviteBaseUrl}/join?code=${encodeURIComponent(inviteCode)}`,
    [inviteBaseUrl]
  );
  const projectQueryVars = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || null,
    }),
    [page, search]
  );

  const {
    data: projectPageData,
    loading: projectLoading,
    error: projectError,
    refetch: refetchProjectPage,
  } = useQuery(ProjectSummariesDocument, {
    skip: !isAuthenticated,
    fetchPolicy: "network-only",
    errorPolicy: "all",
    variables: projectQueryVars,
  });

  const [createProject] = useMutation(CreateProjectDocument);
  const [updateProject] = useMutation(UpdateProjectDocument);
  const [joinProject] = useMutation(JoinProjectDocument);
  const [archiveProject] = useMutation(ArchiveProjectDocument);
  const [deleteProject] = useMutation(DeleteProjectDocument);
  const [leaveProject] = useMutation(LeaveProjectDocument);

  const onGoogleCredential = useCallback(
    async (credential: string) => {
      authStorage.setGoogleIdToken(credential);
      authStorage.clearDevUserId();
      setAuthHint(true);
      setError(null);
      await apolloClient.resetStore();
    },
    [apolloClient]
  );

  const { googleReady, googleError } = useGoogleSignIn({
    clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    targetRef: googleButtonRef,
    enabled: !isAuthenticated,
    onCredential: onGoogleCredential,
  });

  const projectPage: DashboardProjectPage = useMemo(() => {
    const pageResult = projectPageData?.projectSummaries;
    if (!pageResult) {
      return {
        ...EMPTY_PAGE,
        page,
      };
    }
    return {
      items: pageResult.items.map((item) => ({
        id: item.id,
        name: item.name,
        targetCurrency: item.targetCurrency,
        agreedRateFirst: item.agreedRateFirst,
        status: item.status,
        inviteCode: item.inviteCode,
        inviteLink: toInviteLink(item.inviteCode),
        memberCount: item.memberCount,
        viewerRole: item.viewerRole,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      page: pageResult.page,
      pageSize: pageResult.pageSize,
      total: pageResult.total,
      totalPages: pageResult.totalPages,
      hasNextPage: pageResult.hasNextPage,
      hasPreviousPage: pageResult.hasPreviousPage,
    };
  }, [page, projectPageData, toInviteLink]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const healthResult = await refetchHealth();
      setHealth(healthResult.data?.health ?? "ok");

      if (!authStorage.hasAuthCredentials()) {
        setInitializing(false);
        return;
      }

      const viewerResult = await refetchViewer();
      const authenticated = Boolean(viewerResult.data?.viewer);
      if (!authenticated) {
        setInitializing(false);
        return;
      }

      await refetchProjectPage(projectQueryVars);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setRefreshing(false);
      setInitializing(false);
    }
  }, [projectQueryVars, refetchHealth, refetchProjectPage, refetchViewer]);

  const runProjectMutation = useCallback(
    async (
      executor: () => Promise<void>,
      options?: { suppressError?: boolean }
    ) => {
      setActionBusy(true);
      setError(null);
      try {
        await executor();
        await refetchProjectPage(projectQueryVars);
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        if (!options?.suppressError) {
          setError(toFriendlyError(err));
        }
        throw err;
      } finally {
        setActionBusy(false);
      }
    },
    [projectQueryVars, refetchProjectPage]
  );

  const joinProjectByCode = useCallback(
    async (inviteCode: string): Promise<JoinOutcome> => {
      const normalizedInviteCode = inviteCode.trim().toUpperCase();
      let joinedProjectId = "";

      const baselineItems = projectPageData?.projectSummaries?.items ?? [];
      let beforeProjectIds = new Set(
        baselineItems.map((project) => project.id)
      );

      if (beforeProjectIds.size === 0 && isAuthenticated) {
        try {
          const beforeResult = await refetchProjectPage(projectQueryVars);
          const beforeItems = beforeResult.data?.projectSummaries?.items ?? [];
          beforeProjectIds = new Set(beforeItems.map((project) => project.id));
        } catch {
          // keep current snapshot when baseline fetch fails
        }
      }

      await runProjectMutation(
        async () => {
          const joinResult = await joinProject({
            variables: { inviteCode: normalizedInviteCode },
          });
          joinedProjectId = joinResult.data?.joinProject.id ?? "";
          if (!joinedProjectId) {
            throw new Error("Join project response missing project id.");
          }
        },
        { suppressError: true }
      );

      const refreshed = await refetchProjectPage(projectQueryVars);
      const refreshedItems = refreshed.data?.projectSummaries?.items ?? [];
      const joinedProject = refreshedItems.find(
        (project) => project.id === joinedProjectId
      );

      return {
        status: beforeProjectIds.has(joinedProjectId)
          ? "already_member"
          : "joined",
        projectName: joinedProject?.name ?? "Project",
      };
    },
    [
      isAuthenticated,
      joinProject,
      projectPageData,
      projectQueryVars,
      refetchProjectPage,
      runProjectMutation,
    ]
  );

  const joinViaInviteLink = useCallback(
    async (inviteCode: string) => {
      setError(null);
      setInviteLinkJoinPendingCount((count) => count + 1);
      try {
        const outcome = await joinProjectByCode(inviteCode);
        if (outcome.status === "already_member") {
          setJoinFeedback({
            tone: "info",
            message: "You are already in this project.",
          });
        } else {
          setJoinFeedback({
            tone: "success",
            message: `Joined project: ${outcome.projectName}`,
          });
        }
        navigate("/projects", { replace: true });
      } finally {
        setInviteLinkJoinPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [joinProjectByCode, navigate]
  );

  const withInviteBusyOverlay = (content: React.ReactNode) => (
    <>
      {content}
      {inviteLinkBusy ? (
        <div
          className={styles.inviteLinkBusyOverlay}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.inviteLinkBusyCard}>
            <span className={styles.inviteLinkBusySpinner} aria-hidden="true" />
            <p>Joining project from invitation link...</p>
          </div>
        </div>
      ) : null}
    </>
  );

  const onJoinFeedbackAction = useCallback(() => {
    if (!joinFeedback) {
      return;
    }
    if (joinFeedback.actionType === "OPEN_JOIN") {
      setJoinFeedback(null);
      setPage(1);
      navigate("/projects", { replace: true });
      setOpenJoinSignal((current) => current + 1);
      return;
    }
    if (joinFeedback.actionType === "RETRY_LINK" && joinFeedback.inviteCode) {
      setError(null);
      void joinViaInviteLink(joinFeedback.inviteCode).catch((err) => {
        setJoinFeedback({
          tone: "error",
          message: toFriendlyError(err) || "Invalid or expired invite code.",
          actionLabel: "Retry",
          actionType: "RETRY_LINK",
          inviteCode: joinFeedback.inviteCode,
        });
      });
    }
  }, [joinFeedback, joinViaInviteLink, navigate]);

  const onDismissJoinFeedback = useCallback(() => {
    setJoinFeedback(null);
  }, []);

  useEffect(() => {
    if (!healthData?.health) {
      return;
    }
    setHealth(healthData.health);
  }, [healthData]);

  useEffect(() => {
    if (!healthError) {
      return;
    }
    setHealth("error");
    setError(toFriendlyError(healthError));
  }, [healthError]);

  useEffect(() => {
    if (!projectPageData?.projectSummaries) {
      return;
    }
    setLastSyncedAt(new Date().toISOString());
  }, [projectPageData]);

  useEffect(() => {
    if (!projectError) {
      return;
    }
    setError(toFriendlyError(projectError));
  }, [projectError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void refresh();
  }, [authHint, refresh]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!joinFeedback) {
      return;
    }
    if (joinFeedback.tone === "error") {
      return;
    }
    const timer = window.setTimeout(() => {
      setJoinFeedback((current) => {
        if (!current || current.tone === "error") {
          return current;
        }
        return null;
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [joinFeedback]);

  useEffect(() => {
    if (isAuthChecking) {
      return;
    }

    if (isAuthenticated) {
      if (isAuthRoute) {
        const next = new URLSearchParams(location.search).get("next");
        if (next && next.startsWith("/")) {
          navigate(next, { replace: true });
        } else {
          navigate("/projects", { replace: true });
        }
      }
      return;
    }

    if (!isAuthRoute) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [
    isAuthChecking,
    isAuthenticated,
    isAuthRoute,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (!inviteCodeFromLink) {
      return;
    }
    if (inviteCodeFromLink === consumedInviteCode) {
      return;
    }

    setConsumedInviteCode(inviteCodeFromLink);
    void joinViaInviteLink(inviteCodeFromLink).catch((err) => {
      setJoinFeedback({
        tone: "error",
        message: toFriendlyError(err) || "Invalid or expired invite code.",
        actionLabel: "Retry",
        actionType: "RETRY_LINK",
        inviteCode: inviteCodeFromLink,
      });
      navigate("/projects", { replace: true });
    });
  }, [
    consumedInviteCode,
    inviteCodeFromLink,
    isAuthenticated,
    joinViaInviteLink,
    navigate,
  ]);

  useEffect(() => {
    const handleUnauthenticated = async () => {
      authStorage.clearAll();
      setAuthHint(false);
      setLastSyncedAt(null);
      setConsumedInviteCode("");
      setJoinFeedback(null);
      navigate("/auth", { replace: true });
      await apolloClient.clearStore();
    };

    window.addEventListener("fairshare:unauthenticated", handleUnauthenticated);
    return () => {
      window.removeEventListener(
        "fairshare:unauthenticated",
        handleUnauthenticated
      );
    };
  }, [apolloClient, navigate]);

  const onUseDevUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = devUserIdInput.trim();
    if (!value) {
      return;
    }

    authStorage.setDevUserId(value);
    authStorage.clearGoogleIdToken();
    setAuthHint(true);
    setError(null);
    await apolloClient.resetStore();
  };

  const onLogout = async () => {
    authStorage.clearAll();
    setAuthHint(false);
    setLastSyncedAt(null);
    setConsumedInviteCode("");
    setJoinFeedback(null);
    navigate("/auth", { replace: true });
    await apolloClient.clearStore();
  };

  const onCreateProject = async (input: ProjectFormInput) => {
    if (!isOnline) {
      setError("You are offline. Reconnect before creating a project.");
      throw new Error("OFFLINE");
    }

    await runProjectMutation(async () => {
      await createProject({
        variables: {
          name: input.name,
          targetCurrency: input.targetCurrency,
          agreedRateFirst: input.agreedRateFirst,
        },
      });
    });
  };

  const onUpdateProject = async (
    input: ProjectFormInput & { projectId: string }
  ) => {
    await runProjectMutation(async () => {
      await updateProject({
        variables: {
          projectId: input.projectId,
          name: input.name,
          targetCurrency: input.targetCurrency,
          agreedRateFirst: input.agreedRateFirst,
        },
      });
    });
  };

  const onJoinProject = async (inviteCode: string) => {
    setError(null);
    try {
      const outcome = await joinProjectByCode(inviteCode);
      if (outcome.status === "already_member") {
        setJoinFeedback({
          tone: "info",
          message: "You are already in this project.",
        });
      } else {
        setJoinFeedback({
          tone: "success",
          message: `Joined project: ${outcome.projectName}`,
        });
      }
    } catch (err) {
      setJoinFeedback({
        tone: "error",
        message: toFriendlyError(err) || "Invalid or expired invite code.",
        actionLabel: "Open join",
        actionType: "OPEN_JOIN",
      });
      throw err;
    }
  };

  const onArchiveProject = async (projectId: string) => {
    await runProjectMutation(async () => {
      await archiveProject({
        variables: { projectId },
      });
    });
  };

  const onDeleteProject = async (projectId: string) => {
    await runProjectMutation(async () => {
      await deleteProject({
        variables: { projectId },
      });
    });
  };

  const onLeaveProject = async (projectId: string) => {
    await runProjectMutation(async () => {
      await leaveProject({
        variables: { projectId },
      });
    });
  };

  const onInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setError(null);
    }
  };

  if (isAuthChecking) {
    return withInviteBusyOverlay(
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <p>Restoring session...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return withInviteBusyOverlay(
      <AuthScreen
        googleClientConfigured={Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID)}
        googleReady={googleReady}
        googleError={googleError}
        googleButtonRef={googleButtonRef}
        canInstall={canInstall}
        onInstall={onInstall}
        showDevBypass={showDevBypass}
        devUserIdInput={devUserIdInput}
        onDevUserIdInputChange={setDevUserIdInput}
        onUseDevUser={onUseDevUser}
        viewerLoading={viewerLoading || initializing}
        viewerError={viewerError ? toFriendlyError(viewerError) : undefined}
        error={error ?? undefined}
      />
    );
  }

  if (isExpensesRoute) {
    return withInviteBusyOverlay(
      <ExpensesScreen
        projectId={expenseProjectId}
        viewerId={viewerData?.viewer.id ?? ""}
        viewerName={viewerData?.viewer.displayName ?? ""}
        onBack={() => navigate("/projects")}
        onLogout={onLogout}
      />
    );
  }

  return withInviteBusyOverlay(
    <DashboardScreen
      viewerName={viewerData?.viewer.displayName ?? ""}
      viewerRole={viewerData?.viewer.accountRole ?? "VIEWER"}
      refreshing={refreshing}
      actionBusy={actionBusy}
      onRefresh={refresh}
      onLogout={onLogout}
      canInstall={canInstall}
      installed={installed}
      onInstall={onInstall}
      isOnline={isOnline}
      health={health}
      lastSyncedAt={lastSyncedAt}
      endpoint={graphqlEndpoint}
      projectPage={projectPage}
      projectLoading={projectLoading}
      search={searchInput}
      onSearchChange={setSearchInput}
      onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
      onCreateProject={onCreateProject}
      onUpdateProject={onUpdateProject}
      onJoinProject={onJoinProject}
      onOpenProject={(projectId) =>
        navigate(`/projects/${encodeURIComponent(projectId)}/expenses`)
      }
      onArchiveProject={onArchiveProject}
      onDeleteProject={onDeleteProject}
      onLeaveProject={onLeaveProject}
      joinFeedback={joinFeedback}
      onJoinFeedbackAction={onJoinFeedbackAction}
      onDismissJoinFeedback={onDismissJoinFeedback}
      openJoinSignal={openJoinSignal}
      error={error ?? undefined}
    />
  );
}
