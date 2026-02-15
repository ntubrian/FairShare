import { appError } from "../lib/errors";
import { CURRENCIES, Currency, Locale } from "../types";

export const assertCurrency = (value: string): Currency => {
  if (!CURRENCIES.includes(value as Currency)) {
    throw appError(`Unsupported currency: ${value}`, "BAD_USER_INPUT");
  }
  return value as Currency;
};

export const normalizeLocale = (acceptLanguage: string): Locale => {
  const value = acceptLanguage.toLowerCase();
  if (value.startsWith("zh-tw") || value.startsWith("zh")) {
    return "ZH_TW";
  }
  return "EN";
};

export const roundMoney = (value: number, decimals = 2) => {
  const base = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * base) / base;
};
