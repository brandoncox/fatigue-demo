"""
Chunk an audio file into 3-minute segments, transcribe the first chunk with Whisper,
and write the result to out.json.
"""
import json
import os
from pathlib import Path

import numpy as np
import whisper
from scipy.io import wavfile

# Config
INPUT_FILE = "blowntiresLSZH1-Twr-Jun-24-2025-0800Z.mp3"
CHUNK_DURATION_SEC = 3 * 60  # 3 minutes
SAMPLE_RATE = 16000  # Whisper uses 16 kHz
CHUNK_SAMPLES = SAMPLE_RATE * CHUNK_DURATION_SEC
OUTPUT_JSON = "out.json"

# Use the directory containing this script for input/output
SCRIPT_DIR = Path(__file__).resolve().parent
os.chdir(SCRIPT_DIR)

# Load full audio (Whisper returns 16 kHz mono float32)
audio = whisper.load_audio(INPUT_FILE)
num_samples = len(audio)

# Stem for chunk filenames: original name without extension
stem = Path(INPUT_FILE).stem
chunk_files = []

# Chunk and write WAV files to the same directory
for start in range(0, num_samples, CHUNK_SAMPLES):
    end = min(start + CHUNK_SAMPLES, num_samples)
    chunk = audio[start:end]
    if len(chunk) == 0:
        break
    chunk_index = len(chunk_files) + 1
    chunk_name = f"{stem}_chunk_{chunk_index:03d}.wav"
    chunk_path = SCRIPT_DIR / chunk_name
    # scipy wavfile expects int16
    chunk_int16 = (np.clip(chunk, -1.0, 1.0) * 32767).astype(np.int16)
    wavfile.write(str(chunk_path), SAMPLE_RATE, chunk_int16)
    chunk_files.append(chunk_name)

if not chunk_files:
    raise SystemExit("No chunks were written.")

# Load Whisper model and transcribe the first chunk
model = whisper.load_model("turbo")
first_chunk_path = str(SCRIPT_DIR / chunk_files[0])
first_audio = whisper.load_audio(first_chunk_path)
result = model.transcribe(first_audio)

# Convert result to JSON-serializable form (segments may contain numpy types)
def to_serializable(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_serializable(v) for v in obj]
    return obj

# Extract only id, start, end, text from segments
def extract_fields(segment):
    return {
        "id": int(segment["id"]) if isinstance(segment["id"], np.integer) else segment["id"],
        "start": float(segment["start"]) if isinstance(segment["start"], np.floating) else segment["start"],
        "end": float(segment["end"]) if isinstance(segment["end"], np.floating) else segment["end"],
        "text": segment["text"]
    }

out_data = [extract_fields(seg) for seg in result.get("segments", [])]
print(out_data)

# Write to out.json in the same directory
out_path = SCRIPT_DIR / OUTPUT_JSON
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out_data, f, indent=2, ensure_ascii=False)

print(f"Chunked audio into {len(chunk_files)} file(s): {chunk_files}")
print(f"Transcribed first chunk: {chunk_files[0]}")
print(f"Output written to {out_path}")
