"""
Example usage and test suite for the MongoDB data model
Usage: MONGO_URI="mongodb://localhost:27017/atc" python example.py
"""
from datetime import datetime, timedelta
from db import MongoDatabase, TranscriptionCRUD, ShiftCRUD


# Sample data matching the JSON schema
sample_transcription = {
    "shift_id": "shift_20250624_0800",
    "controller_id": "CTR_823",
    "facility": "blowntiresLSZH1",
    "status": "completed",
    "start_time": datetime(2025, 6, 24, 8, 0, 0),
    "end_time": datetime(2025, 6, 24, 16, 0, 0),
    "position": "Twr",
    "schedule_type": "2-2-1",
    "traffic_count_avg": 15,
    "original_file": "blowntiresLSZH1-Twr-Jun-24-2025-0800Z.mp3",
    "transcription": "United one two, one two three...",
    "language": "en",
    "segments": [
        {
            "id": 0,
            "start": 0.0,
            "end": 4.24,
            "speaker": "controller",
            "text": "United one two, one two three, three three eight"
        },
        {
            "id": 1,
            "start": 4.24,
            "end": 5.24,
            "speaker": "pilot",
            "text": "Roger, understood"
        }
    ]
}

sample_shift = {
    "shift_id": "shift_20240115_123",
    "controller_id": "CTR_123",
    "date": "2024-01-15",
    "shift_time": "06:00-14:00",
    "position": "tower",
    "status": "completed",
    "executive_summary": "Controller demonstrated moderate fatigue...",
    "fatigue_analysis": {
        "score": 58,
        "severity": "moderate",
        "trend": "increasing",
        "indicators": [
            {
                "type": "response_time",
                "evidence": "Average response increased from 2.1s to 3.5s",
                "severity": "medium"
            }
        ],
        "metrics": {
            "avg_response_time": 2.8,
            "hesitation_count": 12,
            "hours_on_duty": 8
        }
    },
    "safety_analysis": {
        "score": 15,
        "severity": "low",
        "issues_found": [],
        "requires_immediate_review": False,
        "summary": "No safety violations detected."
    },
    "recommendations": [
        {
            "priority": 1,
            "action": "Monitor next shift closely",
            "rationale": "Fatigue increasing toward end of shift"
        }
    ],
    "requires_attention": True,
    "priority_level": "medium"
}


def main():
    # Initialize database
    db = MongoDatabase()
    db.connect()
    db.create_indexes()

    try:
        print("\n=== TRANSCRIPTION CRUD EXAMPLES ===\n")

        # Initialize CRUD
        trans_crud = TranscriptionCRUD(db)

        # Create
        print("1. Creating transcription...")
        trans_id = trans_crud.create(sample_transcription.copy())
        print(f"   ID: {trans_id}")

        # Find by shift_id
        print("\n2. Finding transcription by shift_id...")
        found = trans_crud.find_by_shift_id("shift_20250624_0800")
        print(f"   Found: {found['shift_id']} (status: {found['status']})")

        # Update status
        print("\n3. Updating transcription status...")
        updated = trans_crud.update_status("shift_20250624_0800", "processing")
        print(f"   Updated status: {updated['status']}")

        # Find by controller
        print("\n4. Finding transcriptions by controller...")
        by_controller = trans_crud.find_by_controller_id("CTR_823")
        print(f"   Found {len(by_controller)} transcription(s)")

        # Count
        print("\n5. Counting transcriptions...")
        count = trans_crud.count()
        print(f"   Total: {count}")

        print("\n=== SHIFT CRUD EXAMPLES ===\n")

        # Initialize CRUD
        shift_crud = ShiftCRUD(db)

        # Create
        print("1. Creating shift...")
        shift_id = shift_crud.create(sample_shift.copy())
        print(f"   ID: {shift_id}")

        # Find by shift_id
        print("\n2. Finding shift by shift_id...")
        found_shift = shift_crud.find_by_shift_id("shift_20240115_123")
        print(f"   Found: {found_shift['shift_id']}")
        print(f"   Fatigue Score: {found_shift['fatigue_analysis']['score']}")

        # Find high-risk
        print("\n3. Finding high-risk shifts (fatigue >= 50)...")
        high_risk = shift_crud.find_high_risk(50)
        print(f"   Found {len(high_risk)} high-risk shift(s)")

        # Find by controller
        print("\n4. Finding shifts by controller...")
        by_controller_shift = shift_crud.find_by_controller_id("CTR_123")
        print(f"   Found {len(by_controller_shift)} shift(s)")

        # Find requiring attention
        print("\n5. Finding shifts requiring attention...")
        attention = shift_crud.find_requiring_attention()
        print(f"   Found {len(attention)} shift(s) requiring attention")

        # Update
        print("\n6. Updating shift...")
        updated_shift = shift_crud.update(
            "shift_20240115_123",
            {"priority_level": "high", "requires_attention": True}
        )
        print(f"   Updated priority: {updated_shift['priority_level']}")

        # Count
        print("\n7. Counting shifts...")
        shift_count = shift_crud.count()
        print(f"   Total: {shift_count}")


        print("\n✓ All examples completed successfully")

    except Exception as e:
        print(f"\n✗ Error: {e}")
    finally:
        db.disconnect()


if __name__ == "__main__":
    main()
