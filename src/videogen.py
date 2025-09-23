# src/videogen.py
import os
import uuid
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import google.generativeai as genai
from google.cloud import storage
from vertexai.preview.vision_models import VideoGenerationModel

from .auth import get_current_user_required
from .db import get_user, update_user_cover, db

router = APIRouter(prefix="/video", tags=["video"])

# Vertex AI 設定
PROJECT_ID = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"  # Veo がサポートされているリージョン

# Cloud Storage 設定
BUCKET_NAME = os.environ.get("STORAGE_BUCKET_NAME", "ai-future-diary-storage")

class VideoGenerateRequest(BaseModel):
    prompt: str
    duration: int = 8  # 8秒動画
    style: str = "cinematic"

class VideoGenerateResponse(BaseModel):
    video_url: str
    prompt_used: str
    generation_id: str

def _get_veo_model():
    """Veo モデルを取得"""
    try:
        import vertexai
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        # 最新のVeo 3.0モデルを使用
        return VideoGenerationModel.from_pretrained("veo-3.0-generate-001")
    except Exception as e:
        print(f"Failed to initialize Veo model: {e}")
        raise e

async def _check_video_generation_status(user_id: str) -> Optional[dict]:
    """ユーザーの動画生成状態をチェック"""
    try:
        doc_ref = db.collection("video_generations").document(user_id)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Failed to check video generation status: {e}")
        return None

async def _mark_video_generation_started(user_id: str, generation_id: str) -> None:
    """動画生成開始をマーク"""
    try:
        doc_ref = db.collection("video_generations").document(user_id)
        doc_ref.set({
            "generation_id": generation_id,
            "status": "generating",
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
            "video_url": None
        })
    except Exception as e:
        print(f"Failed to mark video generation started: {e}")

async def _mark_video_generation_completed(user_id: str, generation_id: str, video_url: str) -> None:
    """動画生成完了をマーク"""
    try:
        doc_ref = db.collection("video_generations").document(user_id)
        doc_ref.update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc),
            "video_url": video_url
        })
    except Exception as e:
        print(f"Failed to mark video generation completed: {e}")

async def _call_veo_api(prompt: str, duration: int = 8) -> bytes:
    """Veo APIを呼び出して動画を生成"""
    try:
        model = _get_veo_model()

        # Veo APIで動画生成
        response = model.generate_video(
            prompt=prompt,
            duration_seconds=duration,
            aspect_ratio="16:9",
            quality="high"
        )

        # 生成完了まで待機
        max_wait_time = 300  # 5分
        start_time = time.time()

        while not response.is_complete:
            if time.time() - start_time > max_wait_time:
                raise Exception("Video generation timeout")
            await asyncio.sleep(10)
            response.refresh()

        # 動画データを取得
        video_data = response.video_bytes
        return video_data

    except Exception as e:
        print(f"Veo API call failed: {e}")
        raise e

async def _upload_video_to_gcs(video_data: bytes, filename: str) -> str:
    """動画をGCSにアップロード"""
    try:
        client = storage.Client()
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(f"videos/{filename}")

        blob.upload_from_string(video_data, content_type="video/mp4")
        blob.make_public()

        return blob.public_url
    except Exception as e:
        print(f"Failed to upload video to GCS: {e}")
        raise e

