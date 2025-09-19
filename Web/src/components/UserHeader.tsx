'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { regenerateCover } from '@/lib/api';
import UserProfileModal from './UserProfileModal';
import Portal from './Portal';

export default function UserHeader() {
  const { user, token, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [regeneratingCover, setRegeneratingCover] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState(user?.coverImageUrl || '');
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // ESCキーで表紙モーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCoverModal) {
        setShowCoverModal(false);
      }
    };

    if (showCoverModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showCoverModal]);

  // スクロール防止とドロップダウン位置計算
  useEffect(() => {
    if (showDropdown || showCoverModal || showProfileModal) {
      document.body.style.overflow = 'hidden';

      // ドロップダウンの位置を計算
      if (showDropdown && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right
        });
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [showDropdown, showCoverModal, showProfileModal]);

  if (!user) return null;

  const handleRegenerateCover = async () => {
    if (!token) return;

    setRegeneratingCover(true);
    try {
      const result = await regenerateCover(token);
      setCoverImageUrl(result.coverImageUrl);
      alert(result.message);
    } catch (error) {
      console.error('Failed to regenerate cover:', error);
      alert('表紙の再生成に失敗しました');
    } finally {
      setRegeneratingCover(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* 左側: 表紙画像とユーザー名 */}
        <div className="flex items-center gap-4">
          {coverImageUrl && (
            <div
              className="w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => setShowCoverModal(true)}
              title="クリックして拡大表示"
            >
              <Image
                src={coverImageUrl}
                alt={`${user.userName}さんの日記帳表紙`}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {user.userName}さんの日記帳
            </h1>
            <p className="text-xs text-slate-500">
              Future Diary
            </p>
          </div>
        </div>

        {/* 右側: ユーザーメニュー */}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-700">{user.userName}</span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

        </div>
      </div>

      {/* ドロップダウンメニュー（ポータル） */}
      {showDropdown && (
        <Portal>
          {/* ドロップダウン用オーバーレイ */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowDropdown(false)}
          />

          <div
            className="fixed w-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-2xl border-2 border-blue-200 py-2 z-[9999] backdrop-blur-sm"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`
            }}
          >
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-medium text-slate-800">{user.userName}さん</p>
              <p className="text-xs text-slate-500">
                登録日: {new Date(user.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>

            <button
              onClick={handleRegenerateCover}
              disabled={regeneratingCover}
              className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2 rounded-lg mx-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {regeneratingCover ? '表紙を再生成中...' : '表紙を再生成'}
            </button>

            <button
              onClick={() => {
                setShowProfileModal(true);
                setShowDropdown(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-blue-100 flex items-center gap-2 rounded-lg mx-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              プロフィール編集
            </button>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-100 flex items-center gap-2 rounded-lg mx-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ログアウト
            </button>
          </div>
        </Portal>
      )}

      {/* 表紙拡大モーダル（ポータル） */}
      {showCoverModal && coverImageUrl && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            {/* 閉じるボタン */}
            <button
              onClick={() => setShowCoverModal(false)}
              className="absolute top-6 right-6 z-10 w-14 h-14 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <svg className="w-7 h-7 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 拡大画像 - Next.js Image component */}
            <Image
              src={coverImageUrl}
              alt={`${user.userName}さんの日記帳表紙（拡大表示）`}
              width={800}
              height={600}
              className="max-w-[92vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />

            {/* 画像情報 */}
            <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg">
              <p className="text-sm font-medium text-gray-800">{user.userName}さんの日記帳表紙</p>
              <p className="text-xs text-gray-600">クリックまたはESCキーで閉じる</p>
            </div>

            {/* モーダル背景クリックで閉じる */}
            <div
              className="absolute inset-0 -z-10"
              onClick={() => setShowCoverModal(false)}
            />
          </div>
        </Portal>
      )}

      {/* プロフィール編集モーダル */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}