export const CURRENCIES = ["USD", "TWD", "JPY", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MEMBER_ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const SPLIT_MODES = ["EQUAL", "EXACT", "SHARES"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const PROJECT_STATUS = ["ACTIVE", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

export type Locale = "EN" | "ZH_TW";
export type RateSource = "AGREED" | "LIVE";

export type AuthUser = {
  id: string;
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  appRole: MemberRole;
  locale: string | null;
};

export type GraphQLContext = {
  viewer: AuthUser | null;
  acceptLanguage: string;
};
