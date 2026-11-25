/**
 * Board's rules, the short list every account agrees to before it uses the
 * app. A new account meets them on the rules step (pages/RulesGatePage)
 * right after the terms: it reads them to the bottom, ticks the box, and
 * the agreement is recorded on the server (POST /me/accept-rules), so the
 * step is done once, on any device, and not once per device like the
 * terms acceptance in lib/legal.
 *
 * RULES_VERSION is the version in force. Bump it here and
 * currentRulesVersion in internal/api/rules.go together when the rules
 * (the appRules.* strings) change in a way everyone should agree to
 * again; accounts whose recorded version is older meet the step again.
 * Accounts from before the step carry version 1 already (migration 0055):
 * they agreed to the Terms when they signed up, so they are not asked.
 */
export const RULES_VERSION = 1;

/** The rules themselves, in the order they are read: appRules.rule1.. in en.json. */
export const APP_RULE_KEYS: string[] = [
  "appRules.rule1",
  "appRules.rule2",
  "appRules.rule3",
  "appRules.rule4",
  "appRules.rule5",
  "appRules.rule6",
  "appRules.rule7",
  "appRules.rule8",
];
