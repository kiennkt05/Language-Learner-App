import json
import random
from functools import lru_cache
from typing import Dict, Any, List, Optional

from groq import Groq

from app.config import settings
from app.db.exercise_schemas import (
    MCQExercise, MatchExercise, FillBlankExercise, SentenceWritingExercise,
    WordGroupingExercise, OddOneOutExercise, SynonymAntonymExercise,
    DialogueExercise, FlashcardExercise,
)

# ─── All supported exercise types ──────────────────────────────────────

EXERCISE_TYPES = [
    "mcq", "match", "fill_blank", "sentence_writing",
    "word_grouping", "odd_one_out", "synonym_antonym",
    "dialogue", "flashcard",
]

SCHEMA_MAP = {
    "mcq": MCQExercise,
    "match": MatchExercise,
    "fill_blank": FillBlankExercise,
    "sentence_writing": SentenceWritingExercise,
    "word_grouping": WordGroupingExercise,
    "odd_one_out": OddOneOutExercise,
    "synonym_antonym": SynonymAntonymExercise,
    "dialogue": DialogueExercise,
    "flashcard": FlashcardExercise,
}

# The balanced 5-exercise homework package order
BALANCED_SET = ["match", "fill_blank", "mcq", "sentence_writing", "odd_one_out"]


@lru_cache(maxsize=1)
def get_groq_client() -> Optional[Groq]:
    """Thread-safe singleton for the raw Groq client."""
    if settings.GROQ_API_KEY:
        return Groq(api_key=settings.GROQ_API_KEY)
    return None


# ─── Main public API ───────────────────────────────────────────────────

def generate_exercise_for_word(
    spelling: str,
    translation: str,
    exercise_type: str,
    other_translations: List[str] = None,
    other_words: List[Dict[str, str]] = None,
    definition: str = None,
    collocation: str = None,
    part_of_speech: str = None,
) -> Dict[str, Any]:
    """
    Generates an exercise of a given type for a word.
    Uses the raw Groq client with the user's specified model & params.
    Falls back to mock generation when GROQ_API_KEY is unset or on error.
    """
    if exercise_type not in SCHEMA_MAP:
        raise ValueError(f"Unknown exercise type: {exercise_type}")

    client = get_groq_client()

    # MOCK MODE
    if not client:
        return _generate_mock_exercise(
            spelling, translation, exercise_type,
            other_translations, other_words,
            definition=definition, collocation=collocation,
            part_of_speech=part_of_speech,
        )

    # REAL GROQ MODE
    try:
        schema = SCHEMA_MAP[exercise_type]
        prompt = _build_prompt(
            spelling, translation, exercise_type,
            other_words=other_words,
            definition=definition, collocation=collocation,
            part_of_speech=part_of_speech,
        )
        json_schema = schema.model_json_schema()

        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert language teacher generating structured JSON exercises for students. "
                        "Always return a single JSON object that strictly conforms to the provided schema. "
                        "Do NOT include any text outside the JSON object."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"{prompt}\n\n"
                        f"Return your answer as a JSON object conforming to this schema:\n"
                        f"```json\n{json.dumps(json_schema, indent=2)}\n```"
                    ),
                },
            ],
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            reasoning_effort="medium",
            stream=False,
            stop=None,
            response_format={"type": "json_object"},
        )

        raw_text = completion.choices[0].message.content
        parsed = json.loads(raw_text)

        # Validate with Pydantic
        validated = schema.model_validate(parsed)
        return validated.model_dump()

    except Exception as e:
        print(f"Error during Groq generation ({exercise_type}): {e}. Falling back to mock.")
        return _generate_mock_exercise(
            spelling, translation, exercise_type,
            other_translations, other_words,
            definition=definition, collocation=collocation,
            part_of_speech=part_of_speech,
        )


# ─── Prompt builders ──────────────────────────────────────────────────

