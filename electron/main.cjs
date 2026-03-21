const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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

  ipcMain.handle('transcribe-audio', async (event, params) => {
    try {
      if (!params) throw new Error('No parameters provided to transcribe-audio');
      
      const { apiKey, baseUrl, audioBuffer, audioData, provider, model } = params;
      
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
      const actualSize = finalBuffer.byteLength ?? finalBuffer.length ?? 0;
      if (actualSize < MIN_AUDIO_SIZE) {
        console.warn(`[Main] Skipping transcription: Audio chunk too small (${actualSize} bytes)`);
        return ''; // Return empty string instead of erroring to avoid UI noise
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
                      { text: "Transcribe the following audio exactly. Output only the transcription text." },
                      {
                          inline_data: {
                              mime_type: "audio/webm",
                              data: base64Audio
                          }
                      }
                  ]
              }]
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
                    text: 'Transcribe this audio exactly. Return only the transcription text.'
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
