import { appError } from "../lib/errors";
import { expenseRepository } from "../repositories/expenseRepository";
import { participantRepository } from "../repositories/participantRepository";
import { rateRepository } from "../repositories/rateRepository";
import { CURRENCIES, Currency, GraphQLContext, RateSource } from "../types";
import { assertCurrency, roundMoney } from "./domainUtils";
import { exchangeRateService } from "./exchangeRateService";
import { projectService } from "./projectService";

type GraphQLParticipant = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
};

type GraphQLSettlementResult = {
  projectId: string;
  targetCurrency: Currency;
  generatedAt: string;
  rateSource: RateSource;
  instructions: Array<{
    fromParticipantId: string;
    toParticipantId: string;
    amount: number;
    currency: Currency;
    fromParticipant: GraphQLParticipant;
    toParticipant: GraphQLParticipant;
  }>;
  rateSnapshot: {
    baseCurrency: Currency;
    source: RateSource;
    fetchedAt: string;
    rates: Array<{ currency: Currency; rate: number }>;
  };
};

type GraphQLParticipantDebitCredit = {
  participantId: string;
  participant: GraphQLParticipant;
  debitAmount: number;
  creditAmount: number;
  debitCount: number;
  creditCount: number;
  netAmount: number;
};

type GraphQLProjectDebitCreditSummary = {
  projectId: string;
  currency: Currency;
  generatedAt: string;
  totalDebitCount: number;
  totalCreditCount: number;
  rows: GraphQLParticipantDebitCredit[];
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

const getAgreedRate = (
  agreedRates: Array<{
    from_currency: Currency;
    to_currency: Currency;
    rate: string;
  }>,
  fromCurrency: Currency,
  toCurrency: Currency
) => {
  const direct = agreedRates.find(
    (rate) =>
      rate.from_currency === fromCurrency && rate.to_currency === toCurrency
  );
  if (direct) {
    return Number(direct.rate);
  }

  const reverse = agreedRates.find(
    (rate) =>
      rate.from_currency === toCurrency && rate.to_currency === fromCurrency
  );
  if (reverse) {
    const reverseRate = Number(reverse.rate);
    if (reverseRate > 0) {
      return 1 / reverseRate;
    }
  }
  return undefined;
};

const buildRateSnapshot = (
  input: {
    targetCurrency: Currency;
    agreedRateFirst: boolean;
    agreedRates: Array<{
      from_currency: Currency;
      to_currency: Currency;
      rate: string;
    }>;
    liveRatesFromTwd?: Record<Currency, number>;
  },
  source: RateSource,
  fetchedAt: string
) => ({
  baseCurrency: input.targetCurrency,
  source,
  fetchedAt,
  rates: CURRENCIES.map((currency) => {
    if (currency === input.targetCurrency) {
      return { currency, rate: 1 };
    }

    const agreed = getAgreedRate(
      input.agreedRates,
      currency,
      input.targetCurrency
    );
    if (input.agreedRateFirst && agreed) {
      return { currency, rate: roundMoney(agreed, 4) };
    }

    if (input.liveRatesFromTwd) {
      return {
        currency,
        rate: roundMoney(
          exchangeRateService.convertUsingLiveRates(
            1,
            currency,
            input.targetCurrency,
            input.liveRatesFromTwd
          ),
          4
        ),
      };
    }

    return { currency, rate: agreed ? roundMoney(agreed, 4) : 0 };
  }),
});

export const settlementService = {
  async calculate(
    projectId: string,
    includeDeleted: boolean,
    context: GraphQLContext
  ): Promise<GraphQLSettlementResult> {
    const project = await projectService.ensureReadable(projectId, context);
    const targetCurrency = assertCurrency(project.target_currency);
    const [participants, expenses, agreedRates] = await Promise.all([
      participantRepository.listByProject(projectId),
      expenseRepository.listByProject(projectId, includeDeleted),
      rateRepository.listByProject(projectId),
    ]);
    const mappedParticipants = participants.map(toParticipant);
    const participantsById = new Map(
      mappedParticipants.map((participant) => [participant.id, participant])
    );

    if (mappedParticipants.length === 0 || expenses.length === 0) {
      return {
        projectId,
        targetCurrency,
        generatedAt: new Date().toISOString(),
        rateSource: "AGREED",
        instructions: [],
        rateSnapshot: buildRateSnapshot(
          {
            targetCurrency,
            agreedRateFirst: project.agreed_rate_first,
            agreedRates,
          },
          "AGREED",
          new Date().toISOString()
        ),
      };
    }

    const paidBy = new Map(
      mappedParticipants.map((participant) => [participant.id, 0])
    );
    let liveSnapshot:
      | { fetchedAt: string; ratesFromTwd: Record<Currency, number> }
      | undefined;
    let usedLiveRates = false;

    for (const expense of expenses) {
      const payerId = expense.payer_participant_id;
      if (!participantsById.has(payerId)) {
        throw appError(
          "Expense payer not found in participant list.",
          "BAD_USER_INPUT"
        );
      }
      const amount = Number(expense.amount);
      let amountInTarget = amount;
      if (expense.currency !== targetCurrency) {
        const agreedRate = getAgreedRate(
          agreedRates,
          expense.currency,
          targetCurrency
        );
        const canUseAgreed = project.agreed_rate_first && agreedRate;
        if (canUseAgreed && agreedRate) {
          amountInTarget = amount * agreedRate;
        } else {
          if (!liveSnapshot) {
            liveSnapshot = await exchangeRateService.getLiveSnapshot();
          }
          usedLiveRates = true;
          amountInTarget = exchangeRateService.convertUsingLiveRates(
            amount,
            expense.currency,
            targetCurrency,
            liveSnapshot.ratesFromTwd
          );
        }
      }
      const current = paidBy.get(payerId) ?? 0;
      paidBy.set(payerId, current + amountInTarget);
    }

    const totalPaid = Array.from(paidBy.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const equalShare = totalPaid / mappedParticipants.length;
    const creditors: Array<{ participantId: string; balance: number }> = [];
    const debtors: Array<{ participantId: string; balance: number }> = [];

    for (const participant of mappedParticipants) {
      const paid = paidBy.get(participant.id) ?? 0;
      const balance = roundMoney(paid - equalShare);
      if (balance > 0) {
        creditors.push({ participantId: participant.id, balance });
      } else if (balance < 0) {
        debtors.push({
          participantId: participant.id,
          balance: Math.abs(balance),
        });
      }
    }

    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => b.balance - a.balance);

    const instructions: GraphQLSettlementResult["instructions"] = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      const amount = roundMoney(Math.min(creditor.balance, debtor.balance));
      if (amount > 0) {
        const fromParticipant = participantsById.get(debtor.participantId);
        const toParticipant = participantsById.get(creditor.participantId);
        if (!fromParticipant || !toParticipant) {
          throw appError(
            "Settlement participant lookup failed.",
            "INTERNAL_SERVER_ERROR"
          );
        }
        instructions.push({
          fromParticipantId: debtor.participantId,
          toParticipantId: creditor.participantId,
          amount,
          currency: targetCurrency,
          fromParticipant,
          toParticipant,
        });
      }

      creditor.balance = roundMoney(creditor.balance - amount);
      debtor.balance = roundMoney(debtor.balance - amount);
      if (creditor.balance <= 0.009) {
        creditorIndex += 1;
      }
      if (debtor.balance <= 0.009) {
        debtorIndex += 1;
      }
    }

    const rateSource: RateSource = usedLiveRates ? "LIVE" : "AGREED";
    const fetchedAt = liveSnapshot?.fetchedAt ?? new Date().toISOString();

    return {
      projectId,
      targetCurrency,
      generatedAt: new Date().toISOString(),
      rateSource,
      instructions,
      rateSnapshot: buildRateSnapshot(
        {
          targetCurrency,
          agreedRateFirst: project.agreed_rate_first,
          agreedRates,
          liveRatesFromTwd: liveSnapshot?.ratesFromTwd,
        },
        rateSource,
        fetchedAt
      ),
    };
  },

  async buildPdfPreview(
    projectId: string,
    includeSoftDeleted: boolean,
    context: GraphQLContext
  ) {
    const project = await projectService.ensureReadable(projectId, context);
    const settlement = await this.calculate(
      projectId,
      includeSoftDeleted,
      context
    );
    const expenses = await expenseRepository.listByProject(
      projectId,
      includeSoftDeleted
    );
    return {
      projectName: project.name,
      exportTime: new Date().toISOString(),
      targetCurrency: assertCurrency(project.target_currency),
      rateSnapshotIncluded: true,
      settlementIncluded: true,
      expenseDetailsIncluded: true,
      includeSoftDeleted,
      instructionCount: settlement.instructions.length,
      expenseCount: expenses.length,
    };
  },

  async debitCreditSummary(
    projectId: string,
    includeDeleted: boolean,
    context: GraphQLContext
  ): Promise<GraphQLProjectDebitCreditSummary> {
    const settlement = await this.calculate(projectId, includeDeleted, context);
    const participantRows = await participantRepository.listByProject(
      projectId
    );
    const participants = participantRows.map(toParticipant);
    const totalsByParticipantId = new Map<
      string,
      GraphQLParticipantDebitCredit
    >(
      participants.map((participant) => [
        participant.id,
        {
          participantId: participant.id,
          participant,
          debitAmount: 0,
          creditAmount: 0,
          debitCount: 0,
          creditCount: 0,
          netAmount: 0,
        },
      ])
    );

    for (const instruction of settlement.instructions) {
      const debtor = totalsByParticipantId.get(instruction.fromParticipantId);
      if (debtor) {
        debtor.debitAmount = roundMoney(
          debtor.debitAmount + instruction.amount
        );
        debtor.debitCount += 1;
      }
      const creditor = totalsByParticipantId.get(instruction.toParticipantId);
      if (creditor) {
        creditor.creditAmount = roundMoney(
          creditor.creditAmount + instruction.amount
        );
        creditor.creditCount += 1;
      }
    }

    const rows = Array.from(totalsByParticipantId.values())
      .map((row) => ({
        ...row,
        netAmount: roundMoney(row.creditAmount - row.debitAmount),
      }))
      .sort((a, b) => {
        if (a.netAmount !== b.netAmount) {
          return b.netAmount - a.netAmount;
        }
        return a.participant.name.localeCompare(b.participant.name);
      });

    return {
      projectId,
      currency: settlement.targetCurrency,
      generatedAt: settlement.generatedAt,
      totalDebitCount: settlement.instructions.length,
      totalCreditCount: settlement.instructions.length,
      rows,
    };
  },
};
