# ClueInterview - AI Interview Copilot

An AI-powered stealth desktop application designed to provide real-time assistance during technical interviews. It captures audio, transcribes it, and provides expert AI suggestions without being detected by screen-sharing software.

## 🚀 Key Features

-   **🥷 Stealth Mode**: Built-in "Content Protection" makes the window completely invisible to screen-sharing apps (Zoom, Teams, Google Meet, etc.). Even if you share your entire screen, viewers see nothing.
-   **🎙️ Real-time Transcription**: Supports both native Browser Speech API and high-accuracy OpenAI Whisper STT.
-   **🤖 Multi-Model AI**: Connect to OpenAI (GPT-4o), Google Gemini (1.5 Flash), or any OpenAI-compatible API (DeepSeek, Local LLMs).
-   **📌 Always-on-Top**: Floats seamlessly over your browser or IDE.
-   **📋 Smart Interaction**: 
    -   Select and copy any AI output or transcript.
    -   Manual input for specific questions.
    -   Session history to review your interviews later.
-   **🔄 Auto-Updates**: Stays up-to-date automatically via background checks.

## 🛠️ Setup & Development

### Prerequisites
-   Node.js (v18+)
-   NPM or Yarn

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-private-repo/clueinterview.git
    cd clueinterview
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```

### Development
Run the app in development mode with hot-reloading:
```bash
npm run dev
```

### Building for Production
To package the app for Windows:
```bash
# Set your GitHub token if you want to publish a release
$env:GH_TOKEN="your_token_here"
npm run electron:build -- -p always
```

## ⚙️ Configuration

1.  **API Keys**: Open the **Settings** gear icon in the app.
2.  **Transcription**: Choose between "Browser" (Free) or "Whisper" (Paid, higher accuracy).
3.  **Stealth Settings**: Toggle "Stealth Mode" to enable/disable invisibility from screen-sharing.
4.  **Shortcuts**: 
    -   `Ctrl + Shift + H`: Emergency toggle to show/hide the app instantly.

## 🔒 Privacy & Security

-   **Private Builds**: Source code remains in your private repository.
-   **Public Releases**: Only compiled binaries and update metadata are hosted in the public releases repo to enable seamless auto-updates for users.
-   **No Data Logging**: Your API keys and interview transcripts are stored locally in your app's storage and never sent to our servers.

---
*Disclaimer: Use this tool responsibly and ethically in accordance with your local laws and company policies.*
