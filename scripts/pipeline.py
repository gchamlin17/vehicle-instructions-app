"""
Vehicle Instructions App – Content Pipeline
This Python script implements the core content pipeline described in the project
plan: extracting text from a vehicle manual PDF, using a large language model
to summarise the text into a friendly narration script, converting the
script to speech using a text‑to‑speech (TTS) service, and finally
assembling a simple video by pairing the audio with a static image.

Prerequisites
--------------
* Python 3.9 or later with the following packages installed:
  - PyMuPDF (for PDF text extraction)
  - requests (for HTTP API calls)
* An external FFmpeg installation available on the system PATH (see
  the project documentation for installation steps). FFmpeg is used
  to combine the static image with the generated audio to produce
  an MP4 file.
* Environment variables for API keys:
  - ``OPENAI_API_KEY``: your OpenAI API key used for summarisation.
  - ``ELEVENLABS_API_KEY``: your ElevenLabs API key used for TTS.

Usage
-----
Run this script from PowerShell or the command line. For example:

.. code-block:: powershell

    $env:OPENAI_API_KEY = "<your openai key>"
    $env:ELEVENLABS_API_KEY = "<your elevenlabs key>"
    py scripts/pipeline.py \ \
      --pdf "C:\path\to\manual.pdf" \ \
      --image "C:\path\to\background.jpg" \ \
      --output "C:\path\to\output_dir" \ \
      --vehicle "toyota-camry-2025" \ \
      --voice "21m00Tcm4TlvDq8ikWAM"

The script will extract the manual text, generate a narration script via the
OpenAI API, synthesise speech with ElevenLabs, and write the audio and video
files to the specified output directory.

Notes
-----
This script is provided as a reference implementation. It makes external
network calls to the OpenAI and ElevenLabs APIs. When running in an
offline environment these calls will fail. For unit testing you may wish
to stub out the calls to ``generate_script`` and ``generate_audio``.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from typing import Optional

import fitz  # PyMuPDF
import requests


@dataclass
class PipelineConfig:
    pdf_path: pathlib.Path
    image_path: pathlib.Path
    output_dir: pathlib.Path
    vehicle_id: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # default ElevenLabs voice (Rachel)
    model: str = "gpt-4"  # default OpenAI model
    # Additional parameters could be added here (e.g. audio format)


def extract_text(pdf_path: pathlib.Path) -> str:
    """Extract all text from a PDF using PyMuPDF.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        A single string containing the concatenated text from all pages.
    """
    doc = fitz.open(pdf_path)
    text = []
    for page in doc:
        text.append(page.get_text())
    doc.close()
    return "\n".join(text)


def generate_script(manual_text: str, openai_api_key: str, model: str = "gpt-4") -> str:
    """Generate a concise narration script from the manual text using OpenAI.

    Args:
        manual_text: The raw text extracted from the PDF manual.
        openai_api_key: Your OpenAI API key.
        model: The OpenAI model to use for summarisation.

    Returns:
        A narration script suitable for a how‑to video.

    Raises:
        RuntimeError: If the API response is not successful or missing content.
    """
    headers = {
        "Authorization": f"Bearer {openai_api_key}",
        "Content-Type": "application/json",
    }
    # Frame the prompt to cast the assistant as an automotive trainer and limit
    # the response length. You can tweak the prompt to suit your needs.
    system_prompt = (
        "You are an automotive trainer. Summarise the following vehicle manual "
        "into a friendly narration script that can be read aloud in 8–10 minutes."
    )
    # We truncate extremely long manuals for the model's context window. Users
    # should consider splitting long manuals into sections for better quality.
    max_chars = 15000
    truncated_text = manual_text[:max_chars]
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": truncated_text},
    ]
    data = {
        "model": model,
        "messages": messages,
        "temperature": 0.5,
    }
    response = requests.post(
        "https://api.openai.com/v1/chat/completions", headers=headers, json=data
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"OpenAI API returned status {response.status_code}: {response.text}"
        )
    result = response.json()
    try:
        return result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected OpenAI response: {result}") from exc


def generate_audio(
    script_text: str,
    elevenlabs_api_key: str,
    voice_id: str = "21m00Tcm4TlvDq8ikWAM",
    model_id: str = "eleven_monolingual_v1",
    stability: float = 0.75,
    similarity_boost: float = 0.75,
) -> bytes:
    """Call the ElevenLabs API to generate an MP3 audio from the narration script.

    Args:
        script_text: The narration script to be read.
        elevenlabs_api_key: Your ElevenLabs API key.
        voice_id: The identifier of the voice to use (see ElevenLabs voices).
        model_id: The TTS model ID.
        stability: Voice stability setting (0.0–1.0).
        similarity_boost: Voice similarity boost setting (0.0–1.0).

    Returns:
        Binary audio data (MP3).

    Raises:
        RuntimeError: If the API request fails.
    """
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": elevenlabs_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": script_text,
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
        },
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        raise RuntimeError(
            f"ElevenLabs API returned status {response.status_code}: {response.text}"
        )
    return response.content


def write_binary_file(path: pathlib.Path, data: bytes) -> None:
    """Write binary data to a file, ensuring the parent directory exists."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def create_video(
    image_path: pathlib.Path, audio_path: pathlib.Path, output_path: pathlib.Path
) -> None:
    """Use FFmpeg to combine a static image and an audio track into an MP4.

    Args:
        image_path: Path to the background image file.
        audio_path: Path to the MP3 audio file.
        output_path: Path where the resulting MP4 should be written.
    """
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",  # overwrite output if it exists
        "-loop",
        "1",
        "-i",
        str(image_path),
        "-i",
        str(audio_path),
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(output_path),
    ]
    # Run FFmpeg and capture output. If FFmpeg is not on PATH this will raise
    # FileNotFoundError.
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def run_pipeline(config: PipelineConfig) -> None:
    """Execute the full pipeline using the provided configuration."""
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        raise EnvironmentError("OPENAI_API_KEY environment variable is not set")
    eleven_key = os.environ.get("ELEVENLABS_API_KEY")
    if not eleven_key:
        raise EnvironmentError("ELEVENLABS_API_KEY environment variable is not set")

    # 1. Extract text from the manual
    print(f"[pipeline] Extracting text from {config.pdf_path}...")
    manual_text = extract_text(config.pdf_path)
    print(f"[pipeline] Extracted {len(manual_text)} characters of text.")

    # 2. Generate narration script via OpenAI
    print("[pipeline] Generating narration script via OpenAI...")
    script_text = generate_script(manual_text, openai_key, model=config.model)
    print(f"[pipeline] Generated script ({len(script_text.split())} words).")

    # Save the script to disk for reference
    script_path = config.output_dir / f"{config.vehicle_id}_script.txt"
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(script_text, encoding="utf-8")

    # 3. Generate audio via ElevenLabs
    print("[pipeline] Generating audio narration via ElevenLabs...")
    audio_data = generate_audio(
        script_text,
        eleven_key,
        voice_id=config.voice_id,
    )
    audio_path = config.output_dir / f"{config.vehicle_id}_audio.mp3"
    write_binary_file(audio_path, audio_data)
    print(f"[pipeline] Audio saved to {audio_path}")

    # 4. Create video using FFmpeg
    print("[pipeline] Creating video with FFmpeg...")
    video_path = config.output_dir / f"{config.vehicle_id}_video.mp4"
    create_video(config.image_path, audio_path, video_path)
    print(f"[pipeline] Video saved to {video_path}")

    print("[pipeline] Done.")


