# File: main.py - Minimal working prototype

import os
from typing import Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException
import boto3

from motor.motor_asyncio import AsyncIOMotorClient
from agents import FatigueAgent, SafetyAgent, SummarizerAgent

app = FastAPI()
s3_client = boto3.client('s3')

# MongoDB
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.environ.get("MONGODB_DB", "atc_analyzer")
MONGODB_COLLECTION = os.environ.get("MONGODB_COLLECTION", "reports")

_mongo_client: Optional[AsyncIOMotorClient] = None


def get_mongo_client() -> AsyncIOMotorClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(MONGODB_URI)
    return _mongo_client


async def save_to_database(report: dict) -> None:
    """Store a report document in MongoDB, keyed by shift_id."""
    client = get_mongo_client()
    coll = client[MONGODB_DB][MONGODB_COLLECTION]
    report["_id"] = report["shift_id"]
    await coll.replace_one(
        {"_id": report["shift_id"]},
        report,
        upsert=True,
    )


async def get_from_database(shift_id: str) -> Optional[dict]:
    """Retrieve a report document by shift_id. Returns None if not found."""
    client = get_mongo_client()
    coll = client[MONGODB_DB][MONGODB_COLLECTION]
    doc = await coll.find_one({"_id": shift_id})
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc

@app.post("/analyze-shift")
async def analyze_shift(shift_id: str, background_tasks: BackgroundTasks):
    """Start analysis job"""
    background_tasks.add_task(process_shift, shift_id)
    return {"status": "processing", "shift_id": shift_id}

async def process_shift(shift_id: str):
    """Main processing function"""
    try:
        # 1. Download from S3
        audio_data = download_from_s3(shift_id)
        metadata = get_shift_metadata(shift_id)
        
        # 2. Transcribe (using Deepgram or similar)
        transcript = await transcribe(audio_data)
        
        # 3. Run agents
        fatigue = await FatigueAgent().analyze(transcript, metadata)
        safety = await SafetyAgent().analyze(transcript, metadata)
        summary = await SummarizerAgent().analyze(
            transcript, metadata, fatigue, safety
        )
        
        # 4. Save results
        await save_to_database({
            'shift_id': shift_id,
            'fatigue': fatigue,
            'safety': safety,
            'summary': summary
        })
        
        # 5. Upload report to S3
        upload_report_to_s3(shift_id, summary)
        
        return {"status": "complete"}
        
    except Exception as e:
        log_error(shift_id, e)
        return {"status": "failed", "error": str(e)}

@app.get("/report/{shift_id}")
async def get_report(shift_id: str):
    """Retrieve analysis report"""
    report = await get_from_database(shift_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report not found for shift_id: {shift_id}")
    return report
