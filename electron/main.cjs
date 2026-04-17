const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { autoUpdater } = require('electron-updater');

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

let tray = null;
let win = null;

// Window state management
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function saveWindowState() {
  if (!win) return;
  const bounds = win.getBounds();
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(bounds));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function loadWindowState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load window state:', e);
  }
  return null;
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const isDev = process.env.NODE_ENV === 'development';
  const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png');

  const savedState = loadWindowState();

  win = new BrowserWindow({
    title: "Clue Interview",
    width: savedState?.width || 400,
    height: savedState?.height || 600,
    x: savedState?.x ?? (screenWidth - 420),
    y: savedState?.y ?? 50,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Enable web security
      enableBlinkFeatures: 'MediaDevices' // Enable media devices for microphone access
    },
    alwaysOnTop: true,
    frame: true,
    transparent: false,
    resizable: true,
    minWidth: 300,
    minHeight: 400,
    hasShadow: false,
    autoHideMenuBar: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
  });

  // Hides the window from screen capture
  win.setContentProtection(true);

  // Set as Always on Top and ignore standard mouse events for the transparency to work correctly on some systems
  win.setAlwaysOnTop(true, 'screen-saver');

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Check for updates in production immediately
    autoUpdater.checkForUpdatesAndNotify();
    
    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 4 * 60 * 60 * 1000);
  }

  // Auto-updater events to communicate with Renderer
  autoUpdater.on('checking-for-update', () => {
    win?.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
  });

  autoUpdater.on('update-available', (info) => {
    win?.webContents.send('update-status', { 
      status: 'available', 
      message: `Update v${info.version} available!`,
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', () => {
    win?.webContents.send('update-status', { status: 'latest', message: 'App is up to date.' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win?.webContents.send('update-progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('update-status', { 
      status: 'downloaded', 
      message: 'Update downloaded. Restart to apply.',
      version: info.version
    });
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `A new version (v${info.version}) has been downloaded. Restart the app to apply the update.`,
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    win?.webContents.send('update-status', { 
      status: 'error', 
      message: `Update Error: ${err.message}` 
    });
  });

  // Global Shortcut to toggle visibility
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
      win.setSkipTaskbar(true);
    } else {
      win.show();
      win.setSkipTaskbar(false);
      win.focus();
    }
  });

  // IPC Listeners
  ipcMain.on('toggle-window', () => {
    if (win.isVisible()) {
      win.hide();
      win.setSkipTaskbar(true);
    } else {
      win.show();
      win.setSkipTaskbar(false);
      win.focus();
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('capture-screen', async () => {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    // For simplicity, capture the first screen
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
    return null;
  });

  ipcMain.handle('ask-ai', async (event, { apiKey, baseUrl, model, messages, systemPrompt }) => {
    try {
      // Check if any message contains an image (for screen capture analysis)
      const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));

      // Check for Google Gemini
      if (baseUrl.includes('generativelanguage.googleapis.com') || model.toLowerCase().includes('gemini')) {
          const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
          // Gemini 3.1 models might need the models/ prefix if not already present, but the URL must be clean
          const modelName = model.replace(/^models\//, '');
          const url = `${cleanBaseUrl}/models/${modelName}:generateContent?key=${apiKey}`;
          
          console.log('[Main] Calling Gemini at:', url); // Debug log
          
          const contents = messages.map(msg => {
              const role = msg.role === 'assistant' ? 'model' : 'user';
              
              // Handle vision/image parts for Gemini
              if (Array.isArray(msg.content)) {
                  const parts = msg.content.map(part => {
                      if (part.type === 'image_url') {
                          // Extract base64 from data:image/png;base64,...
                          const base64Data = part.image_url.url.split(',')[1];
                          return {
                              inline_data: {
                                  mime_type: "image/png",
                                  data: base64Data
                              }
                          };
                      }
                      return { text: part.text };
                  });
                  return { role, parts };
              }

              return {
                  role: role,
                  parts: [{ text: msg.content }]
              };
          });

          const body = {
              contents: contents,
              system_instruction: {
                  parts: [{ text: systemPrompt }]
              }
          };

          const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error?.message || `Gemini API Error: ${response.statusText}`);
          }

          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // OpenAI / Standard Logic
      const finalMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => {
          // Flatten content for non-vision models if necessary, 
          // but GPT-4o supports the array format directly.
          return m;
        })
      ];
      
      // Ensure no trailing slashes in base URL if we are appending /chat/completions
      // But usually user provides 'https://api.openai.com/v1', so we append '/chat/completions'
      // Some providers like OpenRouter might differ.
      const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          // Add referer for OpenRouter or others if needed
          'HTTP-Referer': 'https://clueinterview.com',
          'X-Title': 'Clue Interview'
        },
        body: JSON.stringify({
          model: model,
          messages: finalMessages
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API Error in Main Process:', error);
      throw error.message;
    }
  });

