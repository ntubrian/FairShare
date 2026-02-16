import { Field, Float, ID, Int, ObjectType } from "type-graphql";
import { Currency, MemberRole, ProjectStatus, RateSource } from "../types";
import {
  CurrencyEnum,
  MemberRoleEnum,
  ProjectStatusEnum,
  RateSourceEnum,
} from "./enums";

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => String)
  email!: string;

  @Field(() => MemberRoleEnum)
  accountRole!: MemberRole;
}

@ObjectType()
export class ProjectMember {
  @Field(() => ID)
  userId!: string;

  @Field(() => MemberRoleEnum)
  role!: MemberRole;

  @Field(() => String)
  joinedAt!: string;

  @Field(() => User, { nullable: true })
  user!: User | null;
}

@ObjectType()
export class Participant {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID, { nullable: true })
  userId!: string | null;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class AgreedRate {
  @Field(() => CurrencyEnum)
  fromCurrency!: Currency;

  @Field(() => CurrencyEnum)
  toCurrency!: Currency;

  @Field(() => Float)
  rate!: number;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType()
export class Expense {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => ID)
  payerId!: string;

  @Field(() => Participant, { nullable: true })
  payer!: Participant | null;

  @Field(() => Float)
  amount!: number;

  @Field(() => CurrencyEnum)
  currency!: Currency;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;

  @Field(() => String, { nullable: true })
  deletedAt!: string | null;
}

@ObjectType()
export class Project {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  targetCurrency!: string;

  @Field(() => Boolean)
  agreedRateFirst!: boolean;

  @Field(() => ProjectStatusEnum)
  status!: ProjectStatus;

  @Field(() => String)
  inviteCode!: string;

  @Field(() => String)
  inviteLink!: string;

  @Field(() => Int)
  memberCount!: number;

  @Field(() => Int)
  participantCount!: number;

  @Field(() => Int)
  expenseCount!: number;

  @Field(() => [ProjectMember])
  members!: ProjectMember[];

  @Field(() => [Participant])
  participants!: Participant[];

  @Field(() => [Expense])
  expenses!: Expense[];

  @Field(() => [AgreedRate])
  agreedRates!: AgreedRate[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType()
export class ProjectSummary {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  targetCurrency!: string;

  @Field(() => Boolean)
  agreedRateFirst!: boolean;

  @Field(() => ProjectStatusEnum)
  status!: ProjectStatus;

  @Field(() => String)
  inviteCode!: string;

  @Field(() => String)
  inviteLink!: string;

  @Field(() => Int)
  memberCount!: number;

  @Field(() => MemberRoleEnum)
  viewerRole!: MemberRole;

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  updatedAt!: string;
}

@ObjectType()
export class ProjectPage {
  @Field(() => [ProjectSummary])
  items!: ProjectSummary[];

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;

  @Field(() => Boolean)
  hasPreviousPage!: boolean;
}

@ObjectType()
export class InviteValidation {
  @Field(() => Boolean)
  ok!: boolean;

  @Field(() => String)
  message!: string;

  @Field(() => ID, { nullable: true })
  projectId!: string | null;

  @Field(() => String, { nullable: true })
  projectName!: string | null;
}

@ObjectType()
export class RateValue {
  @Field(() => CurrencyEnum)
  currency!: Currency;

  @Field(() => Float)
  rate!: number;
}

@ObjectType()
export class RateSnapshot {
  @Field(() => CurrencyEnum)
  baseCurrency!: Currency;

  @Field(() => RateSourceEnum)
  source!: RateSource;

  @Field(() => String)
  fetchedAt!: string;

  @Field(() => [RateValue])
  rates!: RateValue[];
}

@ObjectType()
export class SettlementInstruction {
  @Field(() => ID)
  fromParticipantId!: string;

  @Field(() => ID)
  toParticipantId!: string;

  @Field(() => Float)
  amount!: number;

  @Field(() => CurrencyEnum)
  currency!: Currency;

  @Field(() => Participant)
  fromParticipant!: Participant;

  @Field(() => Participant)
  toParticipant!: Participant;
}

@ObjectType()
export class SettlementResult {
  @Field(() => ID)
  projectId!: string;

  @Field(() => CurrencyEnum)
  targetCurrency!: Currency;

  @Field(() => String)
  generatedAt!: string;

  @Field(() => RateSourceEnum)
  rateSource!: RateSource;

  @Field(() => [SettlementInstruction])
  instructions!: SettlementInstruction[];

  @Field(() => RateSnapshot)
  rateSnapshot!: RateSnapshot;
}

@ObjectType()
export class ParticipantDebitCredit {
  @Field(() => ID)
  participantId!: string;

  @Field(() => Participant)
  participant!: Participant;

  @Field(() => Float)
  debitAmount!: number;

  @Field(() => Float)
  creditAmount!: number;

  @Field(() => Int)
  debitCount!: number;

  @Field(() => Int)
  creditCount!: number;

  @Field(() => Float)
  netAmount!: number;
}

@ObjectType()
export class ProjectDebitCreditSummary {
  @Field(() => ID)
  projectId!: string;

  @Field(() => CurrencyEnum)
  currency!: Currency;

  @Field(() => String)
  generatedAt!: string;

  @Field(() => Int)
  totalDebitCount!: number;

  @Field(() => Int)
  totalCreditCount!: number;

  @Field(() => [ParticipantDebitCredit])
  rows!: ParticipantDebitCredit[];
}

@ObjectType()
export class PdfChecklist {
  @Field(() => String)
  projectName!: string;

  @Field(() => String)
  exportTime!: string;

  @Field(() => CurrencyEnum)
  targetCurrency!: Currency;

  @Field(() => Boolean)
  rateSnapshotIncluded!: boolean;

  @Field(() => Boolean)
  settlementIncluded!: boolean;

  @Field(() => Boolean)
  expenseDetailsIncluded!: boolean;

  @Field(() => Boolean)
  includeSoftDeleted!: boolean;

  @Field(() => Int)
  instructionCount!: number;

  @Field(() => Int)
  expenseCount!: number;
}
