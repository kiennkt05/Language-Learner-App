import pytest
import uuid
from unittest.mock import patch
from app.services.ai import generate_exercise_for_word, BALANCED_SET, EXERCISE_TYPES
from app.db.models import VocabList, Word, Exercise

def test_mock_exercise_generators_original_types():
    """Test that the 4 original exercise types still generate correctly."""
    # Test MCQ Mock Generation
    mcq = generate_exercise_for_word("perro", "dog", "mcq")
    assert "question" in mcq
    assert "options" in mcq
    assert len(mcq["options"]) == 4
    assert mcq["correct_option"] in [0, 1, 2, 3]

    # Test Match Mock Generation
    match = generate_exercise_for_word("gato", "cat", "match")
    assert "pairs" in match
    assert len(match["pairs"]) == 4
    assert any(p["spelling"] == "gato" and p["translation"] == "cat" for p in match["pairs"])

    # Test Fill Blank Mock Generation
    fb = generate_exercise_for_word("libro", "book", "fill_blank")
    assert "___" in fb["sentence_with_blank"]
    assert fb["blank_value"] == "libro"

    # Test Sentence Writing Mock Generation
    sw = generate_exercise_for_word("amigo", "friend", "sentence_writing")
    assert "amigo" in sw["instruction"]
    assert sw["required_word"] == "amigo"


def test_mock_exercise_generators_new_types():
    """Test the 5 new exercise types generate valid mock data."""
    # Word Grouping
    wg = generate_exercise_for_word("perro", "dog", "word_grouping")
    assert "instruction" in wg
    assert "categories" in wg
    assert len(wg["categories"]) >= 2
    for cat in wg["categories"]:
        assert "name" in cat
        assert "words" in cat
        assert len(cat["words"]) >= 2

    # Odd One Out
    ooo = generate_exercise_for_word("perro", "dog", "odd_one_out")
    assert "instruction" in ooo
    assert "words" in ooo
    assert len(ooo["words"]) >= 4
    assert "odd_word" in ooo
    assert "explanation" in ooo
    assert ooo["odd_word"] in ooo["words"]

    # Synonym / Antonym
    sa = generate_exercise_for_word("perro", "dog", "synonym_antonym")
    assert "instruction" in sa
    assert "target_word" in sa
    assert "relationship" in sa
    assert sa["relationship"] in ["synonym", "antonym"]
    assert "correct_answer" in sa
    assert "options" in sa
    assert len(sa["options"]) == 4

    # Dialogue
    dlg = generate_exercise_for_word("perro", "dog", "dialogue")
    assert "instruction" in dlg
    assert "dialogue_lines" in dlg
    assert len(dlg["dialogue_lines"]) >= 3
    assert "missing_line_index" in dlg
    assert "correct_response" in dlg
    for line in dlg["dialogue_lines"]:
        assert "speaker" in line
        assert "text" in line

    # Flashcard
    fc = generate_exercise_for_word("perro", "dog", "flashcard")
    assert "front" in fc
    assert "back" in fc
    assert "hint" in fc


def test_exercise_types_constants():
    """Validate the EXERCISE_TYPES and BALANCED_SET constants."""
    assert len(EXERCISE_TYPES) == 9
    assert len(BALANCED_SET) == 5
    for ex_type in BALANCED_SET:
        assert ex_type in EXERCISE_TYPES


def test_unknown_exercise_type_raises():
    """Generating an unknown type should raise ValueError."""
    with pytest.raises(ValueError, match="Unknown exercise type"):
        generate_exercise_for_word("perro", "dog", "nonexistent_type")


def test_generate_and_fetch_exercises_endpoint(client, db_session, test_user, auth_headers):
    # Setup list and test word
    vocab_list = VocabList(user_id=test_user.id, name="AI Test List", description="")
    db_session.add(vocab_list)
    db_session.commit()

    word = Word(spelling="perro", translation="dog", definition="A loyal pet", example_sentence="El perro corre.")
    db_session.add(word)
    db_session.commit()

    vocab_list.words.append(word)
    db_session.commit()

    # Generate exercises — now produces 5 balanced exercises
    response = client.post(f"/vocab/words/{word.id}/exercises", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5  # Balanced set: match, fill_blank, mcq, sentence_writing, odd_one_out
    types = {ex["type"] for ex in data}
    assert "mcq" in types
    assert "fill_blank" in types
    assert "match" in types
    assert "sentence_writing" in types
    assert "odd_one_out" in types

    # Retrieve existing exercises
    fetch_res = client.get(f"/vocab/words/{word.id}/exercises", headers=auth_headers)
    assert fetch_res.status_code == 200
    fetch_data = fetch_res.json()
    assert len(fetch_data) == 5


def test_explain_word_sse_stream_endpoint(client, db_session, test_user, auth_headers):
    # Setup list and test word
    vocab_list = VocabList(user_id=test_user.id, name="AI Test List", description="")
    db_session.add(vocab_list)
    db_session.commit()

    word = Word(spelling="hola", translation="hello", definition="", example_sentence="")
    db_session.add(word)
    db_session.commit()

    vocab_list.words.append(word)
    db_session.commit()

    # Run GET request for SSE stream
    response = client.get(f"/ai/words/{word.id}/explain", headers=auth_headers)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "hola" in response.text.lower()
    assert "[done]" in response.text.lower()


def test_mock_enrich_words():
    """Test the mock enrichment fallback."""
    from app.services.ai import enrich_words_from_spellings

    results = enrich_words_from_spellings(
        ["generous", "borrow", "exhausted"],
        target_language="English",
        source_language="English",
    )
    assert len(results) == 3
    for word in results:
        assert "spelling" in word
        assert "translation" in word
        assert "definition" in word
        assert "example_sentence" in word
        assert "pronunciation" in word
        assert "part_of_speech" in word
        assert "collocation" in word
        assert "visual_clue" in word
        assert "exercise_level" in word
        assert word["part_of_speech"] in ["noun", "verb", "adjective", "adverb"]

    spellings = [w["spelling"] for w in results]
    assert "generous" in spellings
    assert "borrow" in spellings
    assert "exhausted" in spellings


def test_generate_from_spellings_endpoint(client, db_session, test_user, auth_headers):
    """Test the POST /vocab/lists/{list_id}/generate SSE endpoint."""
    vocab_list = VocabList(user_id=test_user.id, name="AI Generate Test", description="", target_language="Spanish")
    db_session.add(vocab_list)
    db_session.commit()

    response = client.post(
        f"/vocab/lists/{vocab_list.id}/generate",
        json={"spellings": ["perro", "gato"], "source_language": "English"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    # Parse SSE events
    events = []
    for line in response.text.strip().split("\n"):
        if line.startswith("data: "):
            import json
            try:
                events.append(json.loads(line[6:]))
            except Exception:
                pass

    # Should have progress, word_done, and complete events
    types = {e["type"] for e in events}
    assert "word_done" in types
    assert "complete" in types

    # Verify words were created in DB
    db_session.expire_all()
    words = db_session.query(Word).all()
    assert len(words) >= 2
    spellings_in_db = {w.spelling for w in words}
    assert "perro" in spellings_in_db
    assert "gato" in spellings_in_db

    # Verify exercises were generated
    exercises = db_session.query(Exercise).all()
    assert len(exercises) >= 10  # 2 words × 5 exercises each
