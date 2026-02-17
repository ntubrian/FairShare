import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useLazyQuery,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client/react";
import {
  CalculateSettlementDocument,
  Currency,
  CreateExpenseDocument,
  DebitCreditSummaryDocument,
  ExpenseAddedDocument,
  ExpenseSplitInput,
  MemberRole,
  PdfExportPreviewDocument,
  ProjectDetailDocument,
  ProjectExpensesDocument,
  ProjectParticipantsDocument,
  ProjectStatus,
  RateSource,
  SplitMode,
} from "../../graphql/generated";
import { toFriendlyError } from "../../lib/errors";
import { formatRelativeTime } from "../dashboard/utils";
import { createSettlementPdfBlob } from "./pdfExport";
import styles from "./ExpensesScreen.module.scss";

const CURRENCY_OPTIONS = [
  Currency.Usd,
  Currency.Twd,
  Currency.Jpy,
  Currency.Eur,
];

type ExpensesScreenProps = {
  projectId: string;
  viewerId: string;
  viewerName: string;
  onBack: () => void;
  onLogout: () => Promise<void> | void;
};

type ExpenseFormState = {
  payerId: string;
  amount: string;
  currency: Currency;
  description: string;
  occurredAt: string;
  splitMode: SplitMode;
  splitRows: Record<
    string,
    {
      included: boolean;
      amount: string;
      shares: string;
    }
  >;
};

type SettlementResultState = {
  targetCurrency: Currency;
  generatedAt: string;
  rateSource: RateSource;
  instructions: Array<{
    fromParticipantName: string;
    toParticipantName: string;
    amount: number;
    currency: Currency;
  }>;
  rateSnapshot: {
    fetchedAt: string;
    rates: Array<{
      currency: Currency;
      rate: number;
    }>;
  };
};

const toDateInputValue = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const buildDefaultForm = (
  participants: Array<{ id: string }>
): ExpenseFormState => {
  const splitRows: ExpenseFormState["splitRows"] = {};
  for (const participant of participants) {
    splitRows[participant.id] = {
      included: true,
      amount: "",
      shares: "1",
    };
  }

  return {
    payerId: participants[0]?.id ?? "",
    amount: "",
    currency: Currency.Twd,
    description: "",
    occurredAt: toDateInputValue(new Date()),
    splitMode: SplitMode.Equal,
    splitRows,
  };
};

const formatDayLabel = (iso: string) => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatAmount = (amount: number) => {
  if (!Number.isFinite(amount)) {
    return "0.00";
  }
  return amount.toFixed(2);
};

const toPdfFileName = (projectName: string) => {
  const normalized =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `${normalized}-settlement-${timestamp}.pdf`;
};

