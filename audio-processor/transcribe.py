#!/usr/bin/env python3
"""
Audio Transcription Script using OpenAI Whisper

Transcribes audio files directly using Whisper and outputs JSON with metadata.
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any
import whisper


# Configuration
RAW_DIR = "raw"
OUTPUT_DIR = "output"
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large


def ensure_directories() -> None:
    """Create necessary directories if they don't exist."""
    for directory in [RAW_DIR, OUTPUT_DIR]:
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


def generate_audio_metadata(audio_path: Path) -> Dict[str, Any]:
    """
    Generate metadata for the audio file by parsing the filename.
    
    Expected filename pattern: FACILITY-POSITION-Month-DD-YYYY-HHMMZ.mp3
    Example: KORD1N2-06C-Feb-12-2026-0000Z.mp3
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Dictionary containing metadata fields
    """
    from datetime import datetime, timedelta
    
    filename = audio_path.stem
    parts = filename.split('-')
    
    # Default metadata values (used if parsing fails)
    metadata = {
        "shift_id": f"shift_{filename}",
        "controller_id": "CTR_000",
        "facility": "facility_001",
        "start_time": "2024-01-15T06:00:00Z",
        "end_time": "2024-01-15T14:00:00Z",
        "position": "tower",
        "schedule_type": "2-2-1",
        "traffic_count_avg": 8
    }
    
    try:
        if len(parts) >= 6:
            # Extract facility and position from filename
            # KORD1N2-06C-Feb-12-2026-0000Z.mp3
            facility = parts[0]  # KORD1N2 -> KORD
            position = parts[1]  # 06C
            
            # Parse date components: Feb-12-2026-0000Z
            month_str = parts[2]  # Feb
            day = parts[3]        # 12
            year = parts[4]       # 2026
            time_str = parts[5].replace('Z', '')  # 0000
            
            # Convert month name to number
            month_map = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            }
            month = month_map.get(month_str, '01')
            
            # Format time (0000 -> 00:00)
            hour = time_str[:2] if len(time_str) >= 2 else '00'
            minute = time_str[2:4] if len(time_str) >= 4 else '00'
            
            # Create ISO timestamp for start time
            start_time = f"{year}-{month}-{day.zfill(2)}T{hour}:{minute}:00Z"
            
            # Calculate end time (assume 8-hour shift)
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end_dt = start_dt + timedelta(hours=8)
            end_time = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            # Generate shift ID from timestamp
            shift_id = f"shift_{year}{month}{day}_{hour}{minute}"
            
            # Determine controller_id based on position (example logic)
            # You can customize this mapping
            controller_id = f"CTR_{hash(position) % 900 + 100}"  # Generates CTR_XXX
            
            # Determine traffic count based on time of day (example logic)
            hour_int = int(hour)
            if 6 <= hour_int < 10:  # Morning rush
                traffic_count_avg = 15
            elif 10 <= hour_int < 14:  # Mid-day
                traffic_count_avg = 10
            elif 14 <= hour_int < 18:  # Afternoon
                traffic_count_avg = 12
            elif 18 <= hour_int < 22:  # Evening
                traffic_count_avg = 8
            else:  # Night/early morning
                traffic_count_avg = 5
            
            # Update metadata with parsed values
            metadata.update({
                "shift_id": shift_id,
                "controller_id": controller_id,
                "facility": facility,
                "start_time": start_time,
                "end_time": end_time,
                "position": position,
                "schedule_type": "2-2-1",  # Default schedule type
                "traffic_count_avg": traffic_count_avg
            })
            
            print(f"  Parsed metadata: {facility}, Position {position}, {start_time}")
            
    except Exception as e:
        print(f"  Warning: Could not parse metadata from filename: {e}")
        print(f"  Using default metadata values")
    
    return metadata


def transcribe_audio_file(
    audio_path: Path,
    model: whisper.Whisper,
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Transcribe an audio file using Whisper and combine with metadata.
    
    Args:
        audio_path: Path to the audio file
        model: Loaded Whisper model
        metadata: Metadata dictionary for the audio file
        
    Returns:
        Dictionary containing transcription results and metadata
    """
    print(f"  Transcribing: {audio_path.name}")
    result = model.transcribe(str(audio_path))
    
    # Build complete output with metadata at root level
    transcription_data = {
        # Metadata fields at root level
        **metadata,
        
        # Transcription data
        "original_file": audio_path.name,
        "transcription": result["text"].strip(),
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
    
    return transcription_data


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
    Process a single audio file: generate metadata, transcribe, and save.
    
    Args:
        audio_path: Path to the audio file
        model: Loaded Whisper model
    """
    print(f"\nProcessing: {audio_path.name}")
    print("=" * 60)
    
    # Generate metadata for this audio file
    metadata = generate_audio_metadata(audio_path)
    print(f"  Generated metadata for shift: {metadata['shift_id']}")
    
    # Transcribe audio file directly
    transcription_data = transcribe_audio_file(audio_path, model, metadata)
    
    # Save to JSON
    save_transcription_json(transcription_data, OUTPUT_DIR, audio_path.name)
    
    print(f"✓ Completed: {audio_path.name}")


def main() -> None:
    """Main execution function."""
    print("Audio Transcription Pipeline")
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