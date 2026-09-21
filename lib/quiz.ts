import type {
  AdministrativeDivision,
  QuizQuestion,
} from "@/types/geography";

function shuffle<T>(items: T[], seed: number) {
  return [...items].sort((a, b) => {
    const ax = `${seed}:${String(a)}`;
    const bx = `${seed}:${String(b)}`;
    return ax.localeCompare(bx);
  });
}

export function createCapitalQuestion(
  divisions: AdministrativeDivision[],
  seed = Date.now(),
): QuizQuestion | undefined {
  const available = divisions.filter((division) => division.capital);
  const target = available[seed % available.length];
  if (!target) return undefined;
  const distractors = shuffle(
    available.filter((division) => division.id !== target.id),
    seed,
  )
    .slice(0, 3)
    .map((division) => division.capital!);
  return {
    id: `capital:${target.id}`,
    type: "division-capital",
    prompt: `Quelle est la capitale de ${target.names.fr} ?`,
    targetEntityId: target.id,
    choices: shuffle([target.capital!, ...distractors], seed),
    correctAnswer: target.capital!,
  };
}

export function createLocateQuestion(
  divisions: AdministrativeDivision[],
  seed = Date.now(),
): QuizQuestion | undefined {
  const target = divisions[seed % divisions.length];
  if (!target) return undefined;
  return {
    id: `locate:${target.id}`,
    type: "locate-division",
    prompt: `Cliquez sur ${target.names.fr}.`,
    targetEntityId: target.id,
    correctAnswer: target.id,
  };
}
