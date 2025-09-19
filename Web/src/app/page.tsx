"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  API,
  generateFutureDiary,
  generateImage,
  generateTodayReflection,
} from "@/lib/api";

type DiaryPageState = {
  text: string;
  imageUrl: string | null;
  loading: boolean;
};

const INTEREST_PRESETS = ["読書", "散歩", "映画鑑賞", "カフェ", "ストレッチ"];

type DiffSummary = {
  message: string;
  addedKeywords: string[];
  removedKeywords: string[];
  planLength: number;
  actualLength: number;
};

function buildDiffSummary(planText: string, actualText: string): DiffSummary | null {
  const plan = planText.trim();
  const actual = actualText.trim();
  if (!plan && !actual) return null;

  const planLength = plan.length;
  const actualLength = actual.length;
  const delta = actualLength - planLength;

  let message: string;
  if (Math.abs(delta) <= 15) {
    message = "文字量はほぼ同じです。";
  } else if (delta > 0) {
    message = `実際の文章は予定よりも約 ${delta} 文字長くなりました。`;
  } else {
    message = `実際の文章は予定よりも約 ${Math.abs(delta)} 文字短くまとまりました。`;
  }

  const tokenize = (value: string) => value.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const planTokens = new Set(tokenize(plan));
  const actualTokens = new Set(tokenize(actual));

  const addedKeywords = Array.from(actualTokens).filter((token) => !planTokens.has(token)).slice(0, 5);
  const removedKeywords = Array.from(planTokens).filter((token) => !actualTokens.has(token)).slice(0, 5);

  return {
    message,
    addedKeywords,
    removedKeywords,
    planLength,
    actualLength,
  };
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [planInput, setPlanInput] = useState("");
  const [interestList, setInterestList] = useState<string[]>([]);
  const [actualInput, setActualInput] = useState("");
  const [planPage, setPlanPage] = useState<DiaryPageState>({ text: "", imageUrl: null, loading: false });
  const [actualPage, setActualPage] = useState<DiaryPageState>({ text: "", imageUrl: null, loading: false });

  const diffSummary = useMemo(
    () => buildDiffSummary(planPage.text, actualPage.text),
    [planPage.text, actualPage.text],
  );

  async function handleGeneratePlan() {
    setPlanPage((prev) => ({ ...prev, loading: true }));
    try {
      const textResult = await generateFutureDiary({
        plan: planInput || undefined,
        interests: interestList.length > 0 ? interestList : undefined,
        style: "casual",
      });

      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: "watercolor",
        aspect_ratio: "1:1",
      });

      setPlanPage({
        text: textResult.generated_text,
        imageUrl: imageResult.public_url || null,
        loading: false,
      });
    } catch (error) {
      console.error("Plan generation failed", error);
      alert("予定日記の生成に失敗しました。時間を置いて再度お試しください。");
      setPlanPage((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleGenerateActual() {
    if (!actualInput.trim()) return;
    setActualPage((prev) => ({ ...prev, loading: true }));
    try {
      const textResult = await generateTodayReflection({
        reflection_text: actualInput,
        style: "diary",
      });

      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: "watercolor",
        aspect_ratio: "1:1",
      });

      setActualPage({
        text: textResult.generated_text,
        imageUrl: imageResult.public_url || null,
        loading: false,
      });
    } catch (error) {
      console.error("Reflection generation failed", error);
      alert("実際日記の生成に失敗しました。時間を置いて再度お試しください。");
      setActualPage((prev) => ({ ...prev, loading: false }));
    }
  }

  function handleSuggestActivities() {
    setInterestList(INTEREST_PRESETS);
    setPlanInput("");
  }

  function handleDateChange(offset: number) {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      return next;
    });
    setPlanInput("");
    setInterestList([]);
    setActualInput("");
    setPlanPage({ text: "", imageUrl: null, loading: false });
    setActualPage({ text: "", imageUrl: null, loading: false });
  }

  const selectedDateLabel = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;

  const notebookBackground = {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.9) 100%), repeating-linear-gradient(transparent, transparent 46px, rgba(0,0,0,0.04) 47px)",
    backgroundSize: "100% 100%, 24px 48px",
  } as const;

  return (
    <div className="min-h-screen bg-[#f5ede1] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_60%)] pb-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <header className="text-center lg:text-left">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Future Diary</p>
          <h1 className="text-3xl font-semibold text-slate-900">未来日記ノート</h1>
          <p className="mt-2 text-sm text-slate-600">
            未来の予定と実際の出来事を書き留めて、ノートをめくるように振り返りましょう。
          </p>
        </header>

        <section className="flex items-center justify-between rounded-3xl bg-white/70 px-5 py-4 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => handleDateChange(-1)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            前の日へ
          </button>
          <div className="text-lg font-semibold text-slate-800">{selectedDateLabel}</div>
          <button
            type="button"
            onClick={() => handleDateChange(1)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            次の日へ
          </button>
        </section>

        <div className="relative overflow-hidden rounded-[40px] bg-[#fffaf2] shadow-[0_35px_60px_-25px_rgba(51,35,17,0.3)]" style={notebookBackground}>
          <div className="pointer-events-none absolute inset-y-6 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-rose-200/60 shadow-[4px_0_18px_rgba(0,0,0,0.15)]"></div>
          {Array.from({ length: 5 }, (_, index) => 80 + index * 120).map((offset) => (
            <div
              key={offset}
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full bg-rose-300/50 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.25)]"
              style={{ left: "5.5rem", top: `${offset}px` }}
            ></div>
          ))}
          {Array.from({ length: 5 }, (_, index) => 80 + index * 120).map((offset) => (
            <div
              key={`right-${offset}`}
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full bg-rose-300/50 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.25)]"
              style={{ left: "calc(100% - 5.5rem)", top: `${offset}px` }}
            ></div>
          ))}

          <div className="relative grid gap-8 p-10 lg:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-8 shadow-sm">
              <h2 className="text-lg font-semibold text-blue-700">未来の予定</h2>
              <textarea
                value={planInput}
                onChange={(event) => setPlanInput(event.target.value)}
                placeholder="やりたいこと、訪れたい場所、身につけたい習慣などをメモしましょう。"
                className="mt-4 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {interestList.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleSuggestActivities}
                  className="rounded-full border border-blue-200 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-50"
                >
                  プリセットを追加
                </button>
              </div>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={planPage.loading}
                className="mt-4 w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-200"
              >
                {planPage.loading ? "生成中..." : "未来日記を生成"}
              </button>
              {(planPage.text || planPage.imageUrl) && (
                <div className="mt-6 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                  {planPage.imageUrl && (
                    <div className="overflow-hidden rounded-2xl border border-blue-100">
                      <Image
                        src={planPage.imageUrl}
                        alt="未来日記の挿絵"
                        width={640}
                        height={480}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                  )}
                  {planPage.text && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {planPage.text}
                    </p>
                  )}
                </div>
              )}
            </article>

            <article className="rounded-[28px] border border-slate-200/70 bg-white/80 px-6 py-8 shadow-sm">
              <h2 className="text-lg font-semibold text-emerald-700">実際の出来事</h2>
              <textarea
                value={actualInput}
                onChange={(event) => setActualInput(event.target.value)}
                placeholder="一日の振り返りや気づきを書き残しましょう。"
                className="mt-4 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring"
              />
              <button
                type="button"
                onClick={handleGenerateActual}
                disabled={actualPage.loading || !actualInput.trim()}
                className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:bg-slate-200"
              >
                {actualPage.loading ? "生成中..." : "実際の日記を生成"}
              </button>
              {(actualPage.text || actualPage.imageUrl) && (
                <div className="mt-6 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  {actualPage.imageUrl && (
                    <div className="overflow-hidden rounded-2xl border border-emerald-100">
                      <Image
                        src={actualPage.imageUrl}
                        alt="実際日記の挿絵"
                        width={640}
                        height={480}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                  )}
                  {actualPage.text && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {actualPage.text}
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>
        </div>

        <section className="rounded-[32px] border border-slate-200/60 bg-white/90 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-800">差分要約</h2>
          {diffSummary ? (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>{diffSummary.message}</p>
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>予定: {diffSummary.planLength}文字</span>
                <span>実際: {diffSummary.actualLength}文字</span>
              </div>
              {diffSummary.addedKeywords.length > 0 && (
                <p>
                  追加されたキーワード: <span className="font-medium text-emerald-600">{diffSummary.addedKeywords.join(", ")}</span>
                </p>
              )}
              {diffSummary.removedKeywords.length > 0 && (
                <p>
                  予定にのみ含まれていたキーワード: <span className="font-medium text-rose-600">{diffSummary.removedKeywords.join(", ")}</span>
                </p>
              )}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-500">抜粋メモ</p>
                {planPage.text && (
                  <p className="mt-2">
                    <span className="font-semibold text-blue-600">予定:</span> {planPage.text.slice(0, 60)}{planPage.text.length > 60 ? "…" : ""}
                  </p>
                )}
                {actualPage.text && (
                  <p className="mt-2">
                    <span className="font-semibold text-emerald-600">実際:</span> {actualPage.text.slice(0, 60)}{actualPage.text.length > 60 ? "…" : ""}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              差分を表示するには、まず未来日記と実際の日記の両方を生成してください。
            </p>
          )}
        </section>

        <footer className="text-center text-xs text-slate-400">
          API base: {API}
        </footer>
      </div>
    </div>
  );
}
