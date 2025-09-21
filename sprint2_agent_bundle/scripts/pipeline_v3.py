
# pipeline_v3.py - Multi-segment PDF -> script -> TTS -> slideshow video
# Usage:
#   py scripts/pipeline_v3.py --pdf "C:\path\manual.pdf" --images "C:\img1.jpg;C:\img2.jpg;C:\img3.jpg" --output "C:\out" --vehicle "camry-2025" --ffmpeg "C:\ffmpeg\bin\ffmpeg.exe" --model gpt-4o
import argparse, os, json, textwrap, time, tempfile, subprocess, sys
from pathlib import Path

# External deps: PyMuPDF (import name 'fitz'), requests
import fitz  # PyMuPDF
import requests

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ELEVEN_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

def read_pdf_text(pdf_path, max_chars=4000):
    doc = fitz.open(pdf_path)
    chunks = []
    for page in doc:
        t = page.get_text().strip()
        if t:
            chunks.append(t)
    full = "\n\n".join(chunks)
    return full[:max_chars]

def openai_summarize_to_script(text, model="gpt-4o"):
    if not OPENAI_API_KEY:
        raise SystemExit("OPENAI_API_KEY env var not set.")
    url = "https://api.openai.com/v1/chat/completions"
    messages = [
        {"role":"system","content":"You are a technical writer. Produce a first-person narrated, step-by-step script for a car owner to follow. Keep it clear, concrete, and broken into numbered steps with short sentences."},
        {"role":"user","content":f"Create an instructional narration script from this manual excerpt. 12-16 sentences total.:\n\n{text}"}
    ]
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "temperature": 0.4}
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    if r.status_code != 200:
        raise SystemExit(f"OpenAI error {r.status_code}: {r.text}")
    return r.json()["choices"][0]["message"]["content"].strip()

def split_script_into_segments(script, n_segments):
    # Split into sentences/lines and distribute across segments
    lines = [ln.strip() for ln in script.splitlines() if ln.strip()]
    # flatten if it's numbered
    flat = []
    for ln in lines:
        flat.extend([s.strip() for s in ln.replace("•","- ").split(". ") if s.strip()])
    if not flat:
        flat = [script]
    # chunk evenly
    segs = [[] for _ in range(n_segments)]
    for i, sentence in enumerate(flat):
        segs[i % n_segments].append(sentence if sentence.endswith(".") else sentence + ".")
    return [" ".join(s) for s in segs]

