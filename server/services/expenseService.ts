import { appError } from "../lib/errors";
import {
  expenseRepository,
  ExpenseRow,
  ExpenseSplitRow,
} from "../repositories/expenseRepository";
import { participantRepository } from "../repositories/participantRepository";
import { projectRepository } from "../repositories/projectRepository";
import { expenseAddedTopic, graphqlPubSub } from "../realtime/pubSub";
import { Currency, GraphQLContext, SplitMode } from "../types";
import { assertCurrency, roundMoney } from "./domainUtils";
import { projectService } from "./projectService";

type GraphQLParticipant = {
  id: string;
  projectId: string;
  userId: string | null;
  name: string;
  createdAt: string;
};

type GraphQLExpenseSplit = {
  participantId: string;
  participant: GraphQLParticipant | null;
  amount: number | null;
  shares: number | null;
};

type GraphQLExpense = {
  id: string;
  projectId: string;
  payerId: string;
  payer: GraphQLParticipant | null;
  amount: number;
  currency: Currency;
  splitMode: SplitMode;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  splits: GraphQLExpenseSplit[];
};

type SplitInput = {
  participantId: string;
  amount?: number | null;
  shares?: number | null;
};

type NormalizedSplit = {
  participantId: string;
  amount: number | null;
  shares: number | null;
};

const toParticipant = (row: {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  created_at: string;
}): GraphQLParticipant => ({
  id: row.id,
  projectId: row.project_id,
  userId: row.user_id,
  name: row.name,
  createdAt: row.created_at,
});

const toSplit = (
  row: ExpenseSplitRow,
  participantsById: Map<string, GraphQLParticipant>
): GraphQLExpenseSplit => ({
  participantId: row.participant_id,
  participant: participantsById.get(row.participant_id) ?? null,
  amount: row.amount === null ? null : Number(row.amount),
  shares: row.shares === null ? null : Number(row.shares),
});

const buildSplitMap = (
  rows: ExpenseSplitRow[],
  participantsById: Map<string, GraphQLParticipant>
) => {
  const mapped = new Map<string, GraphQLExpenseSplit[]>();
  for (const row of rows) {
    const current = mapped.get(row.expense_id) ?? [];
    current.push(toSplit(row, participantsById));
    mapped.set(row.expense_id, current);
  }
  return mapped;
};

const toExpense = (
  row: ExpenseRow,
  participantsById: Map<string, GraphQLParticipant>,
  splitsByExpenseId: Map<string, GraphQLExpenseSplit[]>
): GraphQLExpense => {
  const explicitSplits = splitsByExpenseId.get(row.id) ?? [];
  const fallbackEqualSplits =
    explicitSplits.length === 0 && row.split_mode === "EQUAL"
      ? Array.from(participantsById.values()).map((participant) => ({
          participantId: participant.id,
          participant,
          amount: null,
          shares: null,
        }))
      : explicitSplits;

  return {
    id: row.id,
    projectId: row.project_id,
    payerId: row.payer_participant_id,
    payer: participantsById.get(row.payer_participant_id) ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    splitMode: row.split_mode,
    description: row.description,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    splits: fallbackEqualSplits,
  };
};

const requirePositiveAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError("Amount must be greater than 0.", "BAD_USER_INPUT");
  }
};

const requirePositiveShares = (shares: number) => {
  if (!Number.isFinite(shares) || shares <= 0) {
    throw appError("Shares must be greater than 0.", "BAD_USER_INPUT");
  }
};

const normalizeDescription = (description: string | null | undefined) => {
  if (description === undefined) {
    return undefined;
  }
  if (description === null) {
    return null;
  }
  const trimmed = description.trim();
  return trimmed || null;
};

const normalizeOccurredAt = (
  occurredAt: string | null | undefined
): string | undefined => {
  if (
    occurredAt === undefined ||
    occurredAt === null ||
    occurredAt.trim() === ""
  ) {
    return undefined;
  }
  const parsed = new Date(occurredAt);
  if (!Number.isFinite(parsed.getTime())) {
    throw appError("Invalid expense date.", "BAD_USER_INPUT");
  }
  return parsed.toISOString();
};

