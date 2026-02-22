import re
import json
from typing import List, Dict, Any

import httpx

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"
OLLAMA_TIMEOUT = 120.0


async def _ollama_chat(prompt: str, timeout: float = OLLAMA_TIMEOUT) -> str:
    """Send prompt to Ollama and return the assistant message content."""
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout=timeout,
        )
        r.raise_for_status()
        data = r.json()
        return data.get("message", {}).get("content", "").strip()


def _extract_json(text: str) -> Dict[str, Any]:
    """Extract JSON object from model output (handles markdown code blocks)."""
    text = text.strip()
    # Try to find ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    # Fallback: find first { ... }
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    text = text[start : i + 1]
                    break
    return json.loads(text)


class FatigueAgent:
    """Simple fatigue detection agent using Ollama."""

    async def analyze(self, transcription_doc: Dict, shift_doc: Dict) -> Dict:
        """Analyze transcription for fatigue indicators
        
        Args:
            transcription_doc: Transcription document from MongoDB with segments
            shift_doc: Shift document from MongoDB with metadata
        """
        print("Calculating performance metrics for fatigue analysis...")
        
        response_times = self._calculate_response_times(transcription_doc)
        hesitation_count = self._count_hesitations(transcription_doc)
        hours_on_duty = self._get_hours_on_duty(shift_doc)

        prompt = f"""Analyze this air traffic controller shift for fatigue:

SHIFT CONTEXT:
- Duration: {hours_on_duty} hours
- Time started: {shift_doc.get('start_time', 'N/A')}
- Schedule: {shift_doc.get('schedule_type', 'N/A')}
- Position: {shift_doc.get('position', 'N/A')}

PERFORMANCE METRICS:
- Average response time: {response_times['avg']:.1f} seconds
- Hesitations detected: {hesitation_count}
- Total transmissions: {len(transcription_doc.get('segments', []))}

SAMPLE TRANSMISSIONS:
{self._format_samples(transcription_doc, num_samples=10)}

Provide a fatigue assessment with:
1. Fatigue score (0-100)
2. Top 3 concerning indicators with evidence
3. Whether this requires supervisor attention

Output as JSON only, no other text. Make Sure the JSON is properly formatted and parsable. 
ALL keys and ALL values in JSON should be wrapped in double quotes (") unless they already are. 
Be sure to escape any special characters properly. The structure should be as follows:.
The structure should resemeble the following:
{{
  "fatigue_score": <number>,
  "severity": "low|medium|high|critical",
  "indicators": [
    {{"type": "...", "evidence": "...", "timestamp": "..."}}
  ],
  "requires_attention": <boolean>,
  "summary": "brief explanation"
}}"""    
        response_text = await _ollama_chat(prompt)
        print(f"Ollama response for fatigue analysis: {response_text}")
        result = _extract_json(response_text)

        result["metrics"] = {
            "avg_response_time": response_times["avg"],
            "max_response_time": response_times["max"],
            "hesitation_count": hesitation_count,
            "hours_on_duty": hours_on_duty,
        }
        return result

    def _calculate_response_times(self, transcription_doc: Dict) -> Dict:
        """Calculate controller response times from segments"""
        times = []
        segments = transcription_doc.get("segments", [])
        for i in range(len(segments) - 1):
            curr_segment = segments[i]
            next_segment = segments[i + 1]
            
            # Look for pilot transmission followed by controller transmission
            if curr_segment.get("speaker") == "pilot" and next_segment.get("speaker") == "controller":
                curr_end = curr_segment.get("end", 0)
                next_start = next_segment.get("start", 0)
                
                if isinstance(curr_end, (int, float)) and isinstance(next_start, (int, float)):
                    response_time = next_start - curr_end
                    if response_time >= 0:  # Only positive response times
                        times.append(response_time)
        
        return {
            "avg": sum(times) / len(times) if times else 0,
            "max": max(times) if times else 0,
            "min": min(times) if times else 0,
        }

    def _count_hesitations(self, transcription_doc: Dict) -> int:
        """Count hesitation markers (um, uh, er, ah) in controller speech"""
        fillers = ["uh", "um", "er", "ah", "..."]
        count = 0
        segments = transcription_doc.get("segments", [])
        
        for segment in segments:
            if segment.get("speaker") == "controller":
                text = (segment.get("text") or "").lower()
                count += sum(text.count(filler) for filler in fillers)
        
        return count

    def _get_hours_on_duty(self, shift_doc: Dict) -> float:
        """Calculate hours on duty from shift start/end times"""
        start = shift_doc.get("start_time")
        end = shift_doc.get("end_time")
        
        if start and end:
            try:
                from datetime import datetime
                # Handle both string ISO format and datetime objects
                if isinstance(start, str):
                    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                else:
                    start_dt = start
                    
                if isinstance(end, str):
                    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                else:
                    end_dt = end
                    
                delta = end_dt - start_dt
                hours = delta.total_seconds() / 3600
                return hours
            except Exception as e:
                print(f"Error calculating hours on duty: {e}")
        
        # Fallback to default
        return 8.0

    def _format_samples(self, transcription_doc: Dict, num_samples: int = 10) -> str:
        """Format sample segments for LLM analysis"""
        segments = transcription_doc.get("segments", [])
        
        if not segments:
            return "(no transmissions)"
        
        step = max(1, len(segments) // num_samples)
        samples = segments[::step][:num_samples]
        
        return "\n".join(
            f"[{s.get('start', ''):.1f}s] {(s.get('speaker') or '').upper()}: {s.get('text', '')}"
            for s in samples
        )


class SafetyAgent:
    """Simple safety risk detection using Ollama."""

    async def analyze(self, transcription_doc: Dict, shift_doc: Dict) -> Dict:
        """Analyze ATC communications for safety issues
        
        Args:
            transcription_doc: Transcription document from MongoDB with segments
            shift_doc: Shift document from MongoDB with metadata
        """
        print("Preparing prompt for safety analysis...")
        prompt = f"""Analyze these ATC communications for safety issues:

FACILITY: {shift_doc.get('facility', 'N/A')}
POSITION: {shift_doc.get('position', 'N/A')}
CONTROLLER: {shift_doc.get('controller_id', 'N/A')}

FULL TRANSCRIPT:
{self._format_full_transcript(transcription_doc)}

Identify any:
1. Readback errors (pilot reads back wrong, controller doesn't correct)
2. Unclear or ambiguous instructions
3. Missing standard phraseology
4. Potential separation issues
5. Missed acknowledgments

For each issue found, provide type, quote, timestamp, severity (low/medium/high), and why it's concerning.

Output as JSON only, no other text. Make Sure the JSON is properly formatted and parsable. 
ALL keys and ALL values in JSON should be wrapped in double quotes (") unless they already are. 
Be sure to escape any special characters properly. The structure should be as follows:.
The structure should resemeble the following:
{{
  "safety_score": <0-100, where 100=critical>,
  "issues_found": [
    {{
      "type": "...",
      "severity": "...",
      "timestamp": "...",
      "evidence": "exact quote",
      "concern": "explanation"
    }}
  ],
  "requires_immediate_review": <boolean>,
  "summary": "overall assessment"
}}
"""

        response_text = await _ollama_chat(prompt)
        print(f"Ollama response for safety analysis: {response_text}")
        return _extract_json(response_text)

    def _format_full_transcript(self, transcription_doc: Dict) -> str:
        """Format full transcript from segments for analysis"""
        print("Formatting full transcript for safety analysis...")
        segments = transcription_doc.get("segments", [])
        
        if not segments:
            return "(no transcript)"
        
        return "\n".join(
            f"[{s.get('start', ''):.1f}s] {(s.get('speaker') or '').upper()}: {s.get('text', '')}"
            for s in segments
        )


class SummarizerAgent:
    """Create readable supervisor reports using Ollama."""

    async def analyze(
        self,
        transcription_doc: Dict,
        shift_doc: Dict,
        fatigue_result: Dict,
        safety_result: Dict,
    ) -> Dict:
        """Generate supervisor report summarizing analysis results
        
        Args:
            transcription_doc: Transcription document from MongoDB
            shift_doc: Shift document from MongoDB
            fatigue_result: Results from FatigueAgent analysis
            safety_result: Results from SafetyAgent analysis
        """
        hours_on_duty = self._get_hours(shift_doc)
        
        prompt = f"""Create a supervisor report for this ATC shift:

SHIFT INFO:
Controller: {shift_doc.get('controller_id', 'N/A')}
Date: {shift_doc.get('start_time', 'N/A')}
Duration: {hours_on_duty} hours
Position: {shift_doc.get('position', 'N/A')}
Schedule: {shift_doc.get('schedule_type', 'N/A')}
Facility: {shift_doc.get('facility', 'N/A')}

FATIGUE ANALYSIS:
Score: {fatigue_result.get('fatigue_score', 0)}/100
Severity: {fatigue_result.get('severity', 'N/A')}
Key indicators: {fatigue_result.get('indicators', [])}

SAFETY ANALYSIS:
Score: {safety_result.get('safety_score', 0)}/100
Issues found: {len(safety_result.get('issues_found', []))}
Requires review: {safety_result.get('requires_immediate_review', False)}

Create a clear, actionable report with:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. KEY FINDINGS (bullet points)
3. TIMELINE OF CONCERNS (if any critical moments)
4. RECOMMENDATIONS (specific actions for supervisor)
5. PRIORITY LEVEL (low/medium/high/urgent)

Output as JSON ONLY (no other formats) with these sections (executive_summary, key_findings, timeline, recommendations, priority_level).
Make Sure the JSON is properly formatted and parsable. 
ALL keys and ALL values in JSON should be wrapped in double quotes (") unless they already are. 
Be sure to escape any special characters properly. The structure should be as follows:.
"""

        print("Sending prompt to Ollama for supervisor summary...")
        response_text = await _ollama_chat(prompt)
        return _extract_json(response_text)

    def _get_hours(self, shift_doc: Dict) -> float:
        """Calculate hours on duty from shift document"""
        start = shift_doc.get("start_time")
        end = shift_doc.get("end_time")
        
        if start and end:
            try:
                from datetime import datetime
                # Handle both string ISO format and datetime objects
                if isinstance(start, str):
                    start_dt = datetime.fromisoformat(str(start).replace("Z", "+00:00"))
                else:
                    start_dt = start
                    
                if isinstance(end, str):
                    end_dt = datetime.fromisoformat(str(end).replace("Z", "+00:00"))
                else:
                    end_dt = end
                    
                hours = (end_dt - start_dt).total_seconds() / 3600
                return hours
            except Exception as e:
                print(f"Error calculating hours on duty: {e}")
        
        return 8.0
