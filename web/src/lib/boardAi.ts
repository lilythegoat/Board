import { t } from "@/i18n";

/** Board AI: answers from a built-in knowledge base, no server or network
    call. The page and the /boardai command both ask here. */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  words: string[];
}

function faq(id: string, words: string[]): FaqEntry {
  return { id, question: t(`boardai.faq.${id}.q`), answer: t(`boardai.faq.${id}.a`), words };
}

export function faqEntries(): FaqEntry[] {
  return [
    faq("cookies", ["cookie", "cookies", "earn", "get", "balance", "shop", "buy", "spend"]),
    faq("daily", ["daily", "bonus", "streak", "login", "every day"]),
    faq("levels", ["level", "xp", "experience", "rank", "level up"]),
    faq("boardplus", ["plus", "board plus", "pro", "supporter", "premium", "platinum", "beast", "starter", "plan", "subscribe", "pay", "price"]),
    faq("servers", ["server", "create", "join", "leave", "invite", "headquarters", "hq"]),
    faq("friends", ["friend", "add", "dm", "message", "block"]),
    faq("avatar", ["avatar", "item", "wear", "wearable", "profile picture", "pfp", "banner"]),
    faq("rules", ["rule", "rules", "report", "appeal", "ban", "mod", "moderator", "safety"]),
    faq("boost", ["boost", "boosts", "server boost"]),
    faq("themes", ["theme", "colour", "color", "purple", "dark", "light", "custom theme"]),
    faq("calls", ["call", "voice", "video", "screen", "share"]),
    faq("account", ["account", "password", "email", "username", "delete", "recovery"]),
  ];
}

/** The best matching answer, or null when nothing in the base fits. */
export function answerQuestion(question: string): FaqEntry | null {
  const q = question.toLowerCase();
  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of faqEntries()) {
    let score = 0;
    for (const word of entry.words) {
      if (q.includes(word)) score += word.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}
