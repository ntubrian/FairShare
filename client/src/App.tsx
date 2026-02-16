import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { AuthScreen } from "./features/auth/AuthScreen";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import type {
  DashboardProjectPage,
  ProjectFormInput,
} from "./features/dashboard/types";
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

export default function App() {
  const apolloClient = useApolloClient();
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

  const isAuthenticated = Boolean(viewerData?.viewer);
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

  const { googleReady } = useGoogleSignIn({
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
        inviteLink: item.inviteLink,
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
  }, [page, projectPageData]);

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
    async (executor: () => Promise<void>) => {
      setActionBusy(true);
      setError(null);
      try {
        await executor();
        await refetchProjectPage(projectQueryVars);
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        setError(toFriendlyError(err));
        throw err;
      } finally {
        setActionBusy(false);
      }
    },
    [projectQueryVars, refetchProjectPage]
  );

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
    const handleUnauthenticated = async () => {
      authStorage.clearAll();
      setAuthHint(false);
      setLastSyncedAt(null);
      await apolloClient.clearStore();
    };

    window.addEventListener("fairshare:unauthenticated", handleUnauthenticated);
    return () => {
      window.removeEventListener(
        "fairshare:unauthenticated",
        handleUnauthenticated
      );
    };
  }, [apolloClient]);

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
    await runProjectMutation(async () => {
      await joinProject({
        variables: { inviteCode },
      });
    });
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

  if (!isAuthenticated) {
    return (
      <AuthScreen
        googleClientConfigured={Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID)}
        googleReady={googleReady}
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

  return (
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
      onArchiveProject={onArchiveProject}
      onDeleteProject={onDeleteProject}
      onLeaveProject={onLeaveProject}
      error={error ?? undefined}
    />
  );
}
