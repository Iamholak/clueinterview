
export {};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    electron: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      toggleWindow: () => void;
      captureScreen: () => Promise<string>;
      askAI: (params: any) => Promise<string>;
      transcribeAudio: (params: any) => Promise<string>;
      resize: (width: number, height: number) => void;
      setContentProtection?: (enable: boolean) => void;
    };
  }
}
