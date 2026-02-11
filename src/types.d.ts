
export {};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    electron?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      setContentProtection?: (enable: boolean) => void;
      askAI: (params: any) => Promise<string>;
      transcribeAudio: (params: any) => Promise<string>;
      resize: (width: number, height: number) => void;
    };
  }
}
