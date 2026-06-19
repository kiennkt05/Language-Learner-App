import pytest
from datetime import datetime, timedelta
from app.db.models import VocabList, Word, SRSCard, ReviewLog

def test_get_user_stats(client, db_session, test_user, auth_headers):
    # Setup Vocab List
    vocab_list = VocabList(user_id=test_user.id, name="Test Stats List")
    db_session.add(vocab_list)
    db_session.commit()

    # Create 3 words
    w1 = Word(spelling="uno", translation="one")
    w2 = Word(spelling="dos", translation="two")
    w3 = Word(spelling="tres", translation="three")
    db_session.add_all([w1, w2, w3])
    db_session.commit()

    # Create SRSCards with different mastery segments
    # w1 -> reps = 0 (unstarted)
    card1 = SRSCard(user_id=test_user.id, word_id=w1.id, repetitions=0)
    # w2 -> reps = 1 (learning)
    card2 = SRSCard(user_id=test_user.id, word_id=w2.id, repetitions=1, next_review=datetime.utcnow() - timedelta(hours=1))
    # w3 -> reps = 4 (mastered)
    card3 = SRSCard(user_id=test_user.id, word_id=w3.id, repetitions=4, next_review=datetime.utcnow() + timedelta(days=5))
    
    db_session.add_all([card1, card2, card3])
    db_session.commit()

    # Create ReviewLogs to test streak and accuracy
    # Day 0: Correct review yesterday
    log1 = ReviewLog(
        user_id=test_user.id,
        word_id=w2.id,
        quality=5,
        is_correct=True,
        reviewed_at=datetime.utcnow() - timedelta(days=1)
    )
    # Day 1: Incorrect review today (for accuracy)
    log2 = ReviewLog(
        user_id=test_user.id,
        word_id=w3.id,
        quality=1,
        is_correct=False,
        reviewed_at=datetime.utcnow()
    )
    db_session.add_all([log1, log2])
    db_session.commit()

    # Call stats API
    response = client.get("/vocab/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    # Validate streak
    # Since we reviewed yesterday and today, streak should be 2
    assert data["streak"] == 2

    # Validate accuracy
    # 1 correct, 1 incorrect -> 50%
    assert data["accuracy"] == 50

    # Validate mastery counts
    assert data["mastery_counts"]["unstarted"] == 1
    assert data["mastery_counts"]["learning"] == 1
    assert data["mastery_counts"]["mastered"] == 1
    assert data["mastery_counts"]["total"] == 3

    # Validate forecast
    # card2 is due now (reps > 0 and next_review < now) -> 1
    # card3 is due in 5 days (reps > 0 and next_review in 5 days) -> due today=1, due this week=2, due this month=2
    assert data["forecast"]["due_now"] == 1
    assert data["forecast"]["due_today"] == 1
    assert data["forecast"]["due_this_week"] == 2
    assert data["forecast"]["due_this_month"] == 2
