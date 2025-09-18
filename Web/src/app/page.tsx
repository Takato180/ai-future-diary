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
    <div className="min-h-screen bg-amber-50">
      {/* 見開きノートレイアウト */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
            
            {/* 左ページ：今日の振り返り */}
            <div className="bg-white p-8 lg:border-r border-gray-200">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-2">今日 {new Date().toLocaleDateString('ja-JP')}</div>
              </div>
            
              <div className="space-y-6">
                <div>
                  <textarea
                    className="w-full border-none outline-none resize-none text-gray-700 placeholder-gray-400 leading-relaxed h-32"
                    placeholder="今日の出来事を書いてください..."
                    value={todayReflection}
                    onChange={e => setTodayReflection(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={handleGenerateToday}
                  disabled={!todayReflection.trim() || todayPage.loading}
                  className="w-full bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 text-blue-800 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  {todayPage.loading ? '生成中...' : '日記を作成'}
                </button>
              </div>

              {/* 今日の日記表示エリア */}
              {(todayPage.text || todayPage.imageUrl) && (
                <div className="mt-8 space-y-6">
                  {todayPage.imageUrl && (
                    <div className="text-center">
                      <Image 
                        src={todayPage.imageUrl} 
                        alt="今日の挿絵" 
                        width={300}
                        height={200}
                        className="rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {todayPage.text && (
                    <div className="vertical-text text-gray-800 bg-transparent">
                      {todayPage.text}
                    </div>
                  )}
                </div>
              )}
          </div>

            {/* 右ページ：未来日記 */}
            <div className="bg-white p-8">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-2">明日 {new Date(Date.now() + 86400000).toLocaleDateString('ja-JP')}</div>
              </div>
            
              <div className="space-y-6">
                <div>
                  <textarea
                    className="w-full border-none outline-none resize-none text-gray-700 placeholder-gray-400 leading-relaxed h-24"
                    placeholder="明日の予定を教えてください..."
                    value={futurePlan}
                    onChange={e => setFuturePlan(e.target.value)}
                  />
                </div>

                <div className="text-center">
                  <span className="text-gray-400 text-sm">または</span>
                </div>

                <button
                  onClick={handleSuggestActivities}
                  className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  おすすめ活動を提案
                </button>

                {interests.length > 0 && (
                  <div className="text-sm text-gray-500">
                    提案: {interests.join('、')}
                  </div>
                )}
                
                <button
                  onClick={handleGenerateFuture}
                  disabled={(!futurePlan.trim() && interests.length === 0) || futurePage.loading}
                  className="w-full bg-amber-100 hover:bg-amber-200 disabled:bg-gray-100 text-amber-800 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  {futurePage.loading ? '生成中...' : '未来日記を作成'}
                </button>
              </div>

              {/* 未来日記表示エリア */}
              {(futurePage.text || futurePage.imageUrl) && (
                <div className="mt-8 space-y-6">
                  {futurePage.imageUrl && (
                    <div className="text-center">
                      <Image 
                        src={futurePage.imageUrl} 
                        alt="未来の挿絵" 
                        width={300}
                        height={200}
                        className="rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {futurePage.text && (
                    <div className="vertical-text text-gray-800 bg-transparent">
                      {futurePage.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* フッター */}
        <div className="text-center text-xs text-gray-400 py-4">
          API: {API}
        </div>
      </div>
    </div>
  );
}
