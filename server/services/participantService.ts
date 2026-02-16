import { appError } from "../lib/errors";
import { participantRepository } from "../repositories/participantRepository";
import { projectRepository } from "../repositories/projectRepository";
import { GraphQLContext } from "../types";
import { projectService } from "./projectService";

type GraphQLParticipant = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
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

const trimAndRequire = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw appError("Participant name is required.", "BAD_USER_INPUT");
  }
  return trimmed;
};

export const participantService = {
  async listParticipants(
    projectId: string,
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
    const rows = await participantRepository.listByProject(projectId, {
      page,
      pageSize,
    });
    return rows.map(toParticipant);
  },

  async addParticipant(
    projectId: string,
    name: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    const trimmed = trimAndRequire(name);
    try {
      return await projectRepository.withProjectWriteLock(
        projectId,
        async (tx) => {
          const created = await participantRepository.add(
            projectId,
            trimmed,
            tx
          );
          await projectRepository.touchProject(projectId, tx);
          return toParticipant(created);
        }
      );
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        throw appError("Participant name already exists.", "BAD_USER_INPUT");
      }
      throw error;
    }
  },

  async removeParticipant(
    projectId: string,
    participantId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    return projectRepository.withProjectWriteLock(projectId, async (tx) => {
      const participant = await participantRepository.findByIdInProject(
        projectId,
        participantId,
        tx
      );
      if (!participant) {
        throw appError("Participant not found.", "NOT_FOUND");
      }
      const hasActiveExpenses = await participantRepository.hasActiveExpenses(
        participantId,
        tx
      );
      if (hasActiveExpenses) {
        throw appError(
          "Cannot remove participant with active expenses.",
          "BAD_USER_INPUT"
        );
      }
      const removed = await participantRepository.remove(participantId, tx);
      if (removed) {
        await projectRepository.touchProject(projectId, tx);
      }
      return removed;
    });
  },
};
