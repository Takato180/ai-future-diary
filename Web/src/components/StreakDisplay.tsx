"use client";

import { useState, useEffect } from "react";
import { checkStreak, StreakCheckResponse } from "@/lib/api";

interface StreakDisplayProps {
  token?: string;
  userId?: string;
  refreshTrigger?: number; // 外部から更新をトリガーするための値
}

export default function StreakDisplay({ token, userId, refreshTrigger }: StreakDisplayProps) {
  const [streakData, setStreakData] = useState<StreakCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !userId) {
      setStreakData(null);
      return;
    }

    const fetchStreakData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await checkStreak(token);
        setStreakData(data);
      } catch (err) {
        console.error("Failed to fetch streak data:", err);
        setError("ストリーク情報の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchStreakData();
  }, [token, userId, refreshTrigger]); // refreshTriggerを依存配列に追加

  if (!token || !userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-600">ストリーク情報を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
        <div className="flex items-center gap-2 text-red-600">
          <span className="text-sm">⚠️</span>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!streakData) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white/90 to-blue-50/30 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="text-xl">🔥</span>
          継続記録
        </h3>
        <div className="text-xs text-slate-500">
          総記録: {streakData.total_entries}日
        </div>
      </div>

      {streakData.has_seven_day_streak ? (
        // 7日間達成済み
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎉</div>
            <div>
              <div className="text-lg font-bold text-green-600">7日間連続達成！</div>
              <div className="text-sm text-slate-600">
                {streakData.latest_streak_date && `最新: ${streakData.latest_streak_date}`}
              </div>
            </div>
          </div>
          
          {streakData.streak_dates && (
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-600 mb-2">連続記録日:</div>
              <div className="grid grid-cols-7 gap-1">
                {streakData.streak_dates.map((date, index) => (
                  <div
                    key={date}
                    className={`
                      text-xs p-2 rounded text-center font-medium
                      ${index === 0 
                        ? 'bg-green-500 text-white' 
                        : 'bg-green-100 text-green-700'
                      }
                    `}
                  >
                    {new Date(date).getDate()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // 7日間未達成
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📅</div>
              <div>
                <div className="text-lg font-bold text-blue-600">
                  現在 {streakData.current_streak}日連続
                </div>
                <div className="text-sm text-slate-600">
                  あと{streakData.needed_for_seven}日で7日間達成！
                </div>
              </div>
            </div>
          </div>

          {/* 進捗バー */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600">7日間チャレンジ</span>
              <span className="text-xs text-slate-600">
                {streakData.current_streak}/7
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((streakData.current_streak || 0) / 7) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 現在のストリークが3日以上の場合は励ましメッセージ */}
          {(streakData.current_streak || 0) >= 3 && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-sm text-blue-700 flex items-center gap-2">
                <span>💪</span>
                <span>素晴らしい継続力です！この調子で7日間達成を目指しましょう。</span>
              </div>
            </div>
          )}

          {/* ストリークが0の場合は励ましメッセージ */}
          {(streakData.current_streak || 0) === 0 && (
            <div className="mt-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <div className="text-sm text-yellow-700 flex items-center gap-2">
                <span>🌟</span>
                <span>今日から新しいストリークを始めましょう！継続は力なりです。</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* リフレッシュボタン */}
      <button
        onClick={() => {
          if (token) {
            setLoading(true);
            checkStreak(token)
              .then(setStreakData)
              .catch(() => setError("更新に失敗しました"))
              .finally(() => setLoading(false));
          }
        }}
        className="mt-3 w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        🔄 更新
      </button>
    </div>
  );
}