@router.post("/generate-intro", response_model=VideoGenerateResponse)
async def generate_intro_video(user_id: str = Depends(get_current_user_required)):
    """初回ログイン用イントロ動画を生成"""
    try:
        # ユーザー情報を取得
        user = await get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

        # 既に動画が生成済みかチェック（重複生成防止）
        existing_generation = await _check_video_generation_status(user_id)
        if existing_generation:
            if existing_generation.get("status") == "completed":
                # 既に完了した動画がある場合は既存の動画URLを返す
                return VideoGenerateResponse(
                    video_url=existing_generation["video_url"],
                    prompt_used="Previously generated video",
                    generation_id=existing_generation["generation_id"]
                )
            elif existing_generation.get("status") == "generating":
                # 現在生成中の場合はエラーを返す
                raise HTTPException(status_code=409, detail="動画は既に生成中です。しばらくお待ちください。")

        # 魔法的なプロンプトを生成（ユーザーリクエストに基づく）
        base_prompt = f"""
Create a magical opening sequence that transports viewers into an enchanted world for {user.userName}'s AI future diary.

Scene: A mystical, leather-bound book slowly opens in a dreamy, ethereal magical realm
- Begin with the closed book surrounded by gentle, swirling magical light
- As the book opens, soft golden and silver light emanates from within the pages
- Magical particles and sparkles float gracefully around the book in slow motion
- The pages turn gently, revealing blank parchment ready for writing
- The environment transforms to show a magical sanctuary with floating elements
- Soft beams of light pierce through like sunlight through ancient trees
- Color palette: warm golds, soft purples, ethereal blues, and silver sparkles
- Camera movement: Start wide, slowly zoom and focus on the opening book
- Atmosphere: Mystical, peaceful, inspiring - like entering a personal magical realm
- Duration: 8 seconds
- Style: High-quality cinematic animation with magical fantasy elements

The book represents the gateway to {user.userName}'s personal journey through time and the magic of capturing future dreams.
"""

        # プロフィール情報があれば反映
        if user.favorite_colors:
            colors_text = ", ".join(user.favorite_colors[:2])  # 最大2色
            base_prompt += f"\n- Incorporate {colors_text} as accent colors in the magical light and particle effects"

        if user.favorite_season:
            season_map = {"春": "spring", "夏": "summer", "秋": "autumn", "冬": "winter"}
            season = season_map.get(user.favorite_season, "spring")
            base_prompt += f"\n- Add subtle {season} seasonal magical elements floating in the environment"

        # 一意のファイル名を生成
        generation_id = str(uuid.uuid4())
        filename = f"intro_{user_id}_{generation_id}.mp4"

        print(f"[VIDEO] Generating intro video for user {user_id}")
        print(f"[VIDEO] Generation ID: {generation_id}")
        print(f"[VIDEO] Prompt: {base_prompt}")

        # 生成開始をマーク
        await _mark_video_generation_started(user_id, generation_id)

        try:
            # Veo APIを呼び出して動画を生成
            video_data = await _call_veo_api(base_prompt, duration=8)

            # GCSにアップロード
            video_url = await _upload_video_to_gcs(video_data, filename)

            # 生成完了をマーク
            await _mark_video_generation_completed(user_id, generation_id, video_url)

            print(f"[VIDEO] Successfully generated and uploaded video: {video_url}")

            return VideoGenerateResponse(
                video_url=video_url,
                prompt_used=base_prompt,
                generation_id=generation_id
            )

        except Exception as video_error:
            print(f"[VIDEO] Video generation failed: {video_error}")
            # 失敗した場合は生成状態をクリア
            try:
                doc_ref = db.collection("video_generations").document(user_id)
                doc_ref.delete()
            except:
                pass
            raise video_error

    except HTTPException:
        raise
    except Exception as e:
        print(f"Video generation failed: {e}")
        raise HTTPException(status_code=500, detail="動画生成に失敗しました")

@router.get("/status")
async def get_video_status(user_id: str = Depends(get_current_user_required)):
    """ユーザーの動画生成状態を取得"""
    try:
        generation_status = await _check_video_generation_status(user_id)

        if not generation_status:
            return {
                "intro_video_generated": False,
                "intro_video_url": None,
                "last_generated": None,
                "status": None
            }

        return {
            "intro_video_generated": generation_status.get("status") == "completed",
            "intro_video_url": generation_status.get("video_url"),
            "last_generated": generation_status.get("completed_at"),
            "status": generation_status.get("status"),
            "generation_id": generation_status.get("generation_id")
        }
    except Exception as e:
        print(f"Failed to get video status: {e}")
        raise HTTPException(status_code=500, detail="動画状態の取得に失敗しました")

