from pydantic import BaseModel, Field
from typing import List

# ─── Existing Exercise Types ───────────────────────────────────────────

class MCQExercise(BaseModel):
    """
    Multiple Choice Question for testing vocabulary recognition.
    """
    question: str = Field(..., description="A question prompt asking for the meaning of the target word, e.g. 'What is the meaning of perro?'")
    options: List[str] = Field(..., min_length=4, max_length=4, description="List of exactly 4 translation options")
    correct_option: int = Field(..., ge=0, le=3, description="Zero-based index of the correct option in the options list")

class MatchPair(BaseModel):
    spelling: str = Field(..., description="The spelling of the word")
    translation: str = Field(..., description="The correct translation of the word")

class MatchExercise(BaseModel):
    """
    A match exercise with 4 matching pairs of target language spelling and native translation.
    """
    pairs: List[MatchPair] = Field(..., min_length=4, max_length=4, description="List of exactly 4 spelling-translation pairs")

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

# ─── New Exercise Types ────────────────────────────────────────────────

class CategoryGroup(BaseModel):
    """A single category bucket containing words."""
    name: str = Field(..., description="Category name, e.g. 'Animals' or 'Verbs'")
    words: List[str] = Field(..., min_length=2, description="List of words belonging to this category")

class WordGroupingExercise(BaseModel):
    """
    Sort words into thematic or grammatical categories.
    Purpose: tests deeper vocabulary understanding through classification.
    """
    instruction: str = Field(..., description="Instruction for the student, e.g. 'Sort these words into the correct categories.'")
    categories: List[CategoryGroup] = Field(..., min_length=2, max_length=4, description="2-4 category groups, each containing 2-3 words")

class OddOneOutExercise(BaseModel):
    """
    Identify the word that doesn't belong in a group.
    Purpose: tests semantic understanding and word relationships.
    """
    instruction: str = Field(..., description="Instruction for the student, e.g. 'Which word does NOT belong?'")
    words: List[str] = Field(..., min_length=4, max_length=5, description="4-5 words where one is the odd one out")
    odd_word: str = Field(..., description="The correct answer — the word that doesn't belong")
    explanation: str = Field(..., description="Brief explanation of why the word is odd, e.g. 'banana is a fruit, not an animal'")

class SynonymAntonymExercise(BaseModel):
    """
    Match words with their synonyms or antonyms.
    Purpose: builds vocabulary depth and word relationships.
    """
    instruction: str = Field(..., description="Instruction, e.g. 'Choose the synonym of happy'")
    target_word: str = Field(..., description="The word to find the synonym/antonym for")
    relationship: str = Field(..., description="Either 'synonym' or 'antonym'")
    correct_answer: str = Field(..., description="The correct synonym or antonym")
    options: List[str] = Field(..., min_length=4, max_length=4, description="4 options including the correct answer")

class DialogueLine(BaseModel):
    """A single line in a dialogue."""
    speaker: str = Field(..., description="Speaker label, e.g. 'A' or 'B' or a name")
    text: str = Field(..., description="What the speaker says. Use '___' for the missing line.")

class DialogueExercise(BaseModel):
    """
    Complete a missing line in a short conversational dialogue.
    Purpose: tests contextual usage and pragmatic understanding.
    """
    instruction: str = Field(..., description="Instruction, e.g. 'Complete the missing line in this conversation.'")
    dialogue_lines: List[DialogueLine] = Field(..., min_length=3, max_length=6, description="3-6 dialogue lines, one with '___' as text")
    missing_line_index: int = Field(..., ge=0, description="Zero-based index of the missing line in dialogue_lines")
    correct_response: str = Field(..., description="The correct text for the missing line")

class FlashcardExercise(BaseModel):
    """
    Flashcard-style review with front/back and optional hint.
    Purpose: rapid recall reinforcement.
    """
    front: str = Field(..., description="Front of the card — the target word or definition prompt")
    back: str = Field(..., description="Back of the card — the answer (translation + example)")
    hint: str = Field(..., description="A hint to help recall, e.g. collocation, visual clue, or first letter")
