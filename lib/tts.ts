const CACHE_PREFIX = 'tts_v1_';

/**
 * Returns a playable URL for the given text.
 * - Checks localStorage first (stores permanent Vercel Blob URLs).
 * - If not cached, calls /api/tts which generates + stores the audio in Blob
 *   and returns { url }. That URL is then saved to localStorage.
 * - In dev (no Blob token), /api/tts returns raw binary; we create a blob: URL
 *   which is NOT cached (it's ephemeral).
 */
export async function getTtsUrl(text: string): Promise<string> {
  const key = CACHE_PREFIX + text;

  const cached = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (cached) return cached;

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('TTS failed');

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const { url } = (await res.json()) as { url: string };
    if (typeof window !== 'undefined') localStorage.setItem(key, url);
    return url;
  }

  // Dev fallback: binary response, ephemeral blob: URL (not cached)
  return URL.createObjectURL(await res.blob());
}

export function playAudio(
  url: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
) {
  if (audioRef.current) {
    audioRef.current.pause();
    if (audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
  }
  const audio = new Audio(url);
  audioRef.current = audio;
  audio.play();
}
