"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  displayContent?: string; // What the user sees (optional, defaults to actualContent)
  actualContent: string;   // What is sent to the LLM
}

interface FloatingChatProps {
  token: string | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  // Expose a way for parent to trigger a new message (e.g. AI Insight)
  externalTriggerMessage: ChatMessage | null;
  clearExternalTrigger: () => void;
}

export default function FloatingChat({
  token,
  isOpen,
  setIsOpen,
  externalTriggerMessage,
  clearExternalTrigger,
}: FloatingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (externalTriggerMessage) {
      if (!isOpen) setIsOpen(true);
      handleSendMessage(externalTriggerMessage);
      clearExternalTrigger();
    }
  }, [externalTriggerMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (customMessage?: ChatMessage) => {
    const messageToSend = customMessage || {
      id: Date.now().toString(),
      role: "user" as const,
      actualContent: input.trim(),
    };

    if (!messageToSend.actualContent && !customMessage) return;

    if (!customMessage) {
      setInput("");
    }

    setMessages((prev) => [...prev, messageToSend]);
    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const chatHistory = [...messages, messageToSend].map((m) => ({
        role: m.role,
        content: m.actualContent,
      }));

      const response = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: chatHistory }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        throw new Error("Streaming not supported");
      }

      setIsLoading(false); // First byte received
      const assistantMessageId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", actualContent: "" },
      ]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const data = cleanLine.substring(6);
            if (data === "[DONE]") {
              break;
            }
            
            let textData = data;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content !== undefined) {
                textData = parsed.content;
              }
            } catch (e) {
              if (textData === "\\n") {
                textData = "\n";
              }
            }
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, actualContent: msg.actualContent + textData }
                  : msg
              )
            );
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            actualContent: "Sorry, I encountered an error. Please try again.",
          },
        ]);
      }
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 z-50 flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[550px] max-w-[calc(100vw-3rem)] h-[650px] max-h-[calc(100vh-3rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-950 p-1.5 rounded-lg border border-indigo-900/35">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">AI Assistant</h3>
            <p className="text-[10px] text-slate-400">Powered by VocabFlow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <MessageCircle className="w-8 h-8 text-indigo-400" />
            <p className="text-sm text-slate-300">
              How can I help you with your language learning today?
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm overflow-hidden ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm shadow-md"
                  : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700 shadow-md"
              }`}
            >
              {msg.role === "user" ? (
                msg.displayContent || msg.actualContent
              ) : (
                <div className="text-sm leading-relaxed max-w-full break-words
                  [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-indigo-300 [&>h1]:mb-4 [&>h1]:mt-6 [&>h1:first-child]:mt-0
                  [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-indigo-300 [&>h2]:mb-3 [&>h2]:mt-5 [&>h2:first-child]:mt-0
                  [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-indigo-300 [&>h3]:mb-2 [&>h3]:mt-4 [&>h3:first-child]:mt-0
                  [&>p]:mb-4 [&>p]:last:mb-0
                  [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ul>li]:mb-1 [&>ul]:marker:text-slate-500
                  [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4 [&>ol>li]:mb-1 [&>ol]:marker:text-slate-500
                  [&>blockquote]:border-l-4 [&>blockquote]:border-indigo-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-slate-400 [&>blockquote]:mb-4 [&>blockquote]:bg-slate-900/50 [&>blockquote]:py-2 [&>blockquote]:rounded-r-lg
                  [&_strong]:font-bold [&_strong]:text-indigo-200
                  [&_em]:italic
                  [&_code]:bg-slate-900 [&_code]:text-indigo-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs [&_code]:border [&_code]:border-slate-700
                  [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:border [&_pre]:border-slate-700
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-300 [&_pre_code]:border-0 [&_pre_code]:text-sm
                  [&_table]:w-full [&_table]:mb-4 [&_table]:text-left [&_table]:border-collapse [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap
                  [&_th]:bg-slate-900 [&_th]:p-3 [&_th]:border [&_th]:border-slate-700 [&_th]:font-semibold [&_th]:text-slate-300
                  [&_td]:p-3 [&_td]:border [&_td]:border-slate-700 [&_td]:text-slate-400
                  [&_tr:hover_td]:bg-slate-800/50
                  [&_a]:text-indigo-400 [&_a]:underline [&_a]:hover:text-indigo-300 [&_a]:transition-colors">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.actualContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-sm border border-slate-700 px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-4 pr-12 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            disabled={isLoading && !messages.length} // Disable only if it's the very first message loading
          />
          <button
            type="submit"
            disabled={!input.trim() || (isLoading && !messages.length)}
            className="absolute right-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
