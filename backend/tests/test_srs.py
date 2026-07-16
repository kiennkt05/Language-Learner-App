import uuid
from datetime import datetime, timedelta
import pytest
from app.services.srs import update_card_sm2
from app.db.models import VocabList, Word, SRSCard, Exercise, ReviewLog

def test_sm2_algorithm_logic():
    # Test quality < 3 resets reps and interval
    reps, interval, ef = update_card_sm2(repetitions=3, interval=6, ease_factor=2.5, quality=1)
    assert reps == 0
    assert interval == 1
    assert ef < 2.5  # ease factor decreases

    # Test quality >= 3 correct responses
    # repetitions == 0 -> interval = 1
    reps, interval, ef = update_card_sm2(repetitions=0, interval=1, ease_factor=2.5, quality=4)
    assert reps == 1
    assert interval == 1
    assert ef == 2.5  # no change or very minor

    # repetitions == 1 -> interval = 6
    reps, interval, ef = update_card_sm2(repetitions=1, interval=1, ease_factor=2.5, quality=5)
    assert reps == 2
    assert interval == 6
    assert ef > 2.5

    # repetitions > 1 -> interval = round(interval * ease_factor)
    reps, interval, ef = update_card_sm2(repetitions=2, interval=6, ease_factor=2.5, quality=4)
    assert reps == 3
    assert interval == 15
    assert ef == 2.5

def test_srs_session_queue(client, db_session, test_user, auth_headers):
    # Create vocab list and words
    vocab_list = VocabList(user_id=test_user.id, name="SRS Test List", description="")
    db_session.add(vocab_list)
    db_session.commit()

    # Create 60 cards: 40 due cards (repetitions=1, next_review=past) and 20 new cards (repetitions=0)
    for i in range(40):
        w = Word(spelling=f"due{i}", translation="translation")
        db_session.add(w)
        db_session.commit()
        # Add to vocab list
        vocab_list.words.append(w)
        
        card = SRSCard(
            user_id=test_user.id,
            word_id=w.id,
            repetitions=1,
            interval=1,
            ease_factor=2.5,
            next_review=datetime.utcnow() - timedelta(hours=2)
        )
        db_session.add(card)
        db_session.commit()

    for i in range(20):
        w = Word(spelling=f"new{i}", translation="translation")
        db_session.add(w)
        db_session.commit()
        # Add to vocab list
        vocab_list.words.append(w)
        
        card = SRSCard(
            user_id=test_user.id,
            word_id=w.id,
            repetitions=0,
            interval=1,
            ease_factor=2.5,
            next_review=datetime.utcnow()
        )
        db_session.add(card)
        db_session.commit()

    # Get session for this list
    response = client.get(f"/vocab/srs/session?list_id={vocab_list.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Total cards capped at 50.
    # Due cards: 40 (which fits under 50).
    # New cards cap: min(15, 50 - 40) = 10 new cards.
    # So we should have exactly 50 cards in total: 40 due, 10 new.
    assert len(data) == 50
    due_in_session = [c for c in data if c["repetitions"] > 0]
    new_in_session = [c for c in data if c["repetitions"] == 0]
    assert len(due_in_session) == 40
    assert len(new_in_session) == 10

def test_srs_session_filtering_and_exercise_generation(client, db_session, test_user, auth_headers):
    # List A
    list_a = VocabList(user_id=test_user.id, name="List A")
    db_session.add(list_a)
    db_session.commit()

    word_a = Word(spelling="worda", translation="translation")
    db_session.add(word_a)
    db_session.commit()
    list_a.words.append(word_a)

    card_a = SRSCard(user_id=test_user.id, word_id=word_a.id, repetitions=0)
    db_session.add(card_a)
    db_session.commit()

    # Get session filtered by list_a
    response = client.get(f"/vocab/srs/session?list_id={list_a.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["spelling"] == "worda"
    
    # Verify exercises are generated and response includes exercises
    assert len(data[0]["exercises"]) == 5  # Balanced set: match, fill_blank, mcq, sentence_writing, odd_one_out
    types = {ex["type"] for ex in data[0]["exercises"]}
    assert "mcq" in types
    assert "fill_blank" in types
    assert "match" in types
    assert "sentence_writing" in types
    assert "odd_one_out" in types

def test_submit_card_review(client, db_session, test_user, auth_headers):
    word = Word(spelling="submitword", translation="translation")
    db_session.add(word)
    db_session.commit()

    card = SRSCard(user_id=test_user.id, word_id=word.id, repetitions=0, interval=1, ease_factor=2.5)
    db_session.add(card)
    db_session.commit()

    exercise = Exercise(word_id=word.id, type="mcq", data={"question": "What is submitword?"})
    db_session.add(exercise)
    db_session.commit()

    # Submit review
    response = client.post(
        "/vocab/srs/submit",
        json={
            "card_id": str(card.id),
            "exercise_id": str(exercise.id),
            "quality": 5,
            "response": "translation"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["repetitions"] == 1
    assert data["interval"] == 1  # 0 reps -> 1 rep transition gives interval 1
    assert data["ease_factor"] > 2.5

    # Check ReviewLog is written
    log = db_session.query(ReviewLog).filter(ReviewLog.user_id == test_user.id).first()
    assert log is not None
    assert log.quality == 5
    assert log.is_correct is True

def test_reset_review_dates(client, db_session, test_user, auth_headers):
    word = Word(spelling="resetword", translation="translation")
    db_session.add(word)
    db_session.commit()

    future_time = datetime.utcnow() + timedelta(days=10)
    card = SRSCard(
        user_id=test_user.id,
        word_id=word.id,
        repetitions=1,
        interval=10,
        ease_factor=2.5,
        next_review=future_time
    )
    db_session.add(card)
    db_session.commit()

    # Reset dates
    response = client.post(f"/vocab/srs/reset-dates", headers=auth_headers)
    assert response.status_code == 200
    
    db_session.expire_all()
    updated_card = db_session.query(SRSCard).filter(SRSCard.id == card.id).first()
    # next_review should be reset to now or in the past
    assert updated_card.next_review < datetime.utcnow()
