import pytest
import uuid
from unittest.mock import patch
from app.services.ai import generate_exercise_for_word
from app.db.models import VocabList, Word, Exercise

def test_mock_exercise_generators():
    # Test MCQ Mock Generation
    mcq = generate_exercise_for_word("perro", "dog", "mcq")
    assert "question" in mcq
    assert "options" in mcq
    assert len(mcq["options"]) == 4
    assert mcq["correct_option"] in [0, 1, 2, 3]

    # Test Match Mock Generation
    match = generate_exercise_for_word("gato", "cat", "match")
    assert match["spelling"] == "gato"
    assert len(match["options"]) == 4

    # Test Fill Blank Mock Generation
    fb = generate_exercise_for_word("libro", "book", "fill_blank")
    assert "___" in fb["sentence_with_blank"]
    assert fb["blank_value"] == "libro"

    # Test Sentence Writing Mock Generation
    sw = generate_exercise_for_word("amigo", "friend", "sentence_writing")
    assert "amigo" in sw["instruction"]
    assert sw["required_word"] == "amigo"


def test_generate_and_fetch_exercises_endpoint(client, db_session, test_user, auth_headers):
    # Setup test word
    word = Word(spelling="perro", translation="dog", definition="A loyal pet", example_sentence="El perro corre.")
    db_session.add(word)
    db_session.commit()

    # Generate exercises
    response = client.post(f"/vocab/words/{word.id}/exercises", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2  # Generates 1 MCQ and 1 Fill Blank
    types = {ex["type"] for ex in data}
    assert "mcq" in types
    assert "fill_blank" in types

    # Retrieve existing exercises
    fetch_res = client.get(f"/vocab/words/{word.id}/exercises", headers=auth_headers)
    assert fetch_res.status_code == 200
    fetch_data = fetch_res.json()
    assert len(fetch_data) == 2


def test_explain_word_sse_stream_endpoint(client, db_session, test_user, auth_headers):
    # Setup test word
    word = Word(spelling="hola", translation="hello", definition="", example_sentence="")
    db_session.add(word)
    db_session.commit()

    # Run GET request for SSE stream
    # Note: TestClient handles StreamingResponse as a standard response, making the whole stream content available in response.text
    response = client.get(f"/ai/words/{word.id}/explain", headers=auth_headers)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "hola" in response.text.lower()
    assert "[done]" in response.text.lower()
