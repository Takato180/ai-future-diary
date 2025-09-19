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

// Text Generation API
export interface FutureDiaryRequest {
  plan?: string;
  interests?: string[];
  style?: string;
}

export interface TodayReflectionRequest {
  reflection_text: string;
  style?: string;
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
  actualText?: string;
  actualImageUrl?: string;
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
  actualText?: string;
  actualImageUrl?: string;
  diffText?: string;
  tags?: string[];
}

export async function saveDiaryEntry(date: string, entry: DiaryEntryCreate): Promise<DiaryEntry> {
  const r = await fetch(`${API}/diary/entries/${date}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryEntry(date: string, userId: string = 'anonymous'): Promise<DiaryEntry | null> {
  const r = await fetch(`${API}/diary/entries/${date}?user_id=${userId}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryEntriesByMonth(month: string, userId: string = 'anonymous'): Promise<DiaryEntry[]> {
  const r = await fetch(`${API}/diary/entries?month=${month}&user_id=${userId}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function generateDiffSummary(date: string, userId: string = 'anonymous'): Promise<{ date: string; userId: string; diffText: string }> {
  const r = await fetch(`${API}/diary/entries/${date}/diff?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getDiaryStatus() {
  const r = await fetch(`${API}/diary/status`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
