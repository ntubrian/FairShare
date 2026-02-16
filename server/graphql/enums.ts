import { registerEnumType } from "type-graphql";

export enum CurrencyEnum {
  USD = "USD",
  TWD = "TWD",
  JPY = "JPY",
  EUR = "EUR",
}

export enum MemberRoleEnum {
  OWNER = "OWNER",
  EDITOR = "EDITOR",
  VIEWER = "VIEWER",
}

export enum ProjectStatusEnum {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum RateSourceEnum {
  AGREED = "AGREED",
  LIVE = "LIVE",
}

export enum SplitModeEnum {
  EQUAL = "EQUAL",
  EXACT = "EXACT",
  SHARES = "SHARES",
}

export enum LocaleEnum {
  EN = "EN",
  ZH_TW = "ZH_TW",
}

registerEnumType(CurrencyEnum, {
  name: "Currency",
});

registerEnumType(MemberRoleEnum, {
  name: "MemberRole",
});

registerEnumType(ProjectStatusEnum, {
  name: "ProjectStatus",
});

registerEnumType(RateSourceEnum, {
  name: "RateSource",
});

registerEnumType(SplitModeEnum, {
  name: "SplitMode",
});

registerEnumType(LocaleEnum, {
  name: "Locale",
});