let activeSTTConnections = new Map();

async function getSpeechmaticsTranscript(params) {
  const { apiKey, finalBuffer, model, language, sampleRate } = params;
  const sessionId = 'speechmatics-global';
  
  try {
    const { createSpeechmaticsJWT } = await import('@speechmatics/auth');
    const { RealtimeClient } = await import('@speechmatics/real-time-client');

    let session = activeSTTConnections.get(sessionId);
    
    // Check if session exists, has the same key, and the internal websocket is likely active
    if (!session || session.apiKey !== apiKey) {
      if (session && session.client) {
        try { await session.client.stopRecognition(); } catch (e) {}
      }
      
      const client = new RealtimeClient();
      
      const newSession = { 
        client, 
        ws: null,
        transcript: '', 
        partialTranscript: '',
        apiKey, 
        lastUsed: Date.now(),
        isReady: false,
        handshakeError: null,
        pendingResolvers: []
      };

      client.addEventListener("receiveMessage", ({ data }) => {
        if (data.message === "AddTranscript" || data.message === "AddPartialTranscript") {
          const transcriptText = typeof data.metadata?.transcript === 'string'
            ? data.metadata.transcript.trim()
            : Array.isArray(data.results)
              ? data.results.map((result) => result.alternatives?.[0]?.content || '').join(' ').trim()
              : '';

          if (data.message === "AddTranscript") {
            newSession.transcript = transcriptText;
          } else {
            newSession.partialTranscript = transcriptText;
          }

          const resolvedTranscript = (newSession.transcript || newSession.partialTranscript).trim();
          if (resolvedTranscript) {
            for (const resolve of newSession.pendingResolvers.splice(0)) {
              resolve({
                provider: 'speechmatics',
                text: resolvedTranscript,
                isFinal: data.message === "AddTranscript",
                kind: data.message === "AddTranscript" ? 'final_segment' : 'partial_segment'
              });
            }
          }
        } else if (data.message === "RecognitionStarted") {
          newSession.isReady = true;
        } else if (data.message === "Error") {
          console.error('[Main] Speechmatics Error:', data.reason);
          newSession.handshakeError = data.reason || 'Speechmatics websocket error';
        }
      });

      const jwt = await createSpeechmaticsJWT({
        type: "rt",
        apiKey,
        ttl: 3600,
      });

    const operatingPoint = (model || 'standard').trim() || 'standard';
    const languageCode = (language || 'en').trim() || 'en';

      await client.start(jwt, {
        transcription_config: {
          language: languageCode,
          operating_point: operatingPoint,
          max_delay: 1.0,
          enable_partials: true,
          transcript_filtering_config: {
            remove_disfluencies: true,
          },
        },
        audio_format: {
          type: "raw",
          encoding: "pcm_s16le",
          sample_rate: sampleRate || 16000,
        },
      });

      // Wait for RecognitionStarted
      await new Promise((resolve, reject) => {
        let checkReady = setInterval(() => {
          if (newSession.isReady) {
            clearInterval(checkReady);
            clearTimeout(timeoutId);
            resolve();
          }
          if (newSession.handshakeError) {
            clearInterval(checkReady);
            clearTimeout(timeoutId);
            reject(new Error(`Speechmatics: ${newSession.handshakeError}`));
          }
        }, 100);

        const timeoutId = setTimeout(() => {
          clearInterval(checkReady);
          if (!newSession.isReady) reject(new Error('Speechmatics RecognitionStarted Timeout'));
        }, 5000);
      });

      activeSTTConnections.set(sessionId, newSession);
      session = newSession;
    }

    const previousTranscript = (session.transcript || session.partialTranscript || '').trim();
    session.transcript = ''; 
    session.partialTranscript = '';
    session.lastUsed = Date.now();
    
    await session.client.sendAudio(Buffer.from(finalBuffer));

    const nextTranscript = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = session.pendingResolvers.indexOf(onTranscript);
        if (index >= 0) {
          session.pendingResolvers.splice(index, 1);
        }
        resolve({ provider: 'speechmatics', text: '', isFinal: false, kind: 'timeout' });
      }, 2500);

      const onTranscript = (payload) => {
        if (!payload?.text || payload.text === previousTranscript) {
          return;
        }
        clearTimeout(timeoutId);
        resolve(payload);
      };

      session.pendingResolvers.push(onTranscript);
    });

    return nextTranscript;
  } catch (err) {
    console.error('Speechmatics Error:', err);
    activeSTTConnections.delete(sessionId);
    throw err;
  }
}

