export type DashboardRole = "OWNER" | "EDITOR" | "VIEWER";
export type DashboardProjectStatus = "ACTIVE" | "ARCHIVED";

export type DashboardProject = {
  id: string;
  name: string;
  targetCurrency: string;
  agreedRateFirst: boolean;
  status: DashboardProjectStatus;
  inviteCode: string;
  inviteLink: string;
  memberCount: number;
  viewerRole: DashboardRole;
  createdAt: string;
  updatedAt: string;
};

export type DashboardProjectPage = {
  items: DashboardProject[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ProjectFormInput = {
  name: string;
  targetCurrency: string;
  agreedRateFirst: boolean;
};
