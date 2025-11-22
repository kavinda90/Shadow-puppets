export enum AppState {
  IDLE = 'IDLE',
  LOADING_MODEL = 'LOADING_MODEL',
  READY = 'READY',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}

export enum AppMode {
  LIVE_SHOW = 'LIVE_SHOW',
  LEARN = 'LEARN'
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

export interface TargetShadow {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  hint: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}