async function getAssemblyAITranscript(params) {
  const { apiKey, finalBuffer, model, baseUrl, sampleRate } = params;
  const sessionId = 'assemblyai-global';
  
  try {
    let session = activeSTTConnections.get(sessionId);
    
    if (!session || session.apiKey !== apiKey || !session.ws || session.ws.readyState !== 1) {
      if (session && session.ws) session.ws.close();
      
      // Guard against accidental API-key-as-URL misconfiguration.
      const providedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';
      const normalizedBaseUrl = providedBaseUrl.startsWith('ws://') || providedBaseUrl.startsWith('wss://')
        ? providedBaseUrl
        : 'wss://streaming.assemblyai.com/v3/ws';
      const baseUrlClean = normalizedBaseUrl.replace(/\/+$/, '');
      const targetModel = model || 'universal-streaming-english';
      const url = `${baseUrlClean}?sample_rate=${sampleRate || 16000}&encoding=pcm_s16le&speech_model=${encodeURIComponent(targetModel)}&format_turns=false&end_of_turn_confidence_threshold=0.3`;
      
      console.log(`[Main] Connecting to AssemblyAI: ${baseUrlClean}`);
      
      const ws = new WebSocket(url, {
        headers: { Authorization: apiKey }
      });
      
      const newSession = { 
        ws, 
        client: null,
        transcript: '', 
        utterance: '',
        endOfTurn: false,
        apiKey, 
        lastUsed: Date.now(),
        isReady: false,
        handshakeError: null,
        pendingResolvers: []
      };
      
      ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          const msg = JSON.parse(rawMessage);
          console.log(`[Main] AssemblyAI Msg:`, JSON.stringify(msg));
          
          if (msg.type === 'Begin') {
            newSession.isReady = true;
          } else if (msg.type === 'Turn') {
            newSession.transcript = typeof msg.transcript === 'string' ? msg.transcript.trim() : '';
            newSession.utterance = typeof msg.utterance === 'string' ? msg.utterance.trim() : '';
            newSession.endOfTurn = !!msg.end_of_turn;
            if (newSession.transcript || newSession.utterance) {
              const payload = {
                provider: 'assemblyai',
                transcript: newSession.transcript,
                utterance: newSession.utterance,
                endOfTurn: newSession.endOfTurn
              };
              for (const resolve of newSession.pendingResolvers.splice(0)) {
                resolve(payload);
              }
            }
          } else if (msg.type === 'Error' || msg.error) {
            const errText = msg.error || msg.message || JSON.stringify(msg);
            console.error(`[Main] AssemblyAI Error: ${errText}`);
            newSession.handshakeError = errText;
          }
        } catch (e) {
          console.error('[Main] AssemblyAI Message Error:', e.message, 'Raw:', data.toString());
        }
      });

      await new Promise((resolve, reject) => {
        const checkReady = setInterval(() => {
          if (newSession.isReady) {
            clearInterval(checkReady);
            clearTimeout(timeoutId);
            resolve();
          }
          if (newSession.handshakeError) {
            clearInterval(checkReady);
            clearTimeout(timeoutId);
            reject(new Error(`AssemblyAI: ${newSession.handshakeError}`));
          }
        }, 100);

        const timeoutId = setTimeout(() => {
          clearInterval(checkReady);
          if (!newSession.isReady) {
            reject(new Error('AssemblyAI Handshake Timeout - No Begin event received. Check API key, model name, and audio format.'));
          }
        }, 12000);

        ws.on('error', (err) => {
          clearInterval(checkReady);
          clearTimeout(timeoutId);
          console.error('[Main] AssemblyAI WS Socket Error:', err.message);
          reject(new Error(`AssemblyAI Socket Error: ${err.message}`));
        });
      });

      activeSTTConnections.set(sessionId, newSession);
      session = newSession;
    }

    const previousTranscript = session.transcript;
    const previousUtterance = session.utterance;
    session.lastUsed = Date.now();
    
    const buffer = Buffer.from(finalBuffer);
    session.ws.send(buffer, { binary: true });

    const nextTurn = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = session.pendingResolvers.indexOf(onUpdate);
        if (index >= 0) {
          session.pendingResolvers.splice(index, 1);
        }
        resolve({ provider: 'assemblyai', text: '', isFinal: false, kind: 'timeout' });
      }, 2500);

      const onUpdate = (payload) => {
        const transcriptChanged = payload.transcript && payload.transcript !== previousTranscript;
        const utteranceChanged = payload.utterance && payload.utterance !== previousUtterance;
        if (!transcriptChanged && !utteranceChanged) {
          return;
        }
        clearTimeout(timeoutId);
        resolve(payload);
      };

      session.pendingResolvers.push(onUpdate);
    });

    if (!nextTurn || !nextTurn.provider) {
      return { provider: 'assemblyai', text: '', isFinal: false, kind: 'timeout' };
    }

    if (nextTurn.utterance) {
      return {
        provider: 'assemblyai',
        text: nextTurn.utterance,
        isFinal: true,
        kind: 'utterance'
      };
    }

    return {
      provider: 'assemblyai',
      text: nextTurn.transcript || '',
      isFinal: !!nextTurn.endOfTurn,
      kind: nextTurn.endOfTurn ? 'turn_final' : 'turn_progress'
    };
  } catch (err) {
    console.error('AssemblyAI Error:', err);
    activeSTTConnections.delete(sessionId);
    throw err;
  }
}

