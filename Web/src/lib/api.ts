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
