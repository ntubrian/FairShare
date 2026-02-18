import { OAuth2Client } from "google-auth-library";
import { GraphQLError } from "graphql";
import { IncomingHttpHeaders } from "node:http";
import { env } from "../config/env";
import { appError } from "../lib/errors";
import { userRepository } from "../repositories/userRepository";
import { AuthUser } from "../types";

const bearerPrefix = "Bearer ";

const readBearerToken = (headers: IncomingHttpHeaders) => {
  const authorization = headers.authorization;
  if (!authorization || !authorization.startsWith(bearerPrefix)) {
    return null;
  }
  return authorization.slice(bearerPrefix.length).trim();
};

class AuthService {
  private readonly oauthClient: OAuth2Client | null;

  constructor() {
    this.oauthClient = env.googleClientId
      ? new OAuth2Client(env.googleClientId)
      : null;
  }

  private async authenticateWithGoogleIdToken(idToken: string) {
    if (!this.oauthClient || !env.googleClientId) {
      throw appError(
        "GOOGLE_CLIENT_ID is not configured on server.",
        "INTERNAL_SERVER_ERROR"
      );
    }

    const ticket = await this.oauthClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw appError("Google token payload is invalid.", "UNAUTHENTICATED");
    }

    return userRepository.upsertGoogleUser({
      googleSub: payload.sub,
      email: payload.email,
      displayName: payload.name ?? payload.email,
      avatarUrl: payload.picture ?? null,
      locale: payload.locale ?? null,
    });
  }

  async authenticate(headers: IncomingHttpHeaders): Promise<AuthUser | null> {
    const token = readBearerToken(headers);
    if (token) {
      try {
        return await this.authenticateWithGoogleIdToken(token);
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw appError("Invalid Google ID token.", "UNAUTHENTICATED");
      }
    }

    if (env.allowDevAuthBypass) {
      const bypassUserId = headers["x-user-id"];
      if (typeof bypassUserId === "string" && bypassUserId) {
        const user = await userRepository.findById(bypassUserId);
        if (user) {
          return user;
        }
      }
    }

    return null;
  }
}

export const authService = new AuthService();
