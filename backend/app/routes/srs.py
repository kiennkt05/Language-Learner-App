from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timedelta
from typing import List, Optional

from app.db.session import get_db
from app.db.models import SRSCard, Word, Exercise, ReviewLog, VocabList
from app.db.schemas import SessionCardResponse, ReviewSubmit, SRSCardResponse
from app.auth.security import get_current_user, User
from app.services.srs import update_card_sm2
from app.services.ai import generate_exercise_for_word

router = APIRouter(prefix="/vocab/srs", tags=["srs"])

@router.get("/session", response_model=List[SessionCardResponse])
def get_srs_session(
    list_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches the review session queue.
    Capped at 50 cards total.
    New words (repetitions == 0) are capped at 15 max.
    Prioritizes due reviews first, then fills the remaining slots with new cards.
    Automatically pre-generates exercises for each word in the session if not present.
    """
    # 1. Query due cards (repetitions > 0 and next_review <= now)
    due_query = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.next_review <= datetime.utcnow()
    )
    
    # 2. Query new cards (repetitions == 0)
    new_query = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions == 0
    )
    
    # Optional filtering by vocabulary list
    if list_id:
        # Check if list exists
        vocab_list = db.query(VocabList).filter(VocabList.id == list_id, VocabList.user_id == current_user.id).first()
        if not vocab_list:
            raise HTTPException(status_code=404, detail="Vocab list not found")
            
        due_query = due_query.join(Word).join(Word.vocab_lists).filter(VocabList.id == list_id)
        new_query = new_query.join(Word).join(Word.vocab_lists).filter(VocabList.id == list_id)
        
    due_cards = due_query.order_by(SRSCard.next_review.asc()).all()
    new_cards = new_query.order_by(SRSCard.created_at.asc()).all()
    
    # Cap due cards at 50
    due_cards_selected = due_cards[:50]
    
    # Calculate slots left for new words (max 15 new words)
    slots_left = 50 - len(due_cards_selected)
    new_words_cap = min(15, slots_left)
    new_cards_selected = new_cards[:new_words_cap]
    
    session_cards = due_cards_selected + new_cards_selected
    
    # Truncate to 50 if somehow exceeded
    session_cards = session_cards[:50]
    
    response_list = []
    for card in session_cards:
        # Make sure word has exercises generated
        exercises = db.query(Exercise).filter(Exercise.word_id == card.word_id).all()
        if not exercises:
            # Generate MCQ (Reception)
            try:
                mcq_data = generate_exercise_for_word(card.word.spelling, card.word.translation, "mcq")
                mcq_ex = Exercise(word_id=card.word_id, type="mcq", data=mcq_data)
                db.add(mcq_ex)
            except Exception as e:
                print(f"Failed to auto generate MCQ in session: {e}")
                
            # Generate Fill Blank (Production)
            try:
                fb_data = generate_exercise_for_word(card.word.spelling, card.word.translation, "fill_blank")
                fb_ex = Exercise(word_id=card.word_id, type="fill_blank", data=fb_data)
                db.add(fb_ex)
            except Exception as e:
                print(f"Failed to auto generate Fill Blank in session: {e}")
                
            db.commit()
            # Fetch again after commit
            exercises = db.query(Exercise).filter(Exercise.word_id == card.word_id).all()
            
        response_list.append({
            "card_id": card.id,
            "word_id": card.word_id,
            "spelling": card.word.spelling,
            "translation": card.word.translation,
            "definition": card.word.definition,
            "example_sentence": card.word.example_sentence,
            "repetitions": card.repetitions,
            "interval": card.interval,
            "ease_factor": card.ease_factor,
            "exercises": exercises
        })
        
    return response_list

@router.post("/submit", response_model=SRSCardResponse)
def submit_card_review(
    payload: ReviewSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a review for a card, processes SM-2 metrics,
    records the review log, and updates card timings.
    """
    card = db.query(SRSCard).filter(
        SRSCard.id == payload.card_id,
        SRSCard.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="SRS card not found")
        
    # Apply SM-2 update
    new_reps, new_interval, new_ef = update_card_sm2(
        card.repetitions,
        card.interval,
        card.ease_factor,
        payload.quality
    )
    
    card.repetitions = new_reps
    card.interval = new_interval
    card.ease_factor = new_ef
    card.next_review = datetime.utcnow() + timedelta(days=new_interval)
    
    # Create Review Log entry
    is_correct = payload.quality >= 3
    log = ReviewLog(
        user_id=current_user.id,
        word_id=card.word_id,
        exercise_id=payload.exercise_id,
        quality=payload.quality,
        is_correct=is_correct,
        response=payload.response
    )
    
    db.add(log)
    db.commit()
    db.refresh(card)
    return card

@router.post("/reset-dates")
def reset_review_dates(
    list_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Developer tool: resets review dates to now to easily test sessions.
    If list_id is specified, resets only cards inside that list.
    """
    query = db.query(SRSCard).filter(SRSCard.user_id == current_user.id)
    if list_id:
        query = query.join(Word).join(Word.vocab_lists).filter(VocabList.id == list_id)
        
    cards = query.all()
    for card in cards:
        card.next_review = datetime.utcnow() - timedelta(minutes=1)
        
    db.commit()
    return {"message": f"Successfully reset review dates for {len(cards)} cards"}