def _build_prompt(
    spelling: str,
    translation: str,
    exercise_type: str,
    other_words: List[Dict[str, str]] = None,
    definition: str = None,
    collocation: str = None,
    part_of_speech: str = None,
) -> str:
    """Builds a detailed prompt for each exercise type."""
    word_context = f"'{spelling}' (translation: '{translation}'"
    if part_of_speech:
        word_context += f", {part_of_speech}"
    if definition:
        word_context += f", meaning: {definition}"
    if collocation:
        word_context += f", common usage: {collocation}"
    word_context += ")"

    sibling_info = ""
    if other_words and len(other_words) >= 3:
        samples = random.sample(other_words, min(6, len(other_words)))
        sibling_info = (
            " Other words the student is learning: "
            + ", ".join(f"{w['spelling']} ({w['translation']})" for w in samples)
            + "."
        )

    prompts = {
        "mcq": (
            f"Generate a Multiple Choice Question for the word {word_context}. "
            f"The question should ask what the word means. Provide exactly 4 options with one correct answer. "
            f"Use plausible distractors.{sibling_info}"
        ),
        "match": (
            f"Generate a matching exercise for the word {word_context}. "
            f"Return exactly 4 spelling-translation pairs. One pair must be '{spelling}' and '{translation}'. "
            f"The other 3 pairs should be different words the student might encounter.{sibling_info}"
        ),
        "fill_blank": (
            f"Generate a fill-in-the-blank exercise for the word {word_context}. "
            f"Create a natural sentence using the word, replace it with '___', and provide a context clue in English. "
            f"The blank_value should be the exact word form used in the sentence."
        ),
        "sentence_writing": (
            f"Generate a sentence writing exercise for the word {word_context}. "
            f"Give a clear instruction telling the student what kind of sentence to write using the word."
        ),
        "word_grouping": (
            f"Generate a word grouping/sorting exercise related to the word {word_context}. "
            f"Create 2-3 categories (e.g., by topic or part of speech) with 2-3 words in each category. "
            f"The target word '{spelling}' must appear in one category. "
            f"Use words the student might know.{sibling_info}"
        ),
        "odd_one_out": (
            f"Generate an odd-one-out exercise featuring the word {word_context}. "
            f"Provide 4-5 words where most share a common theme but one does not belong. "
            f"The target word '{spelling}' should be one of the group (NOT the odd one). "
            f"Include a brief explanation of why the odd word doesn't fit.{sibling_info}"
        ),
        "synonym_antonym": (
            f"Generate a synonym/antonym exercise for the word {word_context}. "
            f"Choose whether to test a synonym or antonym. "
            f"Provide 4 options with one correct answer. Use plausible distractors.{sibling_info}"
        ),
        "dialogue": (
            f"Generate a short dialogue completion exercise featuring the word {word_context}. "
            f"Create a 3-5 line dialogue between two speakers (A and B). "
            f"One line should use the target word '{spelling}' and be the missing line (replace its text with '___'). "
            f"The student must figure out the missing line from context."
        ),
        "flashcard": (
            f"Generate a flashcard for the word {word_context}. "
            f"The front should show the word with a definition prompt. "
            f"The back should show the translation with an example sentence. "
            f"Include a helpful hint (mnemonic, collocation, or visual association)."
        ),
    }

    return prompts.get(exercise_type, f"Generate a language learning exercise for {word_context}.")


# ─── Mock generators ──────────────────────────────────────────────────

