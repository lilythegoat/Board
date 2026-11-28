import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { answerQuestion, faqEntries } from "@/lib/boardAi";
import s from "./BoardAIPage.module.css";

import { t } from "@/i18n";
/** Board AI: ask a question, get an answer from Board's own knowledge base. */
export function BoardAIPage() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("q") ?? "";
  const [query, setQuery] = useState(asked);
  const [answer, setAnswer] = useState(() => (asked ? answerQuestion(asked) : null));
  const [missed, setMissed] = useState(() => asked !== "" && !answerQuestion(asked));
  const entries = useMemo(() => faqEntries(), []);

  useEffect(() => {
    if (!asked) return;
    setQuery(asked);
    const found = answerQuestion(asked);
    setAnswer(found);
    setMissed(!found);
  }, [asked]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    setParams({ q: question }, { replace: true });
  };

  return (
    <div className={s.page}>
      <h1 className={s.title}><Sparkles size={28} /> {t("boardai.title")}</h1>
      <p className={s.lede}>{t("boardai.lede")}</p>
      <div className={s.askRow}>
        <input
          className={s.ask}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(query);
          }}
          placeholder={t("boardai.askPlaceholder")}
          aria-label={t("boardai.askPlaceholder")}
        />
        <button className={s.askBtn} onClick={() => ask(query)}>{t("boardai.ask")}</button>
      </div>
      {answer ? (
        <div className={s.answer}>
          <div className={s.answerQ}>{answer.question}</div>
          <div className={s.answerA}>{answer.answer}</div>
        </div>
      ) : null}
      {missed ? <div className={s.missed}>{t("boardai.noAnswer")}</div> : null}
      <h2 className={s.sub}>{t("boardai.faqTitle")}</h2>
      <div className={s.list}>
        {entries.map((entry) => (
          <button key={entry.id} className={s.item} onClick={() => ask(entry.question)}>
            <span className={s.q}>{entry.question}</span>
            <span className={s.a}>{entry.answer}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
