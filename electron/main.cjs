const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

let tray = null;
let win = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const isDev = process.env.NODE_ENV === 'development';
  const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png');

  win = new BrowserWindow({
    width: 400,
    height: 600,
    x: width - 420,
    y: 50,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Enable web security
      enableBlinkFeatures: 'MediaDevices' // Enable media devices for microphone access
    },
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true, // Explicitly allow resizing
    hasShadow: false,
    autoHideMenuBar: true,
    skipTaskbar: true, // Hide from taskbar
    backgroundColor: '#00000000',
  });

  // Remove the menu completely
  win.setMenu(null);

  // Hides the window from screen capture
  win.setContentProtection(true);

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Check for updates in production
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Auto-updater events
  autoUpdater.on('update-available', () => {
    console.log('Update available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart the app to apply the update.',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Global Shortcut to toggle visibility (Safety net since no taskbar icon)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });

  // IPC Listeners
  ipcMain.handle('ask-ai', async (event, { apiKey, baseUrl, model, messages, systemPrompt }) => {
    try {
      // Check for Google Gemini
      if (baseUrl.includes('generativelanguage.googleapis.com') || model.includes('gemini')) {
          const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
          // Construct URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=API_KEY
          const url = `${cleanBaseUrl}/models/${model}:generateContent?key=${apiKey}`;
          
          // Convert messages to Gemini format
          // Gemini uses 'user' and 'model' roles. System prompt is often separate or merged.
          // Gemini 1.5 supports system_instruction.
          
          const contents = messages.map(msg => {
              // Map 'assistant' to 'model'
              const role = msg.role === 'assistant' ? 'model' : 'user';
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
          // Gemini response structure: candidates[0].content.parts[0].text
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      // OpenAI / Standard Logic
      const finalMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
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
          'X-Title': 'ClueInterview'
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

  ipcMain.handle('transcribe-audio', async (event, { apiKey, baseUrl, audioBuffer, provider }) => {
    try {
      // audioBuffer comes as an ArrayBuffer/Uint8Array from renderer

      // Handle Gemini Provider
      if (provider === 'gemini') {
          // Use specific version to avoid 'not found' errors
          const model = 'gemini-2.5-flash'; 
          
          // Use default Gemini base URL if generic one provided, or use custom if it looks like Google's
          let apiBase = 'https://generativelanguage.googleapis.com/v1beta';
          if (baseUrl && baseUrl.includes('googleapis.com')) {
              apiBase = baseUrl.replace(/\/+$/, '');
          }
          
          const url = `${apiBase}/models/${model}:generateContent?key=${apiKey}`;
          console.log('[Main] Transcribing with Gemini at:', url); // Debug log
          
          // Convert buffer to base64
          const base64Audio = Buffer.from(audioBuffer).toString('base64');
          
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

      // Default: OpenAI Whisper
      // Convert to Blob for fetch
      const blob = new Blob([audioBuffer], { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('model', 'whisper-1');
      // Optional: prompt to guide context
      // formData.append('prompt', 'Interview conversation');

      // Adjust URL for audio endpoint
      // baseUrl usually is .../v1. We need .../v1/audio/transcriptions
      // If baseUrl ends with /chat/completions, strip it.
      // A safe bet is using the base origin if possible, but let's assume baseUrl is like https://api.openai.com/v1
      let cleanBaseUrl = baseUrl.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
      
      // HACK: OpenRouter does not support audio transcriptions yet.
      // If the user points to OpenRouter, we should try to fallback to OpenAI's endpoint if possible,
      // or just fail if they don't have a key. But if they provided a key that works for OpenAI...
      // Actually, if the user explicitly set a Whisper Base URL in settings, it comes here as `baseUrl`.
      // If they didn't, it might be the Chat URL.
      // We should detect if it's openrouter and force OpenAI endpoint if so?
      // No, that assumes their key is an OpenAI key. 
      // Better strategy: The frontend should send the correct URL.
      // But as a failsafe, if we see openrouter.ai in the URL, we know it will fail.
      // For now, let's just log it clearly.
      
      const url = `${cleanBaseUrl}/audio/transcriptions`;

      console.log('Transcribing audio to:', url); // Debug log

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Content-Type is set automatically by fetch with FormData boundary
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
      console.error('Whisper API Error in Main Process:', error);
      throw error.message;
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
      win.setSize(Math.round(width), Math.round(height));
    }
  });

  ipcMain.on('set-content-protection', (event, enable) => {
    if (win) {
        win.setContentProtection(enable);
        // Sometimes transparency needs a nudge if toggling protection affects DWM
        // But usually setContentProtection is enough.
    }
  });
  
  // Fix black screen on show
  win.on('show', () => {
      // Re-apply content protection and transparency settings
      win.setContentProtection(false);
      setTimeout(() => {
          win.setContentProtection(true);
      }, 100);
  });

  // Handle Window Close
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
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
  tray.setToolTip('ClueInterview (Stealth Mode)');
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
