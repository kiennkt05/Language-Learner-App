from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any

# Authentication
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    tier: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None

# Words
class WordCreate(BaseModel):
    spelling: str = Field(..., min_length=1, max_length=255)
    translation: str = Field(..., min_length=1, max_length=255)
    definition: Optional[str] = None
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = None
    part_of_speech: Optional[str] = None
    collocation: Optional[str] = None
    visual_clue: Optional[str] = None
    exercise_level: Optional[int] = 1

class WordResponse(BaseModel):
    id: UUID
    spelling: str
    translation: str
    definition: Optional[str]
    example_sentence: Optional[str]
    pronunciation: Optional[str] = None
    part_of_speech: Optional[str] = None
    collocation: Optional[str] = None
    visual_clue: Optional[str] = None
    exercise_level: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BulkDeleteWordsRequest(BaseModel):
    word_ids: List[UUID]

# Vocab Lists
class VocabListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_language: Optional[str] = None

class VocabListResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    target_language: Optional[str] = None
    created_at: datetime
    words: List[WordResponse] = []

    class Config:
        from_attributes = True

# SRS Card
class SRSCardResponse(BaseModel):
    id: UUID
    user_id: UUID
    word_id: UUID
    repetitions: int
    interval: int
    ease_factor: float
    next_review: datetime
    created_at: datetime
    word: WordResponse

    class Config:
        from_attributes = True

# Exercises
class ExerciseResponse(BaseModel):
    id: UUID
    word_id: UUID
    type: str
    data: Any
    created_at: datetime

    class Config:
        from_attributes = True

# Review Logs
class ReviewLogCreate(BaseModel):
    word_id: UUID
    exercise_id: Optional[UUID] = None
    quality: int = Field(..., ge=1, le=5)  # 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    response: Optional[str] = None

class ReviewLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    word_id: UUID
    exercise_id: Optional[UUID]
    quality: int
    is_correct: bool
    response: Optional[str]
    reviewed_at: datetime

    class Config:
        from_attributes = True

# Session Cards
class SessionCardResponse(BaseModel):
    card_id: UUID
    word_id: UUID
    spelling: str
    translation: str
    definition: Optional[str] = None
    example_sentence: Optional[str] = None
    repetitions: int
    interval: int
    ease_factor: float
    exercises: List[ExerciseResponse] = []

class ReviewSubmit(BaseModel):
    card_id: UUID
    exercise_id: Optional[UUID] = None
    quality: int = Field(..., ge=1, le=5) # 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    response: Optional[str] = None

# AI Word Generation
class GenerateWordsRequest(BaseModel):
    spellings: List[str] = Field(..., min_length=1, max_length=50)
    source_language: str = Field(default="English", max_length=100)

class EnrichedWordSchema(BaseModel):
    spelling: str
    translation: str
    definition: Optional[str] = None
    example_sentence: Optional[str] = None
    pronunciation: Optional[str] = None
    part_of_speech: Optional[str] = None
    collocation: Optional[str] = None
    visual_clue: Optional[str] = None
    exercise_level: Optional[int] = 1