// Cleanup idle STT connections every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSTTConnections.entries()) {
    if (now - session.lastUsed > 5 * 60 * 1000) { // 5 minutes idle
      console.log(`[Main] Closing idle STT session: ${id}`);
      if (session.client) session.client.stopRecognition();
      if (session.ws) session.ws.close();
      activeSTTConnections.delete(id);
    }
  }
}, 60 * 1000);

  ipcMain.handle('transcribe-audio', async (event, params) => {
    try {
      if (!params) throw new Error('No parameters provided to transcribe-audio');
      
      const { apiKey, baseUrl, audioBuffer, audioData, provider, model, language, sampleRate } = params;
      
      let finalBuffer = audioBuffer;
      if (audioData && !finalBuffer) {
        finalBuffer = Buffer.from(audioData, 'base64');
      }
      
      if (!finalBuffer || (finalBuffer.byteLength === 0 && finalBuffer.length === 0)) {
        throw new Error('No audio data provided (buffer is empty)');
      }

      // Bug1 Fix: Validate minimum audio size/duration (approx 0.5s of audio)
      // Standard webm/opus headers + small chunk of audio usually > 1000 bytes
      const MIN_AUDIO_SIZE = 1000; 
      const actualSize = Buffer.isBuffer(finalBuffer) ? finalBuffer.length : (finalBuffer.byteLength ?? 0);
      if (actualSize < MIN_AUDIO_SIZE) {
        console.warn(`[Main] Skipping transcription: Audio chunk too small (${actualSize} bytes)`);
        return ''; // Return empty string instead of erroring to avoid UI noise
      }

      // Handle Speechmatics Provider
      if (provider === 'speechmatics') {
        return await getSpeechmaticsTranscript({ apiKey, finalBuffer, model, language, sampleRate });
      }

      // Handle AssemblyAI Provider
      if (provider === 'assemblyai') {
        return await getAssemblyAITranscript({ apiKey, finalBuffer, model, baseUrl, sampleRate });
      }

      // Handle Gemini Provider
      if (provider === 'gemini') {
          const modelName = (model || 'gemini-2.5-flash').replace(/^models\//, ''); 
          let apiBase = 'https://generativelanguage.googleapis.com/v1beta';
          if (baseUrl && baseUrl.includes('googleapis.com')) {
              apiBase = baseUrl.replace(/\/+$/, '');
          }
          
          const url = `${apiBase}/models/${modelName}:generateContent?key=${apiKey}`;
          console.log('[Main] Transcribing with Gemini at:', url);
          
          const base64Audio = Buffer.from(finalBuffer).toString('base64');
          
          const body = {
              contents: [{
                  parts: [
                      { text: `You are doing speech-to-text transcription. Transcribe the spoken audio exactly in ${language || 'English'}. Do not answer questions, summarize, infer, or add filler. If the audio is unclear, return only the words you can hear.` },
                      {
                          inline_data: {
                              mime_type: "audio/webm",
                              data: base64Audio
                          }
                      }
                  ]
              }],
              generationConfig: {
                  temperature: 0,
                  topP: 0.1,
                  maxOutputTokens: 256,
                  responseMimeType: 'text/plain'
              }
          };

          const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error?.message || `Gemini STT Error: ${response.statusText}`);
          }

          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (provider === 'openrouter') {
        const cleanBaseUrl = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
        const url = `${cleanBaseUrl}/chat/completions`;
        const base64Audio = Buffer.from(finalBuffer).toString('base64');
        const targetModel = model || 'openai/gpt-4o-mini-transcribe';

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://clueinterview.com',
            'X-Title': 'Clue Interview'
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Transcribe this audio exactly in ${language || 'English'}. Return only the transcription text.`
                  },
                  {
                    type: 'input_audio',
                    input_audio: {
                      data: base64Audio,
                      format: 'webm'
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `OpenRouter STT Error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return typeof content === 'string' ? content.trim() : '';
      }

      // Default: OpenAI Whisper
      const url = `${baseUrl.replace(/\/chat\/completions$/, '').replace(/\/+$/, '')}/audio/transcriptions`;
      const blob = new Blob([finalBuffer], { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('model', model || 'whisper-1');
      if (language) {
        formData.append('language', language);
      }

      console.log('[Main] Transcribing with Whisper at:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Whisper API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Transcription API Error:', error);
      throw error.message || String(error);
    }
  });

  ipcMain.on('minimize-window', () => {
    // If we minimize with skipTaskbar, it disappears. 
    // So we just hide it instead, restoring via shortcut.
    win.hide();
  });

  ipcMain.on('maximize-window', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    win.close();
  });

  ipcMain.on('resize-window', (event, { width, height }) => {
    if (win) {
      const targetWidth = Math.max(300, Math.round(width));
      const targetHeight = Math.max(400, Math.round(height));
      win.setSize(targetWidth, targetHeight);
    }
  });

  ipcMain.on('set-content-protection', (event, enable) => {
    if (win) {
        win.setContentProtection(enable);
    }
  });

  ipcMain.on('set-ghost-mode', (event, enabled) => {
    if (win) {
        // Ghost mode means the window is non-focusable.
        // This prevents interview platforms from detecting focus loss when interacting with the app.
        win.setFocusable(!enabled);
        console.log(`[Main] Ghost Mode set to: ${enabled}`);
    }
  });

  ipcMain.on('set-transparency', (event, { enabled, percent }) => {
    if (!win) return;
    const value = typeof percent === 'number' ? percent : 0;
    const clampedPercent = Math.min(80, Math.max(0, value));
    if (!enabled) {
      win.setOpacity(1);
      return;
    }
    const opacityFromPercent = 1 - clampedPercent / 100;
    const targetOpacity = Math.max(0.2, Math.min(1, opacityFromPercent));
    win.setOpacity(targetOpacity);
  });
  
  win.on('show', () => {
      // Re-apply content protection and transparency settings
      win.setSkipTaskbar(false);
      win.setContentProtection(false);
      setTimeout(() => {
          win.setContentProtection(true);
      }, 100);
  });

  win.on('hide', () => {
      win.setSkipTaskbar(true);
  });

  // Remember window state
  win.on('resize', saveWindowState);
  win.on('move', saveWindowState);

  // Handle Window Close
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
      win.setSkipTaskbar(true);
    }
    saveWindowState();
    return false;
  });
  
  // Request microphone permission on macOS (not needed for Windows usually, but good practice to handle permissions)
  // For Electron on Windows, permissions are often handled by the OS settings.
  // However, we can ensure the session checks for it.
  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return true;
  });

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    return callback(true);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png'); // Need to ensure this exists or use a default
  // For dev, if icon doesn't exist, Tray might fail or show empty.
  // We should create a simple icon or check existence.
  // Using nativeImage.createFromPath is safe.
  
  // If no icon file, we can't easily create a visual tray icon without a file.
  // Assuming we will create an icon.
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png'));

  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win.show() },
    { label: 'Hide App', click: () => win.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
    }}
  ]);
  tray.setToolTip('Clue Interview (Stealth Mode)');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
      if (win.isVisible()) win.hide();
      else win.show();
  });
}

const isDev = process.env.NODE_ENV === 'development';

// Explicitly enable Web Speech API if possible (Electron often blocks it)
// Passing specific flags to Chromium
app.commandLine.appendSwitch('enable-speech-dispatcher'); 
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');
app.commandLine.appendSwitch('auto-select-desktop-capture-source', 'Entire screen'); // Auto-select screen for capture if needed

app.whenReady().then(() => {
  createWindow();
  // Delay tray creation slightly to ensure icon assets might be ready or just safe init
  setTimeout(createTray, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
