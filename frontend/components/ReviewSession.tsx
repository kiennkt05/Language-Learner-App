import React, { useState, useEffect } from "react";
import { X, Award, CheckCircle2, AlertCircle, Loader2, Sparkles, RefreshCw, ArrowRight, BookOpen, Volume2 } from "lucide-react";
import ExerciseCard from "./ExerciseCard";

interface Exercise {
  id: string;
  word_id: string;
  type: string;
  data: any;
  created_at: string;
}

interface Card {
  card_id: string;
  word_id: string;
  spelling: string;
  translation: string;
  definition: string | null;
  example_sentence: string | null;
  repetitions: number;
  interval: number;
  ease_factor: number;
  exercises: Exercise[];
}

interface ReviewSessionProps {
  listId: string | null;
  listName: string;
  token: string;
  onClose: () => void;
  onSessionComplete: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReviewSession({
  listId,
  listName,
  token,
  onClose,
  onSessionComplete
}: ReviewSessionProps) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);

  // Active Session State
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [exerciseSubmitted, setExerciseSubmitted] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Session Statistics
  const [answersLog, setAnswersLog] = useState<{
    spelling: string;
    translation: string;
    type: string;
    isCorrect: boolean;
  }[]>([]);

  const fetchSessionCards = async () => {
    setLoading(true);
    setError("");
    try {
      const url = listId 
        ? `${API_URL}/vocab/srs/session?list_id=${listId}`
        : `${API_URL}/vocab/srs/session`;
        
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error("Failed to load session queue.");
      }
      
      const data = await res.json();
      setCards(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionCards();
  }, [listId]);

  // Dev Tool: Reset Review Dates
  const handleResetDates = async () => {
    setResetting(true);
    setError("");
    try {
      const url = listId
        ? `${API_URL}/vocab/srs/reset-dates?list_id=${listId}`
        : `${API_URL}/vocab/srs/reset-dates`;
        
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error("Failed to reset review dates.");
      }
      
      // Refetch cards
      await fetchSessionCards();
    } catch (err: any) {
      setError(err.message || "Failed to reset dates.");
    } finally {
      setResetting(false);
    }
  };

  const handleExerciseSubmit = async (isCorrect: boolean, quality: number, response: string) => {
    if (submittingAnswer) return;

    const currentCard = cards[currentCardIdx];
    const exercises = currentCard.exercises;
    const currentExercise = exercises[currentExerciseIdx];

    setSubmittingAnswer(true);
    setExerciseSubmitted(true);

    // Update local statistics log
    setAnswersLog((prev) => [
      ...prev,
      {
        spelling: currentCard.spelling,
        translation: currentCard.translation,
        type: currentExercise.type,
        isCorrect
      }
    ]);

    try {
      const res = await fetch(`${API_URL}/vocab/srs/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          card_id: currentCard.card_id,
          exercise_id: currentExercise.id,
          quality,
          response
        })
      });

      if (!res.ok) {
        console.error("Failed to submit review log to backend.");
      }
    } catch (err) {
      console.error("Network error submitting review:", err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleNext = () => {
    const currentCard = cards[currentCardIdx];
    const exercises = currentCard.exercises;

    // Check if there are more exercises on the current card
    if (currentExerciseIdx < exercises.length - 1) {
      setCurrentExerciseIdx((prev) => prev + 1);
      setExerciseSubmitted(false);
    } else {
      // Move to next card
      if (currentCardIdx < cards.length - 1) {
        setCurrentCardIdx((prev) => prev + 1);
        setCurrentExerciseIdx(0);
        setExerciseSubmitted(false);
      } else {
        // Session finished
        setSessionCompleted(true);
      }
    }
  };

  const playReviewAudio = async (wordId: string, spelling: string) => {
    setPlayingWordId(wordId);
    try {
      const res = await fetch(`${API_URL}/vocab/words/${wordId}/audio`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const data = await res.json();
        const audioUrl = data.audio_url;
        const absoluteUrl = audioUrl.startsWith("http") 
          ? audioUrl 
          : `${API_URL}${audioUrl}`;
          
        const audio = new Audio(absoluteUrl);
        audio.play();
        audio.onended = () => setPlayingWordId(null);
      } else {
        setPlayingWordId(null);
      }
    } catch (err) {
      console.error(err);
      setPlayingWordId(null);
    }
  };

  // Calculate global progress stats
  const totalExercises = cards.reduce((acc, c) => acc + (c.exercises?.length || 0), 0);
  const completedExercises = answersLog.length;
  const progressPercent = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
  
  const correctCount = answersLog.filter((l) => l.isCorrect).length;
  const accuracy = completedExercises > 0 ? Math.round((correctCount / completedExercises) * 100) : 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center gap-4 text-slate-100">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-sm font-medium tracking-wide">Preparing review queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold">Error Loading Session</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchSessionCards}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle empty queue (All cards reviewed)
  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px]" />
        </div>

        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative z-10">
          <div className="bg-indigo-950/60 text-indigo-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-indigo-900/40">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-display font-bold">All Caught Up! 🎉</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No vocabulary cards due for review in <strong>{listName}</strong>. Keep up the excellent work!
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs shadow-md transition cursor-pointer"
            >
              Return to Dashboard
            </button>
            
            {/* Developer Fast Reset Button */}
            <button
              onClick={handleResetDates}
              disabled={resetting}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl font-semibold text-xs transition border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {resetting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Reset Review Dates (Dev Tool)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Summary View
  if (sessionCompleted) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto flex flex-col items-center justify-start p-4 md:p-8 text-slate-100">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px]" />
        </div>

        <div className="max-w-2xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 my-8">
          <div className="text-center space-y-3 mb-8">
            <div className="bg-indigo-950/60 text-indigo-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto border border-indigo-900/40 shadow-lg shadow-indigo-500/10">
              <Award className="w-8 h-8 animate-bounce" />
            </div>
            <h2 className="text-2xl font-display font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Session Complete!
            </h2>
            <p className="text-xs text-slate-400">
              You reviewed {cards.length} card{cards.length > 1 ? "s" : ""} from <strong>{listName}</strong>
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Reviewed</span>
              <p className="text-xl font-bold text-slate-200 mt-1">{completedExercises}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Correct</span>
              <p className="text-xl font-bold text-emerald-450 mt-1">{correctCount}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Accuracy</span>
              <p className="text-xl font-bold text-indigo-400 mt-1">{accuracy}%</p>
            </div>
          </div>

          {/* Detailed Log Table */}
          <div className="space-y-3 mb-8">
            <h3 className="text-sm font-bold text-slate-350 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Review Breakdown
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 max-h-[250px] overflow-y-auto">
              <div className="divide-y divide-slate-850">
                {answersLog.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-200">{log.spelling}</strong>
                        <span className="text-slate-500">—</span>
                        <span className="text-slate-400">{log.translation}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">
                        {log.type === "mcq" ? "Multiple Choice" : "Fill-in-the-Blank"}
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      log.isCorrect 
                        ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" 
                        : "bg-red-950/40 text-red-400 border border-red-900/30"
                    }`}>
                      {log.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onSessionComplete();
              onClose();
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Active review session UI
  const currentCard = cards[currentCardIdx];
  const exercises = currentCard.exercises;
  const currentExercise = exercises && exercises[currentExerciseIdx];

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto flex flex-col p-4 md:p-8 text-slate-100">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px]" />
      </div>

      <div className="max-w-2xl w-full mx-auto relative z-10 flex-1 flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-950 border border-indigo-900/40 rounded-xl text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-200">Reviewing {listName}</h2>
              <p className="text-[10px] text-slate-400">Spaced repetition loop active</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="my-6 shrink-0 space-y-2">
          <div className="flex justify-between text-xs text-slate-400 px-1 font-semibold">
            <span>Card {currentCardIdx + 1} of {cards.length}</span>
            <span>Question {completedExercises + 1} of {totalExercises}</span>
          </div>
          <div className="w-full bg-slate-900 border border-slate-850 h-2.5 rounded-full overflow-hidden p-[2px]">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card Hint Info */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/40 border border-slate-850/60 flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-indigo-400 tracking-wider uppercase">Active Word Hint</span>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-200">{currentCard.translation}</span>
              {currentCard.definition && (
                <span className="text-xs text-slate-400">— {currentCard.definition}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => playReviewAudio(currentCard.word_id, currentCard.spelling)}
            className="text-slate-450 hover:text-indigo-400 transition p-2 bg-slate-950/60 border border-slate-850 rounded-xl hover:scale-105"
            title="Listen pronunciation"
          >
            <Volume2 className={`w-4 h-4 ${playingWordId === currentCard.word_id ? "animate-bounce text-indigo-400" : ""}`} />
          </button>
        </div>

        {/* Active Exercise Component */}
        <div className="flex-1 flex flex-col justify-center py-4">
          {currentExercise ? (
            <ExerciseCard
              key={`${currentCard.card_id}-${currentExercise.id}`}
              exercise={currentExercise}
              onSubmit={handleExerciseSubmit}
            />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="text-xs text-slate-400">
                No interactive exercises found for card `{currentCard.spelling}`.
              </p>
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold"
              >
                Skip Card
              </button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-slate-850 flex justify-end shrink-0">
          {exerciseSubmitted && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              {currentCardIdx === cards.length - 1 && currentExerciseIdx === exercises.length - 1
                ? "Finish Session"
                : "Next Question"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
