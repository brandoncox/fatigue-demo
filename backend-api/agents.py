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

    async def analyze(self, transcript: List[Dict], metadata: Dict) -> Dict:
        """Analyze transcript for fatigue indicators"""
        response_times = self._calculate_response_times(transcript)
        hesitation_count = self._count_hesitations(transcript)
        hours_on_duty = self._get_hours_on_duty(metadata)

        prompt = f"""Analyze this air traffic controller shift for fatigue:

SHIFT CONTEXT:
- Duration: {hours_on_duty} hours
- Time started: {metadata.get('start_time', 'N/A')}
- Schedule: {metadata.get('schedule_type', 'N/A')}
- Position: {metadata.get('position', 'N/A')}

PERFORMANCE METRICS:
- Average response time: {response_times['avg']:.1f} seconds
- Hesitations detected: {hesitation_count}
- Total transmissions: {len(transcript)}

SAMPLE TRANSMISSIONS:
{self._format_samples(transcript, num_samples=10)}

Provide a fatigue assessment with:
1. Fatigue score (0-100)
2. Top 3 concerning indicators with evidence
3. Whether this requires supervisor attention

Format as JSON only, no other text:
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
        result = _extract_json(response_text)

        result["metrics"] = {
            "avg_response_time": response_times["avg"],
            "max_response_time": response_times["max"],
            "hesitation_count": hesitation_count,
            "hours_on_duty": hours_on_duty,
        }
        return result

    def _calculate_response_times(self, transcript: List[Dict]) -> Dict:
        times = []
        for i in range(len(transcript) - 1):
            if transcript[i].get("speaker") == "pilot" and transcript[i + 1].get("speaker") == "controller":
                ta = transcript[i].get("timestamp", 0)
                tb = transcript[i + 1].get("timestamp", 0)
                if isinstance(ta, (int, float)) and isinstance(tb, (int, float)):
                    times.append(tb - ta)
        return {
            "avg": sum(times) / len(times) if times else 0,
            "max": max(times) if times else 0,
            "min": min(times) if times else 0,
        }

    def _count_hesitations(self, transcript: List[Dict]) -> int:
        fillers = ["uh", "um", "er", "ah", "..."]
        count = 0
        for item in transcript:
            if item.get("speaker") == "controller":
                text = (item.get("text") or "").lower()
                count += sum(text.count(f) for f in fillers)
        return count

    def _get_hours_on_duty(self, metadata: Dict) -> float:
        start = metadata.get("start_time")
        end = metadata.get("end_time")
        if start and end:
            try:
                from datetime import datetime
                if isinstance(start, str):
                    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                else:
                    start_dt = start
                if isinstance(end, str):
                    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                else:
                    end_dt = end
                delta = end_dt - start_dt
                return delta.total_seconds() / 3600
            except Exception:
                pass
        return float(metadata.get("hours_on_duty", 8))

    def _format_samples(self, transcript: List[Dict], num_samples: int = 10) -> str:
        if not transcript:
            return "(no transmissions)"
        step = max(1, len(transcript) // num_samples)
        samples = transcript[::step][:num_samples]
        return "\n".join(
            f"[{s.get('timestamp', '')}] {(s.get('speaker') or '').upper()}: {s.get('text', '')}"
            for s in samples
        )


class SafetyAgent:
    """Simple safety risk detection using Ollama."""

    async def analyze(self, transcript: List[Dict], metadata: Dict) -> Dict:
        prompt = f"""Analyze these ATC communications for safety issues:

FACILITY: {metadata.get('facility', 'N/A')}
POSITION: {metadata.get('position', 'N/A')}

FULL TRANSCRIPT:
{self._format_full_transcript(transcript)}

Identify any:
1. Readback errors (pilot reads back wrong, controller doesn't correct)
2. Unclear or ambiguous instructions
3. Missing standard phraseology
4. Potential separation issues
5. Missed acknowledgments

For each issue found, provide type, quote, timestamp, severity (low/medium/high), and why it's concerning.

Output as JSON only:
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
}}"""

        response_text = await _ollama_chat(prompt)
        return _extract_json(response_text)

    def _format_full_transcript(self, transcript: List[Dict]) -> str:
        if not transcript:
            return "(no transcript)"
        return "\n".join(
            f"[{t.get('timestamp', '')}] {(t.get('speaker') or '').upper()}: {t.get('text', '')}"
            for t in transcript
        )


class SummarizerAgent:
    """Create readable supervisor reports using Ollama."""

    async def analyze(
        self,
        transcript: List[Dict],
        metadata: Dict,
        fatigue_result: Dict,
        safety_result: Dict,
    ) -> Dict:
        prompt = f"""Create a supervisor report for this ATC shift:

SHIFT INFO:
Controller: {metadata.get('controller_id', 'N/A')}
Date: {metadata.get('start_time', 'N/A')}
Duration: {self._get_hours(metadata)} hours
Position: {metadata.get('position', 'N/A')}
Schedule: {metadata.get('schedule_type', 'N/A')}

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

Output as JSON with these sections (executive_summary, key_findings, timeline, recommendations, priority_level)."""

        response_text = await _ollama_chat(prompt)
        return _extract_json(response_text)

    def _get_hours(self, metadata: Dict) -> float:
        start, end = metadata.get("start_time"), metadata.get("end_time")
        if start and end:
            try:
                from datetime import datetime
                start_dt = datetime.fromisoformat(str(start).replace("Z", "+00:00")) if isinstance(start, str) else start
                end_dt = datetime.fromisoformat(str(end).replace("Z", "+00:00")) if isinstance(end, str) else end
                return (end_dt - start_dt).total_seconds() / 3600
            except Exception:
                pass
        return float(metadata.get("hours_on_duty", 8))
