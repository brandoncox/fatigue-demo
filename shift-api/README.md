# Shift-API Python MongoDB Data Model

A simple Python MongoDB data model with full CRUD operations for `Transcription` and `Shift` collections.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

Set the MongoDB URI (defaults to `mongodb://127.0.0.1:27017/atc`):

```bash
MONGO_URI="mongodb://localhost:27017/atc" python example.py
```

## Files

- **models.py** — Pydantic models for `Transcription` and `Shift` collections
- **db.py** — CRUD operation classes: `MongoDatabase`, `TranscriptionCRUD`, `ShiftCRUD`
- **example.py** — Complete example demonstrating all CRUD operations

## Transcription Model

The `TranscriptionCRUD` class provides:

- `create(data)` — Create a new transcription record
- `find_by_shift_id(shift_id)` — Find by shift ID
- `find_by_controller_id(controller_id)` — Find all transcriptions for a controller
- `find_by_status(status)` — Find by status (`completed`, `processing`, `queued`, `error`)
- `update(shift_id, data)` — Update transcription fields
- `update_status(shift_id, status)` — Update status only
- `delete(shift_id)` — Delete a transcription
- `get_all(limit, skip)` — Get all with pagination
- `count()` — Count total documents

## Shift Model

The `ShiftCRUD` class provides:

- `create(data)` — Create a new shift record
- `find_by_shift_id(shift_id)` — Find by shift ID
- `find_by_controller_id(controller_id)` — Find all shifts for a controller
- `find_by_status(status)` — Find by status (`completed`, `processing`, `error`)
- `find_requiring_attention()` — Find shifts flagged for attention
- `update(shift_id, data)` — Update shift fields
- `update_status(shift_id, status)` — Update status only
- `delete(shift_id)` — Delete a shift
- `get_all(limit, skip)` — Get all with pagination
- `count()` — Count total documents
- `find_by_priority(priority_level)` — Find by priority (`low`, `medium`, `high`, `urgent`)
- `find_high_risk(fatigue_threshold)` — Find shifts with fatigue score above threshold

## Quick Example

```python
from db import MongoDatabase, ShiftCRUD

db = MongoDatabase()
db.connect()

shift_crud = ShiftCRUD(db)

# Find high-risk shifts
risky = shift_crud.find_high_risk(70)
print(f"High-risk shifts: {len(risky)}")

db.disconnect()
```

## Indexes

Both collections have optimized indexes:

- **Transcription**: `shift_id` (unique), `controller_id`, `status`
- **Shift**: `shift_id` (unique), `controller_id`, `status`
- Compound indexes on `(controller_id, date/timestamp)` for efficient filtering

## Database Connection

Set `MONGO_URI` environment variable:

```bash
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/atc"
python example.py
```

Or pass directly to `MongoDatabase`:

```python
db = MongoDatabase("mongodb+srv://user:pass@cluster.mongodb.net/atc")
```