@router.post("/generate-special", response_model=VideoGenerateResponse)
async def generate_special_video(user_id: str = Depends(get_current_user_required)):
    """7日間連続記録達成後の特別動画を生成"""
    try:
        # ユーザー情報を取得
        user = await get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

        # 7日間連続記録の確認（diary APIから）
        from .diary import check_streak
        try:
            streak_result = await check_streak(user_id)
            if not streak_result.get("has_seven_day_streak"):
                raise HTTPException(status_code=400, detail="7日間連続記録が必要です")
        except Exception as e:
            print(f"Failed to check streak: {e}")
            raise HTTPException(status_code=500, detail="ストリークチェックに失敗しました")

        # 既に特別動画が生成済みかチェック
        existing_generation = await _check_video_generation_status(user_id)
        if existing_generation and existing_generation.get("status") == "special":
            return VideoGenerateResponse(
                video_url=existing_generation["video_url"],
                prompt_used="Previously generated special video",
                generation_id=existing_generation["generation_id"]
            )

        # 7日間の実際の日記データを取得
        from .diary import get_diary_entries_by_year
        try:
            # 7日間連続記録の具体的な日付を取得
            streak_dates = streak_result.get("streak_dates", [])

            # 年間エントリを取得
            current_year = datetime.now().year
            all_entries = await get_diary_entries_by_year(user_id, current_year)

            # ストリーク日付のエントリだけを抽出
            streak_entries = []
            for entry in all_entries:
                if entry['date'] in streak_dates:
                    streak_entries.append(entry)

            # 日付順にソート（最新から古い順）
            streak_entries.sort(key=lambda x: x['date'], reverse=True)

            diary_content_descriptions = []
            for i, entry in enumerate(streak_entries[:7], 1):
                day_desc = f"Day {i} ({entry['date']}): "
                if entry.get('planText') and entry.get('actualText'):
                    day_desc += f"Planned: {entry['planText'][:50]}... Actual: {entry['actualText'][:50]}..."
                elif entry.get('actualText'):
                    day_desc += f"Reflection: {entry['actualText'][:80]}..."
                elif entry.get('planText'):
                    day_desc += f"Plans: {entry['planText'][:80]}..."
                else:
                    day_desc += "A day of thoughtful journaling"
                diary_content_descriptions.append(day_desc)

        except Exception as e:
            print(f"Failed to get diary entries: {e}")
            diary_content_descriptions = [f"Day {i}: A meaningful day of journaling" for i in range(1, 8)]

        # 特別なアルバム動画プロンプトを生成（実際の日記内容を反映）
        special_prompt = f"""
Create an enchanting, personalized journey video for {user.userName} who has achieved 7 consecutive days of diary writing.

Scene: A magical photo album that comes to life, celebrating their dedicated journal journey
- Begin with an elegant, leather-bound photo album with "{user.userName}'s 7-Day Journey" written in golden letters
- The album opens with warm golden light emanating from the pages
- Each page turn reveals a day from their actual journal journey:

{chr(10).join(f"  Page {i}: {desc}" for i, desc in enumerate(diary_content_descriptions, 1))}

Visual Style for each page:
- Elegant book pages with soft parchment texture
- Each page shows artistic illustrations inspired by the diary content
- Gentle magical particles floating around each page as it's revealed
- Smooth page-turning animations with light effects
- Colors: {', '.join(user.favorite_colors) if user.favorite_colors else 'warm earth tones, soft golds, gentle blues'}
- Seasonal atmosphere: {user.favorite_season if user.favorite_season else 'timeless, peaceful ambiance'}

Final sequence:
- All 7 pages visible in a beautiful collage showing the complete journey
- Congratulatory golden text appears: "7 Days of Dedication - Well Done!"
- Album gently closes with sparkles fading
- Duration: 12 seconds to showcase the complete journey
- Style: Cinematic book animation with personal photo album aesthetic, warm and celebrating

This video celebrates {user.userName}'s dedication to capturing life's moments through their AI future diary.
"""

        # プロフィール情報に基づく追加要素
        if user.occupation:
            special_prompt += f"\n- Include subtle elements related to their occupation: {user.occupation}"

        if user.hobbies:
            special_prompt += f"\n- Incorporate hobby-related imagery: {user.hobbies}"

        if user.living_area and user.prefecture:
            special_prompt += f"\n- Include local landscape elements from {user.prefecture}, {user.living_area}"

        # 一意のファイル名を生成
        generation_id = str(uuid.uuid4())
        filename = f"special_{user_id}_{generation_id}.mp4"

        print(f"[VIDEO] Generating special album video for user {user_id}")
        print(f"[VIDEO] Special Generation ID: {generation_id}")

        # 特別動画生成開始をマーク
        await _mark_special_video_generation_started(user_id, generation_id)

        try:
            # Veo APIを呼び出して特別動画を生成（12秒）
            video_data = await _call_veo_api(special_prompt, duration=12)

            # GCSにアップロード
            video_url = await _upload_video_to_gcs(video_data, filename)

            # 特別動画生成完了をマーク
            await _mark_special_video_generation_completed(user_id, generation_id, video_url)

            print(f"[VIDEO] Successfully generated special album video: {video_url}")

            return VideoGenerateResponse(
                video_url=video_url,
                prompt_used=special_prompt,
                generation_id=generation_id
            )

        except Exception as video_error:
            print(f"[VIDEO] Special video generation failed: {video_error}")
            # 失敗した場合は生成状態をクリア
            try:
                doc_ref = db.collection("video_generations").document(user_id)
                doc_ref.delete()
            except:
                pass
            raise video_error

    except HTTPException:
        raise
    except Exception as e:
        print(f"Special video generation failed: {e}")
        raise HTTPException(status_code=500, detail="特別動画生成に失敗しました")

async def _mark_special_video_generation_started(user_id: str, generation_id: str) -> None:
    """特別動画生成開始をマーク"""
    try:
        doc_ref = db.collection("video_generations").document(user_id)
        doc_ref.set({
            "generation_id": generation_id,
            "status": "generating_special",
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
            "video_url": None,
            "video_type": "special"
        })
    except Exception as e:
        print(f"Failed to mark special video generation started: {e}")

async def _mark_special_video_generation_completed(user_id: str, generation_id: str, video_url: str) -> None:
    """特別動画生成完了をマーク"""
    try:
        doc_ref = db.collection("video_generations").document(user_id)
        doc_ref.update({
            "status": "special",
            "completed_at": datetime.now(timezone.utc),
            "video_url": video_url
        })
    except Exception as e:
        print(f"Failed to mark special video generation completed: {e}")

# 開発・テスト用: 動画生成をトリガーするエンドポイント（後で削除予定）
@router.post("/trigger-generation")
async def trigger_video_generation():
    """開発用: 動画生成をトリガー（後で削除）"""
    try:
        # ここで実際のVeo API呼び出しのテストができます
        print("[VIDEO] Video generation triggered manually")

        # サンプルプロンプト
        sample_prompt = """
Create a magical opening sequence for an AI future diary application.
Scene: A mystical book slowly opens in a dreamy, ethereal environment with soft lighting and magical particles.
Duration: 8 seconds, cinematic style, dreamlike atmosphere.
"""

        # TODO: 実際のVeo API呼び出し
        return {
            "status": "triggered",
            "prompt": sample_prompt,
            "note": "This endpoint is for development only and will be removed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))