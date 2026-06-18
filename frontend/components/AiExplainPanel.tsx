import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, Loader2, RefreshCw } from "lucide-react";

interface AiExplainPanelProps {
  wordId: string;
  spelling: string;
  translation: string;
  token: string;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AiExplainPanel({ 
  wordId, spelling, translation, token, onClose 
}: AiExplainPanelProps) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = async () => {
    setExplanation("");
    setLoading(true);
    setError("");
    setDone(false);

    // Cancel previous fetch if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_URL}/ai/words/${wordId}/explain`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate streaming: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      if (!reader) {
        throw new Error("Streaming reader is not supported on this browser.");
      }

      setLoading(false); // First byte received or reader ready
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) {
          setDone(true);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Save the last incomplete line to keep the buffer safe
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const data = cleanLine.substring(6);
            if (data === "[DONE]") {
              setDone(true);
              break;
            }
            setExplanation((prev) => prev + data);
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream fetch aborted successfully.");
        return;
      }
      setError(err.message || "Failed to load AI explanation.");
      setLoading(false);
    }
  };

  useEffect(() => {
    startStreaming();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [wordId]);

  // Clean Markdown Renderer using Regex (renders headings, list items, bold/italic, codes)
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      
      // H3 Headers
      if (cleanLine.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-sm font-bold text-slate-200 mt-4 mb-2 flex items-center gap-1.5 font-display border-b border-slate-800 pb-1">
            {cleanLine.substring(4)}
          </h4>
        );
      }
      
      // H2 Headers
      if (cleanLine.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-base font-bold text-indigo-400 mt-4 mb-2 font-display">
            {cleanLine.substring(3)}
          </h3>
        );
      }

      // H1 Headers
      if (cleanLine.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-lg font-bold tracking-tight text-white mb-3 font-display">
            {cleanLine.substring(2)}
          </h2>
        );
      }

      // List Items
      if (cleanLine.startsWith("* ") || cleanLine.startsWith("- ")) {
        const rawContent = cleanLine.substring(2);
        return (
          <li key={idx} className="text-xs text-slate-300 list-disc ml-5 mb-1.5 leading-relaxed">
            {parseInlineStyles(rawContent)}
          </li>
        );
      }

      // Standard Paragraphs
      if (cleanLine.length > 0) {
        return (
          <p key={idx} className="text-xs text-slate-300 mb-2 leading-relaxed">
            {parseInlineStyles(cleanLine)}
          </p>
        );
      }

      // Empty Lines
      return <div key={idx} className="h-2" />;
    });
  };

  // Parses bold (**), codes (`), and italic (*) inline tags
  const parseInlineStyles = (content: string) => {
    // Basic regex parser mapping
    let parts: React.ReactNode[] = [content];
    
    // Bold parser
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /\*\*(.*?)\*\*/g;
      const subParts = [];
      let lastIdx = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subParts.push(part.substring(lastIdx, match.index));
        subParts.push(<strong key={match.index} className="text-indigo-300 font-semibold">{match[1]}</strong>);
        lastIdx = regex.lastIndex;
      }
      subParts.push(part.substring(lastIdx));
      return subParts;
    });

    // Inline code tag parser
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /`(.*?)`/g;
      const subParts = [];
      let lastIdx = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subParts.push(part.substring(lastIdx, match.index));
        subParts.push(
          <code key={match.index} className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] text-pink-400 font-mono border border-slate-800">
            {match[1]}
          </code>
        );
        lastIdx = regex.lastIndex;
      }
      subParts.push(part.substring(lastIdx));
      return subParts;
    });

    return parts;
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col h-full shadow-2xl relative overflow-hidden">
      {/* Decorative Grid Line */}
      <div className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full bg-indigo-500/5 blur-[50px] pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-950 p-1.5 rounded-lg border border-indigo-900/35">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">AI Insights</h3>
            <p className="text-[10px] text-slate-400">Deep explanations for `{spelling}`</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startStreaming}
            disabled={loading}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-850 transition"
            title="Refresh explanation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-850 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs text-slate-400">Summoning AI context...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950/20 border border-red-900/35 text-red-300 p-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-1">
            {renderMarkdown(explanation)}
            
            {/* Pulsing indicator during stream */}
            {!done && explanation && (
              <span className="inline-block w-2.5 h-4 bg-indigo-500 rounded-sm ml-1 animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {done && (
        <div className="mt-4 border-t border-slate-800/80 pt-3 text-[10px] text-slate-500 text-center shrink-0 flex items-center justify-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-400" />
          AI Analysis completed successfully.
        </div>
      )}
    </div>
  );
}

// Simple internal icon component since X, RefreshCw are from lucide, let's keep Check import helper
function Check(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