const normalizeSplitInputs = (
  splitMode: SplitMode,
  amount: number,
  participants: GraphQLParticipant[],
  splitInputs: SplitInput[] | null | undefined,
  requireExplicitSplits: boolean
): NormalizedSplit[] => {
  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant])
  );

  const providedSplits = splitInputs === null ? [] : splitInputs;
  let selectedParticipantIds: string[] = [];

  if (providedSplits && providedSplits.length > 0) {
    const unique = new Set<string>();
    for (const split of providedSplits) {
      if (unique.has(split.participantId)) {
        throw appError(
          "Duplicate participant in expense splits.",
          "BAD_USER_INPUT"
        );
      }
      unique.add(split.participantId);
      selectedParticipantIds.push(split.participantId);
    }
  } else if (!requireExplicitSplits && splitMode === "EQUAL") {
    selectedParticipantIds = participants.map((participant) => participant.id);
  }

  if (!selectedParticipantIds.length) {
    throw appError(
      "At least one participant must be included in expense split.",
      "BAD_USER_INPUT"
    );
  }

  for (const participantId of selectedParticipantIds) {
    if (!participantsById.has(participantId)) {
      throw appError(
        "Split participant must exist in participant list.",
        "BAD_USER_INPUT"
      );
    }
  }

  if (splitMode === "EQUAL") {
    return selectedParticipantIds.map((participantId) => ({
      participantId,
      amount: null,
      shares: null,
    }));
  }

  if (!providedSplits || providedSplits.length === 0) {
    throw appError(
      `Splits are required for ${splitMode} mode.`,
      "BAD_USER_INPUT"
    );
  }

  if (splitMode === "EXACT") {
    const normalized = providedSplits.map((split) => {
      const splitAmount = split.amount;
      if (typeof splitAmount !== "number") {
        throw appError(
          "Exact split requires amount for each participant.",
          "BAD_USER_INPUT"
        );
      }
      requirePositiveAmount(splitAmount);
      return {
        participantId: split.participantId,
        amount: roundMoney(splitAmount),
        shares: null,
      } as const;
    });

    const sum = roundMoney(
      normalized.reduce((total, split) => total + (split.amount ?? 0), 0)
    );
    if (Math.abs(roundMoney(sum - amount)) > 0.01) {
      throw appError(
        "Exact split amounts must equal total expense amount.",
        "BAD_USER_INPUT"
      );
    }
    return normalized;
  }

  const normalized = providedSplits.map((split) => {
    const shares = split.shares;
    if (typeof shares !== "number") {
      throw appError(
        "Shares split requires shares for each participant.",
        "BAD_USER_INPUT"
      );
    }
    requirePositiveShares(shares);
    return {
      participantId: split.participantId,
      amount: null,
      shares: roundMoney(shares, 6),
    } as const;
  });

  const totalShares = normalized.reduce(
    (total, split) => total + (split.shares ?? 0),
    0
  );
  if (totalShares <= 0) {
    throw appError("Total shares must be greater than 0.", "BAD_USER_INPUT");
  }

  return normalized;
};

