'use client';

import { useEffect, useState } from 'react';
import { getIntroConfig, markIntroSeen, getVideoStatus } from '@/lib/api';

export default function IntroPlayer({ token }: { token?: string }) {
  const [url, setUrl] = useState<string>('');
  const [show, setShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [useAnimationFallback, setUseAnimationFallback] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // デフォルト動画を取得（全ユーザー共通）
        const { url } = await getIntroConfig();
        setUrl(url);

        // 毎回表示する（セッションごとに1回）
        if (!sessionStorage.getItem('intro_shown_this_session')) {
          setShow(true);
          sessionStorage.setItem('intro_shown_this_session', '1');
        }

        // 認証ユーザーの場合、特別動画があるかチェック（7日間連続記録後の特別動画用）
        if (token) {
          try {
            const status = await getVideoStatus(token);
            // 7日間連続記録後の特別動画が生成済みの場合のみ切り替え
            if (status.intro_video_generated && status.intro_video_url && status.status === 'special') {
              setUrl(status.intro_video_url);
            }
          } catch (e) {
            console.error('Failed to check special video:', e);
            // エラーの場合はデフォルト動画を継続使用
          }
        }
      } catch (e) {
        console.error('Failed to load intro config:', e);
        // エラーの場合はアニメーションフォールバックを使用
        setUseAnimationFallback(true);
        if (!sessionStorage.getItem('intro_shown_this_session')) {
          setShow(true);
          sessionStorage.setItem('intro_shown_this_session', '1');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const finish = async () => {
    try {
      if (dontShowAgain && !useAnimationFallback && token) {
        await markIntroSeen(true, token);
      }
      // セッション内での再表示は防ぐが、次回ログイン時は表示する
      sessionStorage.setItem('intro_finished_this_session', '1');
    } catch (e) {
      console.error('Failed to mark intro as seen:', e);
    } finally {
      setShow(false);
    }
  };

  // ローディング中は何も表示しない
  if (loading) return null;

  // 表示条件を満たさない場合は何も表示しない
  if (!show || (!url && !useAnimationFallback)) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* 閉じるボタン */}
        <button
          onClick={finish}
          className="absolute -top-6 right-0 text-white/80 hover:text-white text-sm z-10"
        >
          スキップ ✕
        </button>

        {useAnimationFallback ? (
          // CSS アニメーションフォールバック (または Veo 生成中)
          <div className="w-full h-80 bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden">
            {/* Background animation */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-10 left-10 w-20 h-20 bg-white/20 rounded-full animate-bounce"></div>
              <div className="absolute top-32 right-16 w-12 h-12 bg-blue-300/30 rounded-full animate-pulse"></div>
              <div className="absolute bottom-20 left-1/3 w-16 h-16 bg-purple-300/20 rounded-full animate-ping"></div>
            </div>

            {/* Content */}
            <div className="text-center z-10">
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">✨ AI未来日記 ✨</h1>
                <p className="text-xl text-blue-200 animate-fade-in-delay">あなただけの魔法の日記帳</p>
              </div>

              <div className="space-y-4 text-white/90">
                <div className="animate-slide-up-1">📝 未来の予定を書き留める</div>
                <div className="animate-slide-up-2">🎨 AIが美しい挿絵を生成</div>
                <div className="animate-slide-up-3">📖 実際の出来事と比較して振り返り</div>
              </div>

              <button
                onClick={finish}
                className="mt-8 px-8 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full text-white font-medium transition-all duration-300 backdrop-blur-sm animate-bounce-slow"
              >
                日記を始める →
              </button>
            </div>

            <style jsx>{`
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes fade-in-delay {
                0% { opacity: 0; transform: translateY(20px); }
                50% { opacity: 0; transform: translateY(20px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes slide-up-1 {
                0% { opacity: 0; transform: translateY(30px); }
                33% { opacity: 0; transform: translateY(30px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes slide-up-2 {
                0% { opacity: 0; transform: translateY(30px); }
                66% { opacity: 0; transform: translateY(30px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes slide-up-3 {
                0% { opacity: 0; transform: translateY(30px); }
                80% { opacity: 0; transform: translateY(30px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes bounce-slow {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
              .animate-fade-in { animation: fade-in 1s ease-out; }
              .animate-fade-in-delay { animation: fade-in-delay 2s ease-out; }
              .animate-slide-up-1 { animation: slide-up-1 3s ease-out; }
              .animate-slide-up-2 { animation: slide-up-2 3.5s ease-out; }
              .animate-slide-up-3 { animation: slide-up-3 4s ease-out; }
              .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
            `}</style>
          </div>
        ) : (
          // 動画プレイヤー
          <video
            key={url}
            src={url}
            className="w-full h-80 rounded-2xl shadow-2xl object-cover"
            autoPlay
            muted
            playsInline
            onEnded={finish}
            controls
          />
        )}

        {!useAnimationFallback && (
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-white/90 text-sm">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
                className="rounded"
              />
              次回から表示しない
            </label>

            <button
              onClick={finish}
              className="px-4 py-2 bg-white/90 hover:bg-white rounded-lg text-sm font-medium transition-colors"
            >
              はじめる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}