"""Check your ElevenLabs setup without spending any credits.

    python -m text_to_speech.check_setup

1. Is ELEVENLABS_API_KEY set and accepted?        GET /v1/user    (key permission "User: Read")
2. Plan, credits used, account creation date     (these decide which voices you can use)
3. Which voices can this key see?                GET /v2/voices  (key permission "Voices: Read")
4. Can each voice users choose (voices.json) be used on this account?

No text-to-speech request is made, so this costs nothing.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone

import requests

from .config import TTSConfig
from .voices import VoiceCatalog, load_catalog

# ElevenLabs: Default voices "are only available for accounts that were created before
# March 2026" and "will expire on December 31, 2026" (help centre, checked 2026-10-09).
DEFAULT_VOICES_CUTOFF = datetime(2026, 3, 1, tzinfo=timezone.utc)
MAX_VOICE_PAGES = 5
TIMEOUT = (5, 15)


def run(config: TTSConfig, session: requests.Session, out=print, catalog: VoiceCatalog | None = None) -> int:
    """Returns 0 when the setup looks usable, 1 when something must be fixed."""
    if not config.api_key:
        out("ELEVENLABS_API_KEY is missing. Add it to backend/.env (see audio_service/.env.example).")
        return 1

    headers = {"xi-api-key": config.api_key}
    problems = 0
    tier = None

    out("1. Account (GET /v1/user)")
    status, user = _get(session, f"{config.base_url}/v1/user", headers)
    if status == 200:
        problems += _report_account(user, out)
        tier = str((user.get("subscription") or {}).get("tier") or "").lower() or None
    elif _is_missing_permission(user):
        out("   The key works but cannot read account details. Optional: give the key 'User: Read'.")
    elif status in (401, 403):
        out(f"   The key was rejected: {_message(user)}")
        out("   Check the key in backend/.env, or create a new one at https://elevenlabs.io/app/developers")
        return 1
    else:
        out(f"   Could not check the account (HTTP {status}): {_message(user)}")

    out("\n2. Voices this key can see (GET /v2/voices)")
    voices, error = _list_voices(session, config.base_url, headers)
    if error:
        out(f"   {error}")
        return 1
    for voice in voices:
        labels = voice.get("labels") or {}
        details = ", ".join(v for v in (labels.get("gender"), labels.get("accent"), labels.get("use_case")) if v)
        marker = "   <- ELEVENLABS_VOICE_ID" if voice.get("voice_id") == config.voice_id else ""
        out(f"   {voice.get('voice_id')}  {voice.get('name')}  [{voice.get('category')}] {details}{marker}")
    if not voices:
        out("   No voices found. Free accounts created after March 2026 have no Default voices;")
        out("   create one with Voice Design in the dashboard, or use a paid plan for Voice Library voices.")
        problems += 1

    out("\n3. Voices users can choose (text_to_speech/voices.json)")
    try:
        catalog = catalog if catalog is not None else load_catalog()
    except ValueError as exc:
        out(f"   {exc}")
        return 1
    problems += _report_catalog(catalog, {v.get("voice_id") for v in voices}, tier, out)
    if config.voice_id:
        where = "in your account" if any(v.get("voice_id") == config.voice_id for v in voices) else "not in your account"
        out(f"   ELEVENLABS_VOICE_ID={config.voice_id} replaces the default voice ({catalog.default_key}); {where}.")

    number_reading = config.audio_settings().get("apply_text_normalization", "auto")
    out(f"\nModel {config.model_id}, format {config.output_format}, number reading {number_reading}.")
    if problems:
        out("Fix the items above, then run: python -m text_to_speech.demo")
        return 1
    out("Looks good. Next: python -m text_to_speech.demo")
    return 0


def _report_account(user: dict, out) -> int:
    subscription = user.get("subscription") or {}
    tier = subscription.get("tier", "unknown")
    used = subscription.get("character_count")
    limit = subscription.get("character_limit")
    out(f"   Plan: {tier} (status: {subscription.get('status', 'unknown')})")
    if isinstance(used, int) and isinstance(limit, int):
        out(f"   Credits used this period: {used:,} of {limit:,} ({max(limit - used, 0):,} left)")
    reset = subscription.get("next_character_count_reset_unix")
    if isinstance(reset, (int, float)) and reset > 0:
        out(f"   Credits reset on: {_date(reset)}")

    created_at = user.get("created_at")
    if not isinstance(created_at, (int, float)) or created_at < 0:
        created_at = 0  # ElevenLabs: "0 if the user was created before the unix timestamp was added"
    created_before_cutoff = created_at == 0 or created_at < DEFAULT_VOICES_CUTOFF.timestamp()
    out(f"   Account created: {_date(created_at) if created_at else 'before creation dates were recorded'}")

    if str(tier).lower() == "free":
        out("   Free plan notes:")
        out("   - Voice Library voices do not work through the API on the free plan (error: paid_plan_required).")
        if created_before_cutoff:
            out("   - Your account predates March 2026, so Default voices should work until December 31, 2026.")
        else:
            out("   - Your account was created after March 2026, so Default voices are not available to it.")
        out("   - No commercial licence; credit 'elevenlabs.io' if you publish the audio.")
        out("   - Free accounts can be blocked on shared Wi-Fi ('unusual activity'). Test from the venue early.")
    return 0


def _report_catalog(catalog: VoiceCatalog, account_voice_ids: set, tier: str | None, out) -> int:
    """One line per voice. Voices not in the account come from the Voice Library: paid plans only."""
    problems = 0
    for voice in catalog.voices:
        if voice.voice_id in account_voice_ids:
            where = "in your account"
        elif tier == "free":
            where = "Voice Library voice: will fail on the free plan (paid_plan_required)"
            problems += 1
        else:
            where = "Voice Library voice (works on paid plans)"
        default = " (default)" if voice.key == catalog.default_key else ""
        out(f"   {voice.key:<10} {voice.name}: {voice.description}, {voice.accent}{default}: {where}")
    return problems


def _list_voices(session, base_url: str, headers: dict) -> tuple[list[dict], str | None]:
    voices: list[dict] = []
    params: dict = {"page_size": 100}
    for _ in range(MAX_VOICE_PAGES):
        status, page = _get(session, f"{base_url}/v2/voices", headers, params)
        if status != 200:
            if _is_missing_permission(page):
                return [], "The key cannot list voices. Give it the 'Voices: Read' permission, then try again."
            return [], f"Could not list voices (HTTP {status}): {_message(page)}"
        voices.extend(page.get("voices") or [])
        token = page.get("next_page_token")
        if not page.get("has_more") or not token:
            break
        params = {"page_size": 100, "next_page_token": token}
    return voices, None


def _get(session, url: str, headers: dict, params: dict | None = None) -> tuple[int, dict]:
    try:
        response = session.get(url, headers=headers, params=params, timeout=TIMEOUT)
    except requests.RequestException as exc:
        return 0, {"detail": {"message": f"could not reach ElevenLabs ({type(exc).__name__})"}}
    try:
        body = response.json()
    except ValueError:
        body = {"detail": {"message": (response.text or "")[:200]}}
    return response.status_code, body if isinstance(body, dict) else {}


def _detail(body: dict) -> dict:
    detail = body.get("detail") if isinstance(body, dict) else None
    return detail if isinstance(detail, dict) else {}


def _is_missing_permission(body: dict) -> bool:
    detail = _detail(body)
    codes = {str(detail.get("code", "")).lower(), str(detail.get("status", "")).lower()}
    return bool(codes & {"missing_permissions", "insufficient_permissions"}) or "permission" in _message(body).lower()


def _message(body: dict) -> str:
    return str(_detail(body).get("message") or "no details")


def _date(unix_seconds: int | float) -> str:
    return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).strftime("%Y-%m-%d")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    try:
        config = TTSConfig.from_env()
    except ValueError as exc:
        print(f"Setting error in .env: {exc}")
        return 1
    return run(config, requests.Session())


if __name__ == "__main__":
    sys.exit(main())
