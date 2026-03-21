import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, User, Send, PlusCircle, Copy, Check, Camera, Video } from 'lucide-react';
import Header from '../components/Header';
// ... (Keep existing Type definitions for Web Speech API from App.tsx)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart?: () => void;
  onaudiostart?: () => void;
  onsoundstart?: () => void;
  onspeechstart?: () => void;
  onspeechend?: () => void;
  onsoundend?: () => void;
  onaudioend?: () => void;
  onnomatch?: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Global types defined in src/types.d.ts

interface ChatMessage {
  type: 'user' | 'ai' | 'context';
  text: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
}

interface PromptDefaults {
  interviewerId?: string;
  meId?: string;
}

interface CodeEnvironmentConfig {
  primaryLanguage?: string;
  secondaryLanguages?: string;
  enableSyntaxHighlighting?: boolean;
  enableErrorDetection?: boolean;
  enableCompletionSuggestions?: boolean;
}

const renderInlineMarkdown = (text: string) => {
  const parts: (string | React.ReactNode)[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`i-${key}`}>{token.slice(1, -1)}</em>);
    }
    key += 1;
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const renderMessageText = (text: string) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentList: string[] = [];
  let inList = false;
  let key = 0;

  const flushList = () => {
    if (!inList || currentList.length === 0) return;
    const listItems = currentList.map((item, index) => (
      <li key={`li-${key}-${index}`}>{renderInlineMarkdown(item)}</li>
    ));
    blocks.push(
      <ul key={`ul-${key}`}>
        {listItems}
      </ul>
    );
    key += 1;
    currentList = [];
    inList = false;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^[-*]\s+(.*)$/);
    if (match) {
      inList = true;
      currentList.push(match[1]);
    } else if (trimmed.length === 0) {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key}`}>
          {renderInlineMarkdown(line)}
        </p>
      );
      key += 1;
    }
  });

  flushList();

  if (blocks.length === 0) {
    return <p>{renderInlineMarkdown(text)}</p>;
  }

  return blocks;
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [speakerMode, setSpeakerMode] = useState<'interviewer' | 'me'>('interviewer');
  
  // ... (rest of state)
  const speakerModeRef = useRef(speakerMode);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    speakerModeRef.current = speakerMode;
  }, [speakerMode]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
      const savedSession = localStorage.getItem('current_session_messages');
      return savedSession ? JSON.parse(savedSession) : [];
  });
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showCodeBlocks, setShowCodeBlocks] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + K: Clear chat
      if (isCmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        handleNewSession();
      }

      // Ctrl/Cmd + L: Toggle code block
      if (isCmdOrCtrl && e.key === 'l') {
        e.preventDefault();
        setShowCodeBlocks(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCaptureScreen = async () => {
    const hasPermission = localStorage.getItem('screen_capture_permission') === 'true';
    if (!hasPermission) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Screen capture permission is not granted. Please enable it in Settings.' }]);
      return;
    }

    if (window.electron && window.electron.captureScreen) {
      setIsCapturing(true);
      try {
        const screenshotData = await window.electron.captureScreen();
        if (screenshotData) {
          setMessages(prev => [...prev, { type: 'context', text: '[Screen Captured: Analyzing puzzle/question...]' }]);
          analyzeImage(screenshotData);
        }
      } catch (err) {
        console.error("Screen capture error:", err);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const handleAnalyzeVideoScreen = async () => {
    const hasPermission = localStorage.getItem('screen_capture_permission') === 'true';
    if (!hasPermission) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Screen capture permission is not granted. Please enable it in Settings.' }]);
      return;
    }

    const apiKey = (localStorage.getItem('openai_api_key') || '').trim();
    const rawBaseUrl = localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1';
    const baseUrl = rawBaseUrl.trim();
    const model = (localStorage.getItem('openai_model') || 'gpt-4o').trim();

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Please configure your API Key in Settings.' }]);
      return;
    }

    if (!window.electron || !window.electron.captureScreen || !window.electron.askAI) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Video analysis is only available in the desktop app.' }]);
      return;
    }

    setIsAnalyzingVideo(true);
    setLoading(true);
    setMessages(prev => [...prev, { type: 'context', text: '[Video Analysis: Capturing screen frames...]' }]);

    try {
      const frames: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const frame = await window.electron.captureScreen();
        if (frame) {
          frames.push(frame);
        }
        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 900));
        }
      }

      if (frames.length === 0) {
        setMessages(prev => [...prev, { type: 'ai', text: 'Could not capture frames for video analysis.' }]);
        return;
      }

      const imageParts = frames.flatMap((frame, idx) => ([
        { type: 'text', text: `Frame ${idx + 1}:` },
        { type: 'image_url', image_url: { url: frame } }
      ]));

      const answer = await window.electron.askAI({
        apiKey,
        baseUrl,
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze these sequential frames from my screen as a short video. Explain what is happening over time and give concise interview help based on the visible content.' },
              ...imageParts
            ]
          }
        ],
        systemPrompt: 'You are a fast visual reasoning assistant for live interviews. Extract key text, detect timeline/context across frames, and provide concise actionable guidance.'
      });

      setMessages(prev => [...prev, { type: 'ai', text: answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, { type: 'ai', text: 'Error analyzing video: ' + message }]);
    } finally {
      setLoading(false);
      setIsAnalyzingVideo(false);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setLoading(true);
    
    // Get config from localStorage - use the same logic as getAIResponse
    const apiKey = (localStorage.getItem('openai_api_key') || '').trim();
    const rawBaseUrl = localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1';
    const baseUrl = rawBaseUrl.trim();
    const model = (localStorage.getItem('openai_model') || 'gpt-4o').trim();
    const resume = localStorage.getItem('user_resume') || '';

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Please configure your API Key in Settings.' }]);
      setLoading(false);
      return;
    }

    try {
      // Get Code Analysis prompt from settings if available
      const promptConfigRaw = localStorage.getItem('prompt_templates');
      let systemPrompt = 'You are an expert technical interviewer. I will provide you with a screenshot of a puzzle, code task, or question. Please extract the text and solve it concisely.';
      
      if (promptConfigRaw) {
        try {
          const parsed = JSON.parse(promptConfigRaw) as { prompts?: PromptTemplate[] };
          const list = parsed.prompts || [];
          // Look for a prompt with "Analysis" in the name
          const analysisPrompt = list.find(p => p.name.toLowerCase().includes('analysis') || p.category.toLowerCase().includes('analysis'));
          if (analysisPrompt && analysisPrompt.content) {
            systemPrompt = analysisPrompt.content;
          }
        } catch (e) {
          console.error("Error loading analysis prompt:", e);
        }
      }

      if (resume) {
        systemPrompt = systemPrompt.replace('{{RESUME}}', resume);
      } else {
        systemPrompt = systemPrompt.replace('{{RESUME}}', '(no resume provided)');
      }

      // Include chat history for context
      const history = messages.map(m => {
        const role: 'user' | 'assistant' = m.type === 'ai' ? 'assistant' : 'user';
        return { role, content: m.text };
      });
      
      // Check if Electron askAI is available
      if (window.electron && window.electron.askAI) {
        const answer = await window.electron.askAI({
          apiKey,
          baseUrl,
          model,
          messages: [
            ...history,
            { 
              role: 'user', 
              content: [
                { type: 'text', text: 'Analyze this screenshot in the context of our interview. If it is a coding task or question, please solve it.' },
                { type: 'image_url', image_url: { url: base64Image } }
              ] 
            }
          ],
          systemPrompt
        });
        setMessages(prev => [...prev, { type: 'ai', text: answer }]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Image analysis error:", err);
      setMessages(prev => [...prev, { type: 'ai', text: 'Error analyzing screen: ' + message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  // Persist current session on every message change
  useEffect(() => {
      if (messages.length > 0) {
          localStorage.setItem('current_session_messages', JSON.stringify(messages));
      } else {
          // If explicitly cleared (new session), remove it
          const saved = localStorage.getItem('current_session_messages');
          if (saved && JSON.parse(saved).length === 0) {
             localStorage.removeItem('current_session_messages');
          }
      }
  }, [messages]);

  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // For visualizer
  
  // Initialize from localStorage
    const [useWhisperFallback, setUseWhisperFallback] = useState(() => {
        // Default to FALSE (inbuilt speech) if not set.
        const stored = localStorage.getItem('use_whisper_stt');
        return stored === 'true'; 
    });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveTranscriptBufferRef = useRef('');
  const transcriptPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTranscribingChunkRef = useRef(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resolveTranscriptionConfig = () => {
    const chatApiKey = (localStorage.getItem('openai_api_key') || '').trim();
    const chatBaseUrl = (localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1').trim();
    const chatModel = (localStorage.getItem('openai_model') || 'gpt-4o').trim();
    const whisperApiKey = (localStorage.getItem('whisper_api_key') || '').trim();
    const whisperBaseUrl = (localStorage.getItem('whisper_base_url') || '').trim();
    const whisperModel = (localStorage.getItem('whisper_model') || 'whisper-1').trim();
    const transcriptionProvider = localStorage.getItem('transcription_provider') || 'openai';

    const apiKey = whisperApiKey || chatApiKey;
    let baseUrl = whisperBaseUrl;
    const model = whisperModel || chatModel;

    if (!baseUrl) {
      if (transcriptionProvider === 'openrouter') {
        baseUrl = chatBaseUrl || 'https://openrouter.ai/api/v1';
      } else if (transcriptionProvider === 'openai') {
        baseUrl = chatBaseUrl || 'https://api.openai.com/v1';
      } else if (transcriptionProvider === 'gemini') {
        baseUrl = chatBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      } else {
        baseUrl = chatBaseUrl || 'https://api.openai.com/v1';
      }
    }

    return { apiKey, baseUrl, model, transcriptionProvider };
  };

  const finalizeTranscriptChunk = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const currentMode = speakerModeRef.current;
    if (currentMode === 'interviewer') {
      setMessages(prev => [...prev, { type: 'user', text: trimmed }]);
    } else {
      setMessages(prev => [...prev, { type: 'context', text: trimmed }]);
    }
    getAIResponse(trimmed);
  };

  const queueTranscriptFinalize = () => {
    if (transcriptPauseTimerRef.current) {
      clearTimeout(transcriptPauseTimerRef.current);
    }

    transcriptPauseTimerRef.current = setTimeout(() => {
      const buffered = liveTranscriptBufferRef.current.trim();
      if (!buffered) return;

      liveTranscriptBufferRef.current = '';
      setCurrentTranscript('');
      finalizeTranscriptChunk(buffered);
    }, 1500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentTranscript]);

  // Save to history on unmount or when messages change significantly
  useEffect(() => {
    return () => {
        // We don't necessarily want to save to history on unmount anymore
        // because we are persisting the "active session".
        // History saving should be manual or explicit "End Session".
        // However, if we want to keep a backup:
        if (messages.length > 0) {
            // saveSessionToHistory(); // Disabling auto-save to history to prevent duplicates.
        }
    };
  }, []); 

  /*
  const saveSessionToHistory = () => {
      if (messages.length === 0) return;
      
      const historyItem = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          messages: messages
      };
      
      const saved = localStorage.getItem('interview_history');
      let history = saved ? JSON.parse(saved) : [];
      history.push(historyItem);
      localStorage.setItem('interview_history', JSON.stringify(history));
  };
  */

  const handleNewSession = () => {
      // In Electron, confirm might be blocking or weird, so we can force it or use a custom modal.
      // For now, let's assume confirm works or just do it if message count > 0.
      if (messages.length > 0) {
          // Force save to history immediately
          const historyItem = {
              id: Date.now().toString(),
              date: new Date().toISOString(),
              messages: messages
          };
          
          const saved = localStorage.getItem('interview_history');
          const history = saved ? JSON.parse(saved) : [];
          history.push(historyItem);
          localStorage.setItem('interview_history', JSON.stringify(history));
          
          // Clear current session
          setMessages([]);
          localStorage.removeItem('current_session_messages');
          
          // Reset state without reloading
          setCurrentTranscript('');
          setManualInput('');
          setAudioLevel(0);
          
          // Optionally restart recording if it was active, but usually new session starts paused or ready.
          // If we want to fully reset, we just clear messages.
      } else {
          setMessages([]);
          localStorage.removeItem('current_session_messages');
          setCurrentTranscript('');
          setManualInput('');
      }
  };

  const startWhisperRecording = async () => {
      const { apiKey } = resolveTranscriptionConfig();
      
      if (!apiKey) {
          const msg = 'Error: No API Key found. For reliable speech recognition in the desktop app, please configure an OpenAI API Key in Settings.';
          console.error(msg);
          setMessages(prev => [...prev, { type: 'ai', text: msg }]);
          setIsRecording(false);
          return;
      }

      try {
          const selectedMicId = localStorage.getItem('selected_mic_id');
          const constraints = { 
              audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true 
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = mediaRecorder;
          
          // Audio Visualizer Setup
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64; // Small size for performance
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const updateVisualizer = () => {
              if (!isRecordingRef.current) {
                  audioContext.close();
                  return;
              }
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setAudioLevel(avg); // 0-255
              requestAnimationFrame(updateVisualizer);
          };
          updateVisualizer();
          liveTranscriptBufferRef.current = '';
          setCurrentTranscript('');

          mediaRecorder.ondataavailable = async (e) => {
              if (e.data.size > 0) {
                  console.log(`[Audio Debug] Chunk received. Size: ${e.data.size} bytes. Type: ${e.data.type}`);
              } else {
                  console.warn("[Audio Debug] Received empty audio chunk.");
              }

              if (e.data.size > 0 && isRecordingRef.current && window.electron && window.electron.transcribeAudio) {
                  if (isTranscribingChunkRef.current) {
                      return;
                  }

                  isTranscribingChunkRef.current = true;
                  try {
                      const arrayBuffer = await e.data.arrayBuffer();
                      const uint8Array = new Uint8Array(arrayBuffer);
                      const { apiKey, baseUrl, model, transcriptionProvider } = resolveTranscriptionConfig();

                      if (!apiKey) {
                          console.warn("No API Key available for Transcription.");
                          return;
                      }

                      const text = await window.electron.transcribeAudio({
                          apiKey,
                          baseUrl,
                          audioBuffer: uint8Array,
                          provider: transcriptionProvider,
                          model
                      });

                      const trimmed = (text || '').trim();
                      if (!trimmed) {
                          return;
                      }

                      const previous = liveTranscriptBufferRef.current.trim();
                      const next = previous ? `${previous} ${trimmed}` : trimmed;
                      liveTranscriptBufferRef.current = next;
                      setCurrentTranscript(next);
                      queueTranscriptFinalize();
                  } catch (err) {
                      console.error("Whisper Error:", err);
                  } finally {
                      isTranscribingChunkRef.current = false;
                  }
              }
          };

          mediaRecorder.start(1200);
          setIsListening(true);

      } catch (err) {
          console.error("Failed to start Whisper recording:", err);
          setIsRecording(false);
      }
  };

  const stopWhisperRecording = () => {
      if (transcriptPauseTimerRef.current) {
          clearTimeout(transcriptPauseTimerRef.current);
          transcriptPauseTimerRef.current = null;
      }
      const buffered = liveTranscriptBufferRef.current.trim();
      if (buffered) {
          liveTranscriptBufferRef.current = '';
          setCurrentTranscript('');
          finalizeTranscriptChunk(buffered);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop(); // This triggers final dataavailable
      }
      setIsListening(false);
      
      // Stop all tracks
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setAudioLevel(0);
  };

  const getAIResponse = async (userText: string) => {
    setLoading(true);
    
    // Get config from localStorage
    const apiKey = (localStorage.getItem('openai_api_key') || '').trim();
    const rawBaseUrl = localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1';
    const baseUrl = rawBaseUrl.trim();
    const model = (localStorage.getItem('openai_model') || 'gpt-4o').trim();
    const resume = localStorage.getItem('user_resume') || '';

    console.log("Fetching AI response with:", { apiKey: apiKey ? 'Found' : 'Missing', baseUrl, model, text: userText });

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Please configure your API Key in Settings.' }]);
      setLoading(false);
      return;
    }

    try {
      const mode: 'interviewer' | 'me' = speakerModeRef.current === 'me' ? 'me' : 'interviewer';

      const codeEnvRaw = localStorage.getItem('code_env_config');
      let codeEnvText = '';
      if (codeEnvRaw) {
        try {
          const env = JSON.parse(codeEnvRaw) as CodeEnvironmentConfig;
          const parts: string[] = [];
          if (env.primaryLanguage) {
            parts.push(`Primary language: ${env.primaryLanguage}.`);
          }
          if (env.secondaryLanguages) {
            parts.push(`Other languages: ${env.secondaryLanguages}.`);
          }
          const features: string[] = [];
          if (env.enableSyntaxHighlighting) {
            features.push('syntax-aware code output');
          }
          if (env.enableErrorDetection) {
            features.push('error detection and debugging hints');
          }
          if (env.enableCompletionSuggestions) {
            features.push('completion-style code suggestions');
          }
          if (features.length > 0) {
            parts.push(`When analyzing code, emphasize ${features.join(', ')}.`);
          }
          codeEnvText = parts.join(' ');
        } catch {
          codeEnvText = '';
        }
      }

      const promptConfigRaw = localStorage.getItem('prompt_templates');
      let systemPrompt = '';
      if (promptConfigRaw) {
        try {
          const parsed = JSON.parse(promptConfigRaw) as { prompts?: PromptTemplate[]; defaults?: PromptDefaults };
          const list = parsed.prompts || [];
          const defaults = parsed.defaults || {};
          const desiredId = mode === 'interviewer' ? defaults.interviewerId : defaults.meId;
          if (desiredId) {
            const template = list.find(p => p.id === desiredId);
            if (template && template.content) {
              systemPrompt = template.content;
            }
          }
        } catch {
          systemPrompt = '';
        }
      }

      if (!systemPrompt) {
        if (mode === 'interviewer') {
          systemPrompt = 
            'You are an expert interview coach.\n\n' +
            'Your role is to listen to the live interview and help the candidate.\n' +
            'Look at both the interview transcript and any captured code or puzzles in the chat history.\n' +
            'When you receive messages tagged as Interviewer, respond with a direct, polished answer the candidate can say.\n' +
            'When you receive messages tagged as Me, briefly critique the answer and suggest improvements.\n' +
            'Be concise and prioritize information from the candidate resume below.\n' +
            'Candidate Resume:\n{{RESUME}}';
        } else {
          systemPrompt =
            'You are an AI assistant helping the user ask questions and solve interview and coding tasks.\n' +
            'Respond directly to the user with clear, concise answers.\n' +
            'You have access to the full chat history, including interview transcripts and captured code/screenshots.\n' +
            'When relevant, provide code examples and short explanations.\n' +
            'Assume the user is preparing for technical interviews.\n' +
            'Candidate Resume:\n{{RESUME}}';
        }
      }

      if (resume) {
        systemPrompt = systemPrompt.replace('{{RESUME}}', resume);
      } else {
        systemPrompt = systemPrompt.replace('{{RESUME}}', '(no resume provided)');
      }

      if (codeEnvText) {
        systemPrompt += `\n\nCode Environment:\n${codeEnvText}`;
      }

      let answer = '';

      const apiMessages = messages.map(m => {
        if (mode === 'interviewer') {
          const role: 'user' | 'assistant' = m.type === 'ai' ? 'assistant' : 'user';
          let content = m.text;
          if (m.type === 'user') {
            content = `Interviewer: ${m.text}`;
          } else if (m.type === 'context') {
            content = `Me: ${m.text}`;
          }
          return { role, content };
        }
        const role: 'user' | 'assistant' = m.type === 'ai' ? 'assistant' : 'user';
        return { role, content: m.text };
      });

      if (mode === 'interviewer') {
        apiMessages.push({ role: 'user', content: `Interviewer: ${userText}` });
      } else {
        apiMessages.push({ role: 'user', content: userText });
      }

      if (window.electron && window.electron.askAI) {
        // Use Electron IPC (No CORS)
        answer = await window.electron.askAI({
          apiKey,
          baseUrl,
          model,
          messages: apiMessages,
          systemPrompt
        });
      } else {
        // Web Mode Fallback
        
        // Handle Gemini specifically in Web Mode
        if (model.includes('gemini') || baseUrl.includes('googleapis.com')) {
             const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
             // Default to gemini-1.5-flash if model not specified correctly
             const geminiModel = model.includes('gemini') ? model : 'gemini-1.5-flash';
             const url = `${cleanBaseUrl}/models/${geminiModel}:generateContent?key=${apiKey}`;
             
             // Map messages to Gemini format
             const contents = apiMessages.map(msg => ({
                 role: msg.role === 'assistant' ? 'model' : 'user',
                 parts: [{ text: msg.content }]
             }));
             
             const body = {
                 contents: contents,
                 system_instruction: { parts: [{ text: systemPrompt }] }
             };
             
             const response = await fetch(url, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(body)
             });
             
             if (!response.ok) {
                 const err = await response.json().catch(() => ({}));
                 throw new Error(err.error?.message || response.statusText);
             }
             const data = await response.json();
             answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
             
        } else {
            // OpenAI / Standard Logic via fetch
            let fetchUrl = baseUrl;
            if (window.location.hostname === 'localhost' && baseUrl.includes('api.openai.com')) {
               if (baseUrl === 'https://api.openai.com/v1') {
                   fetchUrl = '/v1';
               }
            }

            const url = `${fetchUrl.replace(/\/+$/, '')}/chat/completions`;

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt } as const,
                  ...apiMessages
                ],
              }),
            });

            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              throw new Error(err.error?.message || response.statusText);
            }

            const data = await response.json();
            answer = data.choices?.[0]?.message?.content || 'No response';
        }
      }

      console.log("AI Response:", answer);
      setMessages(prev => [...prev, { type: 'ai', text: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { type: 'ai', text: 'Error: ' + message }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initSpeech = async () => {
      // Explicitly request microphone access first
      try {
        const selectedMicId = localStorage.getItem('selected_mic_id');
        await navigator.mediaDevices.getUserMedia({ 
            audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true 
        });
      } catch (err) {
        console.error("Microphone access denied:", err);
        setMessages(prev => [...prev, { type: 'ai', text: 'Error: Microphone access denied. Please allow microphone access in your system settings.' }]);
        setIsRecording(false);
        return;
      }

      // Initialize Web Speech API (Chrome-style)
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition() as unknown as SpeechRecognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log("Speech recognition started (onstart)");
            setIsListening(true);
        };
        
        recognition.onaudiostart = () => console.log("Audio capturing started (onaudiostart)");
        recognition.onsoundstart = () => console.log("Sound detected (onsoundstart)");
        recognition.onspeechstart = () => console.log("Speech detected (onspeechstart)");
        recognition.onspeechend = () => console.log("Speech ended (onspeechend)");
        recognition.onsoundend = () => console.log("Sound ended (onsoundend)");
        recognition.onaudioend = () => console.log("Audio capturing ended (onaudioend)");
        recognition.onnomatch = () => console.log("No match found (onnomatch)");

        recognition.onend = () => {
          console.log("Speech recognition ended (onend)");
          setIsListening(false);
          // Only restart if we are still supposed to be recording
          if (isRecordingRef.current) {
              // Add a delay to prevent rapid restart loops (especially after 'aborted' error)
              setTimeout(() => {
                  if (isRecordingRef.current) {
                      try { 
                          console.log("Attempting to restart recognition...");
                          // Use the local instance to ensure we restart the correct one
                          recognition.start(); 
                      } catch (e) {
                          console.log("Restart prevented (likely already started):", e);
                      }
                  }
              }, 1000);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                setMessages(prev => [...prev, { type: 'ai', text: 'Error: Microphone access denied.' }]);
                setIsRecording(false);
            } else if (event.error === 'network') {
                console.warn("Network error detected. Switching to Whisper fallback automatically.");
                // Automatically switch to Whisper fallback if network fails (Electron issue)
                if (!useWhisperFallback) {
                    setUseWhisperFallback(true);
                    // Persist this choice for this session? Maybe not permanent to avoid lock-in
                    // localStorage.setItem('use_whisper_stt', 'true'); 
                    
                    setMessages(prev => [...prev, { 
                        type: 'ai', 
                        text: 'Notice: Network speech recognition failed (common in Electron). Switched to Whisper API automatically. If you have not set an API Key in Settings, this will not work.' 
                    }]);

                    // Stop current recognition attempt
                    try { recognition.stop(); } catch { void 0; }
                    setIsListening(false);
                    
                    return; 
                }
            } else if (event.error === 'no-speech') {
                // Ignore no-speech errors, just let it restart via onend
                return;
            } else if (event.error === 'aborted') {
                 console.warn("Recognition aborted. Will attempt restart if recording is active.");
            }
            setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          // Robust mapping as requested by user, while maintaining our logic
          const fullTranscript = Array.from(event.results)
              .map((result: SpeechRecognitionResult) => result[0].transcript)
              .join('');
          console.log('Full Transcript History:', fullTranscript);

          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          
          console.log("Transcript Update:", { interim, final });
          setCurrentTranscript(interim || final); // Show final if interim is empty

          if (final) {
             const finalTrimmed = final.trim();
             console.log("Final transcript processing:", finalTrimmed);
             if (finalTrimmed) {
                 // Logic based on speaker mode using REF
                 const currentMode = speakerModeRef.current;
                 console.log("Current Speaker Mode:", currentMode);

                 if (currentMode === 'interviewer') {
                     setMessages(prev => [...prev, { type: 'user', text: finalTrimmed }]);
                     getAIResponse(finalTrimmed);
                 } else {
                     // If 'me', add to context AND get a critique/response
                     setMessages(prev => [...prev, { type: 'context', text: finalTrimmed }]);
                     getAIResponse(finalTrimmed); // Now requesting AI response for 'me' too
                 }
                 setCurrentTranscript('');
             }
          }
        };

        recognitionRef.current = recognition;
        if (isRecordingRef.current) {
            try { recognition.start(); } catch (e) { console.error("Start error", e); }
        }
      } else {
          setMessages(prev => [...prev, { type: 'ai', text: 'Error: Web Speech API not supported in this browser/environment.' }]);
      }
    };

    initSpeech();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Toggle recording manually
  useEffect(() => {
    if (isRecording) {
      if (useWhisperFallback) {
        startWhisperRecording();
      } else {
        try { recognitionRef.current?.start(); } catch { void 0; }
      }
    } else {
      if (useWhisperFallback) {
        stopWhisperRecording();
      } else {
        try { recognitionRef.current?.stop(); } catch { void 0; }
      }
    }
  }, [isRecording, useWhisperFallback]);


  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const handleSend = () => {
      if (!manualInput.trim()) return;
      
      const text = manualInput.trim();
      console.log("Manual Send:", text); // Debugging
      
      if (speakerMode === 'interviewer') {
          setMessages(prev => [...prev, { type: 'user', text: text }]);
      } else {
          setMessages(prev => [...prev, { type: 'context', text: text }]);
      }
      getAIResponse(text);
      setManualInput('');
  };

  return (
    <>
      <Header title={
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <PlusCircle 
              size={20} 
              style={{cursor: 'pointer', color: '#00f3ff'}} 
              onClick={handleNewSession}
              aria-label="New Session (Ctrl+K)"
            />
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}} onClick={() => setSpeakerMode(speakerMode === 'interviewer' ? 'me' : 'interviewer')}>
                Live Interview
                {isListening ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                        <div style={{
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: '#00ff9d',
                            boxShadow: `0 0 ${5 + (audioLevel/5)}px #00ff9d`
                        }} title="Listening..."></div>
                        {/* Audio Visualizer Bar */}
                        <div style={{
                            width: '40px',
                            height: '4px',
                            background: '#333',
                            borderRadius: '2px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, (audioLevel / 50) * 100)}%`,
                                height: '100%',
                                background: audioLevel > 10 ? '#00ff9d' : '#555',
                                transition: 'width 0.1s ease'
                            }}></div>
                        </div>
                    </div>
                ) : (
                    <span style={{
                        display: 'inline-block', 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: '#555'
                    }} title="Not Listening"></span>
                )}
            </div>
        </div>
      } />

      <div className="main-content">
        {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.type === 'context' ? 'user context' : msg.type}`}>
                <h4>
                    <span>
                        {msg.type === 'ai'
                          ? 'AI'
                          : speakerMode === 'me'
                            ? 'Me'
                            : msg.type === 'user'
                              ? 'Interviewer'
                              : 'Me'}
                    </span>
                    <button 
                        onClick={() => handleCopy(msg.text, idx)}
                        className="copy-button"
                        title="Copy text"
                    >
                        {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </h4>
                <div className={`chat-text ai-answer ${!showCodeBlocks ? 'hide-code' : ''}`}>
                  {renderMessageText(msg.text)}
                </div>
            </div>
        ))}
        
        {loading && (
            <div className="chat-bubble ai">
                <h4>Thinking...</h4>
                <div className="pulse-dot"></div>
            </div>
        )}

        <div ref={messagesEndRef} style={{marginBottom: '80px'}} />

        {/* Floating Controls */}
        <div className="floating-controls">
            <div className="speaker-toggle">
                <button 
                    className={speakerMode === 'interviewer' ? 'active' : ''}
                    onClick={() => setSpeakerMode('interviewer')}
                >
                    <Monitor size={16} /> Interviewer
                </button>
                <button 
                    className={speakerMode === 'me' ? 'active' : ''}
                    onClick={() => setSpeakerMode('me')}
                >
                    <User size={16} /> Me
                </button>
            </div>
            
            <div className="transcript-preview" style={{
                textAlign: 'center', 
                minHeight: '20px',
                fontSize: '0.9rem',
                color: '#00ff9d',
                textShadow: '0 0 5px rgba(0,255,157,0.5)',
                marginBottom: '5px'
            }}>
                {currentTranscript || (isRecording ? "Listening..." : "")}
            </div>

            <button 
                className={`fab-mic ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
            >
                {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            
            <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '0',
                right: '0',
                padding: '10px',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                gap: '8px',
                marginBottom: '10px',
                borderRadius: '8px'
            }}>
                <input 
                    type="text" 
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={speakerMode === 'interviewer' ? "Type interviewer's question..." : "Type your question for the AI..."}
                    style={{
                        flex: 1,
                        background: '#333',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        padding: '8px',
                        color: '#fff',
                        outline: 'none'
                    }}
                />
                <button 
                    onClick={handleCaptureScreen}
                    title="Read Screen / Solve Puzzle"
                    style={{
                        background: 'rgba(0, 243, 255, 0.1)',
                        border: '1px solid #00f3ff',
                        borderRadius: '4px',
                        padding: '0 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isCapturing ? '#ff5555' : '#00f3ff',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Camera size={20} className={isCapturing ? 'pulse' : ''} />
                </button>
                <button
                    onClick={handleAnalyzeVideoScreen}
                    title="Analyze Video on Screen"
                    style={{
                        background: 'rgba(255, 200, 0, 0.1)',
                        border: '1px solid #ffb300',
                        borderRadius: '4px',
                        padding: '0 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isAnalyzingVideo ? '#ff5555' : '#ffb300',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Video size={20} className={isAnalyzingVideo ? 'pulse' : ''} />
                </button>
                <button 
                    onClick={handleSend}
                    style={{
                        background: '#00ff9d',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0 12px',
                        cursor: 'pointer',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Send size={16} />
                </button>
                <button
                    onClick={handleNewSession}
                    title="New Session"
                    style={{
                        background: '#ff4444',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0 12px',
                        cursor: 'pointer',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <PlusCircle size={16} />
                </button>
            </div>
        </div>
      </div>
    </>
  );
}
