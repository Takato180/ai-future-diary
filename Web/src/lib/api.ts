export const API = process.env.NEXT_PUBLIC_API_BASE!;

export async function getSignedUrl(path: string, method: 'GET'|'PUT', contentType?: string) {
  const u = new URL(`${API}/storage/signed-url`);
  u.searchParams.set('object_path', path);
  u.searchParams.set('method', method);
  if (contentType && method === 'PUT') u.searchParams.set('content_type', contentType);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).signed_url as string;
}
