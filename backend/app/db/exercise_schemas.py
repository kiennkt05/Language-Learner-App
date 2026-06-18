from pydantic import BaseModel, Field
from typing import List

class MCQExercise(BaseModel):
    """
    Multiple Choice Question for testing vocabulary recognition.
    """
    question: str = Field(..., description="A question prompt asking for the meaning of the target word, e.g. 'What is the meaning of perro?'")
    options: List[str] = Field(..., min_length=4, max_length=4, description="List of exactly 4 translation options")
    correct_option: int = Field(..., ge=0, le=3, description="Zero-based index of the correct option in the options list")

class MatchExercise(BaseModel):
    """
    A simple matching exercise that maps a target word to its correct translation.
    """
    spelling: str = Field(..., description="The spelling of the word being tested")
    options: List[str] = Field(..., min_length=4, max_length=4, description="Exactly 4 translation options")
    correct_option: int = Field(..., ge=0, le=3, description="Zero-based index of the correct translation option")

class FillBlankExercise(BaseModel):
    """
    A fill-in-the-blank exercise for vocabulary recall and context understanding.
    """
    sentence_with_blank: str = Field(..., description="A sentence containing a blank represented by underscores '___', e.g. 'Yo ___ un libro.'")
    blank_value: str = Field(..., description="The target word that fills the blank, matching the correct grammar form, e.g. 'leo'")
    context_clue: str = Field(..., description="English/translation clue explaining what the sentence means, e.g. 'I read a book.'")

class SentenceWritingExercise(BaseModel):
    """
    A production writing exercise testing sentence composition.
    """
    instruction: str = Field(..., description="Instruction telling the user what kind of sentence to write using the word, e.g. 'Write a sentence in Spanish using the word perro.'")
    required_word: str = Field(..., description="The target word that must be included in the user's sentence, e.g. 'perro'")
