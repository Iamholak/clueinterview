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

/*
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number; // Optional as not all browsers support it
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}
*/

// Global types defined in src/types.d.ts

export default function Settings() {
  const [apis, setApis] = useState<ApiConfig[]>([]);
  const [activeApiId, setActiveApiId] = useState('');
  
  // Lazy init to prevent overwriting saved settings with defaults on first render
  const [useWhisper, setUseWhisper] = useState(() => localStorage.getItem('use_whisper_stt') === 'true');
  const [transcriptionProvider, setTranscriptionProvider] = useState(() => localStorage.getItem('transcription_provider') || 'openai');
  const [whisperApiKey, setWhisperApiKey] = useState(() => localStorage.getItem('whisper_api_key') || '');
  const [whisperBaseUrl, setWhisperBaseUrl] = useState(() => localStorage.getItem('whisper_base_url') || 'https://api.openai.com/v1');

  // Load saved APIs
  useEffect(() => {
    const savedApis = localStorage.getItem('api_configs');
    const savedActiveId = localStorage.getItem('active_api_id');
    
    if (savedApis) {
      setApis(JSON.parse(savedApis));
    } else {
      // Default initial config if empty
      const defaultApi: ApiConfig = {
        id: '1',
        name: 'OpenAI Default',
        provider: 'openai',
        apiKey: localStorage.getItem('openai_api_key') || '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o'
      };
      setApis([defaultApi]);
      setActiveApiId('1');
    }

    if (savedActiveId) {
      setActiveApiId(savedActiveId);
    }
    
    // Load Invisibility setting
    const savedInvisibility = localStorage.getItem('app_invisibility');
    if (savedInvisibility !== null) {
        const isInvisible = savedInvisibility === 'true';
        setIsInvisible(isInvisible);
        if (window.electron && window.electron.setContentProtection) {
            window.electron.setContentProtection(isInvisible);
        }
    }
  }, []);

  const [isInvisible, setIsInvisible] = useState(true); // Default true (Stealth)

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

  }, [apis, activeApiId, transcriptionProvider, whisperApiKey, whisperBaseUrl]);

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

    } catch (err: any) {
        console.error(err);
        setMediaRecorderTestResult(`Error: ${err.message || err}`);
    }
  };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if ((window as any).testRecognition) {
                try {
                    (window as any).testRecognition.stop();
                } catch (e) {}
            }
        };
    }, []);

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
    } catch (err) {
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
                ClueInterview v1.1.0 - Multi-API Support
             </p>
          </div>
        </div>
      </div>
    </>
  );
}