def _generate_mock_exercise(
    spelling: str,
    translation: str,
    exercise_type: str,
    other_translations: List[str] = None,
    other_words: List[Dict[str, str]] = None,
    definition: str = None,
    collocation: str = None,
    part_of_speech: str = None,
) -> Dict[str, Any]:
    """
    Generates deterministic local mock exercises when offline / no API key.
    """
    distractors = ["house", "table", "chair", "water", "apple", "bread", "friend", "book"]
    if other_translations:
        valid_distractors = [d for d in other_translations if d.lower() != translation.lower()]
        if len(valid_distractors) < 3:
            for d in distractors:
                if d.lower() != translation.lower() and d not in valid_distractors:
                    valid_distractors.append(d)
    else:
        valid_distractors = [d for d in distractors if d.lower() != translation.lower()]

    selected_distractors = random.sample(valid_distractors, min(3, len(valid_distractors)))

    # ── MCQ ──
    if exercise_type == "mcq":
        options = [translation] + selected_distractors
        random.shuffle(options)
        correct_idx = options.index(translation)
        return {
            "question": f"What is the meaning of '{spelling}'?",
            "options": options,
            "correct_option": correct_idx,
        }

    # ── Match ──
    elif exercise_type == "match":
        pairs = [{"spelling": spelling, "translation": translation}]
        if other_words:
            valid_others = [
                w for w in other_words
                if w.get("spelling") and w.get("translation")
                and w["spelling"].lower() != spelling.lower()
                and w["translation"].lower() != translation.lower()
            ]
        else:
            valid_others = []

        if len(valid_others) < 3:
            mock_pairs = [
                {"spelling": "perro", "translation": "dog"},
                {"spelling": "gato", "translation": "cat"},
                {"spelling": "casa", "translation": "house"},
                {"spelling": "libro", "translation": "book"},
                {"spelling": "agua", "translation": "water"},
                {"spelling": "manzana", "translation": "apple"},
            ]
            for mp in mock_pairs:
                if (mp["spelling"].lower() != spelling.lower()
                    and mp["translation"].lower() != translation.lower()
                    and not any(v["spelling"].lower() == mp["spelling"].lower() for v in valid_others)):
                    valid_others.append(mp)

        selected_others = random.sample(valid_others, min(3, len(valid_others)))
        pairs.extend(selected_others)
        random.shuffle(pairs)
        return {"pairs": pairs}

    # ── Fill Blank ──
    elif exercise_type == "fill_blank":
        return {
            "sentence_with_blank": f"Complete the sentence: 'El ___ corre.'",
            "blank_value": spelling,
            "context_clue": f"The {translation} runs.",
        }

    # ── Sentence Writing ──
    elif exercise_type == "sentence_writing":
        return {
            "instruction": f"Write a complete sentence incorporating the word '{spelling}' ({translation}).",
            "required_word": spelling,
        }

    # ── Word Grouping ──
    elif exercise_type == "word_grouping":
        # Build two categories from available words
        category_a_words = [spelling]
        category_b_words = []
        if other_words:
            shuffled = random.sample(other_words, min(4, len(other_words)))
            for i, w in enumerate(shuffled):
                if i < 2:
                    category_a_words.append(w["spelling"])
                else:
                    category_b_words.append(w["spelling"])
        if len(category_a_words) < 2:
            category_a_words.append("perro")
        if len(category_b_words) < 2:
            category_b_words.extend(["rojo", "azul"][:2 - len(category_b_words)])

        return {
            "instruction": "Sort these words into the correct categories.",
            "categories": [
                {"name": "Group A", "words": category_a_words[:3]},
                {"name": "Group B", "words": category_b_words[:3]},
            ],
        }

    # ── Odd One Out ──
    elif exercise_type == "odd_one_out":
        group_words = [spelling]
        if other_words:
            same_group = random.sample(other_words, min(2, len(other_words)))
            group_words.extend([w["spelling"] for w in same_group])
        while len(group_words) < 3:
            group_words.append("libro")

        odd = "sol"  # The outlier
        all_words = group_words[:3] + [odd]
        random.shuffle(all_words)
        return {
            "instruction": "Which word does NOT belong in this group?",
            "words": all_words,
            "odd_word": odd,
            "explanation": f"'{odd}' does not share the same theme as the other words.",
        }

    # ── Synonym / Antonym ──
    elif exercise_type == "synonym_antonym":
        relationship = random.choice(["synonym", "antonym"])
        correct = f"mock_{relationship}_of_{translation}"
        opts = [correct] + selected_distractors[:3]
        random.shuffle(opts)
        return {
            "instruction": f"Choose the {relationship} of '{spelling}'.",
            "target_word": spelling,
            "relationship": relationship,
            "correct_answer": correct,
            "options": opts,
        }

    # ── Dialogue ──
    elif exercise_type == "dialogue":
        return {
            "instruction": "Complete the missing line in this conversation.",
            "dialogue_lines": [
                {"speaker": "A", "text": f"Do you know what '{spelling}' means?"},
                {"speaker": "B", "text": "___"},
                {"speaker": "A", "text": "That's correct! Well done."},
            ],
            "missing_line_index": 1,
            "correct_response": f"Yes, it means '{translation}'.",
        }

    # ── Flashcard ──
    elif exercise_type == "flashcard":
        hint_text = collocation if collocation else f"Think about the meaning: {translation}"
        return {
            "front": f"What does '{spelling}' mean?",
            "back": f"{translation}" + (f" — e.g. {collocation}" if collocation else ""),
            "hint": hint_text,
        }

    raise ValueError(f"Unknown exercise type: {exercise_type}")


