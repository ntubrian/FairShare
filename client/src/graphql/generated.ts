import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AgreedRate = {
  __typename?: 'AgreedRate';
  fromCurrency: Currency;
  rate: Scalars['Float']['output'];
  toCurrency: Currency;
  updatedAt: Scalars['String']['output'];
};

export enum Currency {
  Eur = 'EUR',
  Jpy = 'JPY',
  Twd = 'TWD',
  Usd = 'USD'
}

export type Expense = {
  __typename?: 'Expense';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['String']['output'];
  currency: Currency;
  deletedAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payer?: Maybe<Participant>;
  payerId: Scalars['ID']['output'];
  projectId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type InviteValidation = {
  __typename?: 'InviteValidation';
  message: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
  projectId?: Maybe<Scalars['ID']['output']>;
  projectName?: Maybe<Scalars['String']['output']>;
};

export enum Locale {
  En = 'EN',
  ZhTw = 'ZH_TW'
}

export enum MemberRole {
  Editor = 'EDITOR',
  Owner = 'OWNER',
  Viewer = 'VIEWER'
}

export type Mutation = {
  __typename?: 'Mutation';
  addParticipant: Participant;
  archiveProject: Project;
  createExpense: Expense;
  createProject: Project;
  deleteProject: Scalars['Boolean']['output'];
  joinProject: Project;
  leaveProject: Scalars['Boolean']['output'];
  removeParticipant: Scalars['Boolean']['output'];
  restoreExpense: Expense;
  setAgreedRate: Project;
  setMemberRole: Project;
  softDeleteExpense: Expense;
  updateExpense: Expense;
  updateProject: Project;
};


export type MutationAddParticipantArgs = {
  name: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
};


export type MutationArchiveProjectArgs = {
  projectId: Scalars['ID']['input'];
};


export type MutationCreateExpenseArgs = {
  amount: Scalars['Float']['input'];
  currency: Currency;
  description?: InputMaybe<Scalars['String']['input']>;
  payerId: Scalars['ID']['input'];
  projectId: Scalars['ID']['input'];
};


export type MutationCreateProjectArgs = {
  agreedRateFirst?: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
  targetCurrency?: Scalars['String']['input'];
};


export type MutationDeleteProjectArgs = {
  projectId: Scalars['ID']['input'];
};


export type MutationJoinProjectArgs = {
  inviteCode: Scalars['String']['input'];
};


export type MutationLeaveProjectArgs = {
  projectId: Scalars['ID']['input'];
};


export type MutationRemoveParticipantArgs = {
  participantId: Scalars['ID']['input'];
  projectId: Scalars['ID']['input'];
};


export type MutationRestoreExpenseArgs = {
  expenseId: Scalars['ID']['input'];
  projectId: Scalars['ID']['input'];
};


export type MutationSetAgreedRateArgs = {
  fromCurrency: Currency;
  projectId: Scalars['ID']['input'];
  rate: Scalars['Float']['input'];
  toCurrency: Currency;
};


export type MutationSetMemberRoleArgs = {
  projectId: Scalars['ID']['input'];
  role: MemberRole;
  userId: Scalars['ID']['input'];
};


export type MutationSoftDeleteExpenseArgs = {
  expenseId: Scalars['ID']['input'];
  projectId: Scalars['ID']['input'];
};


export type MutationUpdateExpenseArgs = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Currency>;
  description?: InputMaybe<Scalars['String']['input']>;
  expenseId: Scalars['ID']['input'];
  payerId?: InputMaybe<Scalars['ID']['input']>;
  projectId: Scalars['ID']['input'];
};


export type MutationUpdateProjectArgs = {
  agreedRateFirst?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  projectId: Scalars['ID']['input'];
  targetCurrency?: InputMaybe<Scalars['String']['input']>;
};

