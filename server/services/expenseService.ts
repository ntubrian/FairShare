import { appError } from "../lib/errors";
import { expenseRepository } from "../repositories/expenseRepository";
import { participantRepository } from "../repositories/participantRepository";
import { projectRepository } from "../repositories/projectRepository";
import { Currency, GraphQLContext } from "../types";
import { assertCurrency, roundMoney } from "./domainUtils";
import { projectService } from "./projectService";

type GraphQLParticipant = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
};

type GraphQLExpense = {
  id: string;
  projectId: string;
  payerId: string;
  payer: GraphQLParticipant | null;
  amount: number;
  currency: Currency;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const toParticipant = (row: {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}): GraphQLParticipant => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  createdAt: row.created_at,
});

const toExpense = (
  row: {
    id: string;
    project_id: string;
    payer_participant_id: string;
    amount: string;
    currency: Currency;
    description: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  },
  participantsById: Map<string, GraphQLParticipant>
): GraphQLExpense => ({
  id: row.id,
  projectId: row.project_id,
  payerId: row.payer_participant_id,
  payer: participantsById.get(row.payer_participant_id) ?? null,
  amount: Number(row.amount),
  currency: row.currency,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const requirePositiveAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError("Amount must be greater than 0.", "BAD_USER_INPUT");
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

export const expenseService = {
  async listExpenses(
    projectId: string,
    includeDeleted: boolean,
    context: GraphQLContext
  ) {
    await projectService.ensureReadable(projectId, context);
    const [participants, expenses] = await Promise.all([
      participantRepository.listByProject(projectId),
      expenseRepository.listByProject(projectId, includeDeleted),
    ]);
    const mappedParticipants = participants.map(toParticipant);
    const participantsById = new Map(
      mappedParticipants.map((participant) => [participant.id, participant])
    );
    return expenses.map((expense) => toExpense(expense, participantsById));
  },

  async createExpense(
    input: {
      projectId: string;
      payerId: string;
      amount: number;
      currency: Currency;
      description?: string | null;
    },
    context: GraphQLContext
  ) {
    const viewer = projectService.requireViewer(context);
    await projectService.ensureEditable(input.projectId, context);
    requirePositiveAmount(input.amount);
    assertCurrency(input.currency);

    const payer = await participantRepository.findByIdInProject(
      input.projectId,
      input.payerId
    );
    if (!payer) {
      throw appError("Payer must exist in participant list.", "BAD_USER_INPUT");
    }

    const created = await expenseRepository.add({
      projectId: input.projectId,
      payerParticipantId: input.payerId,
      amount: roundMoney(input.amount),
      currency: input.currency,
      description: normalizeDescription(input.description) ?? null,
      createdBy: viewer.id,
    });
    await projectRepository.touchProject(input.projectId);
    const mappedPayer = toParticipant(payer);
    return toExpense(created, new Map([[mappedPayer.id, mappedPayer]]));
  },

  async updateExpense(
    input: {
      projectId: string;
      expenseId: string;
      payerId?: string | null;
      amount?: number | null;
      currency?: Currency | null;
      description?: string | null;
    },
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(input.projectId, context);
    const current = await expenseRepository.findById(
      input.expenseId,
      input.projectId
    );
    if (!current) {
      throw appError("Expense not found.", "NOT_FOUND");
    }

    let payerParticipantId: string | undefined;
    if (typeof input.payerId === "string") {
      const payer = await participantRepository.findByIdInProject(
        input.projectId,
        input.payerId
      );
      if (!payer) {
        throw appError(
          "Payer must exist in participant list.",
          "BAD_USER_INPUT"
        );
      }
      payerParticipantId = input.payerId;
    }

    let amount: number | undefined;
    if (typeof input.amount === "number") {
      requirePositiveAmount(input.amount);
      amount = roundMoney(input.amount);
    }

    let currency: Currency | undefined;
    if (typeof input.currency === "string") {
      currency = assertCurrency(input.currency);
    }

    const updated = await expenseRepository.update(
      input.projectId,
      input.expenseId,
      {
        payerParticipantId,
        amount,
        currency,
        description: normalizeDescription(input.description),
      }
    );
    if (!updated) {
      throw appError("Expense not found.", "NOT_FOUND");
    }

    await projectRepository.touchProject(input.projectId);
    const participants = await participantRepository.listByProject(
      input.projectId
    );
    const participantsById = new Map(
      participants.map((participant) => {
        const mapped = toParticipant(participant);
        return [mapped.id, mapped] as const;
      })
    );
    return toExpense(updated, participantsById);
  },

  async softDeleteExpense(
    projectId: string,
    expenseId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    const updated = await expenseRepository.softDelete(projectId, expenseId);
    if (!updated) {
      throw appError("Expense not found.", "NOT_FOUND");
    }
    await projectRepository.touchProject(projectId);
    const participants = await participantRepository.listByProject(projectId);
    const participantsById = new Map(
      participants.map((participant) => {
        const mapped = toParticipant(participant);
        return [mapped.id, mapped] as const;
      })
    );
    return toExpense(updated, participantsById);
  },

  async restoreExpense(
    projectId: string,
    expenseId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    const updated = await expenseRepository.restore(projectId, expenseId);
    if (!updated) {
      throw appError("Expense not found.", "NOT_FOUND");
    }
    await projectRepository.touchProject(projectId);
    const participants = await participantRepository.listByProject(projectId);
    const participantsById = new Map(
      participants.map((participant) => {
        const mapped = toParticipant(participant);
        return [mapped.id, mapped] as const;
      })
    );
    return toExpense(updated, participantsById);
  },
};
