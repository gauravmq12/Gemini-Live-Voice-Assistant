
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Helper functions for raw PCM audio handling
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createAudioBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

class GeminiLiveVoiceApp {
  private recordButton: HTMLButtonElement;
  private micIcon: HTMLElement;
  private recordText: HTMLElement;
  private recordingStatus: HTMLSpanElement;
  private transcriptionArea: HTMLDivElement;
  private recordWavesSVG: SVGSVGElement;

  private imageUploadInput: HTMLInputElement;
  private imagePreviewContainer: HTMLDivElement;
  private imagePreview: HTMLImageElement;
  private removeImageButton: HTMLButtonElement;

  private currentImageBase64: string | null = null;
  private currentImageMimeType: string | null = null;

  private sessionPromise: Promise<any> | null = null;
  private isRecording: boolean = false;
  
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  
  private currentInputTranscription: string = '';
  private currentOutputTranscription: string = '';

  constructor() {
    this.recordButton = document.getElementById('recordButton') as HTMLButtonElement;
    this.micIcon = document.getElementById('micIcon') as HTMLElement;
    this.recordText = document.getElementById('recordText') as HTMLElement;
    this.recordingStatus = document.getElementById('recordingStatus') as HTMLSpanElement;
    this.transcriptionArea = document.getElementById('transcriptionArea') as HTMLDivElement;
    this.recordWavesSVG = document.querySelector('.record-waves') as SVGSVGElement;

    this.imageUploadInput = document.getElementById('imageUpload') as HTMLInputElement;
    this.imagePreviewContainer = document.getElementById('imagePreviewContainer') as HTMLDivElement;
    this.imagePreview = document.getElementById('imagePreview') as HTMLImageElement;
    this.removeImageButton = document.getElementById('removeImageButton') as HTMLButtonElement;

    this.recordButton.addEventListener('click', () => this.toggleSession());
    this.imageUploadInput.addEventListener('change', (e) => this.handleImageUpload(e));
    this.removeImageButton.addEventListener('click', () => this.removeImage());

    this.updateStatus('Ready to connect');
  }

  private updateStatus(message: string, isError: boolean = false): void {
    this.recordingStatus.textContent = message;
    this.recordingStatus.style.color = isError ? '#ff453a' : '#A8A8A8';
  }

  private async handleImageUpload(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const fullBase64 = e.target?.result as string;
        this.currentImageBase64 = fullBase64.split(',')[1];
        this.currentImageMimeType = file.type;
        this.imagePreview.src = fullBase64;
        this.imagePreviewContainer.style.display = 'block';
        
        if (this.sessionPromise) {
          this.sessionPromise.then(session => {
            session.sendRealtimeInput({
              media: { data: this.currentImageBase64!, mimeType: this.currentImageMimeType! }
            });
          });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private removeImage(): void {
    this.currentImageBase64 = null;
    this.currentImageMimeType = null;
    this.imagePreview.src = '#';
    this.imagePreviewContainer.style.display = 'none';
    this.imageUploadInput.value = '';
  }

  private async toggleSession() {
    if (this.isRecording) {
      this.stopSession();
    } else {
      await this.startSession();
    }
  }

  private async startSession() {
    this.isRecording = true;
    this.updateUI();
    this.updateStatus('Connecting...');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: 'You are a helpful and expressive voice assistant named Zephyr. Start by greeting the user briefly. You can see images if the user uploads them.',
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            this.updateStatus('Connected & Listening');
            
            // Resume contexts if they were suspended by browser policy
            if (this.inputAudioContext?.state === 'suspended') this.inputAudioContext.resume();
            if (this.outputAudioContext?.state === 'suspended') this.outputAudioContext.resume();

            const source = this.inputAudioContext!.createMediaStreamSource(stream);
            const scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!this.isRecording) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createAudioBlob(inputData);
              
              this.sessionPromise?.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext!.destination);

            // Send initial image if present
            if (this.currentImageBase64) {
              this.sessionPromise?.then(session => {
                session.sendRealtimeInput({
                  media: { data: this.currentImageBase64!, mimeType: this.currentImageMimeType! }
                });
              });
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.inputTranscription) {
              this.currentInputTranscription += message.serverContent.inputTranscription.text;
              this.renderTranscription();
            }
            if (message.serverContent?.outputTranscription) {
              this.currentOutputTranscription += message.serverContent.outputTranscription.text;
              this.renderTranscription();
            }
            if (message.serverContent?.turnComplete) {
              this.appendTranscriptionToHistory();
            }

            // Handle Audio Output
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data && this.outputAudioContext) {
                const base64Audio = part.inlineData.data;
                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  this.outputAudioContext,
                  24000,
                  1
                );
                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.outputAudioContext.destination);
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.activeSources.add(source);
                source.onended = () => this.activeSources.delete(source);
              }
            }

            if (message.serverContent?.interrupted) {
              this.stopAllAudio();
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            this.updateStatus('Network Error - Check API Key/Model', true);
            this.stopSession();
          },
          onclose: () => {
            this.updateStatus('Disconnected');
            this.stopSession();
          }
        }
      });
    } catch (err) {
      console.error('Failed to start session:', err);
      this.updateStatus('Mic Access or Network Error', true);
      this.isRecording = false;
      this.updateUI();
    }
  }

  private stopAllAudio() {
    this.activeSources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  private stopSession() {
    this.isRecording = false;
    this.updateUI();
    this.stopAllAudio();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        try { session.close(); } catch(e) {}
      });
      this.sessionPromise = null;
    }
    
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    this.updateStatus('Session Ended');
  }

  private renderTranscription() {
    let activeTurn = document.getElementById('activeTurn');
    if (!activeTurn) {
      activeTurn = document.createElement('div');
      activeTurn.id = 'activeTurn';
      this.transcriptionArea.appendChild(activeTurn);
    }
    
    const inputHtml = this.currentInputTranscription ? `<p class="user-transcription"><strong>You:</strong> ${this.currentInputTranscription}</p>` : '';
    const outputHtml = this.currentOutputTranscription ? `<p class="ai-transcription"><strong>Zephyr:</strong> ${this.currentOutputTranscription}</p>` : '';
    
    activeTurn.innerHTML = inputHtml + outputHtml;
    this.transcriptionArea.scrollTop = this.transcriptionArea.scrollHeight;
  }

  private appendTranscriptionToHistory() {
    const activeTurn = document.getElementById('activeTurn');
    if (activeTurn) {
      activeTurn.id = ''; // Finalize this turn in history
    }
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
  }

  private updateUI() {
    if (this.isRecording) {
      this.recordButton.classList.add('recording');
      this.micIcon.className = 'fas fa-stop';
      this.recordText.textContent = 'Stop';
      this.recordWavesSVG.style.display = 'block';
    } else {
      this.recordButton.classList.remove('recording');
      this.micIcon.className = 'fas fa-microphone';
      this.recordText.textContent = 'Talk';
      this.recordWavesSVG.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GeminiLiveVoiceApp();
});
