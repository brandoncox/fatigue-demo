"""
MongoDB CRUD operations for Transcription and Shift collections
Supports both sync (pymongo) and async (motor) operations
"""
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError


class MongoDatabase:
    """Synchronous MongoDB connection and operations"""

    def __init__(self, mongo_uri: str = None, db_name: str = "atc"):
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
        self.db_name = db_name
        self.client = None
        self.db = None

    def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = MongoClient(self.mongo_uri)
            self.db = self.client[self.db_name]
            self.db.command("ping")
            print(f"✓ Connected to MongoDB: {self.db_name}")
        except Exception as e:
            print(f"✗ Failed to connect to MongoDB: {e}")
            raise

    def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            print("✓ Disconnected from MongoDB")

    def create_indexes(self):
        """Create collection indexes"""
        transcriptions = self.db["transcriptions"]
        shifts = self.db["shifts"]

        # Transcription indexes
        transcriptions.create_index("shift_id", unique=True)
        transcriptions.create_index("controller_id")
        transcriptions.create_index("status")
        transcriptions.create_index([("controller_id", 1), ("start_time", -1)])

        # Shift indexes
        shifts.create_index("shift_id", unique=True)
        shifts.create_index("controller_id")
        shifts.create_index("status")
        shifts.create_index([("controller_id", 1), ("date", -1)])
        shifts.create_index("requires_attention")

        print("✓ Created collection indexes")


class TranscriptionCRUD:
    """CRUD operations for Transcription collection"""

    def __init__(self, db: MongoDatabase):
        self.collection = db.db["transcriptions"]

    def create(self, data: Dict[str, Any]) -> str:
        """Create a new transcription record"""
        try:
            # Ensure timestamps
            if isinstance(data.get("start_time"), str):
                data["start_time"] = datetime.fromisoformat(data["start_time"].replace("Z", "+00:00"))
            if isinstance(data.get("end_time"), str):
                data["end_time"] = datetime.fromisoformat(data["end_time"].replace("Z", "+00:00"))

            data["created_at"] = datetime.utcnow()
            data["updated_at"] = datetime.utcnow()

            result = self.collection.insert_one(data)
            print(f"✓ Created transcription: {data.get('shift_id')}")
            return str(result.inserted_id)
        except DuplicateKeyError:
            print(f"✗ Transcription {data.get('shift_id')} already exists")
            raise
        except Exception as e:
            print(f"✗ Error creating transcription: {e}")
            raise

    def find_by_shift_id(self, shift_id: str) -> Optional[Dict]:
        """Find transcription by shift_id"""
        try:
            return self.collection.find_one({"shift_id": shift_id})
        except Exception as e:
            print(f"✗ Error finding transcription: {e}")
            raise

    def find_by_controller_id(self, controller_id: str) -> List[Dict]:
        """Find all transcriptions for a controller"""
        try:
            return list(
                self.collection.find({"controller_id": controller_id}).sort(
                    "start_time", -1
                )
            )
        except Exception as e:
            print(f"✗ Error finding transcriptions: {e}")
            raise

    def find_by_status(self, status: str) -> List[Dict]:
        """Find transcriptions by status"""
        try:
            return list(self.collection.find({"status": status}))
        except Exception as e:
            print(f"✗ Error finding transcriptions by status: {e}")
            raise

    def update(self, shift_id: str, data: Dict[str, Any]) -> Optional[Dict]:
        """Update a transcription"""
        try:
            data["updated_at"] = datetime.utcnow()
            return self.collection.find_one_and_update(
                {"shift_id": shift_id},
                {"$set": data},
                return_document=True
            )
        except Exception as e:
            print(f"✗ Error updating transcription: {e}")
            raise

    def update_status(self, shift_id: str, status: str) -> Optional[Dict]:
        """Update transcription status"""
        return self.update(shift_id, {"status": status})

    def delete(self, shift_id: str) -> int:
        """Delete a transcription"""
        try:
            result = self.collection.delete_one({"shift_id": shift_id})
            if result.deleted_count > 0:
                print(f"✓ Deleted transcription: {shift_id}")
            return result.deleted_count
        except Exception as e:
            print(f"✗ Error deleting transcription: {e}")
            raise

    def get_all(self, limit: int = 50, skip: int = 0) -> List[Dict]:
        """Get all transcriptions with pagination"""
        try:
            return list(
                self.collection.find()
                .limit(limit)
                .skip(skip)
                .sort("created_at", -1)
            )
        except Exception as e:
            print(f"✗ Error getting all transcriptions: {e}")
            raise

    def count(self) -> int:
        """Count total transcriptions"""
        try:
            return self.collection.count_documents({})
        except Exception as e:
            print(f"✗ Error counting transcriptions: {e}")
            raise


