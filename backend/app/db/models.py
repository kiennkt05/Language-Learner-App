import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, SmallInteger, Boolean, JSON, Table
from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy.types import UUID

# Junction table for VocabList <-> Word (Many-to-Many)
list_words = Table(
    "list_words",
    Base.metadata,
    Column("list_id", UUID(as_uuid=True), ForeignKey("vocab_lists.id", ondelete="CASCADE"), primary_key=True),
    Column("word_id", UUID(as_uuid=True), ForeignKey("words.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    tier = Column(String(50), default="premium", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    vocab_lists = relationship("VocabList", back_populates="user", cascade="all, delete-orphan")
    srs_cards = relationship("SRSCard", back_populates="user", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="user", cascade="all, delete-orphan")


class VocabList(Base):
    __tablename__ = "vocab_lists"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    target_language = Column(String(100), nullable=True)  # e.g. "Spanish", "French", "Vietnamese"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="vocab_lists")
    words = relationship("Word", secondary=list_words, back_populates="vocab_lists")


class Word(Base):
    __tablename__ = "words"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    spelling = Column(String(255), nullable=False, index=True)
    translation = Column(String(255), nullable=False)
    definition = Column(String, nullable=True)
    example_sentence = Column(String, nullable=True)
    pronunciation = Column(String(255), nullable=True)       # IPA or phonetic
    part_of_speech = Column(String(50), nullable=True)        # noun, verb, adj, etc.
    collocation = Column(String, nullable=True)               # common word pairings
    visual_clue = Column(String, nullable=True)               # mnemonic / visual hint
    exercise_level = Column(SmallInteger, default=1, nullable=True)  # 1=beginner, 2=intermediate, 3=advanced
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    vocab_lists = relationship("VocabList", secondary=list_words, back_populates="words")
    srs_cards = relationship("SRSCard", back_populates="word", cascade="all, delete-orphan")
    exercises = relationship("Exercise", back_populates="word", cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="word", cascade="all, delete-orphan")


class SRSCard(Base):
    __tablename__ = "srs_cards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word_id = Column(UUID(as_uuid=True), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    repetitions = Column(Integer, default=0, nullable=False)
    interval = Column(Integer, default=1, nullable=False)  # in days
    ease_factor = Column(Float, default=2.5, nullable=False)
    next_review = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="srs_cards")
    word = relationship("Word", back_populates="srs_cards")


class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    word_id = Column(UUID(as_uuid=True), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # e.g., mcq, fill_blank
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    word = relationship("Word", back_populates="exercises")
    review_logs = relationship("ReviewLog", back_populates="exercise")


class ReviewLog(Base):
    __tablename__ = "review_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word_id = Column(UUID(as_uuid=True), ForeignKey("words.id", ondelete="CASCADE"), nullable=False, index=True)
    exercise_id = Column(UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True, index=True)
    quality = Column(SmallInteger, nullable=False)  # SM-2 quality: 1, 3, 4, 5
    is_correct = Column(Boolean, nullable=False)
    response = Column(String, nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="review_logs")
    word = relationship("Word", back_populates="review_logs")
    exercise = relationship("Exercise", back_populates="review_logs")
