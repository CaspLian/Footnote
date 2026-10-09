"""Voice for ClaimPulse AI: text_to_speech, speech_to_text, and voice_routes (the /api/v1/voice endpoints).

This file makes audio_service a regular Python package. Without it, the old empty placeholder
backend/services/audio_service.py (still in the repo's history) would be imported instead of this
folder, and every `services.audio_service...` import would fail.
"""
