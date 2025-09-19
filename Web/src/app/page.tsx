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
  getDiaryEntriesByYear,
  generateDiffSummary,
  getActivitySuggestions,
  uploadImageFile,
  DiaryEntry,
} from "@/lib/api";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";
import UserHeader from "@/components/UserHeader";
import IntroPlayer from "@/components/IntroPlayer";

type DiaryPageState = {
  text: string;
  imageUrl: string | null;
  loading: boolean;
};

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
  const { user, token, isLoading } = useAuth();
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
  const [yearlyEntriesCache, setYearlyEntriesCache] = useState<{[year: string]: DiaryEntry[]}>({});
  const [loading, setLoading] = useState(false);
  const [planUseAI, setPlanUseAI] = useState(true);
  const [actualUseAI, setActualUseAI] = useState(true);
  const [planGenerateImage, setPlanGenerateImage] = useState(true);
  const [actualGenerateImage, setActualGenerateImage] = useState(true);
  const [autoSuggestions, setAutoSuggestions] = useState<string[]>([]);
  const [showAutoSuggestions, setShowAutoSuggestions] = useState(false);
  const [planImageUpload, setPlanImageUpload] = useState<File | null>(null);
  const [actualImageUpload, setActualImageUpload] = useState<File | null>(null);
  const [planImagePreview, setPlanImagePreview] = useState<string | null>(null);
  const [actualImagePreview, setActualImagePreview] = useState<string | null>(null);
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [planTags, setPlanTags] = useState<string[]>([]);
  const [actualTags, setActualTags] = useState<string[]>([]);
  const [showTagLibrary, setShowTagLibrary] = useState(false);
  const [taggedPlans, setTaggedPlans] = useState<{ [key: string]: string[] }>({});
  const [planInputHistory, setPlanInputHistory] = useState<string>("");
  const [actualInputHistory, setActualInputHistory] = useState<string>("");

  const diffSummary = useMemo(
    () => buildDiffSummary(planPage.text, actualPage.text),
    [planPage.text, actualPage.text],
  );

  const selectedDateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Store previous user ID to detect actual user changes
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);

  // Load user data and clear only when necessary
  useEffect(() => {
    if (!isLoading) {
      const currentUserId = user?.userId || null;
      const isUserChange = previousUserId !== currentUserId;

      // Only clear data if user actually changed (not just page reload)
      if (isUserChange) {
        console.log('[DEBUG] User changed from', previousUserId, 'to', currentUserId);

        // Clear temporary state
        setPlanInput("");
        setInterestList([]);
        setActualInput("");
        setShowTagLibrary(false);
        setAutoSuggestions([]);
        setShowAutoSuggestions(false);
        setShowCalendar(false);

        // Clear persistent data that should be reloaded
        setPlanPage({ text: "", imageUrl: null, loading: false });
        setActualPage({ text: "", imageUrl: null, loading: false });
        setAiDiffSummary("");
        setPlanTags([]);
        setActualTags([]);
        setSavedEntry(null);
        setMonthlyEntries([]);

        // Clear year cache when switching users
        setYearlyEntriesCache({});
      }

      // Always clear uploaded images (they are date-specific and session-specific)
      setPlanImageUpload(null);
      setActualImageUpload(null);
      setPlanImagePreview(null);
      setActualImagePreview(null);

      // Update previous user ID
      setPreviousUserId(currentUserId);

      // Load year data cache when user logs in
      if (user?.userId) {
        const currentYear = new Date().getFullYear();
        const cacheKey = `yearEntries_${user.userId}_${currentYear}`;

        console.log('[DEBUG] Loading year cache for:', user.userId);

        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const yearEntries = JSON.parse(cachedData);
            setYearlyEntriesCache({ [currentYear.toString()]: yearEntries });
            console.log('[DEBUG] Loaded cached year data:', yearEntries.length, 'entries');
          } else {
            // Load current year data from API
            console.log('[DEBUG] Loading year data from API...');
            getDiaryEntriesByYear(currentYear).then(yearEntries => {
              setYearlyEntriesCache({ [currentYear.toString()]: yearEntries });
              localStorage.setItem(cacheKey, JSON.stringify(yearEntries));
              console.log('[DEBUG] Year data loaded and cached:', yearEntries.length, 'entries');
            }).catch(error => {
              console.error("Failed to load year data:", error);
            });
          }
        } catch (error) {
          console.error("Failed to load cached year data:", error);
        }
      }

      // Load user-specific persistent data
      if (user?.userId) {
        const userTagKey = `taggedPlans_${user.userId}`;
        const userSavedTagsKey = `savedTags_${user.userId}`;

        console.log('[DEBUG] Loading user-specific data for:', user.userId);

        try {
          const savedTaggedPlans = localStorage.getItem(userTagKey);
          const savedUserTags = localStorage.getItem(userSavedTagsKey);

          console.log('[DEBUG] Found localStorage data:', {
            taggedPlans: savedTaggedPlans ? JSON.parse(savedTaggedPlans) : null,
            savedTags: savedUserTags ? JSON.parse(savedUserTags) : null
          });

          if (savedTaggedPlans) {
            setTaggedPlans(JSON.parse(savedTaggedPlans));
          } else {
            setTaggedPlans({});
          }

          if (savedUserTags) {
            setSavedTags(JSON.parse(savedUserTags));
          } else {
            setSavedTags([]);
          }
        } catch (error) {
          console.error("Failed to load user data from localStorage:", error);
          setTaggedPlans({});
          setSavedTags([]);
        }
      } else {
        console.log('[DEBUG] No user logged in, clearing user-specific data');
        // Not logged in - clear user-specific data
        setTaggedPlans({});
        setSavedTags([]);
      }
    }
  }, [user?.userId, isLoading, previousUserId]); // Trigger when user ID changes

  // Load existing entry when date changes or user changes
  useEffect(() => {
    async function loadEntry() {
      // Skip loading if no user is logged in
      if (isLoading || !user) return;

      try {
        // Try to get entry from year cache first
        const currentYear = new Date(selectedDateString).getFullYear().toString();
        const cachedYearData = yearlyEntriesCache[currentYear];
        let entry: DiaryEntry | null = null;

        if (cachedYearData) {
          // Find entry in cache
          entry = cachedYearData.find(e => e.date === selectedDateString) || null;
          console.log('[DEBUG] Entry loaded from cache for:', selectedDateString);
        } else {
          // Fallback to API call if no cache available
          console.log('[DEBUG] Loading entry from API for:', selectedDateString);
          entry = await getDiaryEntry(selectedDateString);
        }
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
          if (entry.tags) {
            // Separate tags for plan and actual (for now, show all tags in plan)
            setPlanTags(entry.tags);
            setActualTags([]);
          }
          if (entry.planInputPrompt) {
            setPlanInputHistory(entry.planInputPrompt);
          }
          if (entry.actualInputPrompt) {
            setActualInputHistory(entry.actualInputPrompt);
          }
        } else {
          // No entry found - this is expected for new dates
          setSavedEntry(null);
          setAiDiffSummary("");
          // Clear uploaded images for new dates
          setPlanImageUpload(null);
          setActualImageUpload(null);
          setPlanImagePreview(null);
          setActualImagePreview(null);
          // Clear input histories for new dates
          setPlanInputHistory("");
          setActualInputHistory("");
          // Don't clear tags here - keep them for new entries
        }
      } catch (error) {
        console.error("Failed to load entry:", error);
      }
    }
    loadEntry();

    // Clear uploaded images when date changes (separate effect for reliability)
    setPlanImageUpload(null);
    setActualImageUpload(null);
    setPlanImagePreview(null);
    setActualImagePreview(null);
  }, [selectedDateString, user, isLoading]); // Also trigger when user changes

  // Load monthly entries for calendar (optimized with cache)
  useEffect(() => {
    async function loadMonthlyEntries() {
      if (!showCalendar || !user || isLoading) return;

      const year = selectedDate.getFullYear().toString();
      const month = selectedDate.getMonth() + 1; // getMonth() returns 0-11
      const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;

      try {
        // Try to use cached year data first
        const cachedYearData = yearlyEntriesCache[year];
        if (cachedYearData) {
          const monthEntries = cachedYearData.filter(entry => entry.date.startsWith(yearMonth));
          console.log('[DEBUG] Monthly entries from cache:', monthEntries.length);
          setMonthlyEntries(monthEntries);
          return;
        }

        // Fallback to API call if no cache
        console.log('[DEBUG] Loading monthly entries from API...');
        const entries = await getDiaryEntriesByMonth(yearMonth);
        console.log('[DEBUG] Monthly entries loaded from API:', entries.length);
        setMonthlyEntries(entries);
      } catch (error) {
        console.error("Failed to load monthly entries:", error);
      }
    }
    loadMonthlyEntries();
  }, [selectedDate, showCalendar, user, isLoading]); // キャッシュは内部で適切に処理される

  // Auto load activity suggestions for empty plan days (optimized)
  useEffect(() => {
    async function loadAutoSuggestions() {
      if (!user || planInput.trim() || planPage.text || loading || isLoading) return;

      try {
        const suggestions = await getActivitySuggestions({
          user_id: user.userId,
          date: selectedDateString,
        });
        setAutoSuggestions(suggestions.suggestions);
        setShowAutoSuggestions(true);
      } catch (error) {
        console.error("Failed to load auto suggestions:", error);
      }
    }

    // 予定が空の場合のみ、少し遅延を入れて自動提案を読み込む
    const timer = setTimeout(loadAutoSuggestions, 1500); // Slightly longer delay
    return () => clearTimeout(timer);
  }, [user, planInput, planPage.text, selectedDateString, loading, isLoading]);

  async function handleGeneratePlan() {
    setPlanPage((prev) => ({ ...prev, loading: true }));

    // Save user input for editing later
    setPlanInputHistory(planInput);

    try {
      const textResult = await generateFutureDiary({
        plan: planInput || undefined,
        interests: interestList.length > 0 ? interestList : undefined,
        style: "casual",
        use_ai: planUseAI,
        user_id: user?.userId,
      });

      let imageUrl = null;
      if (planGenerateImage) {
        const imageResult = await generateImage({
          prompt: textResult.image_prompt,
          style: "watercolor",
          aspect_ratio: "1:1",
        });
        imageUrl = imageResult.public_url || null;
      }

      const newPlanPage = {
        text: textResult.generated_text,
        imageUrl,
        loading: false,
      };

      setPlanPage(newPlanPage);

      // Save to database
      await saveToDiary({
        planText: textResult.generated_text,
        planImageUrl: imageUrl || undefined,
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

    // Save user input for editing later
    setActualInputHistory(actualInput);

    try {
      const textResult = await generateTodayReflection({
        reflection_text: actualInput,
        style: "diary",
        use_ai: actualUseAI,
        user_id: user?.userId,
      });

      let imageUrl = null;
      if (actualGenerateImage) {
        const imageResult = await generateImage({
          prompt: textResult.image_prompt,
          style: "watercolor",
          aspect_ratio: "1:1",
        });
        imageUrl = imageResult.public_url || null;
      }

      const newActualPage = {
        text: textResult.generated_text,
        imageUrl,
        loading: false,
      };

      setActualPage(newActualPage);

      // Save to database
      await saveToDiary({
        actualText: textResult.generated_text,
        actualImageUrl: imageUrl || undefined,
      });
    } catch (error) {
      console.error("Reflection generation failed", error);
      alert("実際日記の生成に失敗しました。時間を置いて再度お試しください。");
      setActualPage((prev) => ({ ...prev, loading: false }));
    }
  }

  async function saveToDiary(updates: Partial<DiaryEntry>) {
    try {
      // Upload images if present
      let planImageUrl = updates.planImageUrl;
      let actualImageUrl = updates.actualImageUrl;

      if (planImageUpload) {
        const imagePath = `diary/${user?.userId || 'anonymous'}/${selectedDateString}/plan_${Date.now()}.jpg`;
        planImageUrl = await uploadImageFile(planImageUpload, imagePath);
      }

      if (actualImageUpload) {
        const imagePath = `diary/${user?.userId || 'anonymous'}/${selectedDateString}/actual_${Date.now()}.jpg`;
        actualImageUrl = await uploadImageFile(actualImageUpload, imagePath);
      }

      const savedEntryData = await saveDiaryEntry(selectedDateString, {
        date: selectedDateString,
        planImageUrl,
        actualImageUrl,
        planInputPrompt: planInputHistory,
        actualInputPrompt: actualInputHistory,
        tags: [...planTags, ...actualTags],
        ...updates,
      });
      setSavedEntry(savedEntryData);

      // Update year cache with new entry
      if (user?.userId) {
        const currentYear = new Date().getFullYear().toString();
        const cachedYearData = yearlyEntriesCache[currentYear];
        if (cachedYearData) {
          const updatedCache = cachedYearData.filter(entry => entry.date !== selectedDateString);
          updatedCache.push(savedEntryData);
          setYearlyEntriesCache({ ...yearlyEntriesCache, [currentYear]: updatedCache });

          // Update localStorage cache
          const cacheKey = `yearEntries_${user.userId}_${currentYear}`;
          localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
        }
      }

      // Clear uploaded images after save
      if (planImageUpload) {
        setPlanImageUpload(null);
        setPlanImagePreview(null);
      }
      if (actualImageUpload) {
        setActualImageUpload(null);
        setActualImagePreview(null);
      }
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
    // Clear uploaded images when changing dates
    setPlanImageUpload(null);
    setActualImageUpload(null);
    setPlanImagePreview(null);
    setActualImagePreview(null);
    // Clear tags and input histories
    setPlanTags([]);
    setActualTags([]);
    setPlanInputHistory("");
    setActualInputHistory("");
    setAutoSuggestions([]);
    setShowAutoSuggestions(false);
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
    // Clear uploaded images when changing dates
    setPlanImageUpload(null);
    setActualImageUpload(null);
    setPlanImagePreview(null);
    setActualImagePreview(null);
    // Clear tags when changing dates
    setPlanTags([]);
    setActualTags([]);
    setAutoSuggestions([]);
    setShowAutoSuggestions(false);
  }

  function handleImageUpload(file: File, type: 'plan' | 'actual') {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (type === 'plan') {
          setPlanImageUpload(file);
          setPlanImagePreview(result);
        } else {
          setActualImageUpload(file);
          setActualImagePreview(result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  function removeUploadedImage(type: 'plan' | 'actual') {
    if (type === 'plan') {
      setPlanImageUpload(null);
      setPlanImagePreview(null);
    } else {
      setActualImageUpload(null);
      setActualImagePreview(null);
    }
  }

  function addTag(tag: string, type: 'plan' | 'actual') {
    const normalizedTag = tag.trim();
    if (!normalizedTag) return;

    if (type === 'plan') {
      if (!planTags.includes(normalizedTag)) {
        setPlanTags([...planTags, normalizedTag]);
      }
    } else {
      if (!actualTags.includes(normalizedTag)) {
        setActualTags([...actualTags, normalizedTag]);
      }
    }

    // Save tag to library
    if (!savedTags.includes(normalizedTag)) {
      const newSavedTags = [...savedTags, normalizedTag];
      setSavedTags(newSavedTags);

      // Save to localStorage
      if (user?.userId) {
        localStorage.setItem(`savedTags_${user.userId}`, JSON.stringify(newSavedTags));
      }
    }
  }

  function removeTag(tag: string, type: 'plan' | 'actual') {
    if (type === 'plan') {
      setPlanTags(planTags.filter(t => t !== tag));
    } else {
      setActualTags(actualTags.filter(t => t !== tag));
    }
  }

  function saveTaggedPlan(text: string, tags: string[]) {
    if (!text.trim() || tags.length === 0) return;

    const newTaggedPlans = { ...taggedPlans };
    tags.forEach(tag => {
      const existing = newTaggedPlans[tag] || [];
      if (!existing.includes(text)) {
        newTaggedPlans[tag] = [...existing, text];
      }
    });

    setTaggedPlans(newTaggedPlans);

    // Save to localStorage
    if (user?.userId) {
      localStorage.setItem(`taggedPlans_${user.userId}`, JSON.stringify(newTaggedPlans));
    }
  }

  function loadTaggedPlan(text: string) {
    setPlanInput(text);
    setShowTagLibrary(false);
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

  // タイムゾーン問題を回避するローカル日付キー生成
  function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatCalendarDate(date: Date) {
    return localDateKey(date);
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
      <IntroPlayer token={token || undefined} />
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
                const dateStr = formatCalendarDate(date);
                const isSelected = dateStr === selectedDateString;
                const isToday = dateStr === formatCalendarDate(new Date());

                // デバッグログ（最初の数日のみ）
                if (day <= 3) {
                  console.log(`[DEBUG] Day ${day} (${dateStr}):`, {
                    entry,
                    hasEntry: !!entry,
                    planText: entry?.planText,
                    actualText: entry?.actualText,
                    shouldShowIndicator: entry && (entry.planText || entry.actualText),
                    monthlyEntriesCount: monthlyEntries.length,
                    monthlyEntries: monthlyEntries.slice(0, 3) // Show first 3 entries
                  });
                }

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
                    {(() => {
                      if (!entry) return null;

                      const hasActual = entry.actualText && entry.actualText.trim().length > 0;
                      const hasPlan = entry.planText && entry.planText.trim().length > 0;

                      if (!hasActual && !hasPlan) return null;

                      const indicatorColor = hasActual ? 'bg-green-500' : 'bg-blue-500';

                      return (
                        <div className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${indicatorColor}`}></div>
                      );
                    })()}
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
                <button
                  type="button"
                  onClick={() => setShowTagLibrary(!showTagLibrary)}
                  className="rounded-full border border-purple-200 px-3 py-1 text-xs text-purple-600 transition hover:bg-purple-50 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  過去の予定
                </button>
              </div>

              {/* Plan Tags */}
              <div className="mt-3 border border-indigo-100 rounded-xl p-3 bg-indigo-50/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-indigo-700">タグで分類 (後で再利用可能)</span>
                  {planTags.length > 0 && (
                    <span className="text-xs text-indigo-500">{planTags.length}個</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {planTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700 flex items-center gap-1">
                      #{tag}
                      <button
                        onClick={() => removeTag(tag, 'plan')}
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="タグ名を入力してEnterキー (例: 研究, 映画, 買い物)"
                    className="flex-1 px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addTag(e.currentTarget.value, 'plan');
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  {planInput.trim() && planTags.length > 0 && (
                    <button
                      onClick={() => {
                        saveTaggedPlan(planInput, planTags);
                        alert(`「${planTags.join(', ')}」タグで予定を保存しました！`);
                      }}
                      className="px-4 py-2 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                    >
                      📚 予定を保存
                    </button>
                  )}
                </div>
                {planTags.length === 0 && (
                  <p className="text-xs text-indigo-600 mt-1">
                    💡 タグを追加すると予定を分類・保存して後で再利用できます
                  </p>
                )}
              </div>

              {/* Tag Library */}
              {showTagLibrary && (
                <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 713 12V7a4 4 0 014-4z" />
                    </svg>
                    保存されたタグ・予定
                  </h4>

                  {/* Saved Tags Section */}
                  {savedTags.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-purple-600 mb-2">📝 保存されたタグ</h5>
                      <div className="flex flex-wrap gap-2">
                        {savedTags.map((tag, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setPlanTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
                            }}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Saved Plans Section */}
                  {Object.keys(taggedPlans).length === 0 && savedTags.length === 0 ? (
                    <p className="text-sm text-purple-600">
                      まだ保存されたタグ・予定がありません。<br />
                      予定にタグを追加して「保存」ボタンを押すと、後で再利用できます。
                    </p>
                  ) : Object.keys(taggedPlans).length > 0 ? (
                    <div>
                      <h5 className="text-xs font-medium text-purple-600 mb-2">📋 保存された予定</h5>
                    <div className="space-y-3">
                      {Object.entries(taggedPlans).map(([tag, plans]) => (
                        <div key={tag} className="border border-purple-100 rounded-xl p-3 bg-white/60">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-purple-600">#{tag}</span>
                            <span className="text-xs text-purple-500">({plans.length}件)</span>
                          </div>
                          <div className="space-y-1">
                            {plans.slice(0, 3).map((plan, index) => (
                              <button
                                key={index}
                                onClick={() => loadTaggedPlan(plan)}
                                className="w-full text-left p-2 rounded-lg border border-purple-100 bg-white/40 hover:bg-white/60 transition-colors text-xs text-slate-700"
                              >
                                {plan.length > 60 ? `${plan.substring(0, 60)}...` : plan}
                              </button>
                            ))}
                            {plans.length > 3 && (
                              <p className="text-xs text-purple-500 mt-1">
                                他 {plans.length - 3} 件...
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  ) : null}
                  <button
                    onClick={() => setShowTagLibrary(false)}
                    className="mt-3 text-xs text-purple-600 hover:text-purple-700"
                  >
                    ライブラリを閉じる
                  </button>
                </div>
              )}

              {/* Auto suggestions for empty plan days */}
              {showAutoSuggestions && autoSuggestions.length > 0 && !planInput.trim() && !planPage.text && (
                <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50/50 p-4">
                  <h4 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    あなたにおすすめの活動
                  </h4>
                  <div className="space-y-2">
                    {autoSuggestions.slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setPlanInput(suggestion);
                          setShowAutoSuggestions(false);
                        }}
                        className="w-full text-left p-3 rounded-xl border border-yellow-200 bg-white/60 hover:bg-white/80 transition-colors text-sm text-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-600">•</span>
                          {suggestion}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAutoSuggestions(false)}
                    className="mt-3 text-xs text-yellow-600 hover:text-yellow-700"
                  >
                    提案を非表示
                  </button>
                </div>
              )}

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
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="plan-generate-image"
                    checked={planGenerateImage}
                    onChange={(e) => setPlanGenerateImage(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="plan-generate-image" className="text-sm text-slate-600">
                    画像を生成
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={planPage.loading}
                  className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-200"
                >
                  {planPage.loading ? "生成中..." : planUseAI ? "未来日記を生成" : "保存"}
                </button>
              </div>
              {/* Photo upload for plan */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">写真をアップロード</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'plan');
                    }}
                    className="hidden"
                    id="plan-image-upload"
                  />
                  <label
                    htmlFor="plan-image-upload"
                    className="cursor-pointer rounded-lg border border-blue-200 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    📷 写真を選択
                  </label>
                </div>
                {planImagePreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-blue-100">
                    <Image
                      src={planImagePreview}
                      alt="アップロードした写真"
                      width={640}
                      height={480}
                      className="h-56 w-full object-cover"
                    />
                    <button
                      onClick={() => removeUploadedImage('plan')}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {(planPage.text || planPage.imageUrl) && (
                <div className="mt-6 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                  {planInputHistory && (
                    <div className="border-b border-blue-200 pb-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-600">元の入力</span>
                        <button
                          onClick={() => setPlanInput(planInputHistory)}
                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                        >
                          編集に戻す
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 bg-white/50 rounded-lg p-2">
                        {planInputHistory}
                      </p>
                    </div>
                  )}
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
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="actual-generate-image"
                    checked={actualGenerateImage}
                    onChange={(e) => setActualGenerateImage(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="actual-generate-image" className="text-sm text-slate-600">
                    画像を生成
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateActual}
                  disabled={actualPage.loading || !actualInput.trim()}
                  className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:bg-slate-200"
                >
                  {actualPage.loading ? "生成中..." : actualUseAI ? "実際の日記を生成" : "保存"}
                </button>
              </div>
              {/* Photo upload for actual */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">写真をアップロード</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'actual');
                    }}
                    className="hidden"
                    id="actual-image-upload"
                  />
                  <label
                    htmlFor="actual-image-upload"
                    className="cursor-pointer rounded-lg border border-emerald-200 px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    📷 写真を選択
                  </label>
                </div>
                {actualImagePreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-100">
                    <Image
                      src={actualImagePreview}
                      alt="アップロードした写真"
                      width={640}
                      height={480}
                      className="h-56 w-full object-cover"
                    />
                    <button
                      onClick={() => removeUploadedImage('actual')}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              {(actualPage.text || actualPage.imageUrl) && (
                <div className="mt-6 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  {actualInputHistory && (
                    <div className="border-b border-emerald-200 pb-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-emerald-600">元の入力</span>
                        <button
                          onClick={() => setActualInput(actualInputHistory)}
                          className="text-xs text-emerald-500 hover:text-emerald-700 underline"
                        >
                          編集に戻す
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 bg-white/50 rounded-lg p-2">
                        {actualInputHistory}
                      </p>
                    </div>
                  )}
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
