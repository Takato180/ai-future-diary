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
  // 選択された日付
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // 左ページ（予定）の状態
  const [plan, setPlan] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [planPage, setPlanPage] = useState<DiaryPage>({
    text: '',
    imageUrl: null,
    loading: false
  });

  // 右ページ（実際）の状態
  const [actualReflection, setActualReflection] = useState('');
  const [actualPage, setActualPage] = useState<DiaryPage>({
    text: '',
    imageUrl: null,
    loading: false
  });

  async function handleGeneratePlan() {
    console.log('予定日記生成開始');
    setPlanPage(prev => ({ ...prev, loading: true }));
    try {
      console.log('API URL:', API);
      
      // テキスト生成
      console.log('テキスト生成中...');
      const textResult = await generateFutureDiary({
        plan: plan || undefined,
        interests: interests.length > 0 ? interests : undefined,
        style: 'casual'
      });
      console.log('テキスト生成成功:', textResult);

      setPlanPage(prev => ({ ...prev, text: textResult.generated_text }));

      // 画像生成
      console.log('画像生成中...');
      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: 'watercolor',
        aspect_ratio: '1:1'
      });
      console.log('画像生成成功:', imageResult);

      setPlanPage(prev => ({ 
        ...prev, 
        imageUrl: imageResult.signed_url || null,
        loading: false
      }));

    } catch (error) {
      console.error('Plan generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`エラー: ${errorMessage}`);
      setPlanPage(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleGenerateActual() {
    if (!actualReflection.trim()) return;

    console.log('実際の振り返り生成開始');
    setActualPage(prev => ({ ...prev, loading: true }));
    try {
      // テキスト生成
      console.log('実際テキスト生成中...');
      const textResult = await generateTodayReflection({
        reflection_text: actualReflection,
        style: 'diary'
      });
      console.log('実際テキスト生成成功:', textResult);

      setActualPage(prev => ({ ...prev, text: textResult.generated_text }));

      // 画像生成
      console.log('実際画像生成中...');
      const imageResult = await generateImage({
        prompt: textResult.image_prompt,
        style: 'watercolor',
        aspect_ratio: '1:1'
      });
      console.log('実際画像生成成功:', imageResult);

      setActualPage(prev => ({ 
        ...prev, 
        imageUrl: imageResult.signed_url || null,
        loading: false
      }));

    } catch (error) {
      console.error('Actual reflection generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`エラー: ${errorMessage}`);
      setActualPage(prev => ({ ...prev, loading: false }));
    }
  }

  function handleSuggestActivities() {
    const commonInterests = ['読書', '散歩', '映画鑑賞', 'ゲーム', '料理'];
    setInterests(commonInterests);
    setPlan('');
  }

  // 日付を変更する関数
  function handleDateChange(days: number) {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
    // 日付変更時にデータをクリア（本来はローカルストレージから読み込み）
    setPlan('');
    setActualReflection('');
    setPlanPage({ text: '', imageUrl: null, loading: false });
    setActualPage({ text: '', imageUrl: null, loading: false });
    setInterests([]);
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ヘッダー・カレンダーナビゲーション */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">AI日記</h1>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => handleDateChange(-1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              ← 前日
            </button>
            
            <div className="text-lg font-medium text-gray-700">
              {selectedDate.toLocaleDateString('ja-JP', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'short'
              })}
            </div>
            
            <button 
              onClick={() => handleDateChange(1)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              翌日 →
            </button>
            
            <button 
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm"
            >
              今日
            </button>
          </div>
        </div>
      </div>

      {/* 見開きノートレイアウト */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
            
            {/* 左ページ：予定 */}
            <div className="bg-white p-8 lg:border-r border-gray-200">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-2">予定</div>
              </div>
            
              <div className="space-y-6">
                <div>
                  <textarea
                    className="w-full border-none outline-none resize-none text-gray-700 placeholder-gray-400 leading-relaxed h-32"
                    placeholder="予定を書いてください..."
                    value={plan}
                    onChange={e => setPlan(e.target.value)}
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
                  onClick={handleGeneratePlan}
                  disabled={(!plan.trim() && interests.length === 0) || planPage.loading}
                  className="w-full bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 text-blue-800 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  {planPage.loading ? '生成中...' : '予定日記を作成'}
                </button>
              </div>

              {/* 予定日記表示エリア */}
              {(planPage.text || planPage.imageUrl) && (
                <div className="mt-8 space-y-6">
                  {planPage.imageUrl && (
                    <div className="text-center">
                      <Image 
                        src={planPage.imageUrl} 
                        alt="予定の挿絵" 
                        width={300}
                        height={200}
                        className="rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {planPage.text && (
                    <div className="vertical-text text-gray-800 bg-transparent">
                      {planPage.text}
                    </div>
                  )}
                </div>
              )}
          </div>

            {/* 右ページ：実際 */}
            <div className="bg-white p-8">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-2">実際</div>
              </div>
            
              <div className="space-y-6">
                <div>
                  <textarea
                    className="w-full border-none outline-none resize-none text-gray-700 placeholder-gray-400 leading-relaxed h-32"
                    placeholder="実際にあったことを書いてください..."
                    value={actualReflection}
                    onChange={e => setActualReflection(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={handleGenerateActual}
                  disabled={!actualReflection.trim() || actualPage.loading}
                  className="w-full bg-green-100 hover:bg-green-200 disabled:bg-gray-100 text-green-800 font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  {actualPage.loading ? '生成中...' : '実際日記を作成'}
                </button>
              </div>

              {/* 実際日記表示エリア */}
              {(actualPage.text || actualPage.imageUrl) && (
                <div className="mt-8 space-y-6">
                  {actualPage.imageUrl && (
                    <div className="text-center">
                      <Image 
                        src={actualPage.imageUrl} 
                        alt="実際の挿絵" 
                        width={300}
                        height={200}
                        className="rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {actualPage.text && (
                    <div className="vertical-text text-gray-800 bg-transparent">
                      {actualPage.text}
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
