"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, Plus, Trash2, Upload, LogOut, Search, 
  FileSpreadsheet, ArrowLeft, Loader2, Key, Mail, 
  AlertCircle, CheckCircle, Globe, Sparkles, Volume2
} from "lucide-react";
import AiExplainPanel from "../components/AiExplainPanel";
import ReviewSession from "../components/ReviewSession";

// API Base URL config
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Word {
  id: string;
  spelling: string;
  translation: string;
  definition: string | null;
  example_sentence: string | null;
  created_at: string;
}

interface VocabList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  words: Word[];
}

export default function Home() {
  // Authentication State
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Vocab Lists State
  const [lists, setLists] = useState<VocabList[]>([]);
  const [selectedList, setSelectedList] = useState<VocabList | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [listLoading, setListLoading] = useState(false);

  // Word Management State
  const [newWordSpelling, setNewWordSpelling] = useState("");
  const [newWordTranslation, setNewWordTranslation] = useState("");
  const [newWordDef, setNewWordDef] = useState("");
  const [newWordEx, setNewWordEx] = useState("");
  const [wordSearch, setWordSearch] = useState("");
  const [wordLoading, setWordLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [activeExplainWord, setActiveExplainWord] = useState<{ id: string; spelling: string; translation: string } | null>(null);
  const [activeReviewSession, setActiveReviewSession] = useState<{ id: string | null; name: string } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("vocab_token");
    if (savedToken) {
      setToken(savedToken);
      fetchLists(savedToken);
      fetchStats(savedToken);
    }
  }, []);

  // Fetch all vocabulary lists
  const fetchLists = async (authToken: string) => {
    setListLoading(true);
    try {
      const res = await fetch(`${API_URL}/vocab/lists`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLists(data);
        // Refresh selected list details if active
        if (selectedList) {
          const updated = data.find((l: VocabList) => l.id === selectedList.id);
          if (updated) {
            setSelectedList(updated);
          }
        }
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to fetch lists", err);
    } finally {
      setListLoading(false);
    }
  };

  // Fetch overall statistics
  const fetchStats = async (authToken: string) => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_URL}/vocab/stats`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // On-demand TTS play
  const playWordAudio = async (wordId: string, spelling: string) => {
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

  // Authenticate (Login or Register)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    const path = isRegister ? "/auth/register" : "/auth/login-json";
    const body = isRegister 
      ? JSON.stringify({ email, password })
      : JSON.stringify({ email, password });

    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      if (isRegister) {
        setAuthSuccess("Account created successfully! Switching to Login.");
        setIsRegister(false);
        setPassword("");
      } else {
        localStorage.setItem("vocab_token", data.access_token);
        setToken(data.access_token);
        fetchLists(data.access_token);
        fetchStats(data.access_token);
      }
    } catch (err: any) {
      setAuthError(err.message || "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Google Login mock/dev handler
  const handleGoogleLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      // Send a mock token string
      const randomToken = Math.random().toString(36).substring(7);
      const res = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: `mock-google-token-${randomToken}` })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google authentication failed");
      }
      localStorage.setItem("vocab_token", data.access_token);
      setToken(data.access_token);
      fetchLists(data.access_token);
      fetchStats(data.access_token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("vocab_token");
    setToken(null);
    setLists([]);
    setSelectedList(null);
    setStats(null);
    setEmail("");
    setPassword("");
    setAuthSuccess("");
    setAuthError("");
    setActiveExplainWord(null);
  };

  // Create List
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !token) return;

    try {
      const res = await fetch(`${API_URL}/vocab/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newListName, description: newListDesc })
      });
      if (res.ok) {
        setNewListName("");
        setNewListDesc("");
        fetchLists(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete List
  const handleDeleteList = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !confirm("Are you sure you want to delete this list?")) return;

    try {
      const res = await fetch(`${API_URL}/vocab/lists/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (selectedList?.id === id) {
          setSelectedList(null);
        }
        fetchLists(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Word to Selected List
  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !newWordSpelling.trim() || !newWordTranslation.trim() || !token) return;

    setWordLoading(true);
    try {
      const res = await fetch(`${API_URL}/vocab/lists/${selectedList.id}/words`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          spelling: newWordSpelling,
          translation: newWordTranslation,
          definition: newWordDef || null,
          example_sentence: newWordEx || null
        })
      });
      if (res.ok) {
        setNewWordSpelling("");
        setNewWordTranslation("");
        setNewWordDef("");
        setNewWordEx("");
        fetchLists(token);
        fetchStats(token);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWordLoading(false);
    }
  };

  // Delete Word from List
  const handleDeleteWord = async (wordId: string) => {
    if (!selectedList || !token) return;

    try {
      const res = await fetch(`${API_URL}/vocab/lists/${selectedList.id}/words/${wordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchLists(token);
        fetchStats(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CSV File upload handler
  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setCsvError("");
    setCsvSuccess("");

    if (!selectedList || !csvFile || !token) {
      setCsvError("Please select a valid CSV file first.");
      return;
    }

    setCsvLoading(true);
    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await fetch(`${API_URL}/vocab/lists/${selectedList.id}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload CSV.");
      }
      setCsvSuccess(data.message || "CSV parsed and imported successfully.");
      setCsvFile(null);
      // Reset file input element
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchLists(token);
      fetchStats(token);
    } catch (err: any) {
      setCsvError(err.message || "An error occurred parsing the CSV.");
    } finally {
      setCsvLoading(false);
    }
  };

  // Filter words based on search query
  const filteredWords = selectedList?.words.filter(
    (w) =>
      w.spelling.toLowerCase().includes(wordSearch.toLowerCase()) ||
      w.translation.toLowerCase().includes(wordSearch.toLowerCase())
  ) || [];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-6xl z-10">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/30">
              <BookOpen className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                VocabFlow
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">AI-Powered Language Spaced Repetition</p>
            </div>
          </div>

          {token && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </header>

        {/* AUTHENTICATION VIEW */}
        {!token ? (
          <div className="max-w-md mx-auto my-12">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl shadow-slate-950/50">
              <h2 className="text-2xl font-display font-bold text-center mb-6">
                {isRegister ? "Create an Account" : "Sign In to VocabFlow"}
              </h2>

              {authError && (
                <div className="flex items-start gap-3 bg-red-950/50 border border-red-900/50 text-red-200 p-3.5 rounded-xl mb-5 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="flex items-start gap-3 bg-emerald-950/50 border border-emerald-900/50 text-emerald-200 p-3.5 rounded-xl mb-5 text-sm">
                  <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>{authSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                >
                  {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRegister ? "Sign Up" : "Sign In"}
                </button>
              </form>

              <div className="relative my-6 text-center">
                <hr className="border-slate-800" />
                <span className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-[#0d1527] px-3 text-xs text-slate-500">
                  OR DEVELOPER ACCESS
                </span>
              </div>

              {/* Developer Google Auth Quick Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-755 border border-slate-700 disabled:opacity-50 text-slate-200 transition cursor-pointer font-medium text-sm"
              >
                <Globe className="w-4 h-4 text-indigo-400" />
                Google Fast Sign In (Mock)
              </button>

              <p className="text-center mt-6 text-xs text-slate-400">
                {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setAuthError("");
                    setAuthSuccess("");
                  }}
                  className="text-indigo-400 hover:underline font-semibold"
                >
                  {isRegister ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </div>
        ) : (
          /* APP MAIN VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* SIDEBAR / VOCAB LIST MANAGEMENT */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-5">
                <h2 className="text-lg font-display font-bold mb-4 text-slate-300 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Your Vocab Lists
                </h2>

                {/* Create List Form */}
                <form onSubmit={handleCreateList} className="space-y-3 mb-5">
                  <input
                    type="text"
                    required
                    placeholder="List Name (e.g., German A1)"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <input
                    type="text"
                    placeholder="Description (Optional)"
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create List
                  </button>
                </form>

                {/* Lists Render */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {listLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  ) : lists.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No lists created yet.</p>
                  ) : (
                    lists.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => { setSelectedList(l); setActiveExplainWord(null); }}
                        className={`flex justify-between items-center p-3 rounded-xl border text-left cursor-pointer transition ${
                          selectedList?.id === l.id
                            ? "bg-indigo-950/40 border-indigo-500/80"
                            : "bg-slate-950/20 border-slate-850 hover:bg-slate-900/30"
                        }`}
                      >
                        <div className="truncate pr-2">
                          <h3 className="font-semibold text-sm text-slate-200 truncate">{l.name}</h3>
                          {l.description && (
                            <p className="text-xs text-slate-400 truncate">{l.description}</p>
                          )}
                          <span className="inline-block text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded mt-1">
                            {l.words?.length || 0} words
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteList(l.id, e)}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* DETAILS & ACTIONS PANEL */}
            <div className="lg:col-span-8 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {selectedList ? (
                <>
                  <div className={`${activeExplainWord ? "xl:col-span-7" : "xl:col-span-12"} space-y-6 bg-slate-900/30 backdrop-blur-md border border-slate-800 rounded-2xl p-6 transition-all duration-300`}>
                  {/* List Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                      <button
                        onClick={() => setSelectedList(null)}
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition mb-2"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        Back to dashboard
                      </button>
                      <h2 className="text-xl font-display font-bold text-slate-100">{selectedList.name}</h2>
                      <p className="text-xs text-slate-400">{selectedList.description || "No description provided."}</p>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setActiveReviewSession({ id: selectedList.id, name: selectedList.name })}
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-650/20 transition cursor-pointer font-sans"
                      >
                        Start Review Session
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Add Word Sub-form */}
                    <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        Add Single Word
                      </h3>
                      <form onSubmit={handleAddWord} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <input
                              type="text"
                              required
                              placeholder="Spelling"
                              value={newWordSpelling}
                              onChange={(e) => setNewWordSpelling(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              required
                              placeholder="Translation"
                              value={newWordTranslation}
                              onChange={(e) => setNewWordTranslation(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Definition (Optional)"
                          value={newWordDef}
                          onChange={(e) => setNewWordDef(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                        <input
                          type="text"
                          placeholder="Example Sentence (Optional)"
                          value={newWordEx}
                          onChange={(e) => setNewWordEx(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                        <button
                          type="submit"
                          disabled={wordLoading}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition border border-slate-700 cursor-pointer"
                        >
                          {wordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Save Word
                        </button>
                      </form>
                    </div>

                    {/* CSV Upload Section */}
                    <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          Import CSV List
                        </h3>
                        <p className="text-[10px] text-slate-400 mb-3">
                          Expected headers: <strong>spelling, translation, definition, example_sentence</strong>. Limit is 100 lines.
                        </p>

                        {csvError && (
                          <p className="text-red-400 text-[10px] bg-red-950/30 p-1.5 rounded border border-red-900/30 mb-2">
                            {csvError}
                          </p>
                        )}
                        {csvSuccess && (
                          <p className="text-emerald-400 text-[10px] bg-emerald-950/30 p-1.5 rounded border border-emerald-900/30 mb-2">
                            {csvSuccess}
                          </p>
                        )}
                      </div>

                      <form onSubmit={handleCsvUpload} className="space-y-3">
                        <input
                          id="csv-file-input"
                          type="file"
                          accept=".csv"
                          required
                          onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                          className="block w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-300 file:cursor-pointer hover:file:bg-slate-750 transition"
                        />
                        <button
                          type="submit"
                          disabled={csvLoading || !csvFile}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-650 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-md"
                        >
                          {csvLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          Upload & Process
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Words List */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <h3 className="text-sm font-bold text-slate-300">Words ({filteredWords.length})</h3>
                      {/* Search Bar */}
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search spelling or translation..."
                          value={wordSearch}
                          onChange={(e) => setWordSearch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl py-1.5 pl-8 pr-3.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>

                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                      {filteredWords.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No words found matching search.</p>
                      ) : (
                        <div className="divide-y divide-slate-850 max-h-[350px] overflow-y-auto">
                          {filteredWords.map((w) => (
                            <div key={w.id} className="flex justify-between items-start p-3 hover:bg-slate-900/20 transition">
                              <div className="space-y-1 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong className="text-sm text-indigo-400 font-semibold">{w.spelling}</strong>
                                  <button
                                    onClick={() => playWordAudio(w.id, w.spelling)}
                                    className="text-slate-500 hover:text-indigo-400 transition p-1 hover:bg-slate-900/80 rounded"
                                    title="Play pronunciation"
                                  >
                                    <Volume2 className={`w-3.5 h-3.5 ${playingWordId === w.id ? "animate-bounce text-indigo-400" : ""}`} />
                                  </button>
                                  <span className="text-xs text-slate-500">—</span>
                                  <span className="text-sm text-slate-200">{w.translation}</span>
                                </div>
                                {w.definition && (
                                  <p className="text-xs text-slate-400 italic">Def: {w.definition}</p>
                                )}
                                {w.example_sentence && (
                                  <p className="text-xs text-slate-500 font-mono">Ex: &quot;{w.example_sentence}&quot;</p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0 mt-0.5">
                                <button
                                  onClick={() => setActiveExplainWord({ id: w.id, spelling: w.spelling, translation: w.translation })}
                                  className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-900 transition"
                                  title="AI Insights"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteWord(w.id)}
                                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {activeExplainWord && (
                    <div className="xl:col-span-5 h-[480px]">
                      <AiExplainPanel
                        wordId={activeExplainWord.id}
                        spelling={activeExplainWord.spelling}
                        translation={activeExplainWord.translation}
                        token={token || ""}
                        onClose={() => setActiveExplainWord(null)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="xl:col-span-12 space-y-6">
                  {/* Stats Dashboard Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Streak Card */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/35 transition duration-300">
                      <div className="absolute top-0 right-0 w-[80px] h-[80px] rounded-full bg-orange-500/5 blur-[30px] pointer-events-none" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-display">Review Streak</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-orange-400 font-display">🔥 {stats?.streak || 0}</span>
                        <span className="text-xs text-slate-450">days</span>
                      </div>
                      <p className="text-[10px] text-slate-450 mt-2 font-sans">Keep reviewing daily to preserve your streak!</p>
                    </div>

                    {/* Accuracy Card */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/35 transition duration-300">
                      <div className="absolute top-0 right-0 w-[80px] h-[80px] rounded-full bg-emerald-500/5 blur-[30px] pointer-events-none" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-display">Recall Accuracy</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-emerald-400 font-display">🎯 {stats?.accuracy || 0}%</span>
                      </div>
                      <p className="text-[10px] text-slate-455 mt-2 font-sans">Target above 85% for optimal retention.</p>
                    </div>

                    {/* Mastery Card */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/35 transition duration-300 col-span-1 md:col-span-2">
                      <div className="absolute top-0 right-0 w-[100px] h-[100px] rounded-full bg-indigo-500/5 blur-[40px] pointer-events-none" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-display">Vocabulary Mastery</span>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <span className="text-[10px] text-slate-550 font-semibold font-display">Mastered</span>
                          <p className="text-base font-bold text-indigo-400">{stats?.mastery_counts?.mastered || 0}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-550 font-semibold font-display">Learning</span>
                          <p className="text-base font-bold text-purple-400">{stats?.mastery_counts?.learning || 0}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-550 font-semibold font-display">Unstarted</span>
                          <p className="text-base font-bold text-slate-400">{stats?.mastery_counts?.unstarted || 0}</p>
                        </div>
                      </div>
                      {/* Segmented Progress Bar */}
                      <div className="w-full bg-slate-950 border border-slate-850 h-2.5 rounded-full overflow-hidden p-[2px] mt-2.5 flex">
                        {stats?.mastery_counts?.total > 0 ? (
                          <>
                            <div 
                              className="bg-indigo-500 h-full rounded-l-full transition-all duration-350" 
                              style={{ width: `${(stats.mastery_counts.mastered / stats.mastery_counts.total) * 100}%` }}
                              title="Mastered"
                            />
                            <div 
                              className="bg-purple-500 h-full transition-all duration-350" 
                              style={{ width: `${(stats.mastery_counts.learning / stats.mastery_counts.total) * 100}%` }}
                              title="Learning"
                            />
                            <div 
                              className="bg-slate-700 h-full rounded-r-full transition-all duration-350" 
                              style={{ width: `${(stats.mastery_counts.unstarted / stats.mastery_counts.total) * 100}%` }}
                              title="Unstarted"
                            />
                          </>
                        ) : (
                          <div className="w-full bg-slate-850 h-full rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Forecast Forecast Row */}
                  <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/35 transition duration-300">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-display">Spaced Repetition Forecast</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                      <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                        <span className="text-[10px] text-slate-400">Due Now</span>
                        <p className="text-lg font-bold text-slate-200 mt-0.5">{stats?.forecast?.due_now || 0}</p>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                        <span className="text-[10px] text-slate-400">Next 24h</span>
                        <p className="text-lg font-bold text-slate-200 mt-0.5">{stats?.forecast?.due_today || 0}</p>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                        <span className="text-[10px] text-slate-400">Next 7 Days</span>
                        <p className="text-lg font-bold text-slate-200 mt-0.5">{stats?.forecast?.due_this_week || 0}</p>
                      </div>
                      <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
                        <span className="text-[10px] text-slate-400">Next 30 Days</span>
                        <p className="text-lg font-bold text-slate-200 mt-0.5">{stats?.forecast?.due_this_month || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Selection Callout */}
                  <div className="bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[200px]">
                    <BookOpen className="w-10 h-10 text-slate-650 mb-3 stroke-1 animate-pulse" />
                    <h3 className="text-sm font-semibold text-slate-400 mb-1 font-display">Select a Vocabulary List</h3>
                    <p className="text-xs text-slate-500 max-w-sm font-sans">
                      Select a vocabulary list from the sidebar or create a new one to manage your words and start learning.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
      {activeReviewSession && (
        <ReviewSession
          listId={activeReviewSession.id}
          listName={activeReviewSession.name}
          token={token || ""}
          onClose={() => setActiveReviewSession(null)}
          onSessionComplete={() => {
            if (token) fetchLists(token);
          }}
        />
      )}
    </main>
  );
}
