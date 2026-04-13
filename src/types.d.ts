
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

type TranscribeAudioParams = {
  apiKey: string;
  baseUrl: string;
  provider: string;
  model?: string;
  sampleRate?: number;
  audioBuffer?: ArrayBuffer | Uint8Array;
  audioData?: string;
} & ({ audioBuffer: ArrayBuffer | Uint8Array } | { audioData: string });

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
      setGhostMode?: (enabled: boolean) => void;
      checkForUpdates: () => Promise<{ success: boolean; result?: unknown; error?: string }>;
      onUpdateStatus: (callback: (data: { status: string; message: string; version?: string }) => void) => void;
      onUpdateProgress: (callback: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => void;
    };
  }
}
