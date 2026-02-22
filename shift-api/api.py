"""
FastAPI server for Shift and Transcription CRUD operations
Usage: MONGO_URI="mongodb://localhost:27017/atc" uvicorn api:app --reload --port 8001
"""
import os
import io
import tempfile
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, File, Form, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import whisper
from db import MongoDatabase, TranscriptionCRUD, ShiftCRUD
from agents import FatigueAgent, SafetyAgent, SummarizerAgent

# Initialize FastAPI app
app = FastAPI(title="Shift-API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
db = MongoDatabase()


@app.on_event("startup")
async def startup():
    """Connect to MongoDB on startup"""
    db.connect()
    db.create_indexes()
    print("✓ API started and connected to MongoDB")


@app.on_event("shutdown")
async def shutdown():
    """Disconnect from MongoDB on shutdown"""
    db.disconnect()
    print("✓ API shutdown")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "shift-api"}


# ============ HELPER FUNCTIONS ============

async def transcribe_audio_with_whisper(audio_bytes: bytes, filename: str, model_name: str = "base", transcription_doc: dict = None) -> dict:
    """
    Transcribe audio file using Whisper model
    Returns dict with transcription text and segments
    """
    try:
        print(f"Loading Whisper model: {model_name}")
        model = whisper.load_model(model_name)
        
        # Save audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name
        
        try:
            print(f"Transcribing audio: {filename}")
            result = model.transcribe(tmp_path, language="en")
            
            # Extract full transcription
            full_text = result.get("text", "")
            
            # Convert segments to match TranscriptionModel format
            segments = []
            for seg in result.get("segments", []):
                segments.append({
                    "id": seg.get("id", 0),
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "speaker": "controller",  # Default; could be enhanced with speaker diarization
                    "text": seg.get("text", "")
                })
                transcription_doc["segments"] = segments
                transcription_doc["transcription"] = full_text
                transcription_doc["language"] = result.get("language", "en")
                transcription_doc["status"] = "completed"
                transcription_doc["updated_at"] = datetime.utcnow()
                trans_crud = TranscriptionCRUD(db)
                # TranscriptionCRUD.update expects (shift_id, data)
                doc = trans_crud.update(transcription_doc["shift_id"], transcription_doc)
                

        finally:
            # Cleanup temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        raise


async def create_transcription_document(
    metadata: dict,
    audio_filename: str,    
    whisper_result: dict,
    status: str = "processing"
) -> dict:
    """
    Create a transcription document matching TranscriptionModel schema
    """
    return {
        "shift_id": metadata["shift_id"],
        "controller_id": metadata["controller_id"],
        "facility": metadata["facility"],
        "status": status,
        "start_time": datetime.fromisoformat(metadata["start_time"].replace("Z", "+00:00")),
        "end_time": datetime.fromisoformat(metadata["end_time"].replace("Z", "+00:00")),
        "position": metadata["position"],
        "schedule_type": metadata["schedule_type"],
        "traffic_count_avg": metadata["traffic_count_avg"],
        "original_file": audio_filename,
        "transcription": whisper_result.get("transcription", ""),
        "language": whisper_result.get("language", "en"),
        "segments": whisper_result.get("segments", []),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }


async def save_transcription_to_db(transcription_data: dict) -> str:
    """
    Save transcription document to MongoDB
    Returns the MongoDB document ID
    """
    try:
        trans_crud = TranscriptionCRUD(db)
        doc_id = trans_crud.create(transcription_data)
        print(f"✓ Saved transcription to MongoDB: {transcription_data['shift_id']}")
        return doc_id
    except Exception as e:
        print(f"✗ Error saving transcription to MongoDB: {e}")
        raise


