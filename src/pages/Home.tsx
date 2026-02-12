import { useState, useEffect, useRef } from 'react';
import OpenAI from 'openai';
import { Mic, MicOff, Monitor, User, Send, PlusCircle, Copy, Check, Camera } from 'lucide-react';
import Header from '../components/Header';
// ... (Keep existing Type definitions for Web Speech API from App.tsx)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
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
        // Hide window briefly to capture what's behind it
        if (window.electron.toggleWindow) window.electron.toggleWindow();
        
        // Wait for window to hide
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const screenshotData = await window.electron.captureScreen();
        
        // Show window back
        if (window.electron.toggleWindow) window.electron.toggleWindow();

        if (screenshotData) {
          setMessages(prev => [...prev, { type: 'context', text: '[Screen Captured: Analyzing puzzle/question...]' }]);
          
          // Send to AI for analysis
          // We'll add the image data to the AI request if supported, or just describe it
          // For now, let's assume we want to send the image to the AI
          analyzeImage(screenshotData);
        }
      } catch (err) {
        console.error("Screen capture error:", err);
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setLoading(true);
    const apiKey = (localStorage.getItem('openai_api_key') || '').trim();
    const rawBaseUrl = localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1';
    const baseUrl = rawBaseUrl.trim();
    const model = (localStorage.getItem('openai_model') || 'gpt-4o').trim();

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'ai', text: 'Please configure your API Key in Settings.' }]);
      setLoading(false);
      return;
    }

    try {
      const systemPrompt = `You are an expert technical interviewer. I will provide you with a screenshot of a puzzle, code task, or question. Please extract the text and solve it concisely.`;
      
      // Check if Electron askAI is available
      if (window.electron && window.electron.askAI) {
        // We need to modify askAI to handle images or send as a special message
        // For now, let's just send the intent
        const answer = await window.electron.askAI({
          apiKey,
          baseUrl,
          model,
          messages: [
            { 
              role: 'user', 
              content: [
                { type: 'text', text: 'What is shown in this image? If it is a coding task or puzzle, please solve it.' },
                { type: 'image_url', image_url: { url: base64Image } }
              ] 
            }
          ],
          systemPrompt
        });
        setMessages(prev => [...prev, { type: 'ai', text: answer }]);
      }
    } catch (err: any) {
      console.error("Image analysis error:", err);
      setMessages(prev => [...prev, { type: 'ai', text: 'Error analyzing screen: ' + err.message }]);
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
  const whisperIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          let history = saved ? JSON.parse(saved) : [];
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
      // Check for API Keys first
      const chatApiKey = (localStorage.getItem('openai_api_key') || '').trim();
      const whisperApiKey = (localStorage.getItem('whisper_api_key') || '').trim();
      
      // If no keys at all, we can't do anything
      if (!chatApiKey && !whisperApiKey) {
          const msg = 'Error: No API Key found. For reliable speech recognition in the desktop app, please configure an OpenAI API Key in Settings.';
          console.error(msg);
          setMessages(prev => [...prev, { type: 'ai', text: msg }]);
          setIsRecording(false);
          return;
      }
      
      console.log(`[Whisper Init] Keys detected - Chat: ${chatApiKey ? 'Yes' : 'No'}, Whisper: ${whisperApiKey ? 'Yes' : 'No'}`);

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

          // Process data every 4 seconds
          // We can't just use timeslice because we need to send complete blobs.
          // Strategy: Start, wait 4s, stop, send, start again.
          
          const processAudio = () => {
              if (mediaRecorder.state === 'recording') {
                  mediaRecorder.stop();
              }
          };

          mediaRecorder.ondataavailable = async (e) => {
              if (e.data.size > 0) {
                  console.log(`[Audio Debug] Chunk received. Size: ${e.data.size} bytes. Type: ${e.data.type}`);
              } else {
                  console.warn("[Audio Debug] Received empty audio chunk.");
              }

              if (e.data.size > 0 && isRecordingRef.current) {
                  // Send to Electron IPC for Whisper
                  const arrayBuffer = await e.data.arrayBuffer();
                  
                  // Get config
                  const chatApiKey = (localStorage.getItem('openai_api_key') || '').trim();
                  const chatBaseUrl = localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1';
                  
                  // Whisper specific config
                  const whisperApiKey = (localStorage.getItem('whisper_api_key') || '').trim();
                  const whisperBaseUrl = (localStorage.getItem('whisper_base_url') || '').trim();
                  const transcriptionProvider = localStorage.getItem('transcription_provider') || 'openai';
                  
                  // Determine credentials to use for Transcription
                  let apiKey = whisperApiKey;
                  let baseUrl = whisperBaseUrl || 'https://api.openai.com/v1';

                  // Fallback to chat credentials if whisper specific ones are missing
                  if (!apiKey) {
                      apiKey = chatApiKey;
                  }
                  
                  // If user didn't set a specific Whisper URL, but set a Chat URL...
                  // For OpenAI provider, we can infer from Chat URL if it's compatible.
                  if (transcriptionProvider === 'openai' && !whisperBaseUrl && chatBaseUrl) {
                       // If Chat URL is OpenRouter, we CANNOT use it for Whisper.
                       // So we default to OpenAI (assuming they have an OpenAI key or similar).
                       if (chatBaseUrl.includes('openrouter.ai')) {
                           baseUrl = 'https://api.openai.com/v1';
                       } else {
                           baseUrl = chatBaseUrl;
                       }
                  }
                  
                  if (!apiKey) {
                      console.warn("No API Key available for Transcription.");
                      return;
                  }

                  if (window.electron && window.electron.transcribeAudio) {
                      try {
                          console.log(`Sending audio chunk to Transcription (${transcriptionProvider})...`, { baseUrl });
                          const text = await window.electron.transcribeAudio({
                              apiKey,
                              baseUrl,
                              audioBuffer: arrayBuffer,
                              provider: transcriptionProvider
                          });
                          
                          console.log("Whisper Transcript Result:", text ? `"${text}"` : "(empty)");

                          if (text && text.trim().length > 0) {
                              setCurrentTranscript(text);
                              
                              // Determine speaker (simple logic or alternate)
                              // For now, assume current mode
                              if (speakerModeRef.current === 'interviewer') {
                                  // Wait for silence or just append?
                                  // Whisper gives full phrases.
                                  // Let's treat it as a message.
                                  setMessages(prev => [...prev, { type: 'user', text: text }]);
                                  getAIResponse(text);
                              } else {
                                  // Me mode
                                  setMessages(prev => [...prev, { type: 'context', text: text }]);
                                  getAIResponse(text);
                              }
                          } else {
                              console.log("Ignored empty transcript");
                          }
                      } catch (err) {
                          console.error("Whisper Error:", err);
                      }
                  }
              }
              
              // Restart if still recording
              if (isRecordingRef.current && mediaRecorder.state === 'inactive') {
                  mediaRecorder.start();
              }
          };

          mediaRecorder.start();
          setIsListening(true);
          
          // Loop every 4 seconds
          whisperIntervalRef.current = setInterval(() => {
              if (isRecordingRef.current) {
                  processAudio();
              }
          }, 4000);

      } catch (err) {
          console.error("Failed to start Whisper recording:", err);
          setIsRecording(false);
      }
  };

  const stopWhisperRecording = () => {
      if (whisperIntervalRef.current) {
          clearInterval(whisperIntervalRef.current);
          whisperIntervalRef.current = null;
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
      const systemPrompt = `You are an expert interview coach.
      
      Your Role:
      - Listen to the conversation between the Candidate ("Me") and the Interviewer.
      - Act as a real-time copilot for the Candidate.
      
      Guidelines:
      1. When the Interviewer speaks (Interviewer: ...):
         - Provide a DIRECT, high-quality answer that the Candidate can say immediately.
         - Do not explain *why* it's a good answer, just give the answer.
         - Keep it natural and professional.
      
      2. When the Candidate speaks (Me: ...):
         - Critique the answer briefly.
         - Suggest a better version or a follow-up point if the answer was weak.
         - If the answer was good, suggest a transition to a strength listed in the resume.
      
      3. General:
         - Be concise. The Candidate is in a live interview and cannot read long paragraphs.
         - Use bullet points if listing key details.
         - Prioritize information from the Resume below.
      
      My Resume:
      ${resume}
      
      Current Conversation:
      (See messages below)`;

      let answer = '';

      // Prepare messages for API
      const apiMessages = messages.map(m => ({
        role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', 
        content: m.type === 'user' ? `Interviewer: ${m.text}` : m.type === 'context' ? `Me: ${m.text}` : m.text 
      }));
      apiMessages.push({ role: 'user', content: `Interviewer: ${userText}` });

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
            // OpenAI / Standard Logic
            // If using default OpenAI URL on localhost, try to use proxy to avoid CORS
            let fetchUrl = baseUrl;
            if (window.location.hostname === 'localhost' && baseUrl.includes('api.openai.com')) {
               if (baseUrl === 'https://api.openai.com/v1') {
                   fetchUrl = '/v1'; // This will hit the Vite proxy if configured
               }
            }
    
            const client = new OpenAI({
              apiKey: apiKey,
              baseURL: fetchUrl, 
              dangerouslyAllowBrowser: true
            });
    
            const completion = await client.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt } as const,
                ...apiMessages
              ],
            });
            answer = completion.choices[0].message.content || 'No response';
        }
      }

      console.log("AI Response:", answer);
      setMessages(prev => [...prev, { type: 'ai', text: answer }]);
    } catch (error: any) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { type: 'ai', text: 'Error: ' + (error.message || error) }]);
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
        const recognition: any = new window.webkitSpeechRecognition();
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

        recognition.onerror = (event: any) => {
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
                    try { recognition.stop(); } catch(e) {}
                    setIsListening(false);
                    
                    // Restart will be handled by the useEffect that watches useWhisperFallback
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

        recognition.onresult = (event: any) => {
          // Robust mapping as requested by user, while maintaining our logic
          const fullTranscript = Array.from(event.results)
              .map((result: any) => result[0].transcript)
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
        try { recognitionRef.current?.start(); } catch(e) {}
      }
    } else {
      if (useWhisperFallback) {
        stopWhisperRecording();
      } else {
        try { recognitionRef.current?.stop(); } catch(e) {}
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
              title="New Session (Ctrl+K)"
            />
            <Camera
              size={20}
              style={{cursor: 'pointer', color: isCapturing ? '#ff5555' : '#00f3ff'}}
              onClick={handleCaptureScreen}
              title="Capture Screen"
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
                        {msg.type === 'user' ? 'Interviewer' : 
                         msg.type === 'context' ? 'Me' : 'Suggestion'}
                    </span>
                    <button 
                        onClick={() => handleCopy(msg.text, idx)}
                        className="copy-button"
                        title="Copy text"
                    >
                        {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </h4>
                <div className="chat-text ai-answer">{msg.text}</div>
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
                    placeholder={speakerMode === 'interviewer' ? "Type interviewer's question..." : "Type your answer..."}
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
                <button 
                    onClick={() => getAIResponse("Test connection")} 
                    disabled={loading}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '0 10px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        cursor: loading ? 'wait' : 'pointer'
                    }}
                >
                    Test AI
                </button>
            </div>
        </div>
      </div>
    </>
  );
}