# ─── Word Enrichment from Spellings ──────────────────────────────────

def enrich_words_from_spellings(
    spellings: List[str],
    target_language: str = "English",
    source_language: str = "English",
) -> List[Dict[str, Any]]:
    """
    Takes a list of raw word spellings and returns enriched word data
    using the Groq LLM. Falls back to mock enrichment when GROQ_API_KEY is unset.
    
    Each enriched word includes:
      spelling, translation, definition, example_sentence,
      pronunciation, part_of_speech, collocation, visual_clue, exercise_level
    """
    client = get_groq_client()

    if not client:
        return _mock_enrich_words(spellings, target_language, source_language)

    try:
        from app.db.schemas import EnrichedWordSchema

        prompt = _build_enrichment_prompt(spellings, target_language, source_language)

        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a language teacher. Return ONLY a JSON object "
                        "{\"words\": [...]} with no other text."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=1,
            max_completion_tokens=4096,
            top_p=1,
            reasoning_effort="medium",
            stream=False,
            stop=None,
            response_format={"type": "json_object"},
        )

        raw_text = completion.choices[0].message.content
        parsed = json.loads(raw_text)

        # Handle both {"words": [...]} and direct [...]
        word_list = parsed.get("words", parsed) if isinstance(parsed, dict) else parsed
        if not isinstance(word_list, list):
            word_list = [word_list]

        # Validate each with Pydantic
        results = []
        for item in word_list:
            validated = EnrichedWordSchema.model_validate(item)
            results.append(validated.model_dump())

        return results

    except Exception as e:
        print(f"Error during Groq enrichment: {e}. Falling back to mock.")
        return _mock_enrich_words(spellings, target_language, source_language)


def _build_enrichment_prompt(
    spellings: List[str],
    target_language: str,
    source_language: str,
) -> str:
    """Builds a compact prompt for word enrichment."""
    word_list_str = ", ".join(spellings)
    return (
        f"You are a language teacher creating vocabulary flashcards. The user provided these input words: {word_list_str}\n\n"
        f"The user wants flashcards for learning these words. As a robust default, you must ALWAYS translate the words into English.\n\n"
        f"IMPORTANT INSTRUCTIONS FOR LANGUAGE MAPPING:\n"
        f"1. The 'spelling' field MUST be the exact input word exactly as provided by the user (do not translate it).\n"
        f"2. The 'translation' field MUST be the English translation of the input word.\n"
        f"3. The 'definition' field MUST be 1-2 sentences in English explaining the word.\n"
        f"4. The 'example_sentence' field MUST be a natural sentence in the original language of the input word.\n\n"
        f"For each word, return a JSON object with the following fields: "
        f"spelling, translation, definition, example_sentence, pronunciation (IPA for the 'spelling'), "
        f"part_of_speech, collocation, visual_clue (mnemonic in English), exercise_level (1=beginner, 2=intermediate, 3=advanced).\n\n"
        f"Example format:\n"
        f'{{"words": [{{"spelling": "<exact input word>", "translation": "<English meaning>", '
        f'"definition": "<English definition>", "example_sentence": "<example in input language>", '
        f'"pronunciation": "<IPA>", "part_of_speech": "noun", '
        f'"collocation": "<common usage>", "visual_clue": "<mnemonic>", "exercise_level": 1}}]}}'
    )


def _mock_enrich_words(
    spellings: List[str],
    target_language: str,
    source_language: str,
) -> List[Dict[str, Any]]:
    """Mock enrichment for development when GROQ_API_KEY is not set."""
    results = []
    for spelling in spellings:
        results.append({
            "spelling": spelling,
            "translation": f"{spelling} (translation)",
            "definition": f"The meaning of '{spelling}' in {target_language}.",
            "example_sentence": f"This is an example sentence using '{spelling}'.",
            "pronunciation": f"/{spelling}/",
            "part_of_speech": random.choice(["noun", "verb", "adjective", "adverb"]),
            "collocation": f"common {spelling}",
            "visual_clue": f"Imagine '{spelling}' as a vivid picture in your mind.",
            "exercise_level": random.choice([1, 2, 3]),
        })
    return results