##=========== Custom endpoints ============
## add a new endpoint /analyze-shift that accepts a shift_id as input and returns a summary of the shift with fatigue and safety analysis results. This will be used by the frontend to display shift details and analysis results. The endpoint will query the Shift collection for the given shift_id, retrieve the associated transcription. Then it will run the fatigue and safety analysis agents on the transcription text and return a summary of the shift with the analysis results.
#   - Input: shift_id (string)
#   - Output: JSON object containing shift details, executive summary, fatigue analysis results, and safety analysis results
#  
@ app.post("/analyze-shift")
async def analyze_shift(shift_id: str):
    """Analyze a shift by shift_id and return summary and analysis results"""
    try:
        # 1. Retrieve shift document
        shift_crud = ShiftCRUD(db)
        shift = shift_crud.find_by_shift_id(shift_id)
        if not shift:
            raise HTTPException(status_code=404, detail=f"Shift {shift_id} not found")
        # 2. Retrieve associated transcription
        trans_crud = TranscriptionCRUD(db)
        transcription = trans_crud.find_by_shift_id(shift_id)

        print(f"Retrieved shift: {shift_id}, transcription found: {bool(transcription)}")
        if not transcription:
            raise HTTPException(status_code=404, detail=f"Transcription for shift {shift_id} not found")
        # 3. Run fatigue analysis agent
        print("Running fatigue analysis agent...")  
        fatigue_results = await FatigueAgent().analyze(transcription, shift)
        # 4. Run safety analysis agent
        print("Running safety analysis agent...")
        safety_results = await SafetyAgent().analyze(transcription, shift)
        print(f"Fatigue analysis results: {fatigue_results}")
        print(f"Safety analysis results: {safety_results}")
        # 5. Generate executive summary
        summary = await SummarizerAgent().analyze(transcription, shift, fatigue_results, safety_results)

       # 6. Update shift document with analysis results and summary
        shift_update = {
          "executive_summary": summary,
         "fatigue_analysis": fatigue_results,
         "safety_analysis": safety_results,
        "status": "completed",
         "updated_at": datetime.utcnow()}
        shift_crud.update(shift_id, shift_update)

        # 7. Return response
        return {
          "shift_id": shift_id,
         "executive_summary": summary,
        "fatigue_analysis": fatigue_results,
       "safety_analysis": safety_results,
      }
    except Exception as e:
      print(f"Error analyzing shift: {e}")
      raise HTTPException(status_code=500, detail=f"Error analyzing shift: {str(e)}")
    finally:
      print(f"✓ Analysis complete for shift_id: {shift_id}")
  

@app.post("/analyze-transcript")
async def analyze_transcript(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    shift_id: str = Form(...),
    controller_id: str = Form(...),
    facility: str = Form(...),
    start_time: str = Form(...),
    end_time: str = Form(...),
    position: str = Form(...),
    schedule_type: str = Form(...),
    traffic_count_avg: int = Form(...),
):
    """Start analysis job with audio file and metadata"""
    try:
        # Read audio file
        audio_bytes = await file.read()
        
        # Prepare metadata
        metadata = {
            "shift_id": shift_id,
            "controller_id": controller_id,
            "facility": facility,
            "start_time": start_time,
            "end_time": end_time,
            "position": position,
            "schedule_type": schedule_type,
            "traffic_count_avg": traffic_count_avg,
        }

        print(f"Received analysis request for shift_id: {shift_id}")
        print(f"Metadata: {metadata}") 
        print(f"Audio file: {file.filename}, size: {len(audio_bytes)} bytes")
        
       
        
        # Step 2: Create transcription document make this a background task since it can be slow and we want to return response faster
        print("Step 2: Creating transcription document...")
        transcription_doc = await create_transcription_document(
            metadata=metadata,
            audio_filename=file.filename,
            whisper_result={"transcription": "", "segments": []},  # Placeholder; will be updated after transcription completes
            status="processing"  # Set to completed since we already transcribed
        )
         # Step 1: Transcribe audio with Whisper
        print("Step 1: Transcribing audio with Whisper...")
        background_tasks.add_task(transcribe_audio_with_whisper,
            audio_bytes=audio_bytes,
            filename=file.filename,
            model_name="base",
            transcription_doc=transcription_doc
        )
        print(f"✓ Transcription task queued for: {file.filename}")
        #step 2.5: Create a Shift document with status queued and link to transcription
        shift_doc = {
            "shift_id": shift_id,
            "controller_id": controller_id,
            "facility": facility,
            "start_time": start_time,
            "end_time": end_time,
            "position": position,
            "schedule_type": schedule_type,
            "traffic_count_avg": traffic_count_avg,
            "status": "queued"
        }
        try:
            shift_crud = ShiftCRUD(db)
            shift_crud.create(shift_doc)
        except Exception as e:
            print(f"✗ Error creating shift document: {e}")
        
        # Step 3: Save to MongoDB
        print("Step 3: Saving transcription to MongoDB...")
        doc_id = await save_transcription_to_db(transcription_doc)
        print(f"✓ Transcription saved with ID: {doc_id}")
        
        # Queue background task for further analysis (fatigue, safety, etc.)
        # This can be uncommented when ready to add AI agent analysis
        # background_tasks.add_task(
        #     process_shift_analysis,
        #     shift_id=shift_id,
        #     metadata=metadata,
        # )

        return {
            "status": "processing",
            "shift_id": shift_id,
            "transcription_id": doc_id,
            "message": "Audio transcribed and stored. Analysis queued."
        }
    
    except Exception as e:
        print(f"Error processing upload: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing upload: {str(e)}")
    
#

# ============ TRANSCRIPTION ENDPOINTS ============

@app.get("/transcriptions/{shift_id}")
async def get_transcription(shift_id: str):
    """Get a single transcription by shift_id"""
    trans_crud = TranscriptionCRUD(db)
    transcription = trans_crud.find_by_shift_id(shift_id)
    if not transcription:
        raise HTTPException(status_code=404, detail=f"Transcription {shift_id} not found")
    # Convert ObjectId to string for JSON serialization
    transcription["_id"] = str(transcription["_id"])
    return transcription


