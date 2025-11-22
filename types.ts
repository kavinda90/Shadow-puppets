export enum AppState {
  IDLE = 'IDLE',
  LOADING_MODEL = 'LOADING_MODEL',
  READY = 'READY',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GeminiLiveConfig {
  model: string;
  systemInstruction: string;
}