class ShiftCRUD:
    """CRUD operations for Shift collection"""

    def __init__(self, db: MongoDatabase):
        self.collection = db.db["shifts"]

    def create(self, data: Dict[str, Any]) -> str:
        """Create a new shift record"""
        try:
            data["created_at"] = datetime.utcnow()
            data["updated_at"] = datetime.utcnow()

            result = self.collection.insert_one(data)
            print(f"✓ Created shift: {data.get('shift_id')}")
            return str(result.inserted_id)
        except DuplicateKeyError:
            print(f"✗ Shift {data.get('shift_id')} already exists")
            raise
        except Exception as e:
            print(f"✗ Error creating shift: {e}")
            raise

    def find_by_shift_id(self, shift_id: str) -> Optional[Dict]:
        """Find shift by shift_id"""
        try:
            return self.collection.find_one({"shift_id": shift_id})
        except Exception as e:
            print(f"✗ Error finding shift: {e}")
            raise

    def find_by_controller_id(self, controller_id: str) -> List[Dict]:
        """Find all shifts for a controller"""
        try:
            return list(
                self.collection.find({"controller_id": controller_id}).sort(
                    "date", -1
                )
            )
        except Exception as e:
            print(f"✗ Error finding shifts: {e}")
            raise

    def find_by_status(self, status: str) -> List[Dict]:
        """Find shifts by status"""
        try:
            return list(self.collection.find({"status": status}))
        except Exception as e:
            print(f"✗ Error finding shifts by status: {e}")
            raise

    def find_requiring_attention(self) -> List[Dict]:
        """Find shifts flagged for attention"""
        try:
            return list(
                self.collection.find({"requires_attention": True}).sort(
                    "created_at", -1
                )
            )
        except Exception as e:
            print(f"✗ Error finding shifts requiring attention: {e}")
            raise

    def find_high_risk(self, fatigue_threshold: int = 70) -> List[Dict]:
        """Find shifts with fatigue score above threshold"""
        try:
            return list(
                self.collection.find({
                    "fatigue_analysis.score": {"$gte": fatigue_threshold}
                }).sort("fatigue_analysis.score", -1)
            )
        except Exception as e:
            print(f"✗ Error finding high-risk shifts: {e}")
            raise

    def find_by_priority(self, priority_level: str) -> List[Dict]:
        """Find shifts by priority level"""
        try:
            return list(
                self.collection.find({"priority_level": priority_level}).sort(
                    "created_at", -1
                )
            )
        except Exception as e:
            print(f"✗ Error finding shifts by priority: {e}")
            raise

    def update(self, shift_id: str, data: Dict[str, Any]) -> Optional[Dict]:
        """Update a shift"""
        try:
            data["updated_at"] = datetime.utcnow()
            return self.collection.find_one_and_update(
                {"shift_id": shift_id},
                {"$set": data},
                return_document=True
            )
        except Exception as e:
            print(f"✗ Error updating shift: {e}")
            raise

    def update_status(self, shift_id: str, status: str) -> Optional[Dict]:
        """Update shift status"""
        return self.update(shift_id, {"status": status})

    def delete(self, shift_id: str) -> int:
        """Delete a shift"""
        try:
            result = self.collection.delete_one({"shift_id": shift_id})
            if result.deleted_count > 0:
                print(f"✓ Deleted shift: {shift_id}")
            return result.deleted_count
        except Exception as e:
            print(f"✗ Error deleting shift: {e}")
            raise

    def get_all(self, limit: int = 50, skip: int = 0) -> List[Dict]:
        """Get all shifts with pagination"""
        try:
            return list(
                self.collection.find()
                .limit(limit)
                .skip(skip)
                .sort("created_at", -1)
            )
        except Exception as e:
            print(f"✗ Error getting all shifts: {e}")
            raise

    def count(self) -> int:
        """Count total shifts"""
        try:
            return self.collection.count_documents({})
        except Exception as e:
            print(f"✗ Error counting shifts: {e}")
            raise
