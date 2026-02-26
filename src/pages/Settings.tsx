import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Header from '../components/Header';

interface ApiConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
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
  primaryLanguage: string;
  secondaryLanguages: string;
  enableSyntaxHighlighting: boolean;
  enableErrorDetection: boolean;
  enableCompletionSuggestions: boolean;
}

/*
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number; // Optional as not all browsers support it
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}
*/

// Global types defined in src/types.d.ts

export default function Settings() {
  const [apis, setApis] = useState<ApiConfig[]>(() => {
    const savedApis = localStorage.getItem('api_configs');
    if (savedApis) {
      try {
        const parsed = JSON.parse(savedApis) as ApiConfig[];
        if (parsed.length > 0) {
          return parsed;
        }
      } catch (error) {
        console.error('Failed to parse api_configs from storage', error);
      }
    }

    const defaultApi: ApiConfig = {
      id: '1',
      name: 'OpenAI Default',
      provider: 'openai',
      apiKey: localStorage.getItem('openai_api_key') || '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o'
    };
    return [defaultApi];
  });
  const [activeApiId, setActiveApiId] = useState(() => {
    const savedActiveId = localStorage.getItem('active_api_id');
    if (savedActiveId) {
      return savedActiveId;
    }
    const savedApis = localStorage.getItem('api_configs');
    if (savedApis) {
      try {
        const parsed = JSON.parse(savedApis) as ApiConfig[];
        if (parsed.length > 0) {
          return parsed[0].id;
        }
      } catch (error) {
        console.error('Failed to parse api_configs for active id', error);
      }
    }
    return '1';
  });
  const [updateStatus, setUpdateStatus] = useState<{status: 'idle' | 'checking' | 'available' | 'latest' | 'error', message?: string}>({status: 'idle'});
  
  // Lazy init to prevent overwriting saved settings with defaults on first render
  const [useWhisper, setUseWhisper] = useState(() => localStorage.getItem('use_whisper_stt') === 'true');
  const [transcriptionProvider, setTranscriptionProvider] = useState(() => localStorage.getItem('transcription_provider') || 'openai');
  const [whisperApiKey, setWhisperApiKey] = useState(() => localStorage.getItem('whisper_api_key') || '');
  const [whisperBaseUrl, setWhisperBaseUrl] = useState(() => localStorage.getItem('whisper_base_url') || 'https://api.openai.com/v1');
  const [screenCapturePermission, setScreenCapturePermission] = useState(() => localStorage.getItem('screen_capture_permission') === 'true');
  const [isInvisible, setIsInvisible] = useState(() => {
    const savedInvisibility = localStorage.getItem('app_invisibility');
    if (savedInvisibility === null) {
      return true;
    }
    return savedInvisibility === 'true';
  }); // Default true (Stealth)

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.history.back();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (window.electron && window.electron.setContentProtection) {
      window.electron.setContentProtection(isInvisible);
    }
  }, [isInvisible]);

  const [transparencyEnabled, setTransparencyEnabled] = useState(() => localStorage.getItem('transparency_enabled') === 'true');
  const [transparencyLevel, setTransparencyLevel] = useState(() => {
    const stored = localStorage.getItem('transparency_level');
    if (!stored) return 0;
    const parsed = parseInt(stored, 10);
    if (Number.isNaN(parsed)) return 0;
    if (parsed < 0) return 0;
    if (parsed > 80) return 80;
    return parsed;
  });

  const toggleInvisibility = () => {
      const newState = !isInvisible;
      setIsInvisible(newState);
      localStorage.setItem('app_invisibility', String(newState));
      
      if (window.electron && window.electron.setContentProtection) {
          window.electron.setContentProtection(newState);
      } else {
          // Web mode simulation or alert
          console.log("Invisibility (Content Protection) set to:", newState);
      }
  };

  const toggleWhisper = () => {
      const newState = !useWhisper;
      setUseWhisper(newState);
      localStorage.setItem('use_whisper_stt', String(newState));
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [aiTestStatus, setAiTestStatus] = useState<{
    state: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });

  // Save changes manually
  const handleSave = () => {
    if (apis.length > 0) {
        localStorage.setItem('api_configs', JSON.stringify(apis));
    }
    if (activeApiId) {
        localStorage.setItem('active_api_id', activeApiId);
        
        // Update legacy keys for backward compatibility with Home.tsx
        const activeApi = apis.find(a => a.id === activeApiId);
        if (activeApi) {
            localStorage.setItem('openai_api_key', activeApi.apiKey);
            localStorage.setItem('openai_base_url', activeApi.baseUrl);
            localStorage.setItem('openai_model', activeApi.model);
            localStorage.setItem('ai_provider', activeApi.provider);
        }
    }
    
    // Save Whisper settings
    localStorage.setItem('transcription_provider', transcriptionProvider);
    localStorage.setItem('whisper_api_key', whisperApiKey);
    localStorage.setItem('whisper_base_url', whisperBaseUrl);
    localStorage.setItem('screen_capture_permission', String(screenCapturePermission));

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };
  
  // Auto-save just to state, but let user click save for persistence reassurance
  useEffect(() => {
     // We can keep auto-save or rely on manual. 
     // Let's keep auto-save for safety but adding the button gives feedback.
     // Actually, if we auto-save, the button is just for show. 
     // Let's keep the logic as is for now, just wrapping it in handleSave for the button.
     // But we also want auto-save for seamless switching.
     if (apis.length > 0) {
        localStorage.setItem('api_configs', JSON.stringify(apis));
    }
    if (activeApiId) {
        localStorage.setItem('active_api_id', activeApiId);
        const activeApi = apis.find(a => a.id === activeApiId);
        if (activeApi) {
            localStorage.setItem('openai_api_key', activeApi.apiKey);
            localStorage.setItem('openai_base_url', activeApi.baseUrl);
            localStorage.setItem('openai_model', activeApi.model);
            localStorage.setItem('ai_provider', activeApi.provider);
        }
    }
    
    // Auto-save Whisper settings
    localStorage.setItem('transcription_provider', transcriptionProvider);
    localStorage.setItem('whisper_api_key', whisperApiKey);
    localStorage.setItem('whisper_base_url', whisperBaseUrl);
    localStorage.setItem('screen_capture_permission', String(screenCapturePermission));

  }, [apis, activeApiId, transcriptionProvider, whisperApiKey, whisperBaseUrl, screenCapturePermission]);

  const addApi = () => {
    const newApi: ApiConfig = {
      id: Date.now().toString(),
      name: 'New API',
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo'
    };
    setApis([...apis, newApi]);
    setActiveApiId(newApi.id);
  };

  const [testTranscript, setTestTranscript] = useState('');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [mediaRecorderTestResult, setMediaRecorderTestResult] = useState('');
  
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const [codeEnv, setCodeEnv] = useState<CodeEnvironmentConfig>(() => {
    const stored = localStorage.getItem('code_env_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CodeEnvironmentConfig;
        return {
          primaryLanguage: parsed.primaryLanguage || 'TypeScript',
          secondaryLanguages: parsed.secondaryLanguages || 'JavaScript, Python',
          enableSyntaxHighlighting: parsed.enableSyntaxHighlighting ?? true,
          enableErrorDetection: parsed.enableErrorDetection ?? true,
          enableCompletionSuggestions: parsed.enableCompletionSuggestions ?? true,
        };
      } catch {
        return {
          primaryLanguage: 'TypeScript',
          secondaryLanguages: 'JavaScript, Python',
          enableSyntaxHighlighting: true,
          enableErrorDetection: true,
          enableCompletionSuggestions: true,
        };
      }
    }
    return {
      primaryLanguage: 'TypeScript',
      secondaryLanguages: 'JavaScript, Python',
      enableSyntaxHighlighting: true,
      enableErrorDetection: true,
      enableCompletionSuggestions: true,
    };
  });

  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => {
    const stored = localStorage.getItem('prompt_templates');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { prompts?: PromptTemplate[]; defaults?: PromptDefaults };
        if (parsed.prompts && Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
          return parsed.prompts;
        }
      } catch (error) {
        console.error('Failed to parse prompt templates from storage', error);
      }
    }
    const initialPrompts: PromptTemplate[] = [
      {
        id: 'interview-coach-default',
        name: 'Interview Coach',
        category: 'Interview',
        content:
          'You are an expert interview coach.\n\n' +
          'Your role is to listen to the live interview and help the candidate.\n' +
          'When you receive messages tagged as Interviewer, respond with a direct, polished answer the candidate can say.\n' +
          'When you receive messages tagged as Me, briefly critique the answer and suggest improvements.\n' +
          'Be concise and prioritize information from the candidate resume below.\n' +
          'Candidate Resume:\n{{RESUME}}',
      },
      {
        id: 'me-mode-assistant-default',
        name: 'Me Mode Assistant',
        category: 'Assistant',
        content:
          'You are a helpful AI assistant for the user.\n' +
          'Answer the user questions directly and clearly.\n' +
          'When relevant, provide code examples and short explanations.\n' +
          'Assume the user is preparing for technical interviews.\n' +
          'Candidate Resume:\n{{RESUME}}',
      },
      {
        id: 'code-analysis-default',
        name: 'Code Analysis',
        category: 'Code',
        content:
          'You analyze code for correctness, style, and performance.\n' +
          'Explain errors, suggest fixes, and propose improved implementations.\n' +
          'When showing code, use Markdown code fences with language identifiers.\n' +
          'Candidate Resume:\n{{RESUME}}',
      },
    ];
    const initialDefaults: PromptDefaults = {
      interviewerId: 'interview-coach-default',
      meId: 'me-mode-assistant-default',
    };
    const config = { prompts: initialPrompts, defaults: initialDefaults };
    localStorage.setItem('prompt_templates', JSON.stringify(config));
    return initialPrompts;
  });

  const [promptDefaults, setPromptDefaults] = useState<PromptDefaults>(() => {
    const stored = localStorage.getItem('prompt_templates');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { prompts?: PromptTemplate[]; defaults?: PromptDefaults };
        return parsed.defaults || {};
      } catch {
        return {};
      }
    }
    return {
      interviewerId: 'interview-coach-default',
      meId: 'me-mode-assistant-default',
    };
  });

  const [activePromptId, setActivePromptId] = useState(() => {
    const stored = localStorage.getItem('prompt_templates');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { prompts?: PromptTemplate[]; defaults?: PromptDefaults };
        const list = parsed.prompts || [];
        if (list.length > 0) return list[0].id;
      } catch {
        return prompts[0]?.id || '';
      }
    }
    return prompts[0]?.id || '';
  });

  // Load devices and selected mic
  useEffect(() => {
      const getDevices = async () => {
          try {
              // Must ask for permission first to get labels
              await navigator.mediaDevices.getUserMedia({ audio: true });
              const devices = await navigator.mediaDevices.enumerateDevices();
              const audioInputs = devices.filter(device => device.kind === 'audioinput');
              setInputDevices(audioInputs);
              
              const savedId = localStorage.getItem('selected_mic_id');
              if (savedId && audioInputs.find(d => d.deviceId === savedId)) {
                  setSelectedDeviceId(savedId);
              } else if (audioInputs.length > 0) {
                  // Default to first or 'default'
                  setSelectedDeviceId(audioInputs[0].deviceId);
              }
          } catch (e) {
              console.error("Error enumerating devices:", e);
          }
      };
      getDevices();
      
      // Listen for device changes
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const handleDeviceChange = (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      localStorage.setItem('selected_mic_id', deviceId);
  };

  useEffect(() => {
    const config: CodeEnvironmentConfig = {
      primaryLanguage: codeEnv.primaryLanguage,
      secondaryLanguages: codeEnv.secondaryLanguages,
      enableSyntaxHighlighting: codeEnv.enableSyntaxHighlighting,
      enableErrorDetection: codeEnv.enableErrorDetection,
      enableCompletionSuggestions: codeEnv.enableCompletionSuggestions,
    };
    localStorage.setItem('code_env_config', JSON.stringify(config));
  }, [codeEnv]);

  useEffect(() => {
    const config = { prompts, defaults: promptDefaults };
    localStorage.setItem('prompt_templates', JSON.stringify(config));
  }, [prompts, promptDefaults]);

  useEffect(() => {
    localStorage.setItem('transparency_enabled', String(transparencyEnabled));
    localStorage.setItem('transparency_level', String(transparencyLevel));
    if (window.electron && window.electron.setTransparency) {
      window.electron.setTransparency(transparencyEnabled, transparencyLevel);
    }
  }, [transparencyEnabled, transparencyLevel]);

  const requestMicrophone = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined 
            } 
        });
        
        // Use AudioContext for reliable hardware testing (works offline/Electron)
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        setIsTestingMic(true);
        setTestTranscript("Listening for sound (Hardware Check)...");
        
        const startTime = Date.now();
        let maxVol = 0;
        
        const checkAudio = () => {
            if (!isTestingMic && (Date.now() - startTime > 5000)) return;
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            if (average > maxVol) maxVol = average;
            
            if (average > 10) {
                setTestTranscript(`Sound Detected! (Level: ${Math.round(average)})`);
            }
            
            if (Date.now() - startTime < 5000) {
                requestAnimationFrame(checkAudio);
            } else {
                // End test
                setIsTestingMic(false);
                stream.getTracks().forEach(t => t.stop());
                audioContext.close();
                if (maxVol > 10) {
                     setTestTranscript("Test Passed: Microphone input detected.");
                } else {
                     setTestTranscript("Test Finished: No significant sound detected.");
                }
            }
        };
        
        checkAudio();

    } catch (err) {
        console.error(err);
        setTestTranscript("Microphone access denied.");
        setIsTestingMic(false);
    }
  };

  const activePrompt = prompts.find(p => p.id === activePromptId) || prompts[0] || null;

  const addPrompt = () => {
    const id = Date.now().toString();
    const newPrompt: PromptTemplate = {
      id,
      name: 'New Prompt',
      category: 'General',
      content: '',
    };
    setPrompts([...prompts, newPrompt]);
    setActivePromptId(id);
  };

  const removePrompt = (id: string) => {
    const remaining = prompts.filter(p => p.id !== id);
    setPrompts(remaining);
    setPromptDefaults(prev => {
      const next: PromptDefaults = { ...prev };
      if (next.interviewerId === id) {
        next.interviewerId = undefined;
      }
      if (next.meId === id) {
        next.meId = undefined;
      }
      return next;
    });
    if (activePromptId === id) {
      setActivePromptId(remaining[0]?.id || '');
    }
  };

  const updatePromptField = (field: keyof PromptTemplate, value: string) => {
    if (!activePrompt) return;
    setPrompts(prompts.map(p => (p.id === activePrompt.id ? { ...p, [field]: value } : p)));
  };

  const testWhisperCapture = async () => {
    try {
        setMediaRecorderTestResult("Initializing MediaRecorder...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined 
            } 
        });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            setMediaRecorderTestResult(`Success! Recorded ${blob.size} bytes. (Type: ${blob.type})`);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setMediaRecorderTestResult("Recording 3 seconds...");
        
        setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }, 3000);

    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        setMediaRecorderTestResult(`Error: ${message}`);
    }
  };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (window.testRecognition) {
                try {
                    window.testRecognition.stop();
                } catch {
                    void 0;
                }
            }
        };
    }, []);

  const handleCheckUpdates = async () => {
    if (!window.electron || !window.electron.checkForUpdates) return;
    
    setUpdateStatus({status: 'checking', message: 'Checking for updates...'});
    try {
      const result = await window.electron.checkForUpdates();
      if (result.success) {
        setUpdateStatus({status: 'available', message: 'Update check complete. If a new version is available, it will download automatically.'});
      } else {
        setUpdateStatus({status: 'error', message: result.error || 'Failed to check for updates.'});
      }
    } catch {
      setUpdateStatus({status: 'error', message: 'Error checking for updates.'});
    }
  };

  const removeApi = (id: string) => {
    if (apis.length <= 1) return; // Prevent deleting last one
    const newApis = apis.filter(a => a.id !== id);
    setApis(newApis);
    if (activeApiId === id) {
      setActiveApiId(newApis[0].id);
    }
  };

  const checkMicPermission = async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        alert("Microphone permission granted!");
    } catch {
        alert("Microphone permission denied. Please check your system settings.");
    }
  };

  const clearAllData = () => {
    if (window.confirm("This will clear ALL settings, history, and keys. Are you sure?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  const updateApi = (id: string, field: keyof ApiConfig, value: string) => {
    setApis(apis.map(api => {
      if (api.id === id) {
        const updated = { ...api, [field]: value };
        // Auto-set defaults if provider changes
        if (field === 'provider') {
            if (value === 'deepseek') {
                updated.baseUrl = 'https://api.deepseek.com';
                updated.model = 'deepseek-chat';
            } else if (value === 'openrouter') {
                updated.baseUrl = 'https://openrouter.ai/api/v1';
                updated.model = 'openai/gpt-3.5-turbo';
            } else if (value === 'gemini') {
                updated.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
                updated.model = 'gemini-1.5-flash';
            } else {
                updated.baseUrl = 'https://api.openai.com/v1';
                updated.model = 'gpt-4o';
            }
        }
        return updated;
      }
      return api;
    }));
  };

  const activeApi = apis.find(a => a.id === activeApiId) || apis[0];

  if (!activeApi) return null;

  const handleTestAIConnection = async () => {
    if (!window.electron || !window.electron.askAI) {
      setAiTestStatus({ state: 'error', message: 'AI test is only available in the desktop app.' });
      return;
    }

    const apiKey = (activeApi.apiKey || '').trim();
    const baseUrl = (activeApi.baseUrl || '').trim();
    const model = (activeApi.model || '').trim();

    if (!apiKey || !baseUrl || !model) {
      setAiTestStatus({ state: 'error', message: 'Please fill API key, base URL, and model first.' });
      return;
    }

    setAiTestStatus({ state: 'testing', message: 'Testing AI connection...' });
    try {
      const answer = await window.electron.askAI({
        apiKey,
        baseUrl,
        model,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        systemPrompt: 'You are a connection test endpoint. Reply with OK only.'
      });

      const clean = (answer || '').trim();
      setAiTestStatus({
        state: 'success',
        message: clean ? `Connected: ${clean}` : 'Connected successfully.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAiTestStatus({ state: 'error', message: `Connection failed: ${message}` });
    }
  };

  return (
    <>
      <Header title="Settings" />

      <div className="main-content">
        <div className="settings-page">
            <div className="section-title">App Visibility (Stealth Mode)</div>
            <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                            {isInvisible ? "Invisible to Screen Share (Default)" : "Visible to Screen Share"}
                        </div>
                        <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                            {isInvisible 
                                ? "The app window is hidden from screen capture tools (Zoom/Teams/etc)." 
                                : "The app window can be seen by others if you share your screen."}
                        </div>
                    </div>
                    <button 
                        onClick={toggleInvisibility}
                        style={{
                            padding: '8px 16px',
                            background: isInvisible ? '#00ff9d' : '#ff5555',
                            color: '#000',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            minWidth: '100px'
                        }}
                    >
                        {isInvisible ? "Make Visible" : "Make Invisible"}
                    </button>
                </div>
            </div>

            <div className="section-title">Window Transparency</div>
            <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                            {transparencyEnabled ? "Transparent Mode Enabled" : "Transparent Mode Disabled"}
                        </div>
                        <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                            {transparencyEnabled
                                ? "The window uses partial transparency so you can see content behind it."
                                : "The window is fully opaque for maximum readability."}
                        </div>
                    </div>
                    <button
                        onClick={() => setTransparencyEnabled(!transparencyEnabled)}
                        style={{
                            padding: '8px 16px',
                            background: transparencyEnabled ? '#00f3ff' : '#444',
                            color: transparencyEnabled ? '#000' : '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            minWidth: '120px'
                        }}
                    >
                        {transparencyEnabled ? "Disable" : "Enable"}
                    </button>
                </div>
                <div>
                    <label style={{display: 'block', marginBottom: '6px', fontSize: '0.8rem'}}>
                        Transparency Level
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={80}
                        step={5}
                        value={transparencyLevel}
                        onChange={(e) => setTransparencyLevel(Number(e.target.value))}
                        style={{width: '100%'}}
                    />
                    <div style={{fontSize: '0.8rem', color: '#aaa', marginTop: '4px'}}>
                        {transparencyLevel}% transparent (0% = fully opaque, 80% = highly transparent)
                    </div>
                </div>
            </div>

            <div className="section-title">Transcription Engine</div>
            <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                            {useWhisper ? "Cloud Transcription" : "Browser Built-in (Default)"}
                        </div>
                        <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                            {useWhisper 
                                ? "Uses cloud API for higher accuracy. Requires API Key & Internet." 
                                : "Uses Chrome/Web Speech API. Free, fast, but less accurate."}
                        </div>
                    </div>
                    <button 
                        onClick={toggleWhisper}
                        style={{
                            padding: '8px 16px',
                            background: useWhisper ? '#00f3ff' : '#444',
                            color: useWhisper ? '#000' : '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            minWidth: '100px'
                        }}
                    >
                        {useWhisper ? "Use Built-in" : "Enable Cloud"}
                    </button>
                </div>
                
                {useWhisper && (
                    <div style={{marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px'}}>
                        <div className="form-group">
                            <label>Transcription Provider</label>
                            <select 
                                className="form-control"
                                value={transcriptionProvider}
                                onChange={(e) => setTranscriptionProvider(e.target.value)}
                            >
                                <option value="openai">OpenAI Whisper</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="custom">Custom (OpenAI Compatible)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>API Key (Optional if same as Chat)</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={whisperApiKey}
                            onChange={(e) => setWhisperApiKey(e.target.value)}
                            placeholder={transcriptionProvider === 'gemini' ? "Gemini API Key" : "sk-..."}
                        />
                        <div style={{fontSize: '0.75rem', color: '#888', marginTop: '4px'}}>
                            {transcriptionProvider === 'gemini' ? "Required for Gemini." : "Required if Chat Provider doesn't support Whisper."}
                        </div>
                    </div>
                    
                    {(transcriptionProvider === 'openai' || transcriptionProvider === 'custom') && (
                        <div className="form-group">
                            <label>Base URL {transcriptionProvider === 'openai' ? '(Optional)' : '(Required)'}</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={whisperBaseUrl}
                                onChange={(e) => setWhisperBaseUrl(e.target.value)}
                                placeholder="https://api.openai.com/v1"
                            />
                        </div>
                    )}
                    
                    <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '10px'}}>
                        <button 
                            onClick={handleSave}
                            className="btn-primary"
                            style={{
                                padding: '8px 16px',
                                background: saveStatus === 'saved' ? '#00ff9d' : '#00f3ff',
                                color: '#000',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            {saveStatus === 'saved' ? "Saved!" : "Save Transcription Settings"}
                        </button>
                    </div>
                    </div>
                )}
            </div>

            <div className="section-title">System Permissions & Data</div>
            <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                            Screen Reading Capability
                        </div>
                        <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                            Allow the app to capture your screen to read puzzles, code tasks, or questions.
                        </div>
                    </div>
                    <button 
                        onClick={() => setScreenCapturePermission(!screenCapturePermission)}
                        style={{
                            padding: '8px 16px',
                            background: screenCapturePermission ? '#00ff9d' : '#444',
                            color: screenCapturePermission ? '#000' : '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            minWidth: '100px'
                        }}
                    >
                        {screenCapturePermission ? "Allowed" : "Grant Access"}
                    </button>
                </div>
            </div>

            <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap'}}>
                <button 
                    onClick={checkMicPermission}
                    className="btn-secondary"
                    style={{padding: '8px 12px', fontSize: '0.85rem'}}
                >
                    Check Mic Permission
                </button>
                <button 
                    onClick={clearAllData}
                    style={{
                        padding: '8px 12px', 
                        fontSize: '0.85rem', 
                        background: '#ff5555', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Reset App Data
                </button>
            </div>

            <div className="section-title">Microphone Selection</div>
            <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Input Device</label>
                <select 
                    className="form-control"
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff'}}
                >
                    {inputDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0,5)}...`}
                        </option>
                    ))}
                    {inputDevices.length === 0 && <option>No microphones found</option>}
                </select>
                <div style={{fontSize: '0.8rem', color: '#aaa', marginTop: '6px'}}>
                    Select the microphone you want to use for both Whisper and built-in speech recognition.
                </div>
            </div>

            <div className="section-title">Microphone Test</div>
            <div className="form-group">
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    {/* Standard Web Speech Test */}
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <button 
                            onClick={requestMicrophone}
                            disabled={isTestingMic}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: isTestingMic ? '#555' : '#00f3ff',
                                color: isTestingMic ? '#ccc' : '#000',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isTestingMic ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                minWidth: '180px'
                            }}
                        >
                            {isTestingMic ? 'Listening...' : 'Test Microphone (Hardware)'}
                        </button>
                        <div style={{
                            flex: 1, 
                            padding: '10px', 
                            background: 'rgba(255,255,255,0.1)', 
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            color: testTranscript.includes('Detected') || testTranscript.includes('Passed') ? '#00ff9d' : '#ccc',
                            fontStyle: testTranscript ? 'normal' : 'italic'
                        }}>
                            {testTranscript || "Click to test microphone input (No Internet Required)"}
                        </div>
                    </div>

                    {/* Whisper MediaRecorder Test */}
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                        <button 
                            onClick={testWhisperCapture}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#ff00ff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                minWidth: '180px'
                            }}
                        >
                            Test Whisper Audio
                        </button>
                        <div style={{
                            flex: 1, 
                            padding: '10px', 
                            background: 'rgba(255,255,255,0.1)', 
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            color: mediaRecorderTestResult.includes('Success') ? '#00ff9d' : '#ccc',
                            fontStyle: mediaRecorderTestResult ? 'normal' : 'italic'
                        }}>
                            {mediaRecorderTestResult || "Click to test raw audio capture (for Whisper)..."}
                        </div>
                    </div>
                </div>
            </div>

          <div className="section-title">Code Environment</div>
          <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
            <div className="form-group">
              <label>Primary Language</label>
              <select
                className="form-control"
                value={codeEnv.primaryLanguage}
                onChange={(e) => setCodeEnv({...codeEnv, primaryLanguage: e.target.value})}
              >
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Python">Python</option>
                <option value="Java">Java</option>
                <option value="C#">C#</option>
                <option value="Go">Go</option>
              </select>
            </div>
            <div className="form-group">
              <label>Other Languages</label>
              <input
                type="text"
                className="form-control"
                value={codeEnv.secondaryLanguages}
                onChange={(e) => setCodeEnv({...codeEnv, secondaryLanguages: e.target.value})}
                placeholder="JavaScript, Python"
              />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem'}}>
                <input
                  type="checkbox"
                  checked={codeEnv.enableSyntaxHighlighting}
                  onChange={(e) => setCodeEnv({...codeEnv, enableSyntaxHighlighting: e.target.checked})}
                  style={{margin: 0}}
                />
                Enable syntax-focused code output
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem'}}>
                <input
                  type="checkbox"
                  checked={codeEnv.enableErrorDetection}
                  onChange={(e) => setCodeEnv({...codeEnv, enableErrorDetection: e.target.checked})}
                  style={{margin: 0}}
                />
                Emphasize error detection and debugging hints
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem'}}>
                <input
                  type="checkbox"
                  checked={codeEnv.enableCompletionSuggestions}
                  onChange={(e) => setCodeEnv({...codeEnv, enableCompletionSuggestions: e.target.checked})}
                  style={{margin: 0}}
                />
                Include completion-style code suggestions
              </label>
            </div>
          </div>

          <div className="section-title">Prompt Management</div>
          <div style={{marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
              <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                Create, edit, and organize prompts for different interaction modes.
              </div>
              <button
                onClick={addPrompt}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0, 243, 255, 0.1)',
                  border: '1px solid #00f3ff',
                  borderRadius: '6px',
                  color: '#00f3ff',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                + New Prompt
              </button>
            </div>
            {prompts.length > 0 && (
              <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px'}}>
                {prompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => setActivePromptId(prompt.id)}
                    style={{
                      flex: '0 0 auto',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${activePrompt && activePrompt.id === prompt.id ? '#00f3ff' : 'rgba(255,255,255,0.1)'}`,
                      background: activePrompt && activePrompt.id === prompt.id ? 'rgba(0,243,255,0.1)' : 'rgba(0,0,0,0.2)',
                      color: activePrompt && activePrompt.id === prompt.id ? '#fff' : '#888',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {prompt.name || 'Untitled'}{prompt.category ? ` (${prompt.category})` : ''}
                  </button>
                ))}
              </div>
            )}
            {activePrompt && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <div className="form-group">
                  <label>Prompt Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={activePrompt.name}
                    onChange={(e) => updatePromptField('name', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    className="form-control"
                    value={activePrompt.category}
                    onChange={(e) => updatePromptField('category', e.target.value)}
                    placeholder="Interview, Code, Debugging"
                  />
                </div>
                <div className="form-group">
                  <label>Prompt Text</label>
                  <textarea
                    className="form-control"
                    value={activePrompt.content}
                    onChange={(e) => updatePromptField('content', e.target.value)}
                    style={{minHeight: '140px', resize: 'vertical'}}
                  />
                  <div style={{fontSize: '0.75rem', color: '#888', marginTop: '4px'}}>
                    You can use {'{{RESUME}}'} to insert the saved resume.
                  </div>
                </div>
                {prompts.length > 1 && (
                  <button
                    onClick={() => removePrompt(activePrompt.id)}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '8px 12px',
                      background: 'rgba(255,50,50,0.15)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,50,50,0.4)',
                      color: '#ff5555',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Delete Prompt
                  </button>
                )}
              </div>
            )}
            {prompts.length > 0 && (
              <div style={{marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                <div className="form-group">
                  <label>Default for Interviewer Mode</label>
                  <select
                    className="form-control"
                    value={promptDefaults.interviewerId || ''}
                    onChange={(e) =>
                      setPromptDefaults({
                        ...promptDefaults,
                        interviewerId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Use built-in default</option>
                    {prompts.map(prompt => (
                      <option key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Default for Me Mode</label>
                  <select
                    className="form-control"
                    value={promptDefaults.meId || ''}
                    onChange={(e) =>
                      setPromptDefaults({
                        ...promptDefaults,
                        meId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Use built-in default</option>
                    {prompts.map(prompt => (
                      <option key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="section-title">API Configuration</div>
          {/* API Selector / List */}
          <div className="form-group">
            <label style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                Active API Profile
                <button onClick={addApi} style={{background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem'}}>
                    <Plus size={14} /> Add New
                </button>
            </label>
            <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px'}}>
                {apis.map(api => (
                    <button 
                        key={api.id}
                        onClick={() => setActiveApiId(api.id)}
                        style={{
                            flex: '0 0 auto',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${activeApiId === api.id ? '#00f3ff' : 'rgba(255,255,255,0.1)'}`,
                            background: activeApiId === api.id ? 'rgba(0,243,255,0.1)' : 'rgba(0,0,0,0.2)',
                            color: activeApiId === api.id ? '#fff' : '#888',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        {api.name}
                    </button>
                ))}
            </div>
          </div>

          <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0'}}></div>

          {/* Active API Config Form */}
          <div className="form-group">
            <div style={{display: 'flex', gap: '10px'}}>
                <div style={{flex: 1}}>
                    <label>Profile Name</label>
                    <input 
                        type="text" 
                        className="form-control" 
                        value={activeApi.name} 
                        onChange={(e) => updateApi(activeApi.id, 'name', e.target.value)}
                    />
                </div>
                {apis.length > 1 && (
                    <button 
                        onClick={() => removeApi(activeApi.id)}
                        style={{marginTop: 'auto', background: 'rgba(255,50,50,0.2)', color: '#ff5555', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer'}}
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
          </div>

          <div className="form-group">
            <label>Provider</label>
            <select 
                className="form-control" 
                value={activeApi.provider} 
                onChange={(e) => updateApi(activeApi.id, 'provider', e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="form-group">
            <label>API Key</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder={activeApi.provider === 'gemini' ? "Gemini API Key" : "sk-..."}
              value={activeApi.apiKey} 
              onChange={(e) => updateApi(activeApi.id, 'apiKey', e.target.value)}
            />
            {window.electron && (
                <div style={{fontSize: '0.75rem', color: '#ff9800', marginTop: '4px'}}>
                    * Required for speech recognition in Desktop App
                </div>
            )}
          </div>

          <div className="form-group">
            <label>Base URL</label>
            <input 
              type="text" 
              className="form-control" 
              value={activeApi.baseUrl} 
              onChange={(e) => updateApi(activeApi.id, 'baseUrl', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Model Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={activeApi.model} 
              onChange={(e) => updateApi(activeApi.id, 'model', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>AI Connection Test</label>
            <button
              onClick={handleTestAIConnection}
              disabled={aiTestStatus.state === 'testing'}
              style={{
                width: '100%',
                padding: '10px',
                background: aiTestStatus.state === 'testing' ? '#555' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                borderRadius: '8px',
                cursor: aiTestStatus.state === 'testing' ? 'default' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {aiTestStatus.state === 'testing' ? 'Testing...' : 'Test AI Connection'}
            </button>
            {aiTestStatus.message && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '0.8rem',
                  color: aiTestStatus.state === 'error' ? '#ff5555' : '#00ff9d'
                }}
              >
                {aiTestStatus.message}
              </div>
            )}
          </div>

          <div className="form-group" style={{marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px'}}>
            <label>System Permissions & Test</label>
            <button 
                onClick={requestMicrophone}
                disabled={isTestingMic}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: isTestingMic ? '#555' : '#333',
                    border: '1px solid #555',
                    color: '#fff',
                    borderRadius: '8px',
                    cursor: isTestingMic ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}
            >
                {isTestingMic ? 'Testing...' : 'Test Microphone (5s)'}
            </button>
            {testTranscript && (
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: testTranscript.includes('Error') || testTranscript.includes('denied') ? '#ff5555' : '#00ff9d'
                }}>
                    {testTranscript}
                </div>
            )}
          </div>

          <div style={{borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0'}}></div>

          <div className="section-title">Application</div>
          <div className="form-group" style={{marginTop: '10px'}}>
            <button 
                onClick={handleCheckUpdates}
                disabled={updateStatus.status === 'checking'}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: updateStatus.status === 'checking' ? '#555' : 'rgba(0, 243, 255, 0.1)',
                    border: '1px solid #00f3ff',
                    color: '#00f3ff',
                    borderRadius: '8px',
                    cursor: updateStatus.status === 'checking' ? 'default' : 'pointer',
                    fontSize: '0.85rem'
                }}
            >
                {updateStatus.status === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>
            {updateStatus.message && (
                <div style={{
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    color: updateStatus.status === 'error' ? '#ff5555' : '#00f3ff',
                    textAlign: 'center'
                }}>
                    {updateStatus.message}
                </div>
            )}
          </div>

          <div className="section" style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
             <button 
                onClick={handleSave}
                style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: saveStatus === 'saved' ? '#4caf50' : '#00f3ff',
                    color: saveStatus === 'saved' ? '#fff' : '#000',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                }}
             >
                {saveStatus === 'saved' ? 'Settings Saved!' : 'Save Settings'}
             </button>
             <p style={{fontSize: '0.8rem', color: '#666', textAlign: 'center'}}>
                ClueInterview v1.2.0 - Multi-API Support & Vision
             </p>
          </div>
        </div>
      </div>
    </>
  );
}
