# ai-future-diary
AI Agent Hackathon

Future Diary API - Google Cloud Storageを使用したファイルストレージAPI

## プロジェクト概要

このプロジェクトは、Google Cloud Storageと連携するFastAPIベースのWebサービスです。ファイルのアップロード、ダウンロード、署名付きURLの生成機能を提供します。

## ファイル構成

### src/main.py
FastAPIアプリケーションのメインエントリーポイント。

**主な機能:**
- FastAPIアプリケーションの初期化
- ヘルスチェックエンドポイント (`/health`)
- ルートエンドポイント (`/`)
- storageルーターの統合

### src/storage.py
Google Cloud Storageとの連携を担当するAPIエンドポイント群。

**主な機能:**
- **署名付きURL生成** (`/storage/signed-url`): GET/PUTメソッド用の署名付きURLを生成
- **ファイルアップロード** (`/storage/upload`): サーバー経由でファイルをアップロード
- **ファイルストリーミング** (`/storage/stream`): サーバー経由でファイルをストリーム配信

**環境変数:**
- `PROJECT_ID`: Google Cloud プロジェクトID
- `BUCKET_NAME`: Cloud Storage バケット名  
- `SERVICE_ACCOUNT_EMAIL`: 署名付きURL生成用サービスアカウント

### requirements.txt
Pythonの依存関係を定義。

**主要な依存パッケージ:**
- `fastapi==0.116.1`: WebAPIフレームワーク
- `google-cloud-storage==3.4.0`: Google Cloud Storage クライアント
- `uvicorn==0.35.0`: ASGIサーバー
- `python-multipart==0.0.20`: ファイルアップロード対応

### Dockerfile
本アプリケーションのコンテナ化設定。

**特徴:**
- Python 3.11-slim ベースイメージ
- Cloud Run対応 (PORT環境変数)
- デフォルトポート: 8080
- uvicornでASGIアプリケーションを起動

## セットアップ・実行方法

### ローカル開発
```bash
pip install -r requirements.txt
uvicorn src.main:app --reload
```

### Docker実行
```bash
docker build -t ai-future-diary .
docker run -p 8080:8080 ai-future-diary
```

### 環境変数設定
```bash
export PROJECT_ID="your-gcp-project-id"
export BUCKET_NAME="your-storage-bucket"
export SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
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
