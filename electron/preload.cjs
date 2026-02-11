const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  setContentProtection: (enable) => ipcRenderer.send('set-content-protection', enable),
  askAI: (params) => ipcRenderer.invoke('ask-ai', params),
  transcribeAudio: (params) => ipcRenderer.invoke('transcribe-audio', params),
  resize: (width, height) => ipcRenderer.send('resize-window', { width, height }),
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector)
      if (element) element.innerText = text
    }
  
    for (const dependency of ['chrome', 'node', 'electron']) {
      replaceText(`${dependency}-version`, process.versions[dependency])
    }
  })
