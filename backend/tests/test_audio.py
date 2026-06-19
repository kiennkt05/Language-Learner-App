import os
import pytest
from app.services.audio import detect_language_code, generate_tts_audio, get_word_audio_url
from app.db.models import Word

def test_detect_language_code():
    assert detect_language_code("German Basics") == "de-DE"
    assert detect_language_code("High Frequency French") == "fr-FR"
    assert detect_language_code("English A1") == "en-US"
    assert detect_language_code("Learn Tiếng Việt") == "vi-VN"
    assert detect_language_code("Japanese Kanji") == "ja-JP"
    assert detect_language_code("Spanish Verbs") == "es-ES"
    # Fallback default
    assert detect_language_code("Some Random List") == "es-ES"

def test_generate_tts_audio_fallback():
    # Since GOOGLE_TTS_API_KEY is empty in test mode, settings.is_tts_mocked should be True
    # generate_tts_audio should return mock MP3 bytes (non-empty)
    audio_bytes = generate_tts_audio("hello")
    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 0

def test_word_audio_generation_endpoint(client, db_session, test_user, auth_headers):
    # Setup test word
    word = Word(spelling="gato", translation="cat")
    db_session.add(word)
    db_session.commit()

    # Call generate audio URL endpoint
    response = client.post(f"/vocab/words/{word.id}/audio", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "audio_url" in data
    assert data["audio_url"] == f"/static/audio/{word.id}.mp3"

    # Verify column updated in DB
    db_session.expire_all()
    updated_word = db_session.query(Word).filter(Word.id == word.id).first()
    assert updated_word.audio_url == f"/static/audio/{word.id}.mp3"

    # Verify physical file was created in static folder
    expected_path = os.path.join("static", "audio", f"{word.id}.mp3")
    assert os.path.exists(expected_path)
    
    # Cleanup created test file
    try:
        os.remove(expected_path)
    except Exception:
        pass
