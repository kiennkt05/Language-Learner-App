import React, { useState } from "react";
import { Check, X, AlertCircle, Sparkles } from "lucide-react";

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

export default function ExerciseCard({ exercise, onSubmit }: ExerciseCardProps) {
  const { type, data } = exercise;
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrectResult, setIsCorrectResult] = useState(false);

  const handleMcqSubmit = (optionIdx: number) => {
    if (submitted) return;
    
    setSelectedOption(optionIdx);
    setSubmitted(true);
    
    const isCorrect = optionIdx === data.correct_option;
    setIsCorrectResult(isCorrect);
    
    // Map to SM-2 quality: 5 (Easy/Correct) or 1 (Again/Incorrect)
    const quality = isCorrect ? 5 : 1;
    onSubmit(isCorrect, quality, data.options[optionIdx]);
  };

  const handleFillBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted || !inputText.trim()) return;

    setSubmitted(true);
    const normalizedInput = inputText.trim().toLowerCase();
    const normalizedCorrect = data.blank_value.trim().toLowerCase();
    
    const isCorrect = normalizedInput === normalizedCorrect;
    setIsCorrectResult(isCorrect);
    
    const quality = isCorrect ? 5 : 1;
    onSubmit(isCorrect, quality, inputText.trim());
  };

  const handleSentenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted || !inputText.trim()) return;

    setSubmitted(true);
    const normalizedInput = inputText.trim().toLowerCase();
    const required = data.required_word.trim().toLowerCase();
    
    // Check if user sentence contains the required word
    const isCorrect = normalizedInput.includes(required);
    setIsCorrectResult(isCorrect);
    
    // Sentence writing requires review, but we auto-score based on keyword inclusion
    const quality = isCorrect ? 4 : 1;
    onSubmit(isCorrect, quality, inputText.trim());
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl text-slate-100 transition-all duration-300 hover:shadow-indigo-500/5">
      
      {/* Exercise Badge header */}
      <div className="flex justify-between items-center mb-5">
        <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 bg-indigo-950/60 text-indigo-400 rounded-full border border-indigo-900/40 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" />
          {type === "mcq" && "Multiple Choice"}
          {type === "match" && "Matching Test"}
          {type === "fill_blank" && "Fill-in-the-Blank"}
          {type === "sentence_writing" && "Sentence Production"}
        </span>
        
        {submitted && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
            isCorrectResult 
              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"
              : "bg-red-950/40 text-red-400 border border-red-900/40"
          }`}>
            {isCorrectResult ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            {isCorrectResult ? "Correct" : "Incorrect"}
          </span>
        )}
      </div>

      {/* MULTIPLE CHOICE / MATCH QUESTION TYPE */}
      {(type === "mcq" || type === "match") && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-200">
            {type === "mcq" ? data.question : `Match translation for spelling: '${data.spelling}'`}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {data.options.map((option: string, idx: number) => {
              let btnClass = "bg-slate-950 border-slate-850 hover:bg-slate-900 hover:border-slate-700 text-slate-300";
              
              if (submitted) {
                if (idx === data.correct_option) {
                  btnClass = "bg-emerald-950/40 border-emerald-500/60 text-emerald-300 font-medium";
                } else if (idx === selectedOption) {
                  btnClass = "bg-red-950/40 border-red-500/60 text-red-300";
                } else {
                  btnClass = "bg-slate-950/50 border-slate-900 text-slate-500 opacity-60";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleMcqSubmit(idx)}
                  disabled={submitted}
                  className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none flex items-center justify-between cursor-pointer ${btnClass}`}
                >
                  <span>{option}</span>
                  {submitted && idx === data.correct_option && <Check className="w-4 h-4 text-emerald-400" />}
                  {submitted && idx === selectedOption && idx !== data.correct_option && <X className="w-4 h-4 text-red-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FILL IN THE BLANK TYPE */}
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

          {submitted && !isCorrectResult && (
            <div className="flex items-start gap-2 bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs text-slate-400">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Correct answer was: <strong className="text-emerald-400">{data.blank_value}</strong>
              </span>
            </div>
          )}
        </form>
      )}

      {/* SENTENCE WRITING PRODUCTION TYPE */}
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

          {submitted && (
            <div className="flex items-start gap-2 bg-slate-950 border border-slate-850 p-3.5 rounded-xl text-xs text-slate-400 leading-relaxed">
              <AlertCircle className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                {isCorrectResult ? (
                  <span>Excellent! Your sentence contains the target word.</span>
                ) : (
                  <span>
                    Incorrect. Your sentence did not contain the keyword: <strong className="text-red-400">{data.required_word}</strong>.
                  </span>
                )}
              </div>
            </div>
          )}
        </form>
      )}

    </div>
  );
}