export const expenseService = {
  async listExpenses(
    projectId: string,
    includeDeleted: boolean,
    context: GraphQLContext,
    options?: { page?: number | null; pageSize?: number | null }
  ) {
    await projectService.ensureReadable(projectId, context);
    const page =
      options?.page && options.page > 0 ? Math.floor(options.page) : undefined;
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? Math.min(100, Math.floor(options.pageSize))
        : undefined;

    const [participants, expenses] = await Promise.all([
      participantRepository.listByProject(projectId),
      expenseRepository.listByProject(projectId, includeDeleted, {
        page,
        pageSize,
      }),
    ]);

    const mappedParticipants = participants.map(toParticipant);
    const participantsById = new Map(
      mappedParticipants.map((participant) => [participant.id, participant])
    );
    const splitRows = await expenseRepository.listSplitsByExpenseIds(
      expenses.map((expense) => expense.id)
    );
    const splitsByExpenseId = buildSplitMap(splitRows, participantsById);

    return expenses.map((expense) =>
      toExpense(expense, participantsById, splitsByExpenseId)
    );
  },

  async createExpense(
    input: {
      projectId: string;
      payerId: string;
      amount: number;
      currency: Currency;
      description?: string | null;
      occurredAt?: string | null;
      splitMode?: SplitMode;
      splits?: SplitInput[] | null;
    },
    context: GraphQLContext
  ) {
    const viewer = projectService.requireViewer(context);
    await projectService.ensureEditable(input.projectId, context);
    requirePositiveAmount(input.amount);
    assertCurrency(input.currency);
    const occurredAt =
      normalizeOccurredAt(input.occurredAt) ?? new Date().toISOString();
    const splitMode = input.splitMode ?? "EQUAL";
    const createdExpense = await projectRepository.withProjectWriteLock(
      input.projectId,
      async (tx) => {
        const payer = await participantRepository.findByIdInProject(
          input.projectId,
          input.payerId,
          tx
        );
        if (!payer) {
          throw appError(
            "Payer must exist in participant list.",
            "BAD_USER_INPUT"
          );
        }

        const participants = await participantRepository.listByProject(
          input.projectId,
          undefined,
          tx
        );
        const mappedParticipants = participants.map(toParticipant);
        const participantsById = new Map(
          mappedParticipants.map((participant) => [participant.id, participant])
        );
        const normalizedSplits = normalizeSplitInputs(
          splitMode,
          roundMoney(input.amount),
          mappedParticipants,
          input.splits,
          false
        );

        const created = await expenseRepository.add(
          {
            projectId: input.projectId,
            payerParticipantId: input.payerId,
            amount: roundMoney(input.amount),
            currency: input.currency,
            splitMode,
            description: normalizeDescription(input.description) ?? null,
            occurredAt,
            createdBy: viewer.id,
          },
          tx
        );

        await expenseRepository.replaceSplits(created.id, normalizedSplits, tx);
        await projectRepository.touchProject(input.projectId, tx);

        const splitRows = await expenseRepository.listSplitsByExpenseIds(
          [created.id],
          tx
        );
        const splitsByExpenseId = buildSplitMap(splitRows, participantsById);
        return toExpense(created, participantsById, splitsByExpenseId);
      }
    );

    graphqlPubSub.publish(expenseAddedTopic(input.projectId), createdExpense);
    return createdExpense;
  },

  async updateExpense(
    input: {
      projectId: string;
      expenseId: string;
      payerId?: string | null;
      amount?: number | null;
      currency?: Currency | null;
      description?: string | null;
      occurredAt?: string | null;
      splitMode?: SplitMode | null;
      splits?: SplitInput[] | null;
    },
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(input.projectId, context);
    return projectRepository.withProjectWriteLock(
      input.projectId,
      async (tx) => {
        const current = await expenseRepository.findById(
          input.expenseId,
          input.projectId,
          tx
        );
        if (!current) {
          throw appError("Expense not found.", "NOT_FOUND");
        }

        let payerParticipantId: string | undefined;
        if (typeof input.payerId === "string") {
          const payer = await participantRepository.findByIdInProject(
            input.projectId,
            input.payerId,
            tx
          );
          if (!payer) {
            throw appError(
              "Payer must exist in participant list.",
              "BAD_USER_INPUT"
            );
          }
          payerParticipantId = input.payerId;
        }

        let amount = Number(current.amount);
        if (typeof input.amount === "number") {
          requirePositiveAmount(input.amount);
          amount = roundMoney(input.amount);
        }

        let currency: Currency | undefined;
        if (typeof input.currency === "string") {
          currency = assertCurrency(input.currency);
        }

        const normalizedOccurredAt = normalizeOccurredAt(input.occurredAt);
        const targetSplitMode = (input.splitMode ??
          current.split_mode) as SplitMode;
        const shouldRebuildSplits =
          input.splits !== undefined ||
          input.splitMode !== undefined ||
          (typeof input.amount === "number" && targetSplitMode === "EXACT");

        const participants = await participantRepository.listByProject(
          input.projectId,
          undefined,
          tx
        );
        const mappedParticipants = participants.map(toParticipant);
        const participantsById = new Map(
          mappedParticipants.map((participant) => [participant.id, participant])
        );

        if (shouldRebuildSplits) {
          const normalizedSplits = normalizeSplitInputs(
            targetSplitMode,
            amount,
            mappedParticipants,
            input.splits,
            targetSplitMode !== "EQUAL"
          );
          await expenseRepository.replaceSplits(
            input.expenseId,
            normalizedSplits,
            tx
          );
        }

        const updated = await expenseRepository.update(
          input.projectId,
          input.expenseId,
          {
            payerParticipantId,
            amount: typeof input.amount === "number" ? amount : undefined,
            currency,
            splitMode:
              input.splitMode === undefined || input.splitMode === null
                ? undefined
                : targetSplitMode,
            description: normalizeDescription(input.description),
            occurredAt: normalizedOccurredAt,
          },
          tx
        );
        if (!updated) {
          throw appError("Expense not found.", "NOT_FOUND");
        }

        await projectRepository.touchProject(input.projectId, tx);
        const splitRows = await expenseRepository.listSplitsByExpenseIds(
          [updated.id],
          tx
        );
        const splitsByExpenseId = buildSplitMap(splitRows, participantsById);
        return toExpense(updated, participantsById, splitsByExpenseId);
      }
    );
  },

  async softDeleteExpense(
    projectId: string,
    expenseId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    return projectRepository.withProjectWriteLock(projectId, async (tx) => {
      const updated = await expenseRepository.softDelete(
        projectId,
        expenseId,
        tx
      );
      if (!updated) {
        throw appError("Expense not found.", "NOT_FOUND");
      }
      await projectRepository.touchProject(projectId, tx);
      const participants = await participantRepository.listByProject(
        projectId,
        undefined,
        tx
      );
      const mappedParticipants = participants.map(toParticipant);
      const participantsById = new Map(
        mappedParticipants.map((participant) => [participant.id, participant])
      );
      const splitRows = await expenseRepository.listSplitsByExpenseIds(
        [updated.id],
        tx
      );
      const splitsByExpenseId = buildSplitMap(splitRows, participantsById);
      return toExpense(updated, participantsById, splitsByExpenseId);
    });
  },

  async restoreExpense(
    projectId: string,
    expenseId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    return projectRepository.withProjectWriteLock(projectId, async (tx) => {
      const updated = await expenseRepository.restore(projectId, expenseId, tx);
      if (!updated) {
        throw appError("Expense not found.", "NOT_FOUND");
      }
      await projectRepository.touchProject(projectId, tx);
      const participants = await participantRepository.listByProject(
        projectId,
        undefined,
        tx
      );
      const mappedParticipants = participants.map(toParticipant);
      const participantsById = new Map(
        mappedParticipants.map((participant) => [participant.id, participant])
      );
      const splitRows = await expenseRepository.listSplitsByExpenseIds(
        [updated.id],
        tx
      );
      const splitsByExpenseId = buildSplitMap(splitRows, participantsById);
      return toExpense(updated, participantsById, splitsByExpenseId);
    });
  },
};
