'use client';

import Image from "next/image";
import { useState } from 'react';
import { getSignedUrl, API } from '@/lib/api';

export default function Home() {
  const [plan, setPlan] = useState('');
  const [futureText, setFutureText] = useState('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleGenerate() {
    // 仮：バックエンドに /entries を作ったらそこへPOSTしてもOK
    // 今はデモとして「テキストだけ即時生成」風のダミー
    setFutureText(`【未来日記】\n${plan}\n…の予定！`);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const objectPath = `uploads/demo/${crypto.randomUUID()}-${file.name}`;
      const putUrl = await getSignedUrl(objectPath, 'PUT', file.type);
      await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      const getUrl = await getSignedUrl(objectPath, 'GET');
      setImgUrl(getUrl); // 署名URL（短期限）で表示
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">未来日記 MVP</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">明日の予定</label>
        <textarea
          className="w-full border rounded p-2"
          rows={4}
          value={plan}
          onChange={e => setPlan(e.target.value)}
          placeholder="例）午前は研究、午後はジム、夜はスプラ30分"
        />
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          disabled={!plan.trim()}
        >
          未来日記を生成（ダミー）
        </button>
      </div>

      {futureText && (
        <div className="border rounded p-3 whitespace-pre-wrap">
          {futureText}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="file-upload" className="block text-sm font-medium">
          実際の写真をアップロード
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading && <div>アップロード中...</div>}
        {imgUrl && (
          <div className="mt-2">
            <img src={imgUrl} alt="uploaded" className="max-h-64 rounded border" />
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        API: {API}
      </div>
    </main>
  );
}
