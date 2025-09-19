'use client';

import { useEffect, useState } from 'react';
import { getIntroConfig, markIntroSeen } from '@/lib/api';

export default function IntroPlayer({ token }: { token?: string }) {
  const [url, setUrl] = useState<string>('');
  const [version, setVersion] = useState<number>(0);
  const [show, setShow] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { url, version } = await getIntroConfig();
        setUrl(url);
        setVersion(version);

        const key = `intro_seen_v${version}`;
        // ローカルで既に見ていたらスキップ
        if (!localStorage.getItem(key)) {
          setShow(true);
        }
      } catch (e) {
        console.error('Failed to load intro config:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finish = async () => {
    try {
      if (dontShowAgain) {
        await markIntroSeen(true, token);
      }
      localStorage.setItem(`intro_seen_v${version}`, '1');
    } catch (e) {
      console.error('Failed to mark intro as seen:', e);
    } finally {
      setShow(false);
    }
  };

  // ローディング中は何も表示しない
  if (loading) return null;

  // 表示条件を満たさない場合は何も表示しない
  if (!show || !url) return null;

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
      </div>
    </div>
  );
}