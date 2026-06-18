import io
import uuid
import pytest
from app.db.models import VocabList, Word, SRSCard

def test_create_vocab_list(client, auth_headers):
    response = client.post(
        "/vocab/lists",
        json={"name": "Spanish Basics", "description": "Useful entry-level Spanish words"},
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Spanish Basics"
    assert "id" in data

def test_get_vocab_lists(client, db_session, test_user, auth_headers):
    # Add dummy list
    vocab_list = VocabList(user_id=test_user.id, name="German Verbs", description="High frequency verbs")
    db_session.add(vocab_list)
    db_session.commit()

    response = client.get("/vocab/lists", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "German Verbs"

def test_add_word_and_srs_auto_seeding(client, db_session, test_user, auth_headers):
    vocab_list = VocabList(user_id=test_user.id, name="French", description="")
    db_session.add(vocab_list)
    db_session.commit()

    response = client.post(
        f"/vocab/lists/{vocab_list.id}/words",
        json={
            "spelling": "bonjour",
            "translation": "hello",
            "definition": "A friendly greeting",
            "example_sentence": "Bonjour! Comment ça va?"
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    word_data = response.json()
    assert word_data["spelling"] == "bonjour"

    # Verify SRS Card is seeded
    srs_cards = db_session.query(SRSCard).filter(
        SRSCard.user_id == test_user.id,
        SRSCard.word_id == uuid.UUID(word_data["id"])
    ).all()

    assert len(srs_cards) == 1
    assert srs_cards[0].repetitions == 0
    assert srs_cards[0].interval == 1
    assert srs_cards[0].ease_factor == 2.5

def test_csv_upload_limit_enforced(client, db_session, test_user, auth_headers):
    vocab_list = VocabList(user_id=test_user.id, name="Test CSV", description="")
    db_session.add(vocab_list)
    db_session.commit()

    # Generate more than 100 words (e.g. 101 words)
    csv_content = "spelling,translation,definition,example_sentence\n"
    for i in range(101):
        csv_content += f"word{i},meaning{i},def{i},example{i}\n"

    file_payload = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    
    response = client.post(
        f"/vocab/lists/{vocab_list.id}/upload",
        files=file_payload,
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "Strict limit is 100 words" in response.json()["detail"]

def test_csv_upload_success(client, db_session, test_user, auth_headers):
    vocab_list = VocabList(user_id=test_user.id, name="Test CSV Success", description="")
    db_session.add(vocab_list)
    db_session.commit()

    csv_content = """spelling,translation,definition,example_sentence
gato,cat,A small domesticated carnivorous mammal,El gato está durmiendo.
perro,dog,A domesticated carnivorous mammal,El perro ladra.
"""
    file_payload = {"file": ("words.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    
    response = client.post(
        f"/vocab/lists/{vocab_list.id}/upload",
        files=file_payload,
        headers=auth_headers
    )
    assert response.status_code == 201
    assert "Successfully parsed CSV and imported 2 words" in response.json()["message"]

    # Verify database populated
    db_session.expire_all()
    words = db_session.query(Word).all()
    assert len(words) == 2
    assert {w.spelling for w in words} == {"gato", "perro"}

    # Verify SRS Cards auto-seeded
    srs_cards = db_session.query(SRSCard).filter(SRSCard.user_id == test_user.id).all()
    assert len(srs_cards) == 2
