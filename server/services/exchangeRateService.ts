import { appError } from "../lib/errors";
import { Currency, CURRENCIES, RateSource } from "../types";

type RateRecord = Record<Currency, number>;

const fallbackRatesFromTwd: RateRecord = {
  USD: 0.0312,
  TWD: 1,
  JPY: 4.72,
  EUR: 0.0288,
};

let liveCache:
  | {
      fetchedAt: string;
      ratesFromTwd: RateRecord;
    }
  | undefined;

const fetchRatesFromApi = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/TWD", {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Rate API status ${response.status}`);
    }

    const payload = (await response.json()) as {
      rates?: Partial<Record<Currency, number>>;
    };
    const rates = payload.rates;
    if (!rates) {
      throw new Error("Missing rates payload");
    }

    const mapped: RateRecord = {
      USD: Number(rates.USD),
      TWD: Number(rates.TWD),
      JPY: Number(rates.JPY),
      EUR: Number(rates.EUR),
    };

    if (
      Object.values(mapped).some(
        (value) => !Number.isFinite(value) || value <= 0
      )
    ) {
      throw new Error("Invalid rates payload");
    }

    return mapped;
  } catch {
    return fallbackRatesFromTwd;
  } finally {
    clearTimeout(timer);
  }
};

const toBaseCurrencyRates = (
  ratesFromTwd: RateRecord,
  baseCurrency: Currency
): RateRecord => {
  const baseValue = ratesFromTwd[baseCurrency];
  if (!baseValue || baseValue <= 0) {
    throw appError("Base currency rate unavailable.", "EXCHANGE_RATE_ERROR");
  }
  return {
    USD: ratesFromTwd.USD / baseValue,
    TWD: ratesFromTwd.TWD / baseValue,
    JPY: ratesFromTwd.JPY / baseValue,
    EUR: ratesFromTwd.EUR / baseValue,
  };
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 10000) / 10000;

export const exchangeRateService = {
  async getLiveSnapshot() {
    const cacheMaxAgeMs = 10 * 60 * 1000;
    if (liveCache) {
      const age = Date.now() - new Date(liveCache.fetchedAt).getTime();
      if (age <= cacheMaxAgeMs) {
        return liveCache;
      }
    }

    liveCache = {
      fetchedAt: new Date().toISOString(),
      ratesFromTwd: await fetchRatesFromApi(),
    };
    return liveCache;
  },

  convertUsingLiveRates(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
    ratesFromTwd: RateRecord
  ) {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    const fromRate = ratesFromTwd[fromCurrency];
    const toRate = ratesFromTwd[toCurrency];
    if (!fromRate || !toRate) {
      throw appError("Currency rate unavailable.", "EXCHANGE_RATE_ERROR");
    }
    const inTwd = amount / fromRate;
    return inTwd * toRate;
  },

  async listRates(baseCurrency: Currency): Promise<{
    baseCurrency: Currency;
    source: RateSource;
    fetchedAt: string;
    rates: Array<{ currency: Currency; rate: number }>;
  }> {
    const snapshot = await this.getLiveSnapshot();
    const converted = toBaseCurrencyRates(snapshot.ratesFromTwd, baseCurrency);
    return {
      baseCurrency,
      source: "LIVE",
      fetchedAt: snapshot.fetchedAt,
      rates: CURRENCIES.map((currency) => ({
        currency,
        rate: roundMoney(converted[currency]),
      })),
    };
  },
};
