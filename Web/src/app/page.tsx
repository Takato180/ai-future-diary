"use client";

import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import {
  API,
  generateFutureDiary,
  generateImage,
  generateTodayReflection,
  saveDiaryEntry,
  getDiaryEntry,
  getDiaryEntriesByMonth,
  generateDiffSummary,
  getActivitySuggestions,
  DiaryEntry,
} from "@/lib/api";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import UserHeader from "@/components/UserHeader";

type DiaryPageState = {
  text: string;
  imageUrl: string | null;
  loading: boolean;
};

const INTEREST_PRESETS = ["読書", "散歩", "映画鑑賞", "カフェ", "ストレッチ"];

function cleanMarkdownArtifacts(text: string): string {
  return text
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/\*/g, '')   // Remove italic markdown
    .replace(/^#+\s*/gm, '') // Remove heading markdown
    .replace(/^-\s*/gm, '') // Remove list markdown
    .replace(/`/g, '')    // Remove code markdown
    .trim();
}

type DiffSummary = {
  message: string;
  addedKeywords: string[];
  removedKeywords: string[];
};

function buildDiffSummary(planText: string, actualText: string): DiffSummary | null {
  const plan = planText.trim();
  const actual = actualText.trim();
  if (!plan && !actual) return null;

  let message: string;
  if (plan && actual) {
    message = "予定と実際の活動内容を比較しました。";
  } else if (plan && !actual) {
    message = "予定は立てましたが、実際の活動は未記録です。";
  } else {
    message = "実際の活動のみ記録されています。";
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
  };
}

function DiaryApp() {
  const { user, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ログインが必要な場合はモーダルを表示
  useEffect(() => {
    if (!isLoading && !user) {
      setShowAuthModal(true);
    }
  }, [isLoading, user]);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [planInput, setPlanInput] = useState("");
  const [interestList, setInterestList] = useState<string[]>([]);
  const [actualInput, setActualInput] = useState("");
  const [planPage, setPlanPage] = useState<DiaryPageState>({ text: "", imageUrl: null, loading: false });
  const [actualPage, setActualPage] = useState<DiaryPageState>({ text: "", imageUrl: null, loading: false });
  const [savedEntry, setSavedEntry] = useState<DiaryEntry | null>(null);
  const [aiDiffSummary, setAiDiffSummary] = useState<string>("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [monthlyEntries, setMonthlyEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [planUseAI, setPlanUseAI] = useState(true);
  const [actualUseAI, setActualUseAI] = useState(true);

  const diffSummary = useMemo(
    () => buildDiffSummary(planPage.text, actualPage.text),
    [planPage.text, actualPage.text],
  );

  const selectedDateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Load existing entry when date changes
  useEffect(() => {
    async function loadEntry() {
      try {
        const entry = await getDiaryEntry(selectedDateString);
        if (entry) {
          setSavedEntry(entry);
          if (entry.planText) {
            setPlanPage(prev => ({ ...prev, text: entry.planText || "" }));
            if (entry.planImageUrl) {
              setPlanPage(prev => ({ ...prev, imageUrl: entry.planImageUrl || null }));
            }
          }
          if (entry.actualText) {
            setActualPage(prev => ({ ...prev, text: entry.actualText || "" }));
            if (entry.actualImageUrl) {
              setActualPage(prev => ({ ...prev, imageUrl: entry.actualImageUrl || null }));
            }
          }
          if (entry.diffText) {
            setAiDiffSummary(entry.diffText);
          }
        } else {
          setSavedEntry(null);
          setAiDiffSummary("");
        }
      } catch (error) {
        console.error("Failed to load entry:", error);
      }
    }
    loadEntry();
  }, [selectedDateString]);

  // Load monthly entries for calendar
  useEffect(() => {
    async function loadMonthlyEntries() {
      if (!showCalendar) return;
      try {
        const yearMonth = selectedDate.toISOString().slice(0, 7); // YYYY-MM
        const entries = await getDiaryEntriesByMonth(yearMonth);
        setMonthlyEntries(entries);
      } catch (error) {
        console.error("Failed to load monthly entries:", error);
      }
    }
    loadMonthlyEntries();
  }, [selectedDate, showCalendar]);

  async function handleGeneratePlan() {
    setPlanPage((prev) => ({ ...prev, loading: true }));
    try {
      const textResult = await generateFutureDiary({
        plan: planInput || undefined,
        interests: interestList.length > 0 ? interestList : undefined,
        style: "casual",
        use_ai: planUseAI,
        user_id: user?.userId,
      });

      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: "watercolor",
        aspect_ratio: "1:1",
      });

      const newPlanPage = {
        text: textResult.generated_text,
        imageUrl: imageResult.public_url || null,
        loading: false,
      };

      setPlanPage(newPlanPage);

      // Save to database
      await saveToDiary({
        planText: textResult.generated_text,
        planImageUrl: imageResult.public_url,
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
        use_ai: actualUseAI,
        user_id: user?.userId,
      });

      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: "watercolor",
        aspect_ratio: "1:1",
      });

      const newActualPage = {
        text: textResult.generated_text,
        imageUrl: imageResult.public_url || null,
        loading: false,
      };

      setActualPage(newActualPage);

      // Save to database
      await saveToDiary({
        actualText: textResult.generated_text,
        actualImageUrl: imageResult.public_url,
      });
    } catch (error) {
      console.error("Reflection generation failed", error);
      alert("実際日記の生成に失敗しました。時間を置いて再度お試しください。");
      setActualPage((prev) => ({ ...prev, loading: false }));
    }
  }

  async function saveToDiary(updates: Partial<DiaryEntry>) {
    try {
      const savedEntryData = await saveDiaryEntry(selectedDateString, {
        date: selectedDateString,
        ...updates,
      });
      setSavedEntry(savedEntryData);
    } catch (error) {
      console.error("Failed to save diary entry:", error);
    }
  }

  async function handleGenerateAIDiff() {
    if (!planPage.text || !actualPage.text) {
      alert("予定と実際の両方の日記が生成されている必要があります。");
      return;
    }

    setLoading(true);
    try {
      const result = await generateDiffSummary(selectedDateString);
      setAiDiffSummary(result.diffText);
      setSavedEntry(prev => prev ? { ...prev, diffText: result.diffText } : null);
    } catch (error) {
      console.error("Failed to generate reflection summary:", error);
      alert("振り返りサマリーの生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggestActivities() {
    if (!user) {
      alert("ログインが必要です");
      return;
    }

    setLoading(true);
    try {
      const suggestions = await getActivitySuggestions({
        user_id: user.userId,
        date: selectedDateString,
      });

      // 提案された活動をinterestListに設定
      setInterestList(suggestions.suggestions.slice(0, 5)); // 最大5個

      // プランの入力欄に提案理由を追加（オプション）
      if (suggestions.reasoning && !planInput.trim()) {
        setPlanInput(`AI提案: ${suggestions.reasoning}`);
      }

      console.log("AI Activity Suggestions:", suggestions);
    } catch (error) {
      console.error("Failed to get activity suggestions:", error);
      // フォールバック
      setInterestList(["散歩", "読書", "カフェでコーヒー", "ストレッチ"]);
    } finally {
      setLoading(false);
    }
  }

  function handleDateChange(offset: number) {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      return next;
    });
    // Clear inputs and generated content (will be loaded from DB if exists)
    setPlanInput("");
    setInterestList([]);
    setActualInput("");
    setPlanPage({ text: "", imageUrl: null, loading: false });
    setActualPage({ text: "", imageUrl: null, loading: false });
    setAiDiffSummary("");
  }

  function handleCalendarDateSelect(date: Date) {
    setSelectedDate(date);
    setShowCalendar(false);
    // Clear inputs and generated content (will be loaded from DB if exists)
    setPlanInput("");
    setInterestList([]);
    setActualInput("");
    setPlanPage({ text: "", imageUrl: null, loading: false });
    setActualPage({ text: "", imageUrl: null, loading: false });
    setAiDiffSummary("");
  }

  const selectedDateLabel = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;

  const notebookBackground = {
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.9) 100%), repeating-linear-gradient(transparent, transparent 46px, rgba(0,0,0,0.04) 47px)",
    backgroundSize: "100% 100%, 24px 48px",
  } as const;

  // Calendar utility functions
  function getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function formatCalendarDate(date: Date) {
    return date.toISOString().split('T')[0];
  }

  function getEntryForDate(date: Date) {
    const dateStr = formatCalendarDate(date);
    return monthlyEntries.find(entry => entry.date === dateStr);
  }

  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5ede1] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-[#f5ede1] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_60%)] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">AI未来日記</h1>
            <p className="text-slate-600 mb-8">あなただけの日記帳を作りましょう</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-500 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-blue-600 transition"
            >
              はじめる
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5ede1] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_60%)] pb-16">
      <UserHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <header className="text-center lg:text-left">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">Future Diary</p>
          <h1 className="text-3xl font-semibold text-slate-900">未来日記ノート</h1>
          <p className="mt-2 text-sm text-slate-600">
            未来の予定と実際の出来事を書き留めて、ノートをめくるように振り返りましょう。
          </p>
        </header>

        <section className="flex items-center justify-between rounded-3xl bg-white/70 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDateChange(-1)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              前の日へ
            </button>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              📅
            </button>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-semibold text-slate-800">{selectedDateLabel}</div>
            {savedEntry && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                保存済み
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleDateChange(1)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            次の日へ
          </button>
        </section>

        {showCalendar && (
          <section className="rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">カレンダー</h2>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>予定のみ</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>記録済み</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                <div key={day} className="p-2 text-sm font-medium text-slate-600">
                  {day}
                </div>
              ))}
              {Array.from({ length: getFirstDayOfMonth(selectedDate) }).map((_, index) => (
                <div key={`empty-${index}`} className="p-2"></div>
              ))}
              {Array.from({ length: getDaysInMonth(selectedDate) }, (_, index) => {
                const day = index + 1;
                const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                const entry = getEntryForDate(date);
                const isSelected = formatCalendarDate(date) === selectedDateString;
                const isToday = formatCalendarDate(date) === formatCalendarDate(new Date());

                return (
                  <button
                    key={day}
                    onClick={() => handleCalendarDateSelect(date)}
                    className={`
                      relative p-2 text-sm rounded-lg transition-colors
                      ${isSelected
                        ? 'bg-blue-500 text-white'
                        : isToday
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-slate-100 text-slate-700'
                      }
                    `}
                  >
                    {day}
                    {entry && (entry.planText || entry.actualText) && (
                      <div className={`
                        absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm
                        ${entry.actualText
                          ? 'bg-green-500'  // 実際の出来事があれば緑
                          : entry.planText
                          ? 'bg-blue-500'   // 予定のみなら青
                          : ''
                        }
                      `}></div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

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
                  disabled={loading}
                  className="rounded-full border border-blue-200 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {loading ? (
                    <>
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      AI提案中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI活動提案
                    </>
                  )}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="plan-use-ai"
                    checked={planUseAI}
                    onChange={(e) => setPlanUseAI(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="plan-use-ai" className="text-sm text-slate-600">
                    日記風に変換
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={planPage.loading}
                  className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-200"
                >
                  {planPage.loading ? "生成中..." : planUseAI ? "未来日記を生成" : "画像付きで保存"}
                </button>
              </div>
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
                      {cleanMarkdownArtifacts(planPage.text)}
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
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="actual-use-ai"
                    checked={actualUseAI}
                    onChange={(e) => setActualUseAI(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="actual-use-ai" className="text-sm text-slate-600">
                    日記風に変換
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateActual}
                  disabled={actualPage.loading || !actualInput.trim()}
                  className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:bg-slate-200"
                >
                  {actualPage.loading ? "生成中..." : actualUseAI ? "実際の日記を生成" : "画像付きで保存"}
                </button>
              </div>
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
                      {cleanMarkdownArtifacts(actualPage.text)}
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>
        </div>

        <section className="rounded-[32px] border border-slate-200/60 bg-white/90 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">振り返りサマリー</h2>
            {planPage.text && actualPage.text && (
              <button
                onClick={handleGenerateAIDiff}
                disabled={loading}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-600 disabled:bg-slate-300"
              >
                {loading ? "生成中..." : "振り返りサマリーを作成"}
              </button>
            )}
          </div>

          {aiDiffSummary && (
            <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <h3 className="text-sm font-semibold text-violet-700 mb-2"> 一日の振り返り</h3>
              <p className="text-sm text-slate-700 whitespace-pre-line">{cleanMarkdownArtifacts(aiDiffSummary)}</p>
            </div>
          )}

          {diffSummary ? (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>{diffSummary.message}</p>
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
              振り返りを表示するには、まず未来日記と実際の日記の両方を生成してください。
            </p>
          )}
        </section>

        <footer className="text-center text-xs text-slate-400">
          API base: {API}
        </footer>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <DiaryApp />
    </AuthProvider>
  );
}
