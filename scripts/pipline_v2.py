#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
pipeline_v2.py
End-to-end: PDF -> narration script (OpenAI) -> MP3 (ElevenLabs) -> MP4 (FFmpeg)

Usage (Windows PowerShell):
  py scripts\pipeline_v2.py --pdf "C:\...\manual.pdf" --image "C:\...\image.jpg" ^
    --output "C:\...\dist\pipeline-output" --vehicle "demo-car" --model gpt-4o ^
    --ffmpeg "C:\Users\gregc\vi-clean\ffmpeg\ffmpeg\bin\ffmpeg.exe"
"""

import os, sys, json, argparse, textwrap, subprocess, pathlib
import fitz  # PyMuPDF
import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # ElevenLabs "Rachel"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
ELEVEN_TTS_URL_TMPL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

def die(msg: str, code: int = 1):
    print(f"[pipeline] ERROR: {msg}")
    sys.exit(code)

def ensure_dir(p: str):
    pathlib.Path(p).mkdir(parents=True, exist_ok=True)

def read_pdf_text(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    return "\n".join(parts)

def openai_narration(model: str, manual_text: str) -> str:
    if not OPENAI_API_KEY:
        die("Missing OPENAI_API_KEY in environment.")
    # Keep prompt size modest to avoid token limits
    manual_excerpt = manual_text.strip()
    if len(manual_excerpt) > 12000:
        manual_excerpt = manual_excerpt[:12000]

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You write tight, friendly, instructional voiceover scripts for vehicle owners."
            },
            {
                "role": "user",
                "content": textwrap.dedent(f"""
                Based on the following manual excerpt, write a clear ~60–90 second narration script
                for a short help video. Avoid jargon, keep sentences short, and use second person ("you").
                End with a one-sentence safety reminder.

                Manual excerpt:
                {manual_excerpt}
                """).strip()
            }
        ],
        "temperature": 0.4,
    }
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    r = requests.post(OPENAI_URL, headers=headers, json=payload, timeout=60)
    if r.status_code != 200:
        die(f"OpenAI API returned {r.status_code}: {r.text}")
    data = r.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        die(f"Unexpected OpenAI response: {json.dumps(data)[:800]}")

def elevenlabs_tts(text: str, out_mp3: str, voice_id: str = DEFAULT_VOICE_ID):
    if not ELEVENLABS_API_KEY:
        die("Missing ELEVENLABS_API_KEY in environment.")
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "voice_settings": {"stability": 0.4, "similarity_boost": 0.7},
    }
    url = ELEVEN_TTS_URL_TMPL.format(voice_id=voice_id)
    with requests.post(url, headers=headers, json=body, stream=True, timeout=120) as r:
        if r.status_code != 200:
            die(f"ElevenLabs API returned {r.status_code}: {r.text}")
        with open(out_mp3, "wb") as f:
            for chunk in r.iter_content(chunk_size=16384):
                if chunk:
                    f.write(chunk)

def ffmpeg_make_video(ffmpeg_path: str, image_path: str, audio_path: str, out_mp4: str):
    # Build the command; H.264 + AAC, still-image tuning
    cmd = [
        ffmpeg_path, "-y",
        "-loop", "1",
        "-i", image_path,
        "-i", audio_path,
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_mp4
    ]
    print("[pipeline] FFmpeg command:", " ".join(f'"{c}"' if " " in c else c for c in cmd))
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        die(f"FFmpeg not found at: {ffmpeg_path}")
    except subprocess.CalledProcessError as e:
        # Show stderr to help diagnose codec issues (e.g., missing libx264)
        die(f"FFmpeg failed: {e.stderr.decode(errors='ignore')[:1200]}")

def main():
    parser = argparse.ArgumentParser(description="PDF -> script -> audio -> video pipeline")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--vehicle", required=True)
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--voice", default=DEFAULT_VOICE_ID)
    parser.add_argument("--ffmpeg", required=True, help="Full path to ffmpeg.exe")
    args = parser.parse_args()

    pdf_path = os.path.abspath(args.pdf)
    image_path = os.path.abspath(args.image)
    out_dir = os.path.abspath(args.output)
    vehicle = args.vehicle

    if not os.path.isfile(pdf_path):
        die(f"PDF not found: {pdf_path}")
    if not os.path.isfile(image_path):
        die(f"Image not found: {image_path}")
    if not os.path.isfile(args.ffmpeg):
        die(f"FFmpeg exe not found: {args.ffmpeg}")

    ensure_dir(out_dir)

    script_txt = os.path.join(out_dir, f"{vehicle}_script.txt")
    audio_mp3 = os.path.join(out_dir, f"{vehicle}_audio.mp3")
    video_mp4 = os.path.join(out_dir, f"{vehicle}_video.mp4")

    print(f"[pipeline] Extracting text from {pdf_path}...")
    manual_text = read_pdf_text(pdf_path)
    print(f"[pipeline] Extracted {len(manual_text)} characters of text.")

    print("[pipeline] Generating narration script via OpenAI...")
    narration = openai_narration(args.model, manual_text)
    with open(script_txt, "w", encoding="utf-8") as f:
        f.write(narration)
    print(f"[pipeline] Generated script ({len(narration.split())} words).")
    print(f"[pipeline] Script saved to {script_txt}")

    print("[pipeline] Generating audio narration via ElevenLabs...")
    elevenlabs_tts(narration, audio_mp3, voice_id=args.voice)
    print(f"[pipeline] Audio saved to {audio_mp3}")

    print("[pipeline] Creating video with FFmpeg...")
    ffmpeg_make_video(args.ffmpeg, image_path, audio_mp3, video_mp4)
    print(f"[pipeline] Video saved to {video_mp4}")

    print("[pipeline] Done.")

if __name__ == "__main__":
    main()