def eleven_tts(text, out_mp3, voice_id="21m00Tcm4TlvDq8ikWAM"):  # default Rachel
    if not ELEVEN_API_KEY:
        raise SystemExit("ELEVENLABS_API_KEY env var not set.")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",
        "voice_settings": {"stability": 0.4, "similarity_boost": 0.7}
    }
    with requests.post(url, headers=headers, json=payload, stream=True, timeout=240) as r:
        if r.status_code != 200:
            raise SystemExit(f"ElevenLabs error {r.status_code}: {r.text}")
        with open(out_mp3, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

def ffmpeg_segment(ffmpeg, image, audio, out_mp4):
    # Try libx264 first, then fallback to mpeg4
    cmd1 = [ffmpeg, "-y", "-loop","1", "-i", image, "-i", audio, "-c:v","libx264","-tune","stillimage","-c:a","aac","-b:a","192k","-shortest", out_mp4]
    p = subprocess.run(cmd1, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode == 0:
        return
    if b"Unknown encoder 'libx264'" in p.stderr or b"not found" in p.stderr:
        cmd2 = [ffmpeg, "-y", "-loop","1", "-i", image, "-i", audio, "-c:v","mpeg4","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-shortest", out_mp4]
        p2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p2.returncode == 0:
            return
        sys.exit("FFmpeg fallback failed:\n" + p2.stderr.decode(errors="ignore"))
    sys.exit("FFmpeg failed:\n" + p.stderr.decode(errors="ignore"))

def ffmpeg_concat(ffmpeg, files_list, out_mp4):
    # Use concat demuxer
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt") as f:
        for p in files_list:
            f.write(f"file '{p.replace(\"'\",\"'\\''\")}'\n")
        list_path = f.name
    cmd = [ffmpeg, "-y", "-f","concat","-safe","0","-i", list_path, "-c","copy", out_mp4]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        # if stream copy fails (codec mismatch), re-encode
        cmd2 = [ffmpeg, "-y", "-f","concat","-safe","0","-i", list_path, "-c:v","libx264","-c:a","aac", out_mp4]
        p2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p2.returncode != 0:
            sys.exit("FFmpeg concat failed:\n" + p2.stderr.decode(errors="ignore"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--images", required=True, help="semicolon or comma-separated list of image paths")
    ap.add_argument("--output", required=True)
    ap.add_argument("--vehicle", required=True)
    ap.add_argument("--model", default="gpt-4o")
    ap.add_argument("--ffmpeg", default=r'"C:\Users\gregc\vi-clean\ffmpeg\ffmpeg\bin\ffmpeg.exe"')
    args = ap.parse_args()

    outdir = Path(args.output); outdir.mkdir(parents=True, exist_ok=True)
    vehicle = args.vehicle

    # parse images list
    raw = args.images.replace(";", ",")
    image_paths = [p.strip().strip('"') for p in raw.split(",") if p.strip()]
    if not image_paths:
        raise SystemExit("No images provided for --images")

    print("[v3] Extracting PDF text…")
    text = read_pdf_text(args.pdf, max_chars=6000)
    print("[v3] Generating narration script via OpenAI…")
    script = openai_summarize_to_script(text, model=args.model)
    script_path = outdir / f"{vehicle}_script.txt"
    script_path.write_text(script, encoding="utf-8")

    print("[v3] Splitting script into", len(image_paths), "segments…")
    seg_texts = split_script_into_segments(script, len(image_paths))

    segment_mp3s = []
    segment_mp4s = []
    manifest = {"vehicle": vehicle, "segments": []}

    for idx, (img, seg_text) in enumerate(zip(image_paths, seg_texts), start=1):
        seg_id = f"{idx:02d}"
        a_out = outdir / f"{vehicle}_seg{seg_id}.mp3"
        v_out = outdir / f"{vehicle}_seg{seg_id}.mp4"
        print(f"[v3] TTS seg {seg_id}…")
        eleven_tts(seg_text, str(a_out))
        segment_mp3s.append(str(a_out))
        print(f"[v3] Making video seg {seg_id}…")
        ffmpeg_segment(args.ffmpeg.strip('"'), img, str(a_out), str(v_out))
        segment_mp4s.append(str(v_out))
        # duration probe could be added; keep simple
        manifest["segments"].append({"index": idx, "image": img, "text": seg_text, "audio": str(a_out), "video": str(v_out)})

    final_mp4 = outdir / f"{vehicle}_video.mp4"
    print("[v3] Concatenating segments ->", final_mp4)
    ffmpeg_concat(args.ffmpeg.strip('"'), segment_mp4s, str(final_mp4))

    audio_full = outdir / f"{vehicle}_audio.mp3"
    print("[v3] Concatenating audio segments ->", audio_full)
    # join audio with concat demuxer
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt") as f:
        for p in segment_mp3s:
            f.write(f"file '{p.replace(\"'\",\"'\\''\")}'\n")
        list_a = f.name
    cmd_a = [args.ffmpeg.strip('"'), "-y", "-f","concat","-safe","0","-i", list_a, "-c","copy", str(audio_full)]
    pa = subprocess.run(cmd_a, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if pa.returncode != 0:
        # fallback re-encode
        cmd_a2 = [args.ffmpeg.strip('"'), "-y", "-f","concat","-safe","0","-i", list_a, "-c:a","aac", str(audio_full)]
        pa2 = subprocess.run(cmd_a2, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if pa2.returncode != 0:
            sys.exit("FFmpeg audio concat failed:\n" + pa2.stderr.decode(errors="ignore"))

    manifest["final"] = {"video": str(final_mp4), "audio": str(audio_full), "script": str(script_path)}
    (outdir / f"{vehicle}_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("[v3] Done.")
if __name__ == "__main__":
    main()
