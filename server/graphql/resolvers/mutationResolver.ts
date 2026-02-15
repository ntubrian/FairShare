import { Arg, Authorized, Ctx, Float, ID, Mutation, Resolver } from "type-graphql";
import { expenseService } from "../../services/expenseService";
import { participantService } from "../../services/participantService";
import { projectService } from "../../services/projectService";
import { Currency, GraphQLContext, MemberRole } from "../../types";
import { CurrencyEnum, MemberRoleEnum } from "../enums";
import { Expense, Participant, Project } from "../types";

@Authorized()
@Resolver()
export class MutationResolver {
  @Mutation(() => Project)
  createProject(
    @Arg("name", () => String) name: string,
    @Arg("targetCurrency", () => String, { defaultValue: "TWD" }) targetCurrency: string,
    @Arg("agreedRateFirst", () => Boolean, { defaultValue: true }) agreedRateFirst: boolean,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.createProject(
      {
        name,
        targetCurrency,
        agreedRateFirst,
      },
      context,
    );
  }

  @Mutation(() => Project)
  updateProject(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("name", () => String, { nullable: true }) name: string | null,
    @Arg("targetCurrency", () => String, { nullable: true }) targetCurrency: string | null,
    @Arg("agreedRateFirst", () => Boolean, { nullable: true }) agreedRateFirst: boolean | null,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.updateProject(
      {
        projectId,
        name,
        targetCurrency,
        agreedRateFirst,
      },
      context,
    );
  }

  @Mutation(() => Project)
  archiveProject(
    @Arg("projectId", () => ID) projectId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.archiveProject(projectId, context);
  }

  @Mutation(() => Boolean)
  deleteProject(
    @Arg("projectId", () => ID) projectId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.deleteProject(projectId, context);
  }

  @Mutation(() => Boolean)
  leaveProject(
    @Arg("projectId", () => ID) projectId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.leaveProject(projectId, context);
  }

  @Mutation(() => Project)
  joinProject(
    @Arg("inviteCode", () => String) inviteCode: string,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.joinProject(inviteCode, context);
  }

  @Mutation(() => Project)
  setMemberRole(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("userId", () => ID) userId: string,
    @Arg("role", () => MemberRoleEnum) role: MemberRoleEnum,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.setMemberRole({ projectId, userId, role: role as MemberRole }, context);
  }

  @Mutation(() => Participant)
  addParticipant(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("name", () => String) name: string,
    @Ctx() context: GraphQLContext,
  ) {
    return participantService.addParticipant(projectId, name, context);
  }

  @Mutation(() => Boolean)
  removeParticipant(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("participantId", () => ID) participantId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return participantService.removeParticipant(projectId, participantId, context);
  }

  @Mutation(() => Expense)
  createExpense(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("payerId", () => ID) payerId: string,
    @Arg("amount", () => Float) amount: number,
    @Arg("currency", () => CurrencyEnum) currency: CurrencyEnum,
    @Arg("description", () => String, { nullable: true }) description: string | null,
    @Ctx() context: GraphQLContext,
  ) {
    return expenseService.createExpense(
      {
        projectId,
        payerId,
        amount,
        currency: currency as Currency,
        description,
      },
      context,
    );
  }

  @Mutation(() => Expense)
  updateExpense(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("expenseId", () => ID) expenseId: string,
    @Arg("payerId", () => ID, { nullable: true }) payerId: string | null,
    @Arg("amount", () => Float, { nullable: true }) amount: number | null,
    @Arg("currency", () => CurrencyEnum, { nullable: true }) currency: CurrencyEnum | null,
    @Arg("description", () => String, { nullable: true }) description: string | null,
    @Ctx() context: GraphQLContext,
  ) {
    return expenseService.updateExpense(
      {
        projectId,
        expenseId,
        payerId,
        amount,
        currency: currency as Currency | null,
        description,
      },
      context,
    );
  }

  @Mutation(() => Expense)
  softDeleteExpense(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("expenseId", () => ID) expenseId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return expenseService.softDeleteExpense(projectId, expenseId, context);
  }

  @Mutation(() => Expense)
  restoreExpense(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("expenseId", () => ID) expenseId: string,
    @Ctx() context: GraphQLContext,
  ) {
    return expenseService.restoreExpense(projectId, expenseId, context);
  }

  @Mutation(() => Project)
  setAgreedRate(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("fromCurrency", () => CurrencyEnum) fromCurrency: CurrencyEnum,
    @Arg("toCurrency", () => CurrencyEnum) toCurrency: CurrencyEnum,
    @Arg("rate", () => Float) rate: number,
    @Ctx() context: GraphQLContext,
  ) {
    return projectService.setAgreedRate(
      {
        projectId,
        fromCurrency: fromCurrency as Currency,
        toCurrency: toCurrency as Currency,
        rate,
      },
      context,
    );
  }
}
