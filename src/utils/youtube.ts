export function parseYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!v) return null;

  // raw ID?
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  try {
    const u = new URL(v);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "") || null;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      const m = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}