export type Participant = {
  __typename?: 'Participant';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type ParticipantDebitCredit = {
  __typename?: 'ParticipantDebitCredit';
  creditAmount: Scalars['Float']['output'];
  creditCount: Scalars['Int']['output'];
  debitAmount: Scalars['Float']['output'];
  debitCount: Scalars['Int']['output'];
  netAmount: Scalars['Float']['output'];
  participant: Participant;
  participantId: Scalars['ID']['output'];
};

export type PdfChecklist = {
  __typename?: 'PdfChecklist';
  expenseCount: Scalars['Int']['output'];
  expenseDetailsIncluded: Scalars['Boolean']['output'];
  exportTime: Scalars['String']['output'];
  includeSoftDeleted: Scalars['Boolean']['output'];
  instructionCount: Scalars['Int']['output'];
  projectName: Scalars['String']['output'];
  rateSnapshotIncluded: Scalars['Boolean']['output'];
  settlementIncluded: Scalars['Boolean']['output'];
  targetCurrency: Currency;
};

export type Project = {
  __typename?: 'Project';
  agreedRateFirst: Scalars['Boolean']['output'];
  agreedRates: Array<AgreedRate>;
  createdAt: Scalars['String']['output'];
  expenseCount: Scalars['Int']['output'];
  expenses: Array<Expense>;
  id: Scalars['ID']['output'];
  inviteCode: Scalars['String']['output'];
  inviteLink: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
  members: Array<ProjectMember>;
  name: Scalars['String']['output'];
  participantCount: Scalars['Int']['output'];
  participants: Array<Participant>;
  status: ProjectStatus;
  targetCurrency: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ProjectDebitCreditSummary = {
  __typename?: 'ProjectDebitCreditSummary';
  currency: Currency;
  generatedAt: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  rows: Array<ParticipantDebitCredit>;
  totalCreditCount: Scalars['Int']['output'];
  totalDebitCount: Scalars['Int']['output'];
};

export type ProjectMember = {
  __typename?: 'ProjectMember';
  joinedAt: Scalars['String']['output'];
  role: MemberRole;
  user?: Maybe<User>;
  userId: Scalars['ID']['output'];
};

export type ProjectPage = {
  __typename?: 'ProjectPage';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  items: Array<ProjectSummary>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export enum ProjectStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED'
}

export type ProjectSummary = {
  __typename?: 'ProjectSummary';
  agreedRateFirst: Scalars['Boolean']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  inviteCode: Scalars['String']['output'];
  inviteLink: Scalars['String']['output'];
  memberCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  status: ProjectStatus;
  targetCurrency: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  viewerRole: MemberRole;
};

export type Query = {
  __typename?: 'Query';
  calculateSettlement: SettlementResult;
  debitCreditSummary: ProjectDebitCreditSummary;
  detectLocale: Locale;
  exchangeRates: RateSnapshot;
  expenses: Array<Expense>;
  health: Scalars['String']['output'];
  participants: Array<Participant>;
  pdfExportPreview: PdfChecklist;
  project?: Maybe<Project>;
  projectByInviteCode: InviteValidation;
  projectSummaries: ProjectPage;
  projects: Array<Project>;
  users: Array<User>;
  viewer: User;
};


export type QueryCalculateSettlementArgs = {
  includeDeleted?: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
};


export type QueryDebitCreditSummaryArgs = {
  includeDeleted?: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
};


export type QueryDetectLocaleArgs = {
  acceptLanguage: Scalars['String']['input'];
};


export type QueryExchangeRatesArgs = {
  baseCurrency?: Currency;
};


export type QueryExpensesArgs = {
  includeDeleted?: Scalars['Boolean']['input'];
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  projectId: Scalars['ID']['input'];
};


export type QueryParticipantsArgs = {
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  projectId: Scalars['ID']['input'];
};


export type QueryPdfExportPreviewArgs = {
  includeSoftDeleted?: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
};


export type QueryProjectArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProjectByInviteCodeArgs = {
  inviteCode: Scalars['String']['input'];
};


export type QueryProjectSummariesArgs = {
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  search?: InputMaybe<Scalars['String']['input']>;
};

export type RateSnapshot = {
  __typename?: 'RateSnapshot';
  baseCurrency: Currency;
  fetchedAt: Scalars['String']['output'];
  rates: Array<RateValue>;
  source: RateSource;
};

export enum RateSource {
  Agreed = 'AGREED',
  Live = 'LIVE'
}

export type RateValue = {
  __typename?: 'RateValue';
  currency: Currency;
  rate: Scalars['Float']['output'];
};

export type SettlementInstruction = {
  __typename?: 'SettlementInstruction';
  amount: Scalars['Float']['output'];
  currency: Currency;
  fromParticipant: Participant;
  fromParticipantId: Scalars['ID']['output'];
  toParticipant: Participant;
  toParticipantId: Scalars['ID']['output'];
};

export type SettlementResult = {
  __typename?: 'SettlementResult';
  generatedAt: Scalars['String']['output'];
  instructions: Array<SettlementInstruction>;
  projectId: Scalars['ID']['output'];
  rateSnapshot: RateSnapshot;
  rateSource: RateSource;
  targetCurrency: Currency;
};

export type User = {
  __typename?: 'User';
  accountRole: MemberRole;
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type HealthQueryVariables = Exact<{ [key: string]: never; }>;


export type HealthQuery = { __typename?: 'Query', health: string };

export type ViewerQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerQuery = { __typename?: 'Query', viewer: { __typename?: 'User', id: string, displayName: string, email: string, accountRole: MemberRole } };

export type ProjectSummariesQueryVariables = Exact<{
  page: Scalars['Int']['input'];
  pageSize: Scalars['Int']['input'];
  search?: InputMaybe<Scalars['String']['input']>;
}>;


export type ProjectSummariesQuery = { __typename?: 'Query', projectSummaries: { __typename?: 'ProjectPage', page: number, pageSize: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean, items: Array<{ __typename?: 'ProjectSummary', id: string, name: string, targetCurrency: string, agreedRateFirst: boolean, status: ProjectStatus, inviteCode: string, inviteLink: string, memberCount: number, viewerRole: MemberRole, createdAt: string, updatedAt: string }> } };

export type ProjectDetailQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;


export type ProjectDetailQuery = { __typename?: 'Query', project?: { __typename?: 'Project', id: string, name: string, targetCurrency: string, status: ProjectStatus, members: Array<{ __typename?: 'ProjectMember', userId: string, role: MemberRole }> } | null };

export type ProjectParticipantsQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
}>;


export type ProjectParticipantsQuery = { __typename?: 'Query', participants: Array<{ __typename?: 'Participant', id: string, projectId: string, name: string, createdAt: string }> };

export type ProjectExpensesQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type ProjectExpensesQuery = { __typename?: 'Query', expenses: Array<{ __typename?: 'Expense', id: string, projectId: string, payerId: string, amount: number, currency: Currency, description?: string | null, createdAt: string, updatedAt: string, payer?: { __typename?: 'Participant', id: string, name: string } | null }> };

export type DebitCreditSummaryQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type DebitCreditSummaryQuery = { __typename?: 'Query', debitCreditSummary: { __typename?: 'ProjectDebitCreditSummary', projectId: string, currency: Currency, generatedAt: string, totalDebitCount: number, totalCreditCount: number, rows: Array<{ __typename?: 'ParticipantDebitCredit', participantId: string, debitAmount: number, creditAmount: number, debitCount: number, creditCount: number, netAmount: number, participant: { __typename?: 'Participant', id: string, name: string } }> } };

export type CreateProjectMutationVariables = Exact<{
  name: Scalars['String']['input'];
  targetCurrency?: InputMaybe<Scalars['String']['input']>;
  agreedRateFirst?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type CreateProjectMutation = { __typename?: 'Mutation', createProject: { __typename?: 'Project', id: string, name: string, targetCurrency: string, agreedRateFirst: boolean, status: ProjectStatus, inviteCode: string, inviteLink: string, memberCount: number, createdAt: string, updatedAt: string } };

export type CreateExpenseMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
  payerId: Scalars['ID']['input'];
  amount: Scalars['Float']['input'];
  currency: Currency;
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateExpenseMutation = { __typename?: 'Mutation', createExpense: { __typename?: 'Expense', id: string, projectId: string, payerId: string, amount: number, currency: Currency, description?: string | null, createdAt: string, updatedAt: string, payer?: { __typename?: 'Participant', id: string, name: string } | null } };

export type UpdateProjectMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  targetCurrency?: InputMaybe<Scalars['String']['input']>;
  agreedRateFirst?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateProjectMutation = { __typename?: 'Mutation', updateProject: { __typename?: 'Project', id: string, name: string, targetCurrency: string, agreedRateFirst: boolean, status: ProjectStatus, inviteCode: string, inviteLink: string, memberCount: number, createdAt: string, updatedAt: string } };

export type JoinProjectMutationVariables = Exact<{
  inviteCode: Scalars['String']['input'];
}>;


export type JoinProjectMutation = { __typename?: 'Mutation', joinProject: { __typename?: 'Project', id: string } };

export type ArchiveProjectMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;


export type ArchiveProjectMutation = { __typename?: 'Mutation', archiveProject: { __typename?: 'Project', id: string, status: ProjectStatus } };

export type DeleteProjectMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;


export type DeleteProjectMutation = { __typename?: 'Mutation', deleteProject: boolean };

export type LeaveProjectMutationVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;


export type LeaveProjectMutation = { __typename?: 'Mutation', leaveProject: boolean };


export const HealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"}}]}}]} as unknown as DocumentNode<HealthQuery, HealthQueryVariables>;
export const ViewerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"accountRole"}}]}}]}}]} as unknown as DocumentNode<ViewerQuery, ViewerQueryVariables>;
export const ProjectSummariesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProjectSummaries"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectSummaries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"pageSize"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"hasPreviousPage"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"targetCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"agreedRateFirst"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inviteCode"}},{"kind":"Field","name":{"kind":"Name","value":"inviteLink"}},{"kind":"Field","name":{"kind":"Name","value":"memberCount"}},{"kind":"Field","name":{"kind":"Name","value":"viewerRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectSummariesQuery, ProjectSummariesQueryVariables>;
export const ProjectDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProjectDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"project"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"targetCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"members"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectDetailQuery, ProjectDetailQueryVariables>;
export const ProjectParticipantsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProjectParticipants"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"defaultValue":{"kind":"IntValue","value":"1"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"defaultValue":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participants"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<ProjectParticipantsQuery, ProjectParticipantsQueryVariables>;
export const ProjectExpensesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ProjectExpenses"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"defaultValue":{"kind":"IntValue","value":"1"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"defaultValue":{"kind":"IntValue","value":"200"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}},"defaultValue":{"kind":"BooleanValue","value":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"expenses"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"pageSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pageSize"}}},{"kind":"Argument","name":{"kind":"Name","value":"includeDeleted"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"payerId"}},{"kind":"Field","name":{"kind":"Name","value":"payer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ProjectExpensesQuery, ProjectExpensesQueryVariables>;
export const DebitCreditSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DebitCreditSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}},"defaultValue":{"kind":"BooleanValue","value":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"debitCreditSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"includeDeleted"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"totalDebitCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalCreditCount"}},{"kind":"Field","name":{"kind":"Name","value":"rows"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"debitAmount"}},{"kind":"Field","name":{"kind":"Name","value":"creditAmount"}},{"kind":"Field","name":{"kind":"Name","value":"debitCount"}},{"kind":"Field","name":{"kind":"Name","value":"creditCount"}},{"kind":"Field","name":{"kind":"Name","value":"netAmount"}}]}}]}}]}}]} as unknown as DocumentNode<DebitCreditSummaryQuery, DebitCreditSummaryQueryVariables>;
export const CreateProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetCurrency"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agreedRateFirst"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"targetCurrency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetCurrency"}}},{"kind":"Argument","name":{"kind":"Name","value":"agreedRateFirst"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agreedRateFirst"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"targetCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"agreedRateFirst"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inviteCode"}},{"kind":"Field","name":{"kind":"Name","value":"inviteLink"}},{"kind":"Field","name":{"kind":"Name","value":"memberCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateProjectMutation, CreateProjectMutationVariables>;
export const CreateExpenseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateExpense"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"payerId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"amount"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"currency"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Currency"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createExpense"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"payerId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"payerId"}}},{"kind":"Argument","name":{"kind":"Name","value":"amount"},"value":{"kind":"Variable","name":{"kind":"Name","value":"amount"}}},{"kind":"Argument","name":{"kind":"Name","value":"currency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"currency"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"payerId"}},{"kind":"Field","name":{"kind":"Name","value":"payer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateExpenseMutation, CreateExpenseMutationVariables>;
export const UpdateProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetCurrency"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"agreedRateFirst"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"targetCurrency"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetCurrency"}}},{"kind":"Argument","name":{"kind":"Name","value":"agreedRateFirst"},"value":{"kind":"Variable","name":{"kind":"Name","value":"agreedRateFirst"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"targetCurrency"}},{"kind":"Field","name":{"kind":"Name","value":"agreedRateFirst"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"inviteCode"}},{"kind":"Field","name":{"kind":"Name","value":"inviteLink"}},{"kind":"Field","name":{"kind":"Name","value":"memberCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateProjectMutation, UpdateProjectMutationVariables>;
export const JoinProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"inviteCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"inviteCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"inviteCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<JoinProjectMutation, JoinProjectMutationVariables>;
export const ArchiveProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ArchiveProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"archiveProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<ArchiveProjectMutation, ArchiveProjectMutationVariables>;
export const DeleteProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}]}}]} as unknown as DocumentNode<DeleteProjectMutation, DeleteProjectMutationVariables>;
export const LeaveProjectDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveProject"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveProject"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectId"}}}]}]}}]} as unknown as DocumentNode<LeaveProjectMutation, LeaveProjectMutationVariables>;