import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Volume2, X } from 'lucide-react';
import { executeCommand } from '../lib/api';

const QUICK_PROMPTS = [
  "Build a parking lot",
  "Convert parking to permeable pavers",
  "Install rain gardens"
];

export default function VoiceCommandBar({
  activeSiteId,
  rainfallMm,
  edits,
  onCommandResult
}) {
  const recognitionRef = useRef(null);
  const contextVersion = useRef(0);
  useEffect(() => { contextVersion.current++; return () => { contextVersion.current++; recognitionRef.current?.abort(); }; }, [activeSiteId, rainfallMm, edits]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState('');
  const hasSpeechSupport = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  const handleStartListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in this browser. You can type your command!");
      return;
    }

    if (isListening) { recognitionRef.current?.stop(); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setLastMessage('Voice transcribed. Review the text, then choose Apply.');
    };

    recognition.onerror = () => {
      setLastMessage('Voice input unavailable or microphone access denied. Type your command instead.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSendCommand = async (commandToRun) => {
    const text = commandToRun || inputText;
    if (!text.trim()) return;

    if (loading) return;
    const version = contextVersion.current;
    setLoading(true);
    try {
      const res = await executeCommand({
        command: text,
        site_id: activeSiteId,
        current_rainfall_mm: rainfallMm,
        current_edits: edits
      });

      if (version !== contextVersion.current) return;
      if (res && res.success) {
        setLastMessage(res.message);
        if (onCommandResult) {
          onCommandResult(res);
        }
      } else {
        setLastMessage(res?.message || 'Command not recognized. Try a quick prompt.');
      }
    } catch (err) {
      console.error('Command failed:', err);
      setLastMessage('Failed to parse command. Try one of the quick prompts below.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="command-composer">
      
      {/* Input Row */}
      <div className="command-row">
        
        
        <div className="command-input-wrap">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            aria-label="Describe a neighborhood change"
            placeholder="e.g. Add rain gardens"
            className="w-full pl-3 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
          />
          {inputText && (
            <button
              onClick={() => setInputText('')}
              aria-label="Clear command"
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Voice Button */}
        <button
          onClick={handleStartListening}
          disabled={!hasSpeechSupport || loading}
          aria-label={isListening ? 'Stop voice input' : 'Dictate a change'}
          className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all shrink-0 ${
            isListening
              ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-lg shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title={isListening ? 'Listening...' : 'Click to speak'}
        >
          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
        </button>

        {/* Send Button */}
        <button
          aria-label="Apply described change"
          onClick={() => handleSendCommand()}
          disabled={loading || !inputText.trim()}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-cyan-600/20 transition-all shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Apply</span>
        </button>
      </div>

      {/* Quick Prompts + Feedback */}
      <div className="command-prompts">
        <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">Try:</span>
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            disabled={loading}
            onClick={() => {
              setInputText(prompt);
              handleSendCommand(prompt);
            }}
            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950/70 hover:bg-cyan-950/50 text-slate-400 hover:text-cyan-300 border border-slate-800/60 hover:border-cyan-800 transition-all truncate"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Feedback Banner */}
      {lastMessage && (
        <div role="status" className="command-feedback px-3 py-2 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-200 flex items-center gap-2 animate-fadeIn">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{lastMessage}</span>
          <button aria-label="Dismiss command feedback" onClick={() => setLastMessage('')} className="ml-auto text-cyan-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

    </div>
  );
}
