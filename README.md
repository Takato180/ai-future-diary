# ai-future-diary
AI Agent Hackathon

Future Diary - AI未来日記生成アプリケーション

## プロジェクト概要

このプロジェクトは、Gemini AIとImagen APIを活用したFastAPIベースの未来日記生成アプリケーションです。ユーザーが予定を入力すると未来日記を生成し、実際の出来事と比較して差分要約を生成する機能を提供します。データはFirestore（Cloud Datastore）に永続化され、カレンダー形式で過去の日記を閲覧できます。

## 主な機能

- 🎯 **未来日記生成**: 予定からGemini AIが自然な日記文を生成
- 🎨 **画像生成**: Imagen APIで水彩画風の挿絵を自動生成
- 📝 **実際日記生成**: 振り返りテキストから読みやすい日記に整理
- 🔍 **AI差分要約**: 予定と実際の違いをAIが分析・要約
- 💾 **データ永続化**: Firestoreで日記データを保存・管理
- 📅 **カレンダー表示**: 月別カレンダーで過去の日記を一覧表示
- 🎨 **日記風UI**: ノートブック風のデザインで親しみやすい操作感

## ファイル構成

### バックエンド (FastAPI)

#### src/main.py
FastAPIアプリケーションのメインエントリーポイント。

**主な機能:**
- FastAPIアプリケーションの初期化
- CORS設定、ルーター登録
- ヘルスチェックエンドポイント (`/health`)

#### src/textgen.py
Gemini AIを使用したテキスト生成機能。

**主な機能:**
- **未来日記生成** (`/text/future-diary`): 予定から未来日記を生成
- **実際日記生成** (`/text/today-reflection`): 振り返りから日記を生成
- **文体スタイル** (`/text/writing-styles`): 利用可能な文体一覧
- 改善されたレスポンスパース機能（「素敵な一日だった！」問題を解決）

#### src/imagegen.py
Imagen APIを使用した画像生成機能。

**主な機能:**
- **画像生成** (`/image/generate`): プロンプトから水彩画風画像を生成
- **画像スタイル** (`/image/styles`): 利用可能なスタイル一覧

#### src/db.py
Firestore データベース連携機能。

**主な機能:**
- DiaryEntry データモデル定義
- CRUD操作（作成、読み取り、更新）
-月別エントリ取得機能
- 接続状態確認機能

#### src/diary.py
日記データ管理のAPIエンドポイント群。

**主な機能:**
- **エントリ保存** (`POST /diary/entries/{date}`): 日記エントリの保存・更新
- **エントリ取得** (`GET /diary/entries/{date}`): 特定日の日記取得
- **月別一覧** (`GET /diary/entries?month=YYYY-MM`): 月別日記一覧
- **AI差分要約** (`POST /diary/entries/{date}/diff`): AIによる差分分析
- **接続テスト** (`GET /diary/test`): データベース接続確認

#### src/storage.py
Google Cloud Storageとの連携機能。

**主な機能:**
- **署名付きURL生成** (`/storage/signed-url`): GET/PUTメソッド用URL
- **ファイルアップロード** (`/storage/upload`): サーバー経由アップロード
- **ファイルストリーミング** (`/storage/stream`): ストリーム配信

### フロントエンド (Next.js)

#### Web/src/app/page.tsx
メインUIコンポーネント。

**主な機能:**
- 日付選択とカレンダー表示
- 未来日記・実際日記の生成UI
- データ保存・読み込み機能
- AI差分要約表示
- レスポンシブなノートブック風デザイン

#### Web/src/lib/api.ts
APIクライアントライブラリ。

**主な機能:**
- テキスト生成API呼び出し
- 画像生成API呼び出し
- 日記データCRUD操作
- エラーハンドリング

**環境変数:**
- `PROJECT_ID`: Google Cloud プロジェクトID
- `VERTEX_LOCATION`: Vertex AI リージョン
- `GEMINI_MODEL`: 使用するGeminiモデル
- `BUCKET_NAME`: Cloud Storage バケット名
- `SERVICE_ACCOUNT_EMAIL`: 署名付きURL生成用サービスアカウント

### requirements.txt
Pythonの依存関係を定義。

**主要な依存パッケージ:**
- `fastapi==0.116.1`: WebAPIフレームワーク
- `google-cloud-aiplatform==1.71.1`: Vertex AI クライアント
- `google-cloud-storage<3.0.0`: Google Cloud Storage クライアント
- `google-cloud-firestore==2.19.0`: Firestore データベースクライアント
- `vertexai==1.71.1`: Vertex AI SDK
- `uvicorn==0.35.0`: ASGIサーバー
- `python-multipart==0.0.20`: ファイルアップロード対応
- `pydantic==2.11.9`: データバリデーション

### Dockerfile
本アプリケーションのコンテナ化設定。

**特徴:**
- Python 3.11-slim ベースイメージ
- Cloud Run対応 (PORT環境変数)
- デフォルトポート: 8080
- uvicornでASGIアプリケーションを起動

## セットアップ・実行方法

### 前提条件
- Python 3.11+
- Node.js 18+
- Google Cloud プロジェクト
- Firestore データベース作成 (ai-future-diary-history)
- Vertex AI API 有効化
- Cloud Storage バケット作成

### バックエンド (FastAPI) セットアップ
```bash
# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定
export PROJECT_ID="your-gcp-project-id"
export VERTEX_LOCATION="us-central1"
export GEMINI_MODEL="gemini-2.5-flash"
export BUCKET_NAME="your-storage-bucket"
export SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"

# 開発サーバー起動
uvicorn src.main:app --reload
```

### フロントエンド (Next.js) セットアップ
```bash
cd Web

# 依存関係インストール
npm install

# 環境変数設定
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000" > .env.local

# 開発サーバー起動
npm run dev
```

### Docker実行
```bash
# バックエンド
docker build -t ai-future-diary-backend .
docker run -p 8080:8080 ai-future-diary-backend

# フロントエンド
cd Web
docker build -t ai-future-diary-frontend .
docker run -p 3000:3000 ai-future-diary-frontend
```

### Cloud Run デプロイ
```bash
# バックエンドデプロイ
gcloud run deploy ai-future-diary-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# フロントエンドデプロイ
cd Web
gcloud run deploy ai-future-diary-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Firestore権限設定
```bash
# Cloud Run サービスアカウントにFirestore権限を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$(gcloud run services describe ai-future-diary-backend --region us-central1 --format='value(spec.template.spec.serviceAccountName)')" \
  --role="roles/datastore.user"
```

## コミットメッセージの書き方

このプロジェクトでは、コミットメッセージに以下の命名規則を使用してください：

### プレフィックス規則

- `[add]` - 新機能やファイルを追加する時
- `[fix]` - バグを修正する時
- `[update]` - 既存の機能を更新・改善する時
- `[remove]` - 機能やファイルを削除する時
- `[docs]` - ドキュメントを更新する時
- `[refactor]` - 機能を変更せずにコードを整理する時

### 例

```
[add] ユーザー登録機能を追加
[fix] ログイン時のバリデーションエラーを修正
[update] AI応答生成のアルゴリズムを改善
[docs] READMEにインストール手順を追加
```

### 注意事項

- コミットメッセージは日本語で記述してください
- プレフィックスの後には半角スペースを入れてください
- 変更内容を簡潔かつ明確に記述してください
