import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, PCM_SAMPLE_RATE } from '../utils/audio';

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null; // Using any for the session object due to complex internal types
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private inputProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API_KEY is missing");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  public async connect(
    onMessage: (text: string) => void,
    onError: (error: Error) => void
  ) {
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

    // CRITICAL: Resume AudioContext immediately to prevent "autoplay" blocks
    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are an enchanted theater narrator watching a shadow puppet show. The user is making hand shadows on a wall. As soon as you see the first image, describe what you see (rabbits, birds, wolves) and weave a short, whimsical story about them. If you don't see a clear shape yet, encourage the user to make one. Speak clearly and with wonder.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Deep, storytelling voice
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            this.startAudioInput(stream);
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message, onMessage);
          },
          onerror: (e: ErrorEvent) => {
            console.error("Gemini Live Error", e);
            onError(new Error("Connection error"));
          },
          onclose: () => {
            console.log("Gemini Live Session Closed");
          },
        },
      });

    } catch (err) {
      console.error("Failed to connect to Gemini Live", err);
      onError(err as Error);
    }
  }

  private startAudioInput(stream: MediaStream) {
    if (!this.inputAudioContext || !this.session) return;

    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.inputProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.inputProcessor.onaudioprocess = (e) => {
      if (!this.session) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      // Send audio chunk
      this.session.sendRealtimeInput({ media: pcmBlob });
    };

    this.mediaStreamSource.connect(this.inputProcessor);
    this.inputProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage, onText: (text: string) => void) {
    // Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      try {
        // Ensure context is running (sometimes browsers suspend it if no user interaction happened recently)
        if (this.outputAudioContext.state === 'suspended') {
            await this.outputAudioContext.resume();
        }

        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        const audioBuffer = await decodeAudioData(
          base64ToUint8Array(base64Audio),
          this.outputAudioContext
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        
        source.addEventListener('ended', () => {
          this.sources.delete(source);
        });
        this.sources.add(source);
        
        this.nextStartTime += audioBuffer.duration;
      } catch (e) {
        console.error("Error decoding audio", e);
      }
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  public sendVideoFrame(base64Image: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        media: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      });
    }
  }

  public async disconnect() {
    if (this.session) {
      this.session = null;
    }

    if (this.inputProcessor) {
      this.inputProcessor.disconnect();
      this.inputProcessor = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    this.sources.forEach(s => s.stop());
    this.sources.clear();

    if (this.inputAudioContext) {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      await this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
  }
}