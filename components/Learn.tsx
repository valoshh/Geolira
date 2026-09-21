"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Country, CountryData, QuizQuestion } from "@/types/geography";
import { createCapitalQuestion, createLocateQuestion } from "@/lib/quiz";
import { loadJson } from "@/lib/geography";
import { Check, X } from "lucide-react";
const AtlasMap = dynamic(() => import("./Map"), { ssr: false });

export default function Learn({ country }: { country: Country }) {
  const [data, setData] = useState<CountryData>();
  const [question, setQuestion] = useState<QuizQuestion>();
  const [mode, setMode] = useState<"locate" | "capital">("locate");
  const [answer, setAnswer] = useState<string>();
  useEffect(() => {
    loadJson<CountryData>(`/data/${country.id}.json`).then((value) => {
      setData(value);
      setQuestion(createLocateQuestion(value.divisions));
    });
  }, [country.id]);
  function next(nextMode = mode) {
    if (!data) return;
    setMode(nextMode);
    setAnswer(undefined);
    setQuestion(
      nextMode === "locate"
        ? createLocateQuestion(data.divisions, Date.now())
        : createCapitalQuestion(data.divisions, Date.now()),
    );
  }
  if (!data || !question)
    return <main className="learn-page"><p>Préparation du mode apprentissage…</p></main>;
  const selected = answer != null;
  return (
    <main className="learn-page">
      <div className="learn-header">
        <p className="eyebrow">MODE APPRENTISSAGE</p>
        <h1>Réviser les {country.names.fr}</h1>
        <p>Une session locale, sans compte et sans score permanent.</p>
        <div className="learn-tabs">
          <button className={mode === "locate" ? "selected" : ""} onClick={() => next("locate")}>Trouver une subdivision</button>
          <button className={mode === "capital" ? "selected" : ""} onClick={() => next("capital")}>Capitales</button>
        </div>
      </div>
      {mode === "locate" ? (
        <div className="learn-map">
          <h2>{question.prompt}</h2>
          <AtlasMap countries={[country]} country={country} cities={[]} onWorld={() => {}} onSelect={(id) => !selected && setAnswer(id)} resizeKey={false} />
          {selected && <p className={answer === question.correctAnswer ? "quiz-correct" : "quiz-wrong"}>{answer === question.correctAnswer ? <Check size={17} /> : <X size={17} />} {answer === question.correctAnswer ? "Correct !" : "Pas tout à fait."}</p>}
        </div>
      ) : (
        <div className="quiz-card">
          <h2>{question.prompt}</h2>
          <div className="quiz-choices">{question.choices?.map((choice) => <button key={choice} disabled={selected} className={selected ? choice === question.correctAnswer ? "correct" : choice === answer ? "wrong" : "" : ""} onClick={() => setAnswer(choice)}>{choice}</button>)}</div>
          {selected && <p className={answer === question.correctAnswer ? "quiz-correct" : "quiz-wrong"}>{answer === question.correctAnswer ? "Bonne réponse." : `La bonne réponse est ${question.correctAnswer}.`}</p>}
        </div>
      )}
      {selected && <button className="primary-action" onClick={() => next()}>Question suivante</button>}
    </main>
  );
}