def parse_args(argv: Optional[list[str]] = None) -> PipelineConfig:
    parser = argparse.ArgumentParser(description="Vehicle Instructions content pipeline")
    parser.add_argument(
        "--pdf",
        required=True,
        type=pathlib.Path,
        help="Path to the vehicle manual PDF",
    )
    parser.add_argument(
        "--image",
        required=True,
        type=pathlib.Path,
        help="Path to the background image used for the video",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=pathlib.Path,
        help="Directory where script, audio and video files will be saved",
    )
    parser.add_argument(
        "--vehicle",
        required=True,
        dest="vehicle_id",
        help="Identifier for the vehicle (used in output file names)",
    )
    parser.add_argument(
        "--voice",
        default="21m00Tcm4TlvDq8ikWAM",
        dest="voice_id",
        help="ElevenLabs voice ID (default: Rachel)",
    )
    parser.add_argument(
        "--model",
        default="gpt-4",
        help="OpenAI model to use for summarisation (default: gpt-4)",
    )
    args = parser.parse_args(argv)
    return PipelineConfig(
        pdf_path=args.pdf,
        image_path=args.image,
        output_dir=args.output,
        vehicle_id=args.vehicle_id,
        voice_id=args.voice_id,
        model=args.model,
    )


def main(argv: Optional[list[str]] = None) -> int:
    config = parse_args(argv)
    try:
        run_pipeline(config)
    except Exception as exc:
        print(f"[pipeline] Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())