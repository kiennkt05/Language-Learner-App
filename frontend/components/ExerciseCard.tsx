import React, { useState, useEffect } from "react";
import { Check, X, AlertCircle, Sparkles, RotateCcw, MessageCircle, Layers } from "lucide-react";

interface Exercise {
  id: string;
  word_id: string;
  type: string;
  data: any;
  created_at: string;
}

interface ExerciseCardProps {
  exercise: Exercise;
  onSubmit: (isCorrect: boolean, quality: number, response: string) => void;
}

const shuffleArray = <T,>(arr: T[]): T[] => {
  return [...arr].sort(() => Math.random() - 0.5);
};

const EXERCISE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  match: "Matching Game",
  fill_blank: "Fill-in-the-Blank",
  sentence_writing: "Sentence Production",
  word_grouping: "Word Sorting",
  odd_one_out: "Odd One Out",
  synonym_antonym: "Synonym / Antonym",
  dialogue: "Dialogue Completion",
  flashcard: "Flashcard Review",
};

export default function ExerciseCard({ exercise, onSubmit }: ExerciseCardProps) {
  const { type, data } = exercise;
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrectResult, setIsCorrectResult] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Matching game state
  const [selectedSpelling, setSelectedSpelling] = useState<string | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [shuffledSpellings, setShuffledSpellings] = useState<string[]>([]);
  const [shuffledTranslations, setShuffledTranslations] = useState<string[]>([]);
  const [matchedSpellings, setMatchedSpellings] = useState<Set<string>>(new Set());
  const [matchedTranslations, setMatchedTranslations] = useState<Set<string>>(new Set());
  const [mistakeCount, setMistakeCount] = useState(0);
  const [failedPair, setFailedPair] = useState<{ spelling: string; translation: string } | null>(null);

  // Word grouping state
  const [ungroupedWords, setUngroupedWords] = useState<string[]>([]);
  const [userBuckets, setUserBuckets] = useState<Record<string, string[]>>({});

  // Odd one out state
  const [selectedOddWord, setSelectedOddWord] = useState<string | null>(null);
  const [shuffledOddWords, setShuffledOddWords] = useState<string[]>([]);

  // Flashcard state
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Dialogue state
  const [dialogueInput, setDialogueInput] = useState("");

  useEffect(() => {
    setSelectedOption(null);
    setInputText("");
    setSubmitted(false);
    setIsCorrectResult(false);
    setValidationError("");
    setSelectedSpelling(null);
    setSelectedTranslation(null);
    setMatchedSpellings(new Set());
    setMatchedTranslations(new Set());
    setMistakeCount(0);
    setFailedPair(null);
    setSelectedOddWord(null);
    setIsFlipped(false);
    setShowHint(false);
    setDialogueInput("");

    if (type === "match" && data?.pairs) {
      const spellings = data.pairs.map((p: any) => p.spelling);
      const translations = data.pairs.map((p: any) => p.translation);
      setShuffledSpellings(shuffleArray(spellings));
      setShuffledTranslations(shuffleArray(translations));
    }

    if (type === "word_grouping" && data?.categories) {
      const allWords = data.categories.flatMap((c: any) => c.words);
      setUngroupedWords(shuffleArray(allWords));
      const emptyBuckets: Record<string, string[]> = {};
      data.categories.forEach((c: any) => {
        emptyBuckets[c.name] = [];
      });
      setUserBuckets(emptyBuckets);
    }

    if (type === "odd_one_out" && data?.words) {
      setShuffledOddWords(shuffleArray([...data.words]));
    }
  }, [exercise.id, type, data]);

  // ── MCQ ──
  const handleMcqSubmit = (optionIdx: number) => {
    if (submitted) return;
    setSelectedOption(optionIdx);
    const isCorrect = optionIdx === data.correct_option;
    setIsCorrectResult(isCorrect);
    setSubmitted(true);
  };

  // ── Fill-in-the-Blank ──
  const handleFillBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted || !inputText.trim()) return;

    const normalizeString = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    };

    const normalizedInput = normalizeString(inputText);
    const normalizedCorrect = normalizeString(data.blank_value);
    
    const isCorrect = normalizedInput === normalizedCorrect;
    setIsCorrectResult(isCorrect);
    setSubmitted(true);
  };

  // ── Sentence Writing ──
  const handleSentenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (submitted || !text) return;

    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const isLongEnough = text.length >= 15;
    const normalizedInput = text.toLowerCase();
    const required = data.required_word.trim().toLowerCase();
    const hasRequiredWord = normalizedInput.includes(required);
    const isNotJustWord = normalizedInput !== required && normalizedInput !== data.instruction.toLowerCase();

    if (!hasRequiredWord) {
      setValidationError(`Sentence must contain the target word '${data.required_word}'.`);
      setIsCorrectResult(false);
      setSubmitted(true);
      return;
    }

    if (wordCount < 3 || !isLongEnough) {
      setValidationError("Sentence is too short. Please write a complete sentence of at least 3 words and 15 characters.");
      setIsCorrectResult(false);
      setSubmitted(true);
      return;
    }

    if (!isNotJustWord) {
      setValidationError("Please do not copy the word or the instruction itself.");
      setIsCorrectResult(false);
      setSubmitted(true);
      return;
    }

    setValidationError("");
    setIsCorrectResult(true);
    setSubmitted(true);
  };

  // ── Matching Game ──
  const handleSpellingClick = (spelling: string) => {
    if (submitted || matchedSpellings.has(spelling)) return;
    
    if (selectedSpelling === spelling) {
      setSelectedSpelling(null);
      return;
    }
    setSelectedSpelling(spelling);
    
    if (selectedTranslation) {
      checkMatch(spelling, selectedTranslation);
    }
  };

  const handleTranslationClick = (translation: string) => {
    if (submitted || matchedTranslations.has(translation)) return;
    
    if (selectedTranslation === translation) {
      setSelectedTranslation(null);
      return;
    }
    setSelectedTranslation(translation);
    
    if (selectedSpelling) {
      checkMatch(selectedSpelling, translation);
    }
  };

  const checkMatch = (sp: string, tr: string) => {
    const pair = data.pairs.find(
      (p: any) => p.spelling.toLowerCase() === sp.toLowerCase() && p.translation.toLowerCase() === tr.toLowerCase()
    );

    if (pair) {
      const nextSpellings = new Set(matchedSpellings);
      nextSpellings.add(sp);
      setMatchedSpellings(nextSpellings);

      const nextTranslations = new Set(matchedTranslations);
      nextTranslations.add(tr);
      setMatchedTranslations(nextTranslations);

      setSelectedSpelling(null);
      setSelectedTranslation(null);
      setFailedPair(null);

      if (nextSpellings.size === data.pairs.length) {
        setSubmitted(true);
        setIsCorrectResult(mistakeCount === 0);
      }
    } else {
      setMistakeCount((prev) => prev + 1);
      setFailedPair({ spelling: sp, translation: tr });
      
      setTimeout(() => {
        setSelectedSpelling(null);
        setSelectedTranslation(null);
        setFailedPair(null);
      }, 500);
    }
  };

  // ── Word Grouping ──
  const handleDropToCategory = (word: string, categoryName: string) => {
    if (submitted) return;
    setUngroupedWords((prev) => prev.filter((w) => w !== word));
    setUserBuckets((prev) => ({
      ...prev,
      [categoryName]: [...(prev[categoryName] || []), word],
    }));
  };

  const handleRemoveFromCategory = (word: string, categoryName: string) => {
    if (submitted) return;
    setUserBuckets((prev) => ({
      ...prev,
      [categoryName]: prev[categoryName].filter((w) => w !== word),
    }));
    setUngroupedWords((prev) => [...prev, word]);
  };

  const handleGroupingSubmit = () => {
    if (submitted) return;
    let allCorrect = true;
    for (const category of data.categories) {
      const correctWords = new Set(category.words.map((w: string) => w.toLowerCase()));
      const userWords = (userBuckets[category.name] || []).map((w: string) => w.toLowerCase());
      if (userWords.length !== correctWords.size) {
        allCorrect = false;
        break;
      }
      for (const uw of userWords) {
        if (!correctWords.has(uw)) {
          allCorrect = false;
          break;
        }
      }
      if (!allCorrect) break;
    }
    setIsCorrectResult(allCorrect);
    setSubmitted(true);
  };

  // ── Odd One Out ──
  const handleOddOneOutSelect = (word: string) => {
    if (submitted) return;
    setSelectedOddWord(word);
    const isCorrect = word.toLowerCase() === data.odd_word.toLowerCase();
    setIsCorrectResult(isCorrect);
    setSubmitted(true);
  };

  // ── Synonym/Antonym ──
  const handleSynAntSubmit = (optionIdx: number) => {
    if (submitted) return;
    setSelectedOption(optionIdx);
    const selected = data.options[optionIdx];
    const isCorrect = selected.toLowerCase() === data.correct_answer.toLowerCase();
    setIsCorrectResult(isCorrect);
    setSubmitted(true);
  };

  // ── Dialogue ──
  const handleDialogueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted || !dialogueInput.trim()) return;
    const normalizeStr = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[.,!?;:'"]/g, "");
    const isCorrect = normalizeStr(dialogueInput).includes(normalizeStr(data.correct_response).slice(0, Math.min(20, normalizeStr(data.correct_response).length)));
    setIsCorrectResult(isCorrect);
    setSubmitted(true);
  };

  // ── Flashcard ──
  const handleFlashcardSubmit = () => {
    if (submitted) return;
    setIsFlipped(true);
    setIsCorrectResult(true);
    setSubmitted(true);
  };

  // ── Quality Submit ──
  const handleQualitySubmit = (quality: number) => {
    let response = "";
    if (type === "mcq" || type === "synonym_antonym") {
      response = selectedOption !== null ? data.options[selectedOption] : "";
    } else if (type === "match") {
      response = `Matched ${data.pairs?.length || 4} pairs with ${mistakeCount} mistakes`;
    } else if (type === "odd_one_out") {
      response = selectedOddWord || "";
    } else if (type === "dialogue") {
      response = dialogueInput;
    } else if (type === "flashcard") {
      response = "Flashcard reviewed";
    } else if (type === "word_grouping") {
      response = JSON.stringify(userBuckets);
    } else {
      response = inputText;
    }
    onSubmit(isCorrectResult, quality, response);
  };

  // ── Feedback message ──
  const getFeedbackMessage = () => {
    if (type === "mcq") {
      return isCorrectResult
        ? "Correct choice!"
        : `Incorrect. The correct option was: '${data.options[data.correct_option]}'.`;
    }
    if (type === "match") {
      return isCorrectResult
        ? "Perfect matching score! All pairs aligned on first attempts."
        : `Matching completed with ${mistakeCount} mistake(s).`;
    }
    if (type === "fill_blank") {
      return isCorrectResult
        ? "Correct spelling match!"
        : `Incorrect spelling. The correct answer is: '${data.blank_value}'.`;
    }
    if (type === "sentence_writing") {
      return isCorrectResult
        ? "Sentence validated successfully."
        : validationError || "Invalid input sentence.";
    }
    if (type === "word_grouping") {
      if (isCorrectResult) return "All words sorted correctly!";
      const correctSorting = data.categories.map((c: any) => `${c.name}: ${c.words.join(", ")}`).join("  |  ");
      return `Some words are in the wrong category. Correct: ${correctSorting}`;
    }
    if (type === "odd_one_out") {
      return isCorrectResult
        ? `Correct! ${data.explanation}`
        : `Incorrect. The odd word was '${data.odd_word}'. ${data.explanation}`;
    }
    if (type === "synonym_antonym") {
      return isCorrectResult
        ? `Correct! '${data.correct_answer}' is a ${data.relationship} of '${data.target_word}'.`
        : `Incorrect. The ${data.relationship} was '${data.correct_answer}'.`;
    }
    if (type === "dialogue") {
      return isCorrectResult
        ? "Good response! It fits the dialogue context."
        : `Expected response: '${data.correct_response}'.`;
    }
    if (type === "flashcard") {
      return "Card reviewed. Rate how well you remembered it.";
    }
    return "";
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl text-slate-100 transition-all duration-300 hover:shadow-indigo-500/5">
      
      {/* Exercise Badge header */}
      <div className="flex justify-between items-center mb-5">
        <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 bg-indigo-950/60 text-indigo-400 rounded-full border border-indigo-900/40 flex items-center gap-1.5 font-mono">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          {EXERCISE_LABELS[type] || type}
        </span>
        
        {submitted && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
            isCorrectResult 
              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
              : "bg-amber-950/40 text-amber-450 border border-amber-900/40"
          }`}>
            {isCorrectResult ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {isCorrectResult ? "Completed Correctly" : "Completed with Mistakes"}
          </span>
        )}
      </div>

      {/* ════════════ MCQ TYPE ════════════ */}
      {type === "mcq" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">
            {data.question}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {data.options.map((option: string, idx: number) => {
              let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 hover:border-slate-700 text-slate-350";
              
              if (submitted) {
                if (idx === data.correct_option) {
                  btnClass = "bg-emerald-950/40 border-emerald-500/60 text-emerald-350 font-medium";
                } else if (idx === selectedOption) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300";
                } else {
                  btnClass = "bg-slate-950/50 border-slate-900 text-slate-650 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleMcqSubmit(idx)}
                  disabled={submitted}
                  className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none flex items-center justify-between cursor-pointer ${btnClass}`}
                >
                  <span>{option}</span>
                  {submitted && idx === data.correct_option && <Check className="w-4 h-4 text-emerald-400 animate-pulse" />}
                  {submitted && idx === selectedOption && idx !== data.correct_option && <X className="w-4 h-4 text-red-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════ MATCHING PUZZLE GRID ════════════ */}
      {type === "match" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200 text-center">
            Match the target vocabulary spellings to their English translations.
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            {/* Left Column: Words */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center mb-1 font-mono">Word</span>
              {shuffledSpellings.map((sp) => {
                const isMatched = matchedSpellings.has(sp);
                const isSelected = selectedSpelling === sp;
                const isFailed = failedPair?.spelling === sp;
                
                let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-300 hover:border-slate-700";
                if (isMatched) {
                  btnClass = "bg-emerald-950/20 border-emerald-900/30 text-emerald-400/80 opacity-60 pointer-events-none";
                } else if (isFailed) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300 ring-2 ring-red-500/30";
                } else if (isSelected) {
                  btnClass = "bg-indigo-950/40 border-indigo-500/80 text-indigo-300 ring-2 ring-indigo-500/20";
                }
                
                return (
                  <button
                    key={sp}
                    type="button"
                    disabled={isMatched || submitted}
                    onClick={() => handleSpellingClick(sp)}
                    className={`w-full text-center p-3 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${btnClass}`}
                  >
                    {sp}
                  </button>
                );
              })}
            </div>

            {/* Right Column: Translations */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block text-center mb-1 font-mono">Translation</span>
              {shuffledTranslations.map((tr) => {
                const isMatched = matchedTranslations.has(tr);
                const isSelected = selectedTranslation === tr;
                const isFailed = failedPair?.translation === tr;
                
                let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 text-slate-300 hover:border-slate-700";
                if (isMatched) {
                  btnClass = "bg-emerald-950/20 border-emerald-900/30 text-emerald-400/80 opacity-60 pointer-events-none";
                } else if (isFailed) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300 ring-2 ring-red-500/30";
                } else if (isSelected) {
                  btnClass = "bg-indigo-950/40 border-indigo-500/80 text-indigo-300 ring-2 ring-indigo-500/20";
                }
                
                return (
                  <button
                    key={tr}
                    type="button"
                    disabled={isMatched || submitted}
                    onClick={() => handleTranslationClick(tr)}
                    className={`w-full text-center p-3 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${btnClass}`}
                  >
                    {tr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ FILL IN THE BLANK ════════════ */}
      {type === "fill_blank" && (
        <form onSubmit={handleFillBlankSubmit} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200 font-mono tracking-wide leading-relaxed">
              {data.sentence_with_blank}
            </h3>
            <p className="text-xs text-slate-400 italic">Clue: {data.context_clue}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              required
              disabled={submitted}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type target word..."
              className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
            {!submitted && (
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition cursor-pointer shrink-0"
              >
                Submit Answer
              </button>
            )}
          </div>
        </form>
      )}

      {/* ════════════ SENTENCE WRITING ════════════ */}
      {type === "sentence_writing" && (
        <form onSubmit={handleSentenceSubmit} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">
              {data.instruction}
            </h3>
            <p className="text-xs text-slate-400">
              Your sentence must contain the word: <strong className="text-indigo-400 font-mono">{data.required_word}</strong>
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <textarea
              required
              disabled={submitted}
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Write your sentence here..."
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition resize-none"
            />
            {!submitted && (
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition cursor-pointer"
              >
                Validate Sentence
              </button>
            )}
          </div>
        </form>
      )}

      {/* ════════════ WORD GROUPING / SORTING ════════════ */}
      {type === "word_grouping" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">
            {data.instruction}
          </h3>

          {/* Ungrouped word pool */}
          {ungroupedWords.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Available Words</span>
              <div className="flex flex-wrap gap-2">
                {ungroupedWords.map((word) => (
                  <span
                    key={word}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 cursor-grab hover:border-indigo-500/50 hover:text-indigo-300 transition-all"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category buckets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.categories.map((cat: any) => (
              <div
                key={cat.name}
                className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 min-h-[80px]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wider font-mono">{cat.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {(userBuckets[cat.name] || []).map((word) => (
                    <button
                      key={word}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleRemoveFromCategory(word, cat.name)}
                      className="px-2.5 py-1 bg-violet-950/30 border border-violet-900/40 rounded-lg text-xs text-violet-300 hover:bg-red-950/30 hover:border-red-500/40 hover:text-red-300 transition-all cursor-pointer"
                    >
                      {word} ×
                    </button>
                  ))}
                </div>
                {/* Drop target buttons from ungrouped */}
                {!submitted && ungroupedWords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ungroupedWords.map((word) => (
                      <button
                        key={`add-${cat.name}-${word}`}
                        type="button"
                        onClick={() => handleDropToCategory(word, cat.name)}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-900/80 border border-dashed border-slate-700 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer"
                      >
                        + {word}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit button */}
          {!submitted && ungroupedWords.length === 0 && (
            <button
              type="button"
              onClick={handleGroupingSubmit}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition cursor-pointer"
            >
              Check Sorting
            </button>
          )}
        </div>
      )}

      {/* ════════════ ODD ONE OUT ════════════ */}
      {type === "odd_one_out" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">
            {data.instruction}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {shuffledOddWords.map((word) => {
              const isOdd = word.toLowerCase() === data.odd_word.toLowerCase();
              let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 hover:border-slate-700 text-slate-300";

              if (submitted) {
                if (isOdd) {
                  btnClass = "bg-emerald-950/40 border-emerald-500/60 text-emerald-350 font-medium";
                } else if (word === selectedOddWord) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300";
                } else {
                  btnClass = "bg-slate-950/50 border-slate-900 text-slate-650 opacity-50";
                }
              }

              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => handleOddOneOutSelect(word)}
                  disabled={submitted}
                  className={`w-full text-center p-3.5 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${btnClass}`}
                >
                  {word}
                  {submitted && isOdd && <Check className="w-3.5 h-3.5 text-emerald-400 inline-block ml-1.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════ SYNONYM / ANTONYM ════════════ */}
      {type === "synonym_antonym" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">
            {data.instruction}
          </h3>
          <p className="text-xs text-slate-400">
            Find the <strong className="text-amber-400">{data.relationship}</strong> of: <strong className="text-indigo-400 font-mono">{data.target_word}</strong>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {data.options.map((option: string, idx: number) => {
              const isCorrectOpt = option.toLowerCase() === data.correct_answer.toLowerCase();
              let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 hover:border-slate-700 text-slate-350";

              if (submitted) {
                if (isCorrectOpt) {
                  btnClass = "bg-emerald-950/40 border-emerald-500/60 text-emerald-350 font-medium";
                } else if (idx === selectedOption) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300";
                } else {
                  btnClass = "bg-slate-950/50 border-slate-900 text-slate-650 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSynAntSubmit(idx)}
                  disabled={submitted}
                  className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${btnClass}`}
                >
                  <span>{option}</span>
                  {submitted && isCorrectOpt && <Check className="w-4 h-4 text-emerald-400 inline-block ml-2" />}
                  {submitted && idx === selectedOption && !isCorrectOpt && <X className="w-4 h-4 text-red-400 inline-block ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════ DIALOGUE COMPLETION ════════════ */}
      {type === "dialogue" && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-teal-400" />
            {data.instruction}
          </h3>

          {/* Dialogue bubbles */}
          <div className="space-y-2.5 mt-4">
            {data.dialogue_lines.map((line: any, idx: number) => {
              const isMissing = idx === data.missing_line_index;
              const isLeftSpeaker = line.speaker === "A";

              return (
                <div key={idx} className={`flex ${isLeftSpeaker ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMissing
                      ? "bg-indigo-950/30 border-2 border-dashed border-indigo-500/50 text-indigo-300"
                      : isLeftSpeaker
                        ? "bg-slate-800/80 text-slate-300 rounded-bl-md"
                        : "bg-teal-950/40 text-teal-200 rounded-br-md border border-teal-900/30"
                  }`}>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{line.speaker}</span>
                    {isMissing ? (
                      submitted ? (
                        <span className="italic">{data.correct_response}</span>
                      ) : (
                        <span className="text-indigo-400 italic">Your response goes here...</span>
                      )
                    ) : (
                      <span>{line.text}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input for the missing line */}
          {!submitted && (
            <form onSubmit={handleDialogueSubmit} className="flex gap-3 pt-2">
              <input
                type="text"
                required
                value={dialogueInput}
                onChange={(e) => setDialogueInput(e.target.value)}
                placeholder="Type the missing line..."
                className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition cursor-pointer shrink-0"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      )}

      {/* ════════════ FLASHCARD ════════════ */}
      {type === "flashcard" && (
        <div className="space-y-4">
          <div
            className="relative w-full min-h-[160px] cursor-pointer perspective-1000"
            onClick={() => !submitted && setIsFlipped(!isFlipped)}
          >
            <div className={`w-full transition-all duration-500 transform-style-preserve-3d ${isFlipped ? "rotate-y-180" : ""}`}>
              {/* Front */}
              <div className={`w-full p-6 rounded-2xl border text-center ${
                isFlipped ? "hidden" : "block"
              } bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block mb-3">Front</span>
                <h3 className="text-lg font-semibold text-slate-200">{data.front}</h3>
                {!showHint && !submitted && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                    className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer transition"
                  >
                    Show Hint
                  </button>
                )}
                {showHint && (
                  <p className="mt-3 text-xs text-amber-400 italic bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
                    💡 {data.hint}
                  </p>
                )}
                <p className="mt-4 text-[10px] text-slate-600">Click to flip</p>
              </div>

              {/* Back */}
              <div className={`w-full p-6 rounded-2xl border text-center ${
                isFlipped ? "block" : "hidden"
              } bg-gradient-to-br from-emerald-950/20 to-slate-950 border-emerald-900/30`}>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-mono block mb-3">Back</span>
                <h3 className="text-lg font-semibold text-emerald-300">{data.back}</h3>
                {data.hint && (
                  <p className="mt-3 text-xs text-slate-400 italic">
                    💡 {data.hint}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Flip + Confirm */}
          {!submitted && (
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Flip Card
              </button>
              {isFlipped && (
                <button
                  type="button"
                  onClick={handleFlashcardSubmit}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition cursor-pointer"
                >
                  I've Reviewed This
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════ FEEDBACK & SM-2 QUALITY RATING ════════════ */}
      {submitted && (
        <div className="mt-6 border-t border-slate-800/80 pt-5 space-y-4">
          
          {/* Answer Key / Verification status message */}
          <div className={`p-4 rounded-xl text-xs flex gap-2.5 border ${
            isCorrectResult 
              ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-350"
              : "bg-red-950/20 border-red-900/30 text-red-300"
          }`}>
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <div>
              <span>{getFeedbackMessage()}</span>
            </div>
          </div>

          {/* SM-2 Buttons Grid */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col items-center justify-center gap-1 text-center">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest font-mono">Rate recall difficulty</span>
              <p className="text-[9px] text-slate-550">Grades help schedule future review dates</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => handleQualitySubmit(1)}
                className="px-2.5 py-3 rounded-xl text-xs font-bold transition-all border bg-red-950/25 border-red-900/35 text-red-400 hover:bg-red-950/40 hover:border-red-500/50 cursor-pointer text-center flex flex-col items-center justify-center gap-0.5"
              >
                <span>Again (1)</span>
                <span className="text-[8px] font-normal text-red-500 font-sans">Forgot / Wrong</span>
              </button>
              <button
                type="button"
                onClick={() => handleQualitySubmit(3)}
                className="px-2.5 py-3 rounded-xl text-xs font-bold transition-all border bg-amber-950/25 border-amber-900/35 text-amber-450 hover:bg-amber-950/40 hover:border-amber-500/50 cursor-pointer text-center flex flex-col items-center justify-center gap-0.5"
              >
                <span>Hard (3)</span>
                <span className="text-[8px] font-normal text-amber-500 font-sans">High effort</span>
              </button>
              <button
                type="button"
                onClick={() => handleQualitySubmit(4)}
                className="px-2.5 py-3 rounded-xl text-xs font-bold transition-all border bg-indigo-950/25 border-indigo-900/35 text-indigo-400 hover:bg-indigo-950/40 hover:border-indigo-500/50 cursor-pointer text-center flex flex-col items-center justify-center gap-0.5"
              >
                <span>Good (4)</span>
                <span className="text-[8px] font-normal text-indigo-500 font-sans">Hesitant</span>
              </button>
              <button
                type="button"
                onClick={() => handleQualitySubmit(5)}
                className="px-2.5 py-3 rounded-xl text-xs font-bold transition-all border bg-emerald-950/25 border-emerald-900/35 text-emerald-450 hover:bg-emerald-950/40 hover:border-emerald-500/50 cursor-pointer text-center flex flex-col items-center justify-center gap-0.5"
              >
                <span>Easy (5)</span>
                <span className="text-[8px] font-normal text-emerald-500 font-sans">Immediate</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
