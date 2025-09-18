'use client';

import { useState } from 'react';
import Image from 'next/image';
import { 
  generateFutureDiary, 
  generateTodayReflection, 
  generateImage, 
  API 
} from '@/lib/api';

interface DiaryPage {
  text: string;
  imageUrl: string | null;
  loading: boolean;
}

export default function Home() {
  // 右ページ（未来日記）の状態
  const [futurePlan, setFuturePlan] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [futurePage, setFuturePage] = useState<DiaryPage>({
    text: '',
    imageUrl: null,
    loading: false
  });

  // 左ページ（今日の振り返り）の状態
  const [todayReflection, setTodayReflection] = useState('');
  const [todayPage, setTodayPage] = useState<DiaryPage>({
    text: '',
    imageUrl: null,
    loading: false
  });

  async function handleGenerateFuture() {
    setFuturePage(prev => ({ ...prev, loading: true }));
    try {
      // テキスト生成
      const textResult = await generateFutureDiary({
        plan: futurePlan || undefined,
        interests: interests.length > 0 ? interests : undefined,
        style: 'casual'
      });

      setFuturePage(prev => ({ ...prev, text: textResult.generated_text }));

      // 画像生成
      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: 'watercolor',
        aspect_ratio: '1:1'
      });

      setFuturePage(prev => ({ 
        ...prev, 
        imageUrl: imageResult.signed_url || null,
        loading: false
      }));

    } catch (error) {
      console.error('Future diary generation failed:', error);
      setFuturePage(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleGenerateToday() {
    if (!todayReflection.trim()) return;

    setTodayPage(prev => ({ ...prev, loading: true }));
    try {
      // テキスト生成
      const textResult = await generateTodayReflection({
        reflection_text: todayReflection,
        style: 'diary'
      });

      setTodayPage(prev => ({ ...prev, text: textResult.generated_text }));

      // 画像生成
      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: 'watercolor',
        aspect_ratio: '1:1'
      });

      setTodayPage(prev => ({ 
        ...prev, 
        imageUrl: imageResult.signed_url || null,
        loading: false
      }));

    } catch (error) {
      console.error('Today reflection generation failed:', error);
      setTodayPage(prev => ({ ...prev, loading: false }));
    }
  }

  function handleSuggestActivities() {
    const commonInterests = ['読書', '散歩', '映画鑑賞', 'ゲーム', '料理'];
    setInterests(commonInterests);
    setFuturePlan('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* ヘッダー */}
      <header className="text-center py-6">
        <h1 className="text-3xl font-bold text-amber-800">AI未来日記</h1>
        <p className="text-amber-600 mt-2">明日への想いと今日の記録</p>
      </header>

      {/* 見開きレイアウト */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* 左ページ：今日の振り返り */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-400">
            <h2 className="text-xl font-bold text-blue-800 mb-4">今日の振り返り</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  今日あったこと
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-32 resize-none"
                  placeholder="今日の出来事や感じたことを自由に書いてください..."
                  value={todayReflection}
                  onChange={e => setTodayReflection(e.target.value)}
                />
              </div>
              
              <button
                onClick={handleGenerateToday}
                disabled={!todayReflection.trim() || todayPage.loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {todayPage.loading ? '生成中...' : '今日の日記を作成'}
              </button>
            </div>

            {/* 今日の日記表示エリア */}
            {(todayPage.text || todayPage.imageUrl) && (
              <div className="mt-6 space-y-4">
                {todayPage.imageUrl && (
                  <div className="text-center">
                    <Image 
                      src={todayPage.imageUrl} 
                      alt="今日の挿絵" 
                      width={400}
                      height={256}
                      className="max-w-full h-64 object-cover rounded-lg mx-auto"
                    />
                  </div>
                )}
                {todayPage.text && (
                  <div className="vertical-text bg-blue-50 p-4 rounded-lg">
                    {todayPage.text}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右ページ：未来日記 */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-r-4 border-amber-400">
            <h2 className="text-xl font-bold text-amber-800 mb-4">明日の未来日記</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  明日の予定
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 h-24 resize-none"
                  placeholder="明日の予定を教えてください..."
                  value={futurePlan}
                  onChange={e => setFuturePlan(e.target.value)}
                />
              </div>

              <div className="text-center">
                <span className="text-gray-500">または</span>
              </div>

              <button
                onClick={handleSuggestActivities}
                className="w-full border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium py-2 px-4 rounded-md transition-colors"
              >
                予定がない → おすすめ活動を提案
              </button>

              {interests.length > 0 && (
                <div className="text-sm text-gray-600">
                  提案された活動: {interests.join('、')}
                </div>
              )}
              
              <button
                onClick={handleGenerateFuture}
                disabled={(!futurePlan.trim() && interests.length === 0) || futurePage.loading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {futurePage.loading ? '生成中...' : '未来日記を作成'}
              </button>
            </div>

            {/* 未来日記表示エリア */}
            {(futurePage.text || futurePage.imageUrl) && (
              <div className="mt-6 space-y-4">
                {futurePage.imageUrl && (
                  <div className="text-center">
                    <Image 
                      src={futurePage.imageUrl} 
                      alt="未来の挿絵" 
                      width={400}
                      height={256}
                      className="max-w-full h-64 object-cover rounded-lg mx-auto"
                    />
                  </div>
                )}
                {futurePage.text && (
                  <div className="vertical-text bg-amber-50 p-4 rounded-lg">
                    {futurePage.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="text-center text-xs text-gray-500 pb-6">
          API: {API}
        </div>
      </div>
    </div>
  );
}
