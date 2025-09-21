import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function VehicleDetail() {
  const { query } = useRouter();
  const id = (query.id as string) || "";
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState<number>(0);

  useEffect(() => { if (!id) return; (async () => {
    const snap = await getDoc(doc(db, "vehicles", id));
    if (snap.exists()) setData(snap.data());
  })(); }, [id]);

  const videoUrl = data?.videoUrl as string | undefined;
  const segments = (data?.segments as any[]) || [];

  const startTime = useMemo(() => {
    // naive per-segment seeking: assume equal durations if not provided
    const n = Math.max(segments.length, 1);
    return (idx: number) => (idx / n) * 0.999; // fraction for posterity, real player seeking would use timestamps
  }, [segments]);

  if (!id) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!data) return <main style={{ padding: 24 }}>Not found.</main>;

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>{data.name ?? id}</h1>
      {videoUrl ? (
        <video id="player" width={720} controls src={videoUrl} style={{ borderRadius: 8 }} />
      ) : <p>No video uploaded.</p>}

      <h3>Chapters</h3>
      <ol>
        {segments.map((s, idx) => (
          <li key={idx} style={{ marginBottom: 8 }}>
            <button onClick={() => {
              const player = document.getElementById("player") as HTMLVideoElement | null;
              if (player) { player.currentTime = player.duration * startTime(idx); player.play(); }
              setActive(idx);
            }} style={{ padding: 6, borderRadius: 6, background: idx===active ? "#111827" : "#e5e7eb", color: idx===active ? "white" : "black" }}>
              Segment {s.index}: {s.text?.slice(0, 60) ?? ""}
            </button>
          </li>
        ))}
      </ol>

      <h3>Narration Script</h3>
      <pre style={{ whiteSpace:"pre-wrap" }}>{data.script ?? "—"}</pre>
    </main>
  );
}
