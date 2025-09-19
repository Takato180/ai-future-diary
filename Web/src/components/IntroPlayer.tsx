'use client';

import { useEffect, useState } from 'react';
import { getIntroConfig, markIntroSeen, generateIntroVideo, getVideoStatus, VideoStatusResponse } from '@/lib/api';

export default function IntroPlayer({ token }: { token?: string }) {
  const [url, setUrl] = useState<string>('');
  const [version, setVersion] = useState<number>(0);
  const [show, setShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [useAnimationFallback, setUseAnimationFallback] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        // 認証されているユーザーには個人用動画生成を試行
        if (token) {
          try {
            // まず現在の動画状態をチェック
            const status = await getVideoStatus(token);

            if (status.intro_video_generated && status.intro_video_url) {
              // 個人用動画が既に生成済み
              setUrl(status.intro_video_url);
              setVersion(1); // 個人用動画は常にversion 1

              const key = `intro_seen_personal_${status.generation_id}`;
              if (!localStorage.getItem(key)) {
                setShow(true);
              }
              setLoading(false);
              return;
            } else if (status.status === 'generating') {
              // 現在生成中
              setIsGenerating(true);
              setUseAnimationFallback(true);
              setShow(true);
              setLoading(false);
              return;
            } else {
              // 個人用動画が未生成 → 生成を開始
              setIsGenerating(true);
              setUseAnimationFallback(true);
              setShow(true);

              try {
                const result = await generateIntroVideo(token);
                setUrl(result.video_url);
                setIsGenerating(false);
                setUseAnimationFallback(false);

                const key = `intro_seen_personal_${result.generation_id}`;
                localStorage.setItem(key, '1');
              } catch (genError: any) {
                console.error('Video generation failed:', genError);
                setGenerationError('動画生成に失敗しました。次回お試しください。');
                setIsGenerating(false);
                // フォールバックアニメーションを継続使用
              }
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to check/generate personal video:', e);
            // 個人用動画失敗時は共通動画にフォールバック
          }
        }

        // 非認証ユーザーまたは個人用動画失敗時の共通動画ロジック
        const { url, version } = await getIntroConfig();
        setUrl(url);
        setVersion(version);

        const key = `intro_seen_v${version}`;
        if (!localStorage.getItem(key)) {
          setShow(true);
        }
      } catch (e) {
        console.error('Failed to load intro config:', e);
        // エラーの場合はアニメーションフォールバックを使用
        setUseAnimationFallback(true);
        const key = `intro_seen_v1_fallback`;
        if (!localStorage.getItem(key)) {
          setShow(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const finish = async () => {
    try {
      if (dontShowAgain && !useAnimationFallback) {
        await markIntroSeen(true, token);
      }
      if (useAnimationFallback) {
        localStorage.setItem('intro_seen_v1_fallback', '1');
      } else {
        localStorage.setItem(`intro_seen_v${version}`, '1');
      }
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
      <div className="relative w-full max-w-4xl">
        {/* 閉じるボタン */}
        <button
          onClick={finish}
          className="absolute -top-6 right-0 text-white/80 hover:text-white text-sm z-10"
        >
          スキップ ✕
        </button>

        {useAnimationFallback ? (
          // CSS アニメーションフォールバック (または Veo 生成中)
          <div className="w-full h-[50vh] bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden">
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
                <p className="text-xl text-blue-200 animate-fade-in-delay">
                  {isGenerating ? '魔法の動画を生成中...' : 'あなただけの魔法の日記帳'}
                </p>
                {isGenerating && (
                  <div className="mt-4 flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                )}
                {generationError && (
                  <p className="mt-4 text-red-300 text-sm animate-fade-in">{generationError}</p>
                )}
              </div>

              <div className="space-y-4 text-white/90">
                <div className="animate-slide-up-1">📝 未来の予定を書き留める</div>
                <div className="animate-slide-up-2">🎨 AIが美しい挿絵を生成</div>
                <div className="animate-slide-up-3">📖 実際の出来事と比較して振り返り</div>
              </div>

              <button
                onClick={finish}
                className="mt-8 px-8 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full text-white font-medium transition-all duration-300 backdrop-blur-sm animate-bounce-slow"
                disabled={isGenerating}
              >
                {isGenerating ? '生成中...' : '日記を始める →'}
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
            className="w-full max-h-[80vh] rounded-2xl shadow-2xl"
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