import csv
import io
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from typing import List

from app.db.session import get_db
from app.db.models import VocabList, Word, SRSCard, Exercise, list_words
from app.db.schemas import (
    VocabListCreate, VocabListResponse, WordCreate, WordResponse,
    ExerciseResponse, GenerateWordsRequest, BulkDeleteWordsRequest
)
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
        description=list_in.description,
        target_language=list_in.target_language
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
    vocab_list.target_language = list_in.target_language
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

@router.post("/lists/{list_id}/words/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
def remove_words_from_list(
    list_id: UUID,
    payload: BulkDeleteWordsRequest,
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
    
    # We only remove words that are actually in the list to avoid errors.
    # The relationship is many-to-many, so we can just filter by id.
    words_to_remove = db.query(Word).filter(Word.id.in_(payload.word_ids)).all()
    for word in words_to_remove:
        if word in vocab_list.words:
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
    Accepts CSV headers: spelling, translation, definition, example_sentence,
    pronunciation, part_of_speech, collocation, visual_clue, exercise_level.
    Or positional columns: spelling, translation, definition, example_sentence.
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
            "example_sentence": 3,
            "pronunciation": 4,
            "part_of_speech": 5,
            "collocation": 6,
            "visual_clue": 7,
            "exercise_level": 8,
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

            # Parse enrichment fields (optional)
            pronunciation = ""
            pron_idx = header_mapping.get("pronunciation")
            if pron_idx is not None and pron_idx < len(row):
                pronunciation = row[pron_idx].strip()

            part_of_speech = ""
            pos_idx = header_mapping.get("part_of_speech")
            if pos_idx is not None and pos_idx < len(row):
                part_of_speech = row[pos_idx].strip()

            collocation = ""
            coll_idx = header_mapping.get("collocation")
            if coll_idx is not None and coll_idx < len(row):
                collocation = row[coll_idx].strip()

            visual_clue = ""
            vc_idx = header_mapping.get("visual_clue")
            if vc_idx is not None and vc_idx < len(row):
                visual_clue = row[vc_idx].strip()

            exercise_level = 1
            el_idx = header_mapping.get("exercise_level")
            if el_idx is not None and el_idx < len(row) and row[el_idx].strip().isdigit():
                exercise_level = int(row[el_idx].strip())
                
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
                    example_sentence=example,
                    pronunciation=pronunciation or None,
                    part_of_speech=part_of_speech or None,
                    collocation=collocation or None,
                    visual_clue=visual_clue or None,
                    exercise_level=exercise_level,
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


@router.post("/words/{word_id}/exercises", response_model=List[ExerciseResponse])
def generate_word_exercises(
    word_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a balanced 5-exercise homework package for the word:
      1. Warm-up: match (matching pairs)
      2. Context: fill_blank (fill in the blank)
      3. Meaning check: mcq (multiple choice)
      4. Production: sentence_writing (write a sentence)
      5. Review: odd_one_out (sorting/classification)
    Saves them to the database and returns them.
    """
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found"
        )
        
    # Check word ownership
    is_owned = db.query(VocabList).join(VocabList.words).filter(
        VocabList.user_id == current_user.id,
        Word.id == word_id
    ).first()
    if not is_owned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found or access denied"
        )

        
    from app.services.ai import generate_exercise_for_word, BALANCED_SET

    # Fetch sibling words and translations for distractor context
    other_translations = []
    other_words = []
    list_ids = [l.id for l in word.vocab_lists if l.user_id == current_user.id]
    if list_ids:
        siblings = db.query(Word).join(Word.vocab_lists).filter(
            VocabList.id.in_(list_ids),
            Word.id != word_id
        ).distinct().all()
        other_translations = [s.translation for s in siblings if s.translation]
        other_words = [{"spelling": s.spelling, "translation": s.translation} for s in siblings if s.spelling and s.translation]

    try:
        # Delete any pre-existing exercises for this word
        db.query(Exercise).filter(Exercise.word_id == word.id).delete()

        # Generate balanced 5-exercise set
        for ex_type in BALANCED_SET:
            ex_data = generate_exercise_for_word(
                word.spelling, word.translation, ex_type,
                other_translations=other_translations,
                other_words=other_words,
                definition=word.definition,
                collocation=word.collocation,
                part_of_speech=word.part_of_speech,
            )
            db.add(Exercise(word_id=word.id, type=ex_type, data=ex_data))
        
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate exercises: {str(e)}"
        )
    
    return db.query(Exercise).filter(Exercise.word_id == word.id).all()

@router.get("/words/{word_id}/exercises", response_model=List[ExerciseResponse])
def get_word_exercises(
    word_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves existing exercises for the word.
    """
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found"
        )
        
    # Check word ownership
    is_owned = db.query(VocabList).join(VocabList.words).filter(
        VocabList.user_id == current_user.id,
        Word.id == word_id
    ).first()
    if not is_owned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Word not found or access denied"
        )
        
    return db.query(Exercise).filter(Exercise.word_id == word.id).all()


@router.post("/lists/{list_id}/generate")
async def generate_words_from_spellings(
    list_id: UUID,
    request: GenerateWordsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI-powered word enrichment from spellings only.
    Accepts a list of raw word spellings, enriches each using the Groq LLM
    (translation, definition, example, pronunciation, POS, collocation, mnemonic),
    creates Word records with SRS cards and balanced exercises, and streams
    progress events via SSE.
    """
    # Validate list ownership
    vocab_list = db.query(VocabList).filter(
        VocabList.id == list_id,
        VocabList.user_id == current_user.id
    ).first()
    if not vocab_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary list not found"
        )

    # Clean and deduplicate spellings
    spellings = list(dict.fromkeys(s.strip() for s in request.spellings if s.strip()))
    if not spellings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid spellings provided"
        )
    if len(spellings) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many words ({len(spellings)}). Maximum is 50 per request."
        )

    # Determine target language from list or request
    target_language = vocab_list.target_language or "English"
    source_language = request.source_language or "English"

    async def event_generator():
        from app.services.ai import enrich_words_from_spellings, generate_exercise_for_word, BALANCED_SET

        total = len(spellings)
        words_added = 0
        batch_size = 10  # Process in batches to stay within token limits

        for batch_start in range(0, total, batch_size):
            batch = spellings[batch_start:batch_start + batch_size]

            # Send progress event for batch start
            yield f"data: {json.dumps({'type': 'progress', 'message': f'Enriching words {batch_start+1}–{min(batch_start+len(batch), total)} of {total}...'})}\n\n"

            try:
                enriched_words = enrich_words_from_spellings(
                    batch,
                    target_language=target_language,
                    source_language=source_language,
                )
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Enrichment failed for batch: {str(e)}'})}\n\n"
                continue

            # Process each enriched word
            for enriched in enriched_words:
                try:
                    spelling = enriched["spelling"]
                    translation = enriched["translation"]

                    # Check if word already exists
                    word = db.query(Word).filter(
                        Word.spelling == spelling,
                        Word.translation == translation
                    ).first()

                    if not word:
                        word = Word(
                            spelling=spelling,
                            translation=translation,
                            definition=enriched.get("definition"),
                            example_sentence=enriched.get("example_sentence"),
                            pronunciation=enriched.get("pronunciation"),
                            part_of_speech=enriched.get("part_of_speech"),
                            collocation=enriched.get("collocation"),
                            visual_clue=enriched.get("visual_clue"),
                            exercise_level=enriched.get("exercise_level", 1),
                        )
                        db.add(word)
                        db.flush()

                    # Link to list
                    if word not in vocab_list.words:
                        vocab_list.words.append(word)
                        db.flush()

                    # Seed SRS card
                    seed_srs_card(db, current_user.id, word.id)

                    # Generate balanced exercises
                    db.query(Exercise).filter(Exercise.word_id == word.id).delete()
                    other_words = [
                        {"spelling": w["spelling"], "translation": w["translation"]}
                        for w in enriched_words
                        if w["spelling"] != spelling
                    ]
                    for ex_type in BALANCED_SET:
                        ex_data = generate_exercise_for_word(
                            word.spelling, word.translation, ex_type,
                            other_words=other_words,
                            definition=word.definition,
                            collocation=word.collocation,
                            part_of_speech=word.part_of_speech,
                        )
                        db.add(Exercise(word_id=word.id, type=ex_type, data=ex_data))

                    db.flush()
                    words_added += 1

                    # Stream per-word success
                    word_data = {
                        "id": str(word.id),
                        "spelling": word.spelling,
                        "translation": word.translation,
                        "definition": word.definition,
                        "pronunciation": word.pronunciation,
                        "part_of_speech": word.part_of_speech,
                        "collocation": word.collocation,
                        "visual_clue": word.visual_clue,
                        "exercise_level": word.exercise_level,
                    }
                    yield f"data: {json.dumps({'type': 'word_done', 'current': words_added, 'total': total, 'word': word_data})}\n\n"

                except Exception as e:
                    spelling_val = enriched.get('spelling', 'unknown')
                    err_msg = f"Failed to process {spelling_val}: {str(e)}"
                    yield f"data: {json.dumps({'type': 'error', 'message': err_msg})}\n\n"
                    continue

        # Commit all changes
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            yield f"data: {json.dumps({'type': 'error', 'message': f'Database commit failed: {str(e)}'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'complete', 'words_added': words_added, 'total': total})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