export const ExpensesScreen = ({
  projectId,
  viewerId,
  viewerName,
  onBack,
  onLogout,
}: ExpensesScreenProps) => {
  const [payerFilter, setPayerFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<"ALL" | Currency>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(() =>
    buildDefaultForm([])
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const [settlementResult, setSettlementResult] =
    useState<SettlementResultState | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    data: projectData,
    loading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery(ProjectDetailDocument, {
    variables: { projectId },
    fetchPolicy: "network-only",
  });
  const {
    data: participantsData,
    loading: participantsLoading,
    error: participantsError,
    refetch: refetchParticipants,
  } = useQuery(ProjectParticipantsDocument, {
    variables: { projectId, page: 1, pageSize: 100 },
    fetchPolicy: "network-only",
  });
  const {
    data: expensesData,
    loading: expensesLoading,
    error: expensesError,
    refetch: refetchExpenses,
  } = useQuery(ProjectExpensesDocument, {
    variables: { projectId, page: 1, pageSize: 200, includeDeleted: false },
    fetchPolicy: "network-only",
  });
  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery(DebitCreditSummaryDocument, {
    variables: { projectId, includeDeleted: false },
    fetchPolicy: "network-only",
  });

  const [createExpense, { loading: createExpenseLoading }] = useMutation(
    CreateExpenseDocument
  );
  const [runCalculateSettlement, { loading: calculateSettlementLoading }] =
    useLazyQuery(CalculateSettlementDocument, {
      fetchPolicy: "network-only",
    });
  const [runPdfPreview] = useLazyQuery(PdfExportPreviewDocument, {
    fetchPolicy: "network-only",
  });

  const participants = participantsData?.participants ?? [];
  const expenses = expensesData?.expenses ?? [];
  const summary = summaryData?.debitCreditSummary;
  const project = projectData?.project;
  const viewerProjectRole =
    project?.members.find((member) => member.userId === viewerId)?.role ??
    MemberRole.Viewer;
  const isProjectArchived = project?.status === ProjectStatus.Archived;
  const canMutate =
    Boolean(project) &&
    !isProjectArchived &&
    (viewerProjectRole === MemberRole.Owner ||
      viewerProjectRole === MemberRole.Editor);

  const refreshAll = async () => {
    setLocalError(null);
    try {
      await Promise.all([
        refetchProject({ projectId }),
        refetchParticipants({ projectId, page: 1, pageSize: 100 }),
        refetchExpenses({
          projectId,
          page: 1,
          pageSize: 200,
          includeDeleted: false,
        }),
        refetchSummary({ projectId, includeDeleted: false }),
      ]);
    } catch (error) {
      setLocalError(toFriendlyError(error));
    }
  };

  useSubscription(ExpenseAddedDocument, {
    variables: { projectId },
    skip: !projectId,
    onData: ({ data }) => {
      if (!data.data?.expenseAdded) {
        return;
      }
      setRealtimeNotice("Expense list updated just now");
      void refreshAll();
    },
    onError: (error) => {
      const message = toFriendlyError(error);
      if (message) {
        setLocalError(message);
      }
    },
  });

  useEffect(() => {
    if (!realtimeNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setRealtimeNotice(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [realtimeNotice]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!accountMenuRef.current?.contains(target)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!addOpen) {
      return;
    }
    setForm((current) => {
      const nextSplitRows: ExpenseFormState["splitRows"] = {};
      for (const participant of participants) {
        nextSplitRows[participant.id] = current.splitRows[participant.id] ?? {
          included: true,
          amount: "",
          shares: "1",
        };
      }
      const nextPayerId = participants.some(
        (participant) => participant.id === current.payerId
      )
        ? current.payerId
        : participants[0]?.id ?? "";
      return {
        ...current,
        payerId: nextPayerId,
        splitRows: nextSplitRows,
      };
    });
  }, [addOpen, participants]);

  useEffect(() => {
    if (!canMutate && addOpen) {
      setAddOpen(false);
    }
  }, [addOpen, canMutate]);

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((item) => {
        if (payerFilter !== "ALL" && item.payerId !== payerFilter) {
          return false;
        }
        if (currencyFilter !== "ALL" && item.currency !== currencyFilter) {
          return false;
        }
        return true;
      }),
    [currencyFilter, expenses, payerFilter]
  );

  const groupedExpenses = useMemo(() => {
    const groups = new Map<
      string,
      {
        dayLabel: string;
        items: typeof filteredExpenses;
      }
    >();
    for (const item of filteredExpenses) {
      const dayKey = new Date(item.occurredAt).toISOString().slice(0, 10);
      const current = groups.get(dayKey);
      if (current) {
        current.items.push(item);
      } else {
        groups.set(dayKey, {
          dayLabel: formatDayLabel(item.occurredAt),
          items: [item],
        });
      }
    }
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([, value]) => value);
  }, [filteredExpenses]);

  const latestExpenseSync = useMemo(() => {
    let latestTimestamp = 0;
    for (const expense of expenses) {
      const timestamp = new Date(
        expense.updatedAt || expense.createdAt
      ).getTime();
      if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
      }
    }
    return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null;
  }, [expenses]);

  const settlementRateSource =
    settlementResult?.rateSource ??
    (project?.agreedRateFirst ? RateSource.Agreed : RateSource.Live);

  const rateSourceLabel =
    settlementRateSource === RateSource.Live ? "Live API" : "Agreed rate";

  const rateSnapshotText = useMemo(() => {
    if (!settlementResult) {
      return "--";
    }
    const usdRate = settlementResult.rateSnapshot.rates.find(
      (rate) => rate.currency === Currency.Usd
    );
    if (usdRate) {
      return `1 USD = ${usdRate.rate.toFixed(4)} ${
        settlementResult.targetCurrency
      }`;
    }
    const first = settlementResult.rateSnapshot.rates[0];
    if (!first) {
      return "--";
    }
    return `1 ${first.currency} = ${first.rate.toFixed(4)} ${
      settlementResult.targetCurrency
    }`;
  }, [settlementResult]);

  const settlementHint = settlementError
    ? "Unable to calculate settlement. Retry to continue."
    : settlementRateSource === RateSource.Live
    ? "Using Live API rates (only when no agreed rate exists)."
    : "Agreed rate will be used (priority over Live API).";

  const screenError = useMemo(() => {
    const firstError =
      projectError || participantsError || expensesError || summaryError;
    if (!firstError) {
      return localError;
    }
    return toFriendlyError(firstError) || localError;
  }, [
    projectError,
    participantsError,
    expensesError,
    summaryError,
    localError,
  ]);

  const onSubmitExpense = async () => {
    setLocalError(null);
    if (!canMutate) {
      setLocalError("This project is read-only for your role.");
      return;
    }
    const amount = Number(form.amount);
    const occurredAt = new Date(form.occurredAt);
    const selectedParticipantIds = participants
      .map((participant) => participant.id)
      .filter((participantId) => form.splitRows[participantId]?.included);

    if (!form.payerId) {
      setLocalError("Please select a payer.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError("Amount must be greater than 0.");
      return;
    }
    if (!Number.isFinite(occurredAt.getTime())) {
      setLocalError("Please pick a valid expense date.");
      return;
    }
    if (!selectedParticipantIds.length) {
      setLocalError("Select at least one participant for split.");
      return;
    }

    let splits: ExpenseSplitInput[] | undefined;

    if (form.splitMode === SplitMode.Equal) {
      splits = selectedParticipantIds.map((participantId) => ({
        participantId,
      }));
    }

    if (form.splitMode === SplitMode.Exact) {
      let exactTotal = 0;
      const exactSplits: ExpenseSplitInput[] = [];
      for (const participantId of selectedParticipantIds) {
        const splitAmount = Number(form.splitRows[participantId]?.amount ?? "");
        if (!Number.isFinite(splitAmount) || splitAmount <= 0) {
          setLocalError(
            "Exact split requires amount > 0 for each selected participant."
          );
          return;
        }
        exactTotal += splitAmount;
        exactSplits.push({
          participantId,
          amount: splitAmount,
        });
      }
      if (Math.abs(exactTotal - amount) > 0.01) {
        setLocalError("Exact split amounts must equal total amount.");
        return;
      }
      splits = exactSplits;
    }

    if (form.splitMode === SplitMode.Shares) {
      const shareSplits: ExpenseSplitInput[] = [];
      for (const participantId of selectedParticipantIds) {
        const shares = Number(form.splitRows[participantId]?.shares ?? "");
        if (!Number.isFinite(shares) || shares <= 0) {
          setLocalError(
            "Shares split requires shares > 0 for each selected participant."
          );
          return;
        }
        shareSplits.push({
          participantId,
          shares,
        });
      }
      splits = shareSplits;
    }

    try {
      await createExpense({
        variables: {
          projectId,
          payerId: form.payerId,
          amount,
          currency: form.currency,
          description: form.description.trim() || null,
          occurredAt: occurredAt.toISOString(),
          splitMode: form.splitMode,
          splits,
        },
      });
      setAddOpen(false);
      setForm(buildDefaultForm(participants));
      await refreshAll();
    } catch (error) {
      setLocalError(toFriendlyError(error));
    }
  };

  const onCalculateSettlement = async () => {
    setSettlementError(null);
    try {
      const result = await runCalculateSettlement({
        variables: {
          projectId,
          includeDeleted: false,
        },
      });
      const calculated = result.data?.calculateSettlement;
      if (!calculated) {
        throw new Error("Settlement calculation response is empty.");
      }

      setSettlementResult({
        targetCurrency: calculated.targetCurrency,
        generatedAt: calculated.generatedAt,
        rateSource: calculated.rateSource,
        instructions: calculated.instructions.map((instruction) => ({
          fromParticipantName: instruction.fromParticipant.name,
          toParticipantName: instruction.toParticipant.name,
          amount: instruction.amount,
          currency: instruction.currency,
        })),
        rateSnapshot: {
          fetchedAt: calculated.rateSnapshot.fetchedAt,
          rates: calculated.rateSnapshot.rates.map((rate) => ({
            currency: rate.currency,
            rate: rate.rate,
          })),
        },
      });
      setSettlementOpen(true);
    } catch (error) {
      setSettlementError(
        toFriendlyError(error) || "Unable to calculate settlement."
      );
    }
  };

  const onExportPdf = async () => {
    if (!project || !settlementResult) {
      return;
    }

    setExportingPdf(true);
    setSettlementError(null);

    try {
      const previewResult = await runPdfPreview({
        variables: {
          projectId,
          includeSoftDeleted: false,
        },
      });

      if (!previewResult.data?.pdfExportPreview) {
        throw new Error("PDF preview failed.");
      }

      const blob = await createSettlementPdfBlob({
        projectName: project.name,
        exportTime: new Date().toISOString(),
        targetCurrency: settlementResult.targetCurrency,
        rateSource: settlementResult.rateSource,
        rateFetchedAt: settlementResult.rateSnapshot.fetchedAt,
        rateRows: settlementResult.rateSnapshot.rates,
        instructions: settlementResult.instructions,
        includeSoftDeleted: false,
        expenses: expenses.map((expense) => ({
          payerName: expense.payer?.name ?? "Unknown payer",
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description ?? null,
          occurredAt: expense.occurredAt,
          deletedAt: expense.deletedAt ?? null,
          splits: expense.splits.map((split) => ({
            participantName: split.participant?.name ?? "Unknown participant",
            amount: split.amount ?? null,
            shares: split.shares ?? null,
          })),
        })),
      });

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = toPdfFileName(project.name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setSettlementError(toFriendlyError(error) || "Unable to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const onLogoutFromMenu = async () => {
    setAccountMenuOpen(false);
    await onLogout();
  };

  const isLoading =
    projectLoading || participantsLoading || expensesLoading || summaryLoading;
  const disableMutationControls = createExpenseLoading || !canMutate;

  return (
    <main className={styles.screen}>
      <header className={styles.headerCard}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to projects"
        >
          ←
        </button>
        <div className={styles.headerTitle}>
          <h1>{project?.name ?? "Project"}</h1>
          <p>Expenses</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.syncButton}
            onClick={() => void refreshAll()}
          >
            Synced
          </button>
          <div className={styles.accountMenu} ref={accountMenuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              {viewerName.charAt(0).toUpperCase() || "U"}
            </button>
            {accountMenuOpen ? (
              <div
                className={styles.accountDropdown}
                role="menu"
                aria-label="Account actions"
              >
                <p className={styles.accountName}>{viewerName}</p>
                <button
                  type="button"
                  className={styles.accountLogoutButton}
                  role="menuitem"
                  onClick={() => void onLogoutFromMenu()}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {realtimeNotice ? (
        <section className={styles.realtimeNotice}>{realtimeNotice}</section>
      ) : null}

      <section className={styles.filterRow}>
        <label className={styles.filterField}>
          <span>Payer</span>
          <select
            value={payerFilter}
            onChange={(event) => setPayerFilter(event.target.value)}
          >
            <option value="ALL">All</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span>Currency</span>
          <select
            value={currencyFilter}
            onChange={(event) =>
              setCurrencyFilter(event.target.value as "ALL" | Currency)
            }
          >
            <option value="ALL">All</option>
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.settlementCard}>
        <div className={styles.settlementSummaryCard}>
          <div>
            <p className={styles.sectionLabel}>Summary</p>
            <h2>{project?.name ?? "Project"}</h2>
            <p className={styles.sectionMeta}>Target currency</p>
          </div>
          <span className={styles.currencyBadge}>
            {project?.targetCurrency ?? "TWD"}
          </span>
        </div>

        <div className={styles.rateCard}>
          <div className={styles.rateHeader}>
            <strong>Exchange rate</strong>
            <span
              className={`${styles.rateSourceBadge} ${
                settlementRateSource === RateSource.Live
                  ? styles.rateSourceLive
                  : styles.rateSourceAgreed
              }`}
            >
              {rateSourceLabel}
            </span>
          </div>
          <p className={styles.rateMetaLabel}>Last sync</p>
          <p className={styles.rateMetaValue}>
            {latestExpenseSync ? formatDateTime(latestExpenseSync) : "--"}
          </p>
          <p className={styles.rateMetaLabel}>Rate snapshot</p>
          <p className={styles.rateMetaValue}>{rateSnapshotText}</p>
          {settlementError ? (
            <div className={styles.rateErrorRow}>
              <span>{settlementError}</span>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => void onCalculateSettlement()}
                disabled={calculateSettlementLoading}
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>

        <p className={styles.settlementHint}>{settlementHint}</p>
        <button
          type="button"
          className={styles.calculateButton}
          onClick={() => void onCalculateSettlement()}
          disabled={isLoading || calculateSettlementLoading}
        >
          {calculateSettlementLoading ? "Calculating..." : "Calculate"}
        </button>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <h2>Debit / Credit Summary</h2>
          <span>{summary?.currency ?? project?.targetCurrency ?? "TWD"}</span>
        </div>
        {!canMutate ? (
          <p className={styles.readOnlyHint}>
            Read-only project: expense creation is disabled for your role.
          </p>
        ) : null}
        {summary?.rows.length ? (
          <ul className={styles.summaryList}>
            {summary.rows.map((row) => (
              <li key={row.participantId} className={styles.summaryItem}>
                <div>
                  <strong>{row.participant.name}</strong>
                  <p>
                    Credit {row.creditCount} · Debit {row.debitCount}
                  </p>
                </div>
                <div className={styles.summaryValues}>
                  <span className={styles.creditValue}>
                    +{formatAmount(row.creditAmount)}
                  </span>
                  <span className={styles.debitValue}>
                    -{formatAmount(row.debitAmount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyText}>No settlement instructions yet.</p>
        )}
      </section>

      <section className={styles.expenseList}>
        {isLoading ? <p className={styles.emptyText}>Loading...</p> : null}
        {!isLoading && groupedExpenses.length === 0 ? (
          <p className={styles.emptyText}>No expenses in current filters.</p>
        ) : null}
        {groupedExpenses.map((group) => (
          <article key={group.dayLabel} className={styles.dayCard}>
            <h3>{group.dayLabel}</h3>
            <div className={styles.dayItems}>
              {group.items.map((item) => (
                <div key={item.id} className={styles.expenseItem}>
                  <div>
                    <strong>{item.payer?.name ?? "Unknown payer"}</strong>
                    <p>{item.description || "No description"}</p>
                  </div>
                  <div className={styles.expenseAmount}>
                    <strong>{formatAmount(item.amount)}</strong>
                    <p>
                      <span className={styles.currencyChip}>
                        {item.currency}
                      </span>
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <button
        type="button"
        className={styles.fab}
        onClick={() => {
          setForm(buildDefaultForm(participants));
          setAddOpen(true);
        }}
        aria-label="Add expense"
        disabled={!canMutate}
        title={!canMutate ? "Read-only project" : undefined}
      >
        +
      </button>

      {addOpen ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setAddOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>Add Expense</h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setAddOpen(false)}
              >
                ×
              </button>
            </div>
            <label>
              <span>Payer</span>
              <select
                value={form.payerId}
                disabled={disableMutationControls}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payerId: event.target.value,
                  }))
                }
              >
                <option value="">Select a participant</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={form.occurredAt}
                disabled={disableMutationControls}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    occurredAt: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Amount</span>
              <input
                value={form.amount}
                inputMode="decimal"
                placeholder="0.00"
                disabled={disableMutationControls}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Split</span>
              <div className={styles.splitModeButtons}>
                {[SplitMode.Equal, SplitMode.Exact, SplitMode.Shares].map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`${styles.currencyButton} ${
                        form.splitMode === mode
                          ? styles.currencyButtonActive
                          : ""
                      }`}
                      disabled={disableMutationControls}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          splitMode: mode,
                        }))
                      }
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>
            </label>
            <label>
              <span>Currency</span>
              <div className={styles.currencyButtons}>
                {CURRENCY_OPTIONS.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={`${styles.currencyButton} ${
                      form.currency === currency
                        ? styles.currencyButtonActive
                        : ""
                    }`}
                    disabled={disableMutationControls}
                    onClick={() =>
                      setForm((current) => ({ ...current, currency }))
                    }
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </label>
            <section className={styles.splitParticipants}>
              <span>Participants</span>
              <div className={styles.splitParticipantList}>
                {participants.map((participant) => {
                  const row = form.splitRows[participant.id] ?? {
                    included: true,
                    amount: "",
                    shares: "1",
                  };
                  return (
                    <div
                      key={participant.id}
                      className={styles.splitParticipantRow}
                    >
                      <label className={styles.participantToggle}>
                        <input
                          type="checkbox"
                          checked={row.included}
                          disabled={disableMutationControls}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              splitRows: {
                                ...current.splitRows,
                                [participant.id]: {
                                  ...(current.splitRows[participant.id] ?? {
                                    included: true,
                                    amount: "",
                                    shares: "1",
                                  }),
                                  included: event.target.checked,
                                },
                              },
                            }))
                          }
                        />
                        <span>{participant.name}</span>
                      </label>
                      {row.included && form.splitMode === SplitMode.Exact ? (
                        <input
                          className={styles.splitValueInput}
                          inputMode="decimal"
                          placeholder="Amount"
                          value={row.amount}
                          disabled={disableMutationControls}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              splitRows: {
                                ...current.splitRows,
                                [participant.id]: {
                                  ...(current.splitRows[participant.id] ?? {
                                    included: true,
                                    amount: "",
                                    shares: "1",
                                  }),
                                  amount: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                      ) : null}
                      {row.included && form.splitMode === SplitMode.Shares ? (
                        <input
                          className={styles.splitValueInput}
                          inputMode="decimal"
                          placeholder="Shares"
                          value={row.shares}
                          disabled={disableMutationControls}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              splitRows: {
                                ...current.splitRows,
                                [participant.id]: {
                                  ...(current.splitRows[participant.id] ?? {
                                    included: true,
                                    amount: "",
                                    shares: "1",
                                  }),
                                  shares: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <label>
              <span>Description (optional)</span>
              <input
                value={form.description}
                placeholder="e.g., Team lunch"
                disabled={disableMutationControls}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <button
              type="button"
              disabled={disableMutationControls}
              onClick={() => void onSubmitExpense()}
            >
              {createExpenseLoading ? "Saving..." : "Save Expense"}
            </button>
          </section>
        </div>
      ) : null}

      {settlementOpen && settlementResult ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => {
            if (!exportingPdf) {
              setSettlementOpen(false);
            }
          }}
        >
          <section
            className={`${styles.modal} ${styles.settlementModal}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3>Settlement Result</h3>
                <p className={styles.settlementProjectLabel}>
                  Project: {project?.name ?? "Project"}
                </p>
              </div>
              <span className={styles.currencyBadge}>
                {settlementResult.targetCurrency}
              </span>
            </div>

            <div className={styles.settlementMetaRow}>
              <span
                className={`${styles.rateSourceBadge} ${
                  settlementResult.rateSource === RateSource.Live
                    ? styles.rateSourceLive
                    : styles.rateSourceAgreed
                }`}
              >
                {settlementResult.rateSource === RateSource.Live
                  ? "Live API"
                  : "Agreed rate"}
              </span>
              <span>
                Calculated: {formatDateTime(settlementResult.generatedAt)}
              </span>
            </div>

            {settlementResult.instructions.length > 0 ? (
              <ul className={styles.settlementInstructionList}>
                {settlementResult.instructions.map((instruction, index) => (
                  <li
                    key={`${instruction.fromParticipantName}-${instruction.toParticipantName}-${index}`}
                    className={styles.settlementInstructionItem}
                  >
                    {instruction.fromParticipantName} pays{" "}
                    {instruction.toParticipantName}{" "}
                    {formatAmount(instruction.amount)} {instruction.currency}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptySettlementState}>
                <h4>All settled</h4>
                <p>No payment transactions are needed right now.</p>
              </div>
            )}

            <div className={styles.settlementActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSettlementOpen(false)}
                disabled={exportingPdf}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void onExportPdf()}
                disabled={exportingPdf}
              >
                {exportingPdf ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {screenError ? (
        <section className={styles.errorBanner}>{screenError}</section>
      ) : null}
    </main>
  );
};
