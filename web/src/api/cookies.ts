import { api } from "./client";
import type { Snowflake } from "./types";

/** An account's Cookies as its app needs them (api/cookies.go). */
export interface CookiesState {
  balance: number;
  last_daily: number;
  can_claim_daily: boolean;
}

/** What giving Cookies answers with: both new balances. */
export interface GiveResult {
  balance: number;
  recipient_balance: number;
}

/** Cookies (api/cookies.go): the real balance, the daily bonus, giving. */
export const cookies = {
  get(): Promise<CookiesState> {
    return api.request<CookiesState>("GET", "/cookies");
  },
  /** Pays the daily bonus, once a day; claimed says this call paid. */
  claimDaily(): Promise<{ balance: number; claimed: boolean }> {
    return api.request("POST", "/cookies/daily");
  },
  /** Sends Cookies to someone: from your balance, unless you are the owner. */
  give(to: Snowflake, amount: number): Promise<GiveResult> {
    return api.request<GiveResult>("POST", "/cookies/give", { user_id: to, amount });
  },
};
