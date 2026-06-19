import base64
import os
import requests
from typing import Optional
from app.config import settings

# A simple valid base64 encoded string representing mock audio bytes
MOCK_MP3_BASE64 = "bW9ja19tcDNfZGF0YQ=="

def detect_language_code(list_name: str) -> str:
    """
    Detects language code based on vocabulary list title names.
    Defaults to Spanish (es-ES) if not matched.
    """
    name_lower = list_name.lower()
    if "german" in name_lower or "deutsch" in name_lower:
        return "de-DE"
    elif "french" in name_lower or "français" in name_lower:
        return "fr-FR"
    elif "english" in name_lower:
        return "en-US"
    elif "vietnamese" in name_lower or "tiếng việt" in name_lower:
        return "vi-VN"
    elif "japanese" in name_lower or "nihongo" in name_lower:
        return "ja-JP"
    elif "korean" in name_lower or "hangul" in name_lower:
        return "ko-KR"
    elif "chinese" in name_lower or "mandarin" in name_lower:
        return "zh-CN"
    elif "italian" in name_lower or "italiano" in name_lower:
        return "it-IT"
    return "es-ES"

def upload_to_r2(file_bytes: bytes, filename: str) -> Optional[str]:
    """
    Uploads audio file bytes to Cloudflare R2 bucket.
    Dynamically imports boto3 to avoid hard runtime dependency if package is missing.
    Returns public URL if successful, None otherwise.
    """
    if settings.is_r2_mocked:
        return None
        
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        print("boto3 package not installed. Falling back to local static cache.")
        return None
        
    try:
        # R2 endpoints are of the form https://<accountid>.r2.cloudflarestorage.com
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT,
            aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY,
            aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_KEY,
            config=Config(signature_version="s3v4")
        )
        
        s3.put_object(
            Bucket=settings.CLOUDFLARE_R2_BUCKET,
            Key=f"audio/{filename}",
            Body=file_bytes,
            ContentType="audio/mpeg"
        )
        # Construct access URL
        # Standard S3 endpoint URL or custom domain if endpoint contains domain
        return f"{settings.CLOUDFLARE_R2_ENDPOINT}/{settings.CLOUDFLARE_R2_BUCKET}/audio/{filename}"
    except Exception as e:
        print(f"Failed to upload audio to Cloudflare R2: {e}")
        return None

def generate_tts_audio(text: str, language_code: str = "es-ES") -> bytes:
    """
    Calls Google Text-to-Speech API to convert text to MP3 bytes.
    Falls back to mock silence MP3 bytes if key is missing or call fails.
    """
    if settings.is_tts_mocked:
        return base64.b64decode(MOCK_MP3_BASE64)
        
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={settings.GOOGLE_TTS_API_KEY}"
    payload = {
        "input": {"text": text},
        "voice": {"languageCode": language_code, "ssmlGender": "NEUTRAL"},
        "audioConfig": {"audioEncoding": "MP3"}
    }
    
    try:
        res = requests.post(url, json=payload, timeout=8)
        res.raise_for_status()
        data = res.json()
        audio_content = data.get("audioContent", "")
        if audio_content:
            return base64.b64decode(audio_content)
        raise ValueError("Missing audioContent in TTS API response.")
    except Exception as e:
        print(f"Google TTS API call failed: {e}. Falling back to mock audio.")
        return base64.b64decode(MOCK_MP3_BASE64)

def get_word_audio_url(word_id: str, spelling: str, list_name: Optional[str] = None) -> str:
    """
    Generates TTS audio, caches it locally or on R2, and returns its public URL path.
    """
    # Detect language code
    lang_code = detect_language_code(list_name) if list_name else "es-ES"
    
    # Generate MP3 bytes
    audio_bytes = generate_tts_audio(spelling, lang_code)
    filename = f"{word_id}.mp3"
    
    # Attempt R2 upload
    r2_url = upload_to_r2(audio_bytes, filename)
    if r2_url:
        return r2_url
        
    # Local static files cache fallback
    local_dir = "static/audio"
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    
    with open(local_path, "wb") as f:
        f.write(audio_bytes)
        
    # Return local relative static URL
    return f"/static/audio/{filename}"
