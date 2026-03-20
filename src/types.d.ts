
export {};

interface GenericSpeechRecognitionConstructor {
  new (): unknown;
}

type AskAIMessageContent =
  | string
  | {
      type: string;
      [key: string]: unknown;
    }
  | Array<{
      type: string;
      [key: string]: unknown;
    }>;

interface AskAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: AskAIMessageContent;
}

interface AskAIParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: AskAIMessage[];
  systemPrompt?: string;
}

interface TranscribeAudioParams {
  apiKey: string;
  baseUrl: string;
  audioBuffer: ArrayBuffer;
  provider: string;
  model?: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: GenericSpeechRecognitionConstructor;
    SpeechRecognition: GenericSpeechRecognitionConstructor;
    testRecognition?: { stop: () => void };
    electron: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      toggleWindow: () => void;
      captureScreen: () => Promise<string>;
      askAI: (params: AskAIParams) => Promise<string>;
      transcribeAudio: (params: TranscribeAudioParams) => Promise<string>;
      resize: (width: number, height: number) => void;
      setContentProtection?: (enable: boolean) => void;
      setTransparency?: (enabled: boolean, percent: number) => void;
      checkForUpdates: () => Promise<{ success: boolean; result?: unknown; error?: string }>;
    };
  }
}
