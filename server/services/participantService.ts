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
  async listParticipants(projectId: string, context: GraphQLContext) {
    await projectService.ensureReadable(projectId, context);
    const rows = await participantRepository.listByProject(projectId);
    return rows.map(toParticipant);
  },

  async addParticipant(
    projectId: string,
    name: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    const trimmed = trimAndRequire(name);
    const existing = await participantRepository.listByProject(projectId);
    const duplicated = existing.some(
      (participant) => participant.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicated) {
      throw appError("Participant name already exists.", "BAD_USER_INPUT");
    }

    const created = await participantRepository.add(projectId, trimmed);
    await projectRepository.touchProject(projectId);
    return toParticipant(created);
  },

  async removeParticipant(
    projectId: string,
    participantId: string,
    context: GraphQLContext
  ) {
    await projectService.ensureEditable(projectId, context);
    const participant = await participantRepository.findByIdInProject(
      projectId,
      participantId
    );
    if (!participant) {
      throw appError("Participant not found.", "NOT_FOUND");
    }
    const hasActiveExpenses = await participantRepository.hasActiveExpenses(
      participantId
    );
    if (hasActiveExpenses) {
      throw appError(
        "Cannot remove participant with active expenses.",
        "BAD_USER_INPUT"
      );
    }
    const removed = await participantRepository.remove(participantId);
    if (removed) {
      await projectRepository.touchProject(projectId);
    }
    return removed;
  },
};
