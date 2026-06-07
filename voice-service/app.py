import hashlib
import io
import os
import re
import time
import wave
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    import edge_tts
except ImportError:  # pragma: no cover
    edge_tts = None

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover
    WhisperModel = None


class ProcessAudioResponse(BaseModel):
    text: str
    message: str
    audio_url: Optional[str] = None
    audioUrl: Optional[str] = None
    language: str = "id"
    confidence: float = 0.0
    latency_ms: float


class VoiceProcessor:
    def __init__(self) -> None:
        self.language = os.getenv("VOICE_LANGUAGE", "id")
        self.whisper_model = os.getenv("VOICE_STT_MODEL", "base")
        self.whisper_device = os.getenv("VOICE_STT_DEVICE", "cpu")
        self.whisper_compute_type = os.getenv("VOICE_STT_COMPUTE_TYPE", "int8")
        self.tts_voice = os.getenv("VOICE_TTS_VOICE", "id-ID-GadisNeural")
        self.tts_rate = os.getenv("VOICE_TTS_RATE", "-5%")
        self.audio_cache_dir = Path(os.getenv("VOICE_AUDIO_CACHE_DIR", "./audio_cache"))
        self.audio_cache_dir.mkdir(parents=True, exist_ok=True)
        self.stt = None

    def load(self) -> None:
        if WhisperModel is None:
            raise RuntimeError("faster-whisper is not installed")
        self.stt = WhisperModel(
            self.whisper_model,
            device=self.whisper_device,
            compute_type=self.whisper_compute_type,
        )

    def transcribe(self, audio_bytes: bytes) -> tuple[str, str, float]:
        if self.stt is None:
            raise RuntimeError("STT model is not loaded")
        audio = self._audio_bytes_to_float32(audio_bytes)
        segments, info = self.stt.transcribe(
            audio,
            language=self.language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 400},
        )
        parts: list[str] = []
        confidence_total = 0.0
        segment_count = 0
        for segment in segments:
            text = segment.text.strip()
            if text:
                parts.append(text)
            confidence_total += float(np.exp(segment.avg_logprob))
            segment_count += 1
        return " ".join(parts).strip(), getattr(info, "language", self.language), round(confidence_total / max(segment_count, 1), 3)

    def response_for(self, transcript: str) -> str:
        text = self._normalize(transcript)
        if not text:
            return "Maaf, saya belum mendengar dengan jelas. Bisa ulangi pelan-pelan?"
        if any(word in text for word in ["jatuh", "fall", "fell", "terjatuh"]):
            return "Saya akan segera menghubungi caregiver. Tetap tenang dan jangan bergerak terlalu banyak dulu."
        if any(word in text for word in ["tolong", "help", "darurat", "emergency", "sakit", "sesak"]):
            return "Baik, saya akan memberi tahu caregiver sekarang. Tetap tenang, bantuan sedang dipanggil."
        if any(word in text for word in ["minum", "haus", "air", "drink"]):
            return "Baik, saya akan menyampaikan bahwa Anda membutuhkan minum."
        if any(word in text for word in ["obat", "medicine", "medication", "pill"]):
            return "Baik, saya akan menyampaikan permintaan bantuan obat ke caregiver."
        if any(word in text for word in ["kesepian", "takut", "sedih", "lonely", "scared", "sad"]):
            return "Saya di sini menemani. Tarik napas pelan-pelan, Anda tidak sendirian."
        return "Saya mendengar Anda. Saya akan membantu menyampaikan kebutuhan Anda ke caregiver bila diperlukan."

    async def generate_audio(self, text: str) -> Optional[str]:
        if edge_tts is None:
            return None
        clean_text = self._clean_for_tts(text)
        if not clean_text:
            return None
        filename = f"tts_{hashlib.md5(clean_text.encode()).hexdigest()[:12]}.mp3"
        path = self.audio_cache_dir / filename
        if not path.exists():
            communicate = edge_tts.Communicate(clean_text, self.tts_voice, rate=self.tts_rate)
            await communicate.save(str(path))
        return f"/api/audio/{filename}"

    def _audio_bytes_to_float32(self, audio_bytes: bytes) -> np.ndarray:
        if len(audio_bytes) > 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
            with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
                sample_width = wav_file.getsampwidth()
                frames = wav_file.readframes(wav_file.getnframes())
            if sample_width == 2:
                audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            elif sample_width == 1:
                audio = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
            else:
                raise ValueError("Unsupported WAV sample width")
        else:
            audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        if audio.size == 0:
            raise ValueError("Audio stream is empty")
        return audio

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.lower()).strip()

    def _clean_for_tts(self, text: str) -> str:
        return re.sub(r"[^\w\s.,!?;:'\-()\u00C0-\u024F]", "", text).strip()


processor = VoiceProcessor()
app = FastAPI(title="Eldora Voice Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    processor.load()


@app.get("/health")
def health() -> dict:
    return {
        "status": "healthy" if processor.stt is not None else "initializing",
        "stt_model": processor.whisper_model,
        "language": processor.language,
    }


@app.post("/api/process-audio", response_model=ProcessAudioResponse)
async def process_audio(request: Request) -> ProcessAudioResponse:
    start = time.time()
    audio_bytes = await request.body()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio stream is too short")
    try:
        transcript, language, confidence = processor.transcribe(audio_bytes)
        message = processor.response_for(transcript)
        audio_url = await processor.generate_audio(message)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    return ProcessAudioResponse(
        text=transcript,
        message=message,
        audio_url=audio_url,
        audioUrl=audio_url,
        language=language,
        confidence=confidence,
        latency_ms=round((time.time() - start) * 1000, 2),
    )


@app.get("/api/audio/{filename}")
def get_audio(filename: str) -> FileResponse:
    path = processor.audio_cache_dir / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(str(path), media_type="audio/mpeg", filename=filename)
