'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile, UserProfileUpdate } from '@/lib/api';
import Portal from './Portal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<UserProfileUpdate>({
    birth_date: '',
    gender: '',
    occupation: '',
    hobbies: '',
    favorite_places: '',
    family_structure: '',
    living_area: '',
    prefecture: '',
    city: '',
    favorite_colors: [],
    personality_type: '',
    favorite_season: '',
  });

  // ユーザー情報をフォームに反映
  useEffect(() => {
    if (user) {
      setFormData({
        birth_date: user.birth_date || '',
        gender: user.gender || '',
        occupation: user.occupation || '',
        hobbies: user.hobbies || '',
        favorite_places: user.favorite_places || '',
        family_structure: user.family_structure || '',
        living_area: user.living_area || '',
        prefecture: user.prefecture || '',
        city: user.city || '',
        favorite_colors: user.favorite_colors || [],
        personality_type: user.personality_type || '',
        favorite_season: user.favorite_season || '',
      });
    }
  }, [user]);

  // ESCキーでモーダルを閉じる & スクロール防止
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      await updateUserProfile(formData, token);
      alert('プロフィールを更新しました');
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'プロフィールの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleColorChange = (color: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      favorite_colors: checked
        ? [...(prev.favorite_colors || []), color]
        : (prev.favorite_colors || []).filter(c => c !== color)
    }));
  };

  const colorOptions = ['赤', '青', '緑', '黄', 'ピンク', '紫', 'オレンジ', '茶', '黒', '白'];

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-8 w-full max-w-4xl my-8 shadow-2xl relative">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ヘッダー部分 */}
        <div className="flex items-center justify-center mb-8">
          {/* 表紙画像 */}
          {user?.coverImageUrl && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-blue-200 shadow-lg mr-6">
              <Image
                src={user.coverImageUrl}
                alt={`${user.userName}さんの日記帳表紙`}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              {user?.userName}さんのプロフィール
            </h2>
            <p className="text-slate-600 text-lg">
              絵日記の精度向上のために、あなたのことを教えてください
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本情報 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 border-b border-blue-200 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              基本情報
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="birth_date" className="block text-sm font-medium text-slate-700 mb-2">
                  生年月日
                </label>
                <input
                  type="date"
                  id="birth_date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-2">
                  性別
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                  <option value="その他">その他</option>
                  <option value="未設定">未設定</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="occupation" className="block text-sm font-medium text-slate-700 mb-2">
                職種
              </label>
              <select
                id="occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">選択してください</option>
                <option value="学生">学生</option>
                <option value="会社員">会社員</option>
                <option value="主婦">主婦</option>
                <option value="フリーランス">フリーランス</option>
                <option value="退職">退職</option>
                <option value="その他">その他</option>
              </select>
            </div>
          </div>

          {/* ライフスタイル */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 border-b border-green-200 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              ライフスタイル
            </h3>

            <div>
              <label htmlFor="hobbies" className="block text-sm font-medium text-slate-700 mb-2">
                趣味・特技
              </label>
              <textarea
                id="hobbies"
                name="hobbies"
                value={formData.hobbies}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="例：読書、映画鑑賞、料理、スポーツなど"
              />
            </div>

            <div>
              <label htmlFor="favorite_places" className="block text-sm font-medium text-slate-700 mb-2">
                好きな場所・よく行く場所
              </label>
              <textarea
                id="favorite_places"
                name="favorite_places"
                value={formData.favorite_places}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="例：カフェ、図書館、公園、海、山など"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="family_structure" className="block text-sm font-medium text-slate-700 mb-2">
                  家族構成
                </label>
                <select
                  id="family_structure"
                  name="family_structure"
                  value={formData.family_structure}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="一人暮らし">一人暮らし</option>
                  <option value="家族と同居">家族と同居</option>
                  <option value="パートナーと二人暮らし">パートナーと二人暮らし</option>
                  <option value="その他">その他</option>
                </select>
              </div>

              <div>
                <label htmlFor="living_area" className="block text-sm font-medium text-slate-700 mb-2">
                  住環境
                </label>
                <select
                  id="living_area"
                  name="living_area"
                  value={formData.living_area}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="都市部">都市部</option>
                  <option value="郊外">郊外</option>
                  <option value="田舎">田舎</option>
                  <option value="海近く">海近く</option>
                  <option value="山近く">山近く</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prefecture" className="block text-sm font-medium text-slate-700 mb-2">
                  都道府県
                </label>
                <input
                  type="text"
                  id="prefecture"
                  name="prefecture"
                  value={formData.prefecture}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例：東京都"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-2">
                  市区町村
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例：渋谷区"
                />
              </div>
            </div>
          </div>

          {/* 好み・特性 */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 border-b border-pink-200 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              好み・特性
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                好きな色（複数選択可）
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {colorOptions.map(color => (
                  <label key={color} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.favorite_colors || []).includes(color)}
                      onChange={(e) => handleColorChange(color, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="personality_type" className="block text-sm font-medium text-slate-700 mb-2">
                  性格タイプ
                </label>
                <select
                  id="personality_type"
                  name="personality_type"
                  value={formData.personality_type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="アクティブ">アクティブ</option>
                  <option value="インドア派">インドア派</option>
                  <option value="両方">両方</option>
                </select>
              </div>

              <div>
                <label htmlFor="favorite_season" className="block text-sm font-medium text-slate-700 mb-2">
                  好きな季節
                </label>
                <select
                  id="favorite_season"
                  name="favorite_season"
                  value={formData.favorite_season}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="春">春</option>
                  <option value="夏">夏</option>
                  <option value="秋">秋</option>
                  <option value="冬">冬</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-4 px-6 rounded-2xl font-semibold transition hover:from-gray-300 hover:to-gray-400 shadow-lg"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-2xl font-semibold transition hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  更新中...
                </span>
              ) : (
                '✨ プロフィールを更新する'
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
    </Portal>
  );
}