export const API = process.env.NEXT_PUBLIC_API_BASE!;

// Storage API
export async function getSignedUrl(path: string, method: 'GET'|'PUT', contentType?: string) {
  const u = new URL(`${API}/storage/signed-url`);
  u.searchParams.set('object_path', path);
  u.searchParams.set('method', method);
  if (contentType && method === 'PUT') u.searchParams.set('content_type', contentType);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).signed_url as string;
}

export async function uploadImageFile(file: File, path: string): Promise<string> {
  // Get signed URL for upload
  const signedUrl = await getSignedUrl(path, 'PUT', file.type);

  // Upload file to signed URL
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image');
  }

  // Return public URL
  return `${API}/storage/files/${path}`;
}

// Text Generation API
export interface FutureDiaryRequest {
  plan?: string;
  interests?: string[];
  style?: string;
  use_ai?: boolean;
  user_id?: string;
}

export interface TodayReflectionRequest {
  reflection_text: string;
  style?: string;
  use_ai?: boolean;
  user_id?: string;
}

export interface TextGenerateResponse {
  generated_text: string;
  image_prompt: string;
}

export async function generateFutureDiary(request: FutureDiaryRequest): Promise<TextGenerateResponse> {
  const r = await fetch(`${API}/text/future-diary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function generateTodayReflection(request: TodayReflectionRequest): Promise<TextGenerateResponse> {
  const r = await fetch(`${API}/text/today-reflection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getWritingStyles() {
  const r = await fetch(`${API}/text/writing-styles`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Image Generation API
export interface ImageGenerateRequest {
  prompt: string;
  size?: string;
  style?: string;
  aspect_ratio?: string;
}

export interface ImageGenerateResponse {
  path: string;
  public_url?: string;
  signed_url?: string;
}

export async function generateImage(request: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  const r = await fetch(`${API}/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getImageStyles() {
  const r = await fetch(`${API}/image/styles`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Diary API
export interface DiaryEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  planText?: string;
  planImageUrl?: string;
  planInputPrompt?: string;
  actualText?: string;
  actualImageUrl?: string;
  actualInputPrompt?: string;
  diffText?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DiaryEntryCreate {
  userId?: string;
  date: string;
  planText?: string;
  planImageUrl?: string;
  planInputPrompt?: string;
  actualText?: string;
  actualImageUrl?: string;
  actualInputPrompt?: string;
  diffText?: string;
  tags?: string[];
}

export async function saveDiaryEntry(date: string, entry: DiaryEntryCreate): Promise<DiaryEntry> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const r = await fetch(`${API}/diary/entries/${date}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryEntry(date: string, userId: string = 'anonymous'): Promise<DiaryEntry | null> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 認証済みの場合はuser_idクエリパラメータを送らない（JWTから自動取得）
  const url = token ? `${API}/diary/entries/${date}` : `${API}/diary/entries/${date}?user_id=${userId}`;

  const r = await fetch(url, {
    headers,
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryEntriesByMonth(month: string, userId: string = 'anonymous'): Promise<DiaryEntry[]> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 認証済みの場合はuser_idクエリパラメータを送らない（JWTから自動取得）
  const url = token ? `${API}/diary/entries?month=${month}` : `${API}/diary/entries?month=${month}&user_id=${userId}`;

  const r = await fetch(url, {
    headers,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryEntriesByYear(year: number, userId: string = 'anonymous'): Promise<DiaryEntry[]> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 認証済みの場合はuser_idクエリパラメータを送らない（JWTから自動取得）
  const url = token ? `${API}/diary/entries/year/${year}` : `${API}/diary/entries/year/${year}?user_id=${userId}`;

  const r = await fetch(url, {
    headers,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function generateDiffSummary(date: string, userId: string = 'anonymous'): Promise<{ date: string; userId: string; diffText: string }> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 認証済みの場合はuser_idクエリパラメータを送らない（JWTから自動取得）
  const url = token ? `${API}/diary/entries/${date}/diff` : `${API}/diary/entries/${date}/diff?user_id=${userId}`;

  const r = await fetch(url, {
    method: 'POST',
    headers,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryStatus() {
  const r = await fetch(`${API}/diary/status`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Auth API
export interface UserCreate {
  userName: string;
  password: string;
}

export interface UserLogin {
  userName: string;
  password: string;
}

export interface UserResponse {
  userId: string;
  userName: string;
  coverImageUrl?: string;
  // プロフィール情報
  birth_date?: string;
  gender?: string;
  occupation?: string;
  hobbies?: string;
  favorite_places?: string;
  family_structure?: string;
  living_area?: string;
  prefecture?: string;
  city?: string;
  favorite_colors?: string[];
  personality_type?: string;
  favorite_season?: string;
  createdAt: string;
}

export interface UserProfileUpdate {
  birth_date?: string;
  gender?: string;
  occupation?: string;
  hobbies?: string;
  favorite_places?: string;
  family_structure?: string;
  living_area?: string;
  prefecture?: string;
  city?: string;
  favorite_colors?: string[];
  personality_type?: string;
  favorite_season?: string;
}

export interface ActivitySuggestionRequest {
  user_id?: string;
  date?: string;
  location_query?: string;
}

export interface ActivitySuggestionResponse {
  suggestions: string[];
  local_events: string[];
  reasoning: string;
}

export interface AuthResponse {
  user: UserResponse;
  access_token: string;
  token_type: string;
}

export async function registerUser(user: UserCreate): Promise<AuthResponse> {
  const r = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function loginUser(user: UserLogin): Promise<AuthResponse> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getCurrentUser(token: string): Promise<UserResponse> {
  const r = await fetch(`${API}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function regenerateCover(token: string): Promise<{ coverImageUrl: string; message: string }> {
  const r = await fetch(`${API}/auth/regenerate-cover`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateUserProfile(profileData: UserProfileUpdate, token: string): Promise<{ message: string; user: UserResponse }> {
  const r = await fetch(`${API}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getActivitySuggestions(request: ActivitySuggestionRequest): Promise<ActivitySuggestionResponse> {
  const r = await fetch(`${API}/text/activity-suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Intro Video API
export async function getIntroConfig() {
  const r = await fetch(`${API}/intro/config`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ url: string; version: number }>;
}

export async function markIntroSeen(opted_out: boolean, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const r = await fetch(`${API}/intro/seen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ opted_out })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Video Generation API
export interface VideoGenerateResponse {
  video_url: string;
  prompt_used: string;
  generation_id: string;
}

export interface VideoStatusResponse {
  intro_video_generated: boolean;
  intro_video_url: string | null;
  last_generated: string | null;
  status: string | null;
  generation_id?: string;
}

export async function generateIntroVideo(token: string): Promise<VideoGenerateResponse> {
  const r = await fetch(`${API}/video/generate-intro`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getVideoStatus(token: string): Promise<VideoStatusResponse> {
  const r = await fetch(`${API}/video/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function generateSpecialVideo(token: string): Promise<VideoGenerateResponse> {
  const r = await fetch(`${API}/video/generate-special`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Diary Streak API
export interface StreakCheckResponse {
  has_seven_day_streak: boolean;
  streak_dates?: string[];
  latest_streak_date?: string;
  current_streak?: number;
  total_entries: number;
  needed_for_seven?: number;
}

export async function checkStreak(token: string): Promise<StreakCheckResponse> {
  const r = await fetch(`${API}/diary/streak-check`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
