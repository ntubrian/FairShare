import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CreateExpenseDocument,
  Currency,
  DebitCreditSummaryDocument,
  ExpenseSplitInput,
  MemberRole,
  ProjectDetailDocument,
  ProjectExpensesDocument,
  ProjectParticipantsDocument,
  ProjectStatus,
  SplitMode,
} from "../../graphql/generated";
import { toFriendlyError } from "../../lib/errors";
import { formatRelativeTime } from "../dashboard/utils";
import styles from "./ExpensesScreen.module.scss";

const CURRENCY_OPTIONS = [Currency.Usd, Currency.Twd, Currency.Jpy, Currency.Eur];

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

const toDateInputValue = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const buildDefaultForm = (
  participants: Array<{ id: string }>,
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
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
};

const formatAmount = (amount: number) => {
  if (!Number.isFinite(amount)) {
    return "0.00";
  }
  return amount.toFixed(2);
};

export const ExpensesScreen = ({ projectId, viewerId, viewerName, onBack, onLogout }: ExpensesScreenProps) => {
  const [payerFilter, setPayerFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<"ALL" | Currency>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(() => buildDefaultForm([]));
  const [localError, setLocalError] = useState<string | null>(null);

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

  const [createExpense, { loading: createExpenseLoading }] = useMutation(CreateExpenseDocument);

  const participants = participantsData?.participants ?? [];
  const expenses = expensesData?.expenses ?? [];
  const summary = summaryData?.debitCreditSummary;
  const project = projectData?.project;
  const viewerProjectRole =
    project?.members.find((member) => member.userId === viewerId)?.role ?? MemberRole.Viewer;
  const isProjectArchived = project?.status === ProjectStatus.Archived;
  const canMutate =
    Boolean(project) &&
    !isProjectArchived &&
    (viewerProjectRole === MemberRole.Owner || viewerProjectRole === MemberRole.Editor);

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
      const nextPayerId = participants.some((participant) => participant.id === current.payerId)
        ? current.payerId
        : (participants[0]?.id ?? "");
      return {
        ...current,
        payerId: nextPayerId,
        splitRows: nextSplitRows,
      };
    });
  }, [addOpen, participants]);

  const refreshAll = async () => {
    setLocalError(null);
    try {
      await Promise.all([
        refetchProject({ projectId }),
        refetchParticipants({ projectId, page: 1, pageSize: 100 }),
        refetchExpenses({ projectId, page: 1, pageSize: 200, includeDeleted: false }),
        refetchSummary({ projectId, includeDeleted: false }),
      ]);
    } catch (error) {
      setLocalError(toFriendlyError(error));
    }
  };

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
    [currencyFilter, expenses, payerFilter],
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

  const screenError = useMemo(() => {
    const firstError = projectError || participantsError || expensesError || summaryError;
    if (!firstError) {
      return localError;
    }
    return toFriendlyError(firstError) || localError;
  }, [projectError, participantsError, expensesError, summaryError, localError]);

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
      splits = selectedParticipantIds.map((participantId) => ({ participantId }));
    }

    if (form.splitMode === SplitMode.Exact) {
      let exactTotal = 0;
      const exactSplits: ExpenseSplitInput[] = [];
      for (const participantId of selectedParticipantIds) {
        const splitAmount = Number(form.splitRows[participantId]?.amount ?? "");
        if (!Number.isFinite(splitAmount) || splitAmount <= 0) {
          setLocalError("Exact split requires amount > 0 for each selected participant.");
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
          setLocalError("Shares split requires shares > 0 for each selected participant.");
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

  const isLoading = projectLoading || participantsLoading || expensesLoading || summaryLoading;
  const disableMutationControls = createExpenseLoading || !canMutate;

  useEffect(() => {
    if (!canMutate && addOpen) {
      setAddOpen(false);
    }
  }, [addOpen, canMutate]);

  return (
    <main className={styles.screen}>
      <header className={styles.headerCard}>
        <button type="button" className={styles.backButton} onClick={onBack} aria-label="Back to projects">
          ←
        </button>
        <div className={styles.headerTitle}>
          <h1>{project?.name ?? "Project"}</h1>
          <p>Expenses</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.syncButton} onClick={() => void refreshAll()}>
            Synced
          </button>
          <button type="button" className={styles.avatarButton} onClick={() => void onLogout()} aria-label="Logout">
            {viewerName.charAt(0).toUpperCase() || "U"}
          </button>
        </div>
      </header>

      <section className={styles.filterRow}>
        <label className={styles.filterField}>
          <span>Payer</span>
          <select value={payerFilter} onChange={(event) => setPayerFilter(event.target.value)}>
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
            onChange={(event) => setCurrencyFilter(event.target.value as "ALL" | Currency)}
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
                  <span className={styles.creditValue}>+{formatAmount(row.creditAmount)}</span>
                  <span className={styles.debitValue}>-{formatAmount(row.debitAmount)}</span>
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
                      <span className={styles.currencyChip}>{item.currency}</span>
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
        <div className={styles.overlay} role="presentation" onClick={() => setAddOpen(false)}>
          <section className={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add Expense</h3>
              <button type="button" className={styles.closeButton} onClick={() => setAddOpen(false)}>
                ×
              </button>
            </div>
            <label>
              <span>Payer</span>
              <select
                value={form.payerId}
                disabled={disableMutationControls}
                onChange={(event) => setForm((current) => ({ ...current, payerId: event.target.value }))}
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
                  setForm((current) => ({ ...current, occurredAt: event.target.value }))
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
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>
            <label>
              <span>Split</span>
              <div className={styles.splitModeButtons}>
                {[SplitMode.Equal, SplitMode.Exact, SplitMode.Shares].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.currencyButton} ${form.splitMode === mode ? styles.currencyButtonActive : ""}`}
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
                ))}
              </div>
            </label>
            <label>
              <span>Currency</span>
              <div className={styles.currencyButtons}>
                {CURRENCY_OPTIONS.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={`${styles.currencyButton} ${form.currency === currency ? styles.currencyButtonActive : ""}`}
                    disabled={disableMutationControls}
                    onClick={() => setForm((current) => ({ ...current, currency }))}
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
                    <div key={participant.id} className={styles.splitParticipantRow}>
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
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <button type="button" disabled={disableMutationControls} onClick={() => void onSubmitExpense()}>
              {createExpenseLoading ? "Saving..." : "Save Expense"}
            </button>
          </section>
        </div>
      ) : null}

      {screenError ? <section className={styles.errorBanner}>{screenError}</section> : null}
    </main>
  );
};
