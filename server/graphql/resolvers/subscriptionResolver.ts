import {
  Arg,
  Authorized,
  ID,
  Resolver,
  Root,
  Subscription,
} from "type-graphql";
import { expenseAddedTopic, graphqlPubSub } from "../../realtime/pubSub";
import { projectService } from "../../services/projectService";
import { GraphQLContext } from "../../types";
import { Expense } from "../types";

@Resolver()
export class SubscriptionResolver {
  @Authorized()
  @Subscription(() => Expense, {
    subscribe: async ({ args, context }) => {
      const projectId = String(args.projectId ?? "");
      await projectService.ensureReadable(projectId, context as GraphQLContext);
      return graphqlPubSub.subscribe(expenseAddedTopic(projectId));
    },
  })
  expenseAdded(
    @Arg("projectId", () => ID) _projectId: string,
    @Root() payload: Expense
  ) {
    return payload;
  }
}
