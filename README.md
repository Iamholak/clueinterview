# AI Interview Copilot

An AI-powered desktop application that listens to your interview and provides real-time answers and suggestions.

## Features

- **Live Transcription**: Listens to speech via microphone.
- **AI Answers**: Uses OpenAI GPT-4 to generate professional answers.
- **Stealth Mode**: The application window is hidden from screen sharing (viewers see it as invisible or blacked out), but remains visible to you.
- **Always on Top**: Floats over other windows for easy reference.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Development Mode**:
    ```bash
    npm run electron:dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    npm run electron:build
    ```

## Usage

1.  Launch the app.
2.  Enter your **OpenAI API Key** in the settings.
3.  Click **Start Listening** to begin transcription.
    *   *Note*: Ensure your microphone can pick up the audio. If using headphones, the interviewer's voice might not be captured unless you route system audio to the microphone (e.g., using VB-Cable) or if the app is updated to capture system audio directly.
4.  The transcript will appear in real-time.
5.  Click **Get Answer** (or wait if auto-mode is enabled in future versions) to get AI suggestions.

## "Hidden" Feature

This app uses `setContentProtection(true)` which prevents the window from being captured by screen sharing software (Zoom, Teams, etc.) on Windows and macOS.
-   When you share your **entire screen**, the overlay should be invisible to the remote viewer.
-   When you share a **specific window** (e.g., your code editor), the overlay is definitely not visible to the viewer as it is a separate window.

## Troubleshooting

-   **Microphone Permission**: Ensure you allow microphone access if prompted.
-   **API Key**: Ensure your OpenAI API key has credits and is valid.
