#!/usr/bin/env python3
"""
Audio Transcription Script using OpenAI Whisper (librosa version)

This version uses librosa instead of pydub, avoiding the ffmpeg dependency.
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any
import whisper
import librosa
import soundfile as sf
import numpy as np


# Configuration
RAW_DIR = "raw"
INPUT_DIR = "input"
OUTPUT_DIR = "output"
CHUNK_LENGTH_SEC = 30  # 30 seconds per chunk
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large


def ensure_directories() -> None:
    """Create necessary directories if they don't exist."""
    for directory in [RAW_DIR, INPUT_DIR, OUTPUT_DIR]:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"✓ Directory ensured: {directory}")


def get_audio_files(directory: str) -> List[Path]:
    """
    Get all audio files from a directory.
    
    Args:
        directory: Path to the directory containing audio files
        
    Returns:
        List of Path objects for audio files
    """
    audio_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac', '.wma'}
    audio_files = []
    
    dir_path = Path(directory)
    if not dir_path.exists():
        print(f"Warning: Directory {directory} does not exist")
        return audio_files
    
    for file_path in dir_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in audio_extensions:
            audio_files.append(file_path)
    
    return sorted(audio_files)


def split_audio_file(
    input_path: Path,
    output_dir: str,
    chunk_length_sec: int = CHUNK_LENGTH_SEC
) -> List[Path]:
    """
    Split an audio file into smaller chunks using librosa.
    
    Args:
        input_path: Path to the input audio file
        output_dir: Directory to save chunks
        chunk_length_sec: Length of each chunk in seconds
        
    Returns:
        List of paths to the created chunk files
    """
    print(f"  Loading audio: {input_path.name}")
    
    # Load audio file
    audio, sample_rate = librosa.load(str(input_path), sr=None, mono=True)
    
    # Calculate chunk size in samples
    chunk_size = chunk_length_sec * sample_rate
    
    # Split into chunks
    num_chunks = int(np.ceil(len(audio) / chunk_size))
    chunk_paths = []
    
    base_name = input_path.stem
    output_path = Path(output_dir)
    
    for i in range(num_chunks):
        start_idx = i * chunk_size
        end_idx = min((i + 1) * chunk_size, len(audio))
        chunk = audio[start_idx:end_idx]
        
        chunk_name = f"{base_name}_chunk_{i:04d}.wav"
        chunk_path = output_path / chunk_name
        
        # Save chunk as WAV file
        sf.write(str(chunk_path), chunk, sample_rate)
        chunk_paths.append(chunk_path)
    
    print(f"  Created {len(chunk_paths)} chunks")
    return chunk_paths


def transcribe_audio_file(
    audio_path: Path,
    model: whisper.Whisper
) -> Dict[str, Any]:
    """
    Transcribe an audio file using Whisper.
    
    Args:
        audio_path: Path to the audio file
        model: Loaded Whisper model
        
    Returns:
        Dictionary containing transcription results
    """
    result = model.transcribe(str(audio_path))
    
    return {
        "file": audio_path.name,
        "text": result["text"].strip(),
        "language": result.get("language", "unknown"),
        "segments": [
            {
                "id": seg["id"],
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip()
            }
            for seg in result.get("segments", [])
        ]
    }


def transcribe_chunks(
    chunk_paths: List[Path],
    model: whisper.Whisper
) -> List[Dict[str, Any]]:
    """
    Transcribe multiple audio chunks.
    
    Args:
        chunk_paths: List of paths to audio chunks
        model: Loaded Whisper model
        
    Returns:
        List of transcription results
    """
    transcriptions = []
    
    for i, chunk_path in enumerate(chunk_paths, 1):
        print(f"  Transcribing chunk {i}/{len(chunk_paths)}: {chunk_path.name}")
        transcription = transcribe_audio_file(chunk_path, model)
        transcriptions.append(transcription)
    
    return transcriptions


def combine_transcriptions(
    transcriptions: List[Dict[str, Any]],
    original_filename: str
) -> Dict[str, Any]:
    """
    Combine chunk transcriptions into a single result.
    
    Args:
        transcriptions: List of individual chunk transcriptions
        original_filename: Name of the original audio file
        
    Returns:
        Combined transcription dictionary
    """
    full_text = " ".join(t["text"] for t in transcriptions)
    
    # Adjust segment timestamps based on chunk offset
    all_segments = []
    time_offset = 0.0
    
    for chunk_data in transcriptions:
        for segment in chunk_data["segments"]:
            adjusted_segment = {
                "id": len(all_segments),
                "start": segment["start"] + time_offset,
                "end": segment["end"] + time_offset,
                "text": segment["text"]
            }
            all_segments.append(adjusted_segment)
        
        # Update offset for next chunk (approximate)
        if chunk_data["segments"]:
            last_segment = chunk_data["segments"][-1]
            time_offset += last_segment["end"]
    
    return {
        "original_file": original_filename,
        "transcription": full_text,
        "language": transcriptions[0]["language"] if transcriptions else "unknown",
        "chunks_processed": len(transcriptions),
        "segments": all_segments
    }


def save_transcription_json(
    transcription: Dict[str, Any],
    output_dir: str,
    original_filename: str
) -> Path:
    """
    Save transcription to a JSON file.
    
    Args:
        transcription: Transcription dictionary
        output_dir: Directory to save the JSON file
        original_filename: Original audio filename
        
    Returns:
        Path to the saved JSON file
    """
    output_path = Path(output_dir)
    json_filename = Path(original_filename).stem + "_transcription.json"
    json_path = output_path / json_filename
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(transcription, f, indent=2, ensure_ascii=False)
    
    print(f"  Saved transcription: {json_path}")
    return json_path


def process_audio_file(
    audio_path: Path,
    model: whisper.Whisper
) -> None:
    """
    Process a single audio file: split, transcribe, and save.
    
    Args:
        audio_path: Path to the audio file
        model: Loaded Whisper model
    """
    print(f"\nProcessing: {audio_path.name}")
    print("=" * 60)
    
    # Split audio into chunks
    chunk_paths = split_audio_file(audio_path, INPUT_DIR)
    
    # Transcribe chunks
    transcriptions = transcribe_chunks(chunk_paths, model)
    
    # Combine results
    combined = combine_transcriptions(transcriptions, audio_path.name)
    
    # Save to JSON
    save_transcription_json(combined, OUTPUT_DIR, audio_path.name)
    
    print(f"✓ Completed: {audio_path.name}")


def main() -> None:
    """Main execution function."""
    print("Audio Transcription Pipeline (librosa version)")
    print("=" * 60)
    
    # Ensure directories exist
    ensure_directories()
    
    # Get audio files
    audio_files = get_audio_files(RAW_DIR)
    
    if not audio_files:
        print(f"\nNo audio files found in '{RAW_DIR}' directory")
        print("Please add audio files and run again.")
        return
    
    print(f"\nFound {len(audio_files)} audio file(s) to process")
    
    # Load Whisper model
    print(f"\nLoading Whisper model: {WHISPER_MODEL}")
    model = whisper.load_model(WHISPER_MODEL)
    print("✓ Model loaded")
    
    # Process each audio file
    for audio_file in audio_files:
        try:
            process_audio_file(audio_file, model)
        except Exception as e:
            print(f"✗ Error processing {audio_file.name}: {e}")
            continue
    
    print("\n" + "=" * 60)
    print("Transcription pipeline complete!")
    print(f"Check the '{OUTPUT_DIR}' directory for JSON transcriptions")


if __name__ == "__main__":
    main()
