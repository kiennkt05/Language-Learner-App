import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from typing import List

from app.db.session import get_db
from app.db.models import VocabList, Word, SRSCard, list_words
from app.db.schemas import VocabListCreate, VocabListResponse, WordCreate, WordResponse
from app.auth.security import get_current_user, User

router = APIRouter(prefix="/vocab", tags=["vocab"])

# Helper function to seed SRS Card for user
def seed_srs_card(db: Session, user_id: UUID, word_id: UUID) -> SRSCard:
    srs_card = db.query(SRSCard).filter(
        SRSCard.user_id == user_id,
        SRSCard.word_id == word_id
    ).first()
    if not srs_card:
        srs_card = SRSCard(
            user_id=user_id,
            word_id=word_id,
            repetitions=0,
            interval=1,
            ease_factor=2.5,
            next_review=datetime.utcnow()
        )
        db.add(srs_card)
    return srs_card

@router.post("/lists", response_model=VocabListResponse, status_code=status.HTTP_201_CREATED)
def create_vocab_list(
    list_in: VocabListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vocab_list = VocabList(
        user_id=current_user.id,
        name=list_in.name,
        description=list_in.description
    )
    db.add(vocab_list)
    db.commit()
    db.refresh(vocab_list)
    return vocab_list

@router.get("/lists", response_model=List[VocabListResponse])
def get_vocab_lists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(VocabList).filter(VocabList.user_id == current_user.id).all()

@router.get("/lists/{list_id}", response_model=VocabListResponse)
def get_vocab_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )
    return vocab_list

@router.put("/lists/{list_id}", response_model=VocabListResponse)
def update_vocab_list(
    list_id: UUID,
    list_in: VocabListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )
    vocab_list.name = list_in.name
    vocab_list.description = list_in.description
    db.commit()
    db.refresh(vocab_list)
    return vocab_list

@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vocab_list(
    list_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )
    db.delete(vocab_list)
    db.commit()
    return

@router.post("/lists/{list_id}/words", response_model=WordResponse, status_code=status.HTTP_201_CREATED)
def add_word_to_list(
    list_id: UUID,
    word_in: WordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify vocab list exists and belongs to current user
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )
    
    # Check if word spelling already exists in database
    # For a robust design, if a word spelling exists, reuse it or create a specific translation mapping.
    # Let's check if the word with spelling + translation already exists
    word = db.query(Word).filter(
        Word.spelling == word_in.spelling,
        Word.translation == word_in.translation
    ).first()
    
    if not word:
        word = Word(
            spelling=word_in.spelling,
            translation=word_in.translation,
            definition=word_in.definition,
            example_sentence=word_in.example_sentence
        )
        db.add(word)
        db.flush()  # Gets word.id

    # Check if already linked to list
    if word not in vocab_list.words:
        vocab_list.words.append(word)
        db.flush()

    # Auto-seed SRS Card
    seed_srs_card(db, current_user.id, word.id)
    
    db.commit()
    db.refresh(word)
    return word

@router.delete("/lists/{list_id}/words/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_word_from_list(
    list_id: UUID,
    word_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )
    
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word or word not in vocab_list.words:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found in this list"
        )
        
    vocab_list.words.remove(word)
    db.commit()
    return

@router.post("/lists/{list_id}/upload", status_code=status.HTTP_201_CREATED)
def upload_csv_vocab(
    list_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads a CSV of vocab words.
    Accepts CSV headers: spelling, translation, definition, example_sentence
    Or positional columns: spelling, translation, definition, example_sentence
    Enforces a strict 100-word limit.
    """
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )

    # Read file content
    try:
        contents = file.file.read().decode("utf-8-sig")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )

    # Parse CSV
    csv_file = io.StringIO(contents)
    reader = csv.reader(csv_file)
    
    rows = list(reader)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty"
        )

    # Detect header
    has_header = False
    first_row = [col.strip().lower() for col in rows[0]]
    if "spelling" in first_row or "translation" in first_row:
        has_header = True
        header_mapping = {col: idx for idx, col in enumerate(first_row)}
    else:
        # Default column index mapping
        header_mapping = {
            "spelling": 0,
            "translation": 1,
            "definition": 2,
            "example_sentence": 3
        }

    data_rows = rows[1:] if has_header else rows
    
    # Enforce strict 100-word limit
    if len(data_rows) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV contains {len(data_rows)} rows. Strict limit is 100 words per upload."
        )

    added_count = 0
    for idx, row in enumerate(data_rows):
        if not row or all(not cell.strip() for cell in row):
            continue  # Skip empty rows
            
        try:
            spelling_idx = header_mapping.get("spelling", 0)
            translation_idx = header_mapping.get("translation", 1)
            
            # Read cells safely
            spelling = row[spelling_idx].strip() if spelling_idx < len(row) else ""
            translation = row[translation_idx].strip() if translation_idx < len(row) else ""
            
            if not spelling or not translation:
                raise ValueError(f"Spelling and translation must not be empty. Row {idx+1}")
                
            definition = ""
            def_idx = header_mapping.get("definition", 2)
            if def_idx < len(row):
                definition = row[def_idx].strip()
                
            example = ""
            ex_idx = header_mapping.get("example_sentence", 3)
            if ex_idx < len(row):
                example = row[ex_idx].strip()
                
            # Database storage
            word = db.query(Word).filter(
                Word.spelling == spelling,
                Word.translation == translation
            ).first()
            
            if not word:
                word = Word(
                    spelling=spelling,
                    translation=translation,
                    definition=definition,
                    example_sentence=example
                )
                db.add(word)
                db.flush()
                
            if word not in vocab_list.words:
                vocab_list.words.append(word)
                db.flush()
                
            # Seed SRS Card
            seed_srs_card(db, current_user.id, word.id)
            added_count += 1
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error parsing row {idx + (2 if has_header else 1)}: {str(e)}"
            )
            
    db.commit()
    return {"message": f"Successfully parsed CSV and imported {added_count} words"}
