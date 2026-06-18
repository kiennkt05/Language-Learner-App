import os
import random
from typing import Dict, Any
from groq import Groq
import instructor

from app.config import settings
from app.db.exercise_schemas import MCQExercise, MatchExercise, FillBlankExercise, SentenceWritingExercise

# Initialize instructor client lazily
_client = None

def get_ai_client():
    global _client
    if _client is None and settings.GROQ_API_KEY:
        raw_client = Groq(api_key=settings.GROQ_API_KEY)
        _client = instructor.from_groq(raw_client)
    return _client

def generate_exercise_for_word(spelling: str, translation: str, exercise_type: str) -> Dict[str, Any]:
    """
    Generates an exercise of a given type for a word.
    Supports 'mcq', 'match', 'fill_blank', and 'sentence_writing'.
    If GROQ_API_KEY is not set, falls back to mock exercise generation.
    """
    client = get_ai_client()
    
    # Select Pydantic schema based on type
    schema_map = {
        "mcq": MCQExercise,
        "match": MatchExercise,
        "fill_blank": FillBlankExercise,
        "sentence_writing": SentenceWritingExercise
    }
    
    if exercise_type not in schema_map:
        raise ValueError(f"Unknown exercise type: {exercise_type}")
        
    schema = schema_map[exercise_type]

    # MOCK MODE
    if not client:
        return _generate_mock_exercise(spelling, translation, exercise_type)

    # REAL GROQ MODE
    try:
        prompt = f"Generate a language learning exercise of type '{exercise_type}' for the target word '{spelling}' (translation: '{translation}')."
        
        # We use llama3-70b-8192 as it is stable, fast, and supports tool calls/structured output
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            response_model=schema,
            messages=[
                {"role": "system", "content": "You are an expert language teacher generating structured JSON exercises for students."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        # return model_dump if using Pydantic V2, or dict() if using Pydantic V1
        if hasattr(response, "model_dump"):
            return response.model_dump()
        return response.dict()
    except Exception as e:
        # Fallback to mock on error so application continues functioning
        print(f"Error during Groq generation: {e}. Falling back to mock generation.")
        return _generate_mock_exercise(spelling, translation, exercise_type)


def _generate_mock_exercise(spelling: str, translation: str, exercise_type: str) -> Dict[str, Any]:
    """
    Generates a deterministic local mock exercise when offline/no API key.
    """
    distractors = ["house", "table", "chair", "water", "apple", "bread", "friend", "book"]
    # Filter out target translation if it's in the distractors list
    valid_distractors = [d for d in distractors if d.lower() != translation.lower()]
    random.seed(spelling)  # Keep it semi-deterministic per word
    selected_distractors = random.sample(valid_distractors, 3)

    if exercise_type == "mcq":
        options = [translation] + selected_distractors
        random.shuffle(options)
        correct_idx = options.index(translation)
        return {
            "question": f"What is the meaning of '{spelling}'?",
            "options": options,
            "correct_option": correct_idx
        }
        
    elif exercise_type == "match":
        options = [translation] + selected_distractors
        random.shuffle(options)
        correct_idx = options.index(translation)
        return {
            "spelling": spelling,
            "options": options,
            "correct_option": correct_idx
        }
        
    elif exercise_type == "fill_blank":
        # Generate a standard template
        return {
            "sentence_with_blank": f"Complete the sentence: 'El ___ corre.'",
            "blank_value": spelling,
            "context_clue": f"The {translation} runs."
        }
        
    elif exercise_type == "sentence_writing":
        return {
            "instruction": f"Write a complete sentence incorporating the word '{spelling}' ({translation}).",
            "required_word": spelling
        }
        
    raise ValueError(f"Unknown exercise type: {exercise_type}")
