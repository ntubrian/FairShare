import { Arg, Authorized, Ctx, ID, Int, Query, Resolver } from "type-graphql";
import { assertCurrency, normalizeLocale } from "../../services/domainUtils";
import { exchangeRateService } from "../../services/exchangeRateService";
import { expenseService } from "../../services/expenseService";
import { participantService } from "../../services/participantService";
import { projectService } from "../../services/projectService";
import { settlementService } from "../../services/settlementService";
import { GraphQLContext } from "../../types";
import { CurrencyEnum, LocaleEnum } from "../enums";
import {
  Expense,
  InviteValidation,
  Participant,
  PdfChecklist,
  ProjectPage,
  Project,
  RateSnapshot,
  SettlementResult,
  User,
} from "../types";

@Resolver()
export class QueryResolver {
  @Query(() => String)
  health() {
    return "ok";
  }

  @Authorized()
  @Query(() => User)
  viewer(@Ctx() context: GraphQLContext) {
    return projectService.toGraphQLViewer(
      projectService.requireViewer(context)
    );
  }

  @Authorized()
  @Query(() => [User])
  users(@Ctx() context: GraphQLContext) {
    return projectService.listUsers(context);
  }

  @Authorized()
  @Query(() => [Project])
  projects(@Ctx() context: GraphQLContext) {
    return projectService.listProjects(context);
  }

  @Authorized()
  @Query(() => ProjectPage)
  projectSummaries(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("pageSize", () => Int, { defaultValue: 10 }) pageSize: number,
    @Arg("search", () => String, { nullable: true }) search: string | null,
    @Ctx() context: GraphQLContext
  ) {
    return projectService.listProjectSummaries(context, {
      page,
      pageSize,
      search,
    });
  }

  @Authorized()
  @Query(() => Project, { nullable: true })
  project(@Arg("id", () => ID) id: string, @Ctx() context: GraphQLContext) {
    return projectService.getProject(id, context);
  }

  @Authorized()
  @Query(() => InviteValidation)
  projectByInviteCode(@Arg("inviteCode", () => String) inviteCode: string) {
    return projectService.validateInvite(inviteCode);
  }

  @Authorized()
  @Query(() => [Participant])
  participants(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("pageSize", () => Int, { defaultValue: 50 }) pageSize: number,
    @Ctx() context: GraphQLContext
  ) {
    return participantService.listParticipants(projectId, context, {
      page,
      pageSize,
    });
  }

  @Authorized()
  @Query(() => [Expense])
  expenses(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("includeDeleted", () => Boolean, { defaultValue: false })
    includeDeleted: boolean,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("pageSize", () => Int, { defaultValue: 50 }) pageSize: number,
    @Ctx() context: GraphQLContext
  ) {
    return expenseService.listExpenses(
      projectId,
      Boolean(includeDeleted),
      context,
      {
        page,
        pageSize,
      }
    );
  }

  @Query(() => LocaleEnum)
  detectLocale(@Arg("acceptLanguage", () => String) acceptLanguage: string) {
    return normalizeLocale(acceptLanguage) as LocaleEnum;
  }

  @Authorized()
  @Query(() => RateSnapshot)
  exchangeRates(
    @Arg("baseCurrency", () => CurrencyEnum, { defaultValue: CurrencyEnum.TWD })
    baseCurrency: CurrencyEnum
  ) {
    return exchangeRateService.listRates(assertCurrency(baseCurrency));
  }

  @Authorized()
  @Query(() => SettlementResult)
  calculateSettlement(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("includeDeleted", () => Boolean, { defaultValue: false })
    includeDeleted: boolean,
    @Ctx() context: GraphQLContext
  ) {
    return settlementService.calculate(
      projectId,
      Boolean(includeDeleted),
      context
    );
  }

  @Authorized()
  @Query(() => PdfChecklist)
  pdfExportPreview(
    @Arg("projectId", () => ID) projectId: string,
    @Arg("includeSoftDeleted", () => Boolean, { defaultValue: false })
    includeSoftDeleted: boolean,
    @Ctx() context: GraphQLContext
  ) {
    return settlementService.buildPdfPreview(
      projectId,
      Boolean(includeSoftDeleted),
      context
    );
  }
}
