from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.session import get_db
from app.db.models import SRSCard, ReviewLog
from app.auth.security import get_current_user, User

router = APIRouter(prefix="/vocab/stats", tags=["stats"])

@router.get("")
def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns statistics metrics:
    - streak: consecutive days of reviews.
    - mastery_counts: unstarted (reps==0), learning (reps in [1,2]), mastered (reps>=3).
    - accuracy: percentage of correct reviews.
    - forecast: review workload for now, 24h, 7d, and 30d.
    """
    # 1. Calculate Streak
    logs = db.query(ReviewLog.reviewed_at).filter(
        ReviewLog.user_id == current_user.id
    ).order_by(ReviewLog.reviewed_at.desc()).all()
    
    unique_dates = sorted(list({log[0].date() for log in logs}), reverse=True)
    
    streak = 0
    if unique_dates:
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        if unique_dates[0] < yesterday:
            # Last review was older than yesterday
            streak = 0
        else:
            streak = 1
            current_date = unique_dates[0]
            for next_d in unique_dates[1:]:
                if current_date - next_d == timedelta(days=1):
                    streak += 1
                    current_date = next_d
                elif current_date - next_d == timedelta(days=0):
                    continue
                else:
                    break

    # 2. Mastery Counts
    unstarted = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions == 0
    ).count()
    
    learning = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.repetitions < 3
    ).count()
    
    mastered = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions >= 3
    ).count()

    # 3. Accuracy
    total_reviews = db.query(ReviewLog).filter(
        ReviewLog.user_id == current_user.id
    ).count()
    
    correct_reviews = db.query(ReviewLog).filter(
        ReviewLog.user_id == current_user.id,
        ReviewLog.is_correct == True
    ).count()
    
    accuracy = round((correct_reviews / total_reviews) * 100) if total_reviews > 0 else 0

    # 4. Forecast Workload
    now = datetime.utcnow()
    due_now = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.next_review <= now
    ).count()
    
    due_today = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.next_review <= now + timedelta(days=1)
    ).count()
    
    due_this_week = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.next_review <= now + timedelta(days=7)
    ).count()
    
    due_this_month = db.query(SRSCard).filter(
        SRSCard.user_id == current_user.id,
        SRSCard.repetitions > 0,
        SRSCard.next_review <= now + timedelta(days=30)
    ).count()

    return {
        "streak": streak,
        "mastery_counts": {
            "unstarted": unstarted,
            "learning": learning,
            "mastered": mastered,
            "total": unstarted + learning + mastered
        },
        "accuracy": accuracy,
        "forecast": {
            "due_now": due_now,
            "due_today": due_today,
            "due_this_week": due_this_week,
            "due_this_month": due_this_month
        }
    }
