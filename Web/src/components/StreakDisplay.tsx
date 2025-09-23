"use client";

import { useState, useEffect } from "react";
import { checkStreak, getStreakDebugInfo, StreakCheckResponse } from "@/lib/api";

interface StreakDisplayProps {
  token?: string;
  userId?: string;
  refreshTrigger?: number; // 外部から更新をトリガーするための値
}

export default function StreakDisplay({ token, userId, refreshTrigger }: StreakDisplayProps) {
  const [streakData, setStreakData] = useState<StreakCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

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

      {streakData.has_seven_day_streak && streakData.completed_streaks_count > 0 ? (
        // 7日間達成済み（複数回達成も表示）
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎉</div>
            <div>
              <div className="text-lg font-bold text-green-600">
                7日間連続達成！ ({streakData.completed_streaks_count}回達成)
              </div>
              {streakData.latest_completed_streak && (
                <div className="text-sm text-slate-600">
                  最新達成: {streakData.latest_completed_streak.end_date}
                </div>
              )}
            </div>
          </div>
          
          {/* 現在のストリーク進行中の場合 */}
          {(streakData.current_streak || 0) > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">新しいストリーク進行中</span>
                <span className="text-lg font-bold text-blue-600">
                  {streakData.current_streak}日連続
                </span>
              </div>
              <div className="text-xs text-blue-600">
                あと{streakData.needed_for_seven}日で次の7日間達成！
              </div>
              {/* 進捗バー */}
              <div className="mt-2">
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((streakData.current_streak || 0) / 7) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* 完了したストリークの詳細（最新の3つまで） */}
          {streakData.completed_streaks && streakData.completed_streaks.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-600 mb-2">達成履歴:</div>
              <div className="space-y-2">
                {streakData.completed_streaks.slice(-3).reverse().map((streak, index) => (
                  <div key={streak.completed_at} className="text-xs p-2 rounded-lg bg-green-50 border border-green-200">
                    <div className="font-medium text-green-700">
                      {streak.start_date} 〜 {streak.end_date}
                    </div>
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
                  あと{streakData.needed_for_seven}日で初回7日間達成！
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

          {/* 登録日情報 */}
          {streakData.registration_date && (
            <div className="mt-3 text-xs text-slate-500">
              登録日: {streakData.registration_date} から記録開始
            </div>
          )}
        </div>
      )}

      {/* リフレッシュボタンとデバッグ情報 */}
      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
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
            className="flex-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            🔄 更新
          </button>
          
          <button
            onClick={async () => {
              if (token) {
                try {
                  setLoading(true);
                  const debug = await getStreakDebugInfo(token);
                  setDebugInfo(debug);
                  setShowDebug(true);
                  console.log("Debug info:", debug);
                } catch (error) {
                  console.error("Debug failed:", error);
                  setError("デバッグ情報の取得に失敗しました");
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="flex-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            🔍 詳細デバッグ
          </button>
        </div>
        
        {/* デバッグ情報表示 */}
        {showDebug && debugInfo && (
          <div className="mt-3 p-3 bg-gray-50 rounded text-xs space-y-2">
            <div className="flex justify-between items-center">
              <strong>詳細デバッグ情報</strong>
              <button 
                onClick={() => setShowDebug(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div>登録日: {debugInfo.registration_date}</div>
            <div>総エントリ数: {debugInfo.total_entries}</div>
            <div>有効エントリ数: {debugInfo.valid_entries_count}</div>
            <div>登録後エントリ数: {debugInfo.entries_after_registration}</div>
            <div>
              <strong>登録後のエントリ日付:</strong>
              <div className="mt-1 text-xs bg-white p-2 rounded max-h-20 overflow-y-auto">
                {debugInfo.entries_after_reg_dates?.join(", ") || "なし"}
              </div>
            </div>
            <div>
              <strong>連続性分析:</strong>
              <div className="mt-1 space-y-1">
                {debugInfo.consecutive_analysis?.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className={`text-xs p-1 rounded ${item.is_consecutive ? 'bg-green-100' : 'bg-red-100'}`}>
                    {item.from} → {item.to} (差: {item.gap_days}日) {item.is_consecutive ? "✓" : "✗"}
                  </div>
                )) || "分析データなし"}
              </div>
            </div>
            <div>
              <strong>サンプルエントリ:</strong>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {debugInfo.sample_entries?.map((entry: any, index: number) => (
                  <div key={index} className="text-xs p-1 bg-white rounded">
                    <div><strong>{entry.date}</strong></div>
                    <div>予定: {entry.has_plan ? "あり" : "なし"}</div>
                    <div>実際: {entry.has_actual ? "あり" : "なし"}</div>
                    {entry.actual_preview && (
                      <div className="text-gray-600">内容: {entry.actual_preview}...</div>
                    )}
                  </div>
                )) || "サンプルなし"}
              </div>
            </div>
          </div>
        )}
        
        {/* 標準デバッグ情報 */}
        {streakData?.debug && (
          <details className="text-xs">
            <summary className="text-slate-500 cursor-pointer hover:text-slate-700">
              基本デバッグ情報
            </summary>
            <div className="mt-2 p-2 bg-gray-50 rounded text-slate-600 space-y-1">
              <div>総エントリ数: {streakData.debug.total_entries}</div>
              <div>有効エントリ数: {streakData.debug.valid_entries}</div>
              <div>登録日: {streakData.debug.registration_date}</div>
              <div>エントリ日付: {streakData.debug.valid_entry_dates.join(', ')}</div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