@app.get("/transcriptions")
async def get_all_transcriptions(
    controller_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get all transcriptions with optional filtering"""
    trans_crud = TranscriptionCRUD(db)
    
    if controller_id:
        results = trans_crud.find_by_controller_id(controller_id)
    elif status:
        results = trans_crud.find_by_status(status)
    else:
        results = trans_crud.get_all(limit=limit, skip=skip)
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "count": len(results),
        "limit": limit,
        "skip": skip,
        "data": results
    }


@app.get("/transcriptions/controller/{controller_id}")
async def get_transcriptions_by_controller(
    controller_id: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get all transcriptions for a specific controller"""
    trans_crud = TranscriptionCRUD(db)
    results = trans_crud.find_by_controller_id(controller_id)
    
    # Apply limit and skip
    results = results[skip : skip + limit]
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "controller_id": controller_id,
        "count": len(results),
        "limit": limit,
        "skip": skip,
        "data": results
    }


@app.get("/transcriptions/status/{status}")
async def get_transcriptions_by_status(status: str):
    """Get all transcriptions with a specific status"""
    trans_crud = TranscriptionCRUD(db)
    results = trans_crud.find_by_status(status)
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "status": status,
        "count": len(results),
        "data": results
    }


# ============ SHIFT ENDPOINTS ============

@app.get("/shifts/{shift_id}")
async def get_shift(shift_id: str):
    """Get a single shift by shift_id"""
    shift_crud = ShiftCRUD(db)
    shift = shift_crud.find_by_shift_id(shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail=f"Shift {shift_id} not found")
    # Convert ObjectId to string for JSON serialization
    shift["_id"] = str(shift["_id"])
    return shift


@app.get("/shifts")
async def get_all_shifts(
    controller_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    requires_attention: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get all shifts with optional filtering"""
    shift_crud = ShiftCRUD(db)
    
    if controller_id:
        results = shift_crud.find_by_controller_id(controller_id)
    elif status:
        results = shift_crud.find_by_status(status)
    elif priority:
        results = shift_crud.find_by_priority(priority)
    elif requires_attention is not None:
        results = shift_crud.find_requiring_attention() if requires_attention else []
    else:
        results = shift_crud.get_all(limit=limit, skip=skip)
    
    # Apply limit and skip if needed
    if controller_id or status or priority or requires_attention is not None:
        results = results[skip : skip + limit]
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "count": len(results),
        "limit": limit,
        "skip": skip,
        "data": results
    }


@app.get("/shifts/controller/{controller_id}")
async def get_shifts_by_controller(
    controller_id: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get all shifts for a specific controller"""
    shift_crud = ShiftCRUD(db)
    results = shift_crud.find_by_controller_id(controller_id)
    
    # Apply limit and skip
    results = results[skip : skip + limit]
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "controller_id": controller_id,
        "count": len(results),
        "limit": limit,
        "skip": skip,
        "data": results
    }


@app.get("/shifts/status/{status}")
async def get_shifts_by_status(status: str):
    """Get all shifts with a specific status"""
    shift_crud = ShiftCRUD(db)
    results = shift_crud.find_by_status(status)
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "status": status,
        "count": len(results),
        "data": results
    }


@app.get("/shifts/priority/{priority_level}")
async def get_shifts_by_priority(priority_level: str):
    """Get all shifts with a specific priority level"""
    shift_crud = ShiftCRUD(db)
    results = shift_crud.find_by_priority(priority_level)
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "priority_level": priority_level,
        "count": len(results),
        "data": results
    }


@app.get("/shifts/high-risk")
async def get_high_risk_shifts(fatigue_threshold: int = Query(70, ge=0, le=100)):
    """Get all high-risk shifts (fatigue score >= threshold)"""
    shift_crud = ShiftCRUD(db)
    results = shift_crud.find_high_risk(fatigue_threshold)
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "fatigue_threshold": fatigue_threshold,
        "count": len(results),
        "data": results
    }


@app.get("/shifts/attention/required")
async def get_shifts_requiring_attention():
    """Get all shifts flagged as requiring attention"""
    shift_crud = ShiftCRUD(db)
    results = shift_crud.find_requiring_attention()
    
    # Convert ObjectIds to strings
    for doc in results:
        doc["_id"] = str(doc["_id"])
    
    return {
        "requires_attention": True,
        "count": len(results),
        "data": results
    }


# ============ STATISTICS ENDPOINTS ============

@app.get("/stats/transcriptions")
async def get_transcription_stats():
    """Get transcription collection statistics"""
    trans_crud = TranscriptionCRUD(db)
    total = trans_crud.count()
    
    return {
        "collection": "transcriptions",
        "total_documents": total
    }


@app.get("/stats/shifts")
async def get_shift_stats():
    """Get shift collection statistics"""
    shift_crud = ShiftCRUD(db)
    total = shift_crud.count()
    
    return {
        "collection": "shifts",
        "total_documents": total
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
