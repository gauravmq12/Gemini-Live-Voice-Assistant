# Gemini Live Voice Assistant 🎙️

A real-time multimodal voice assistant web application powered by the **Google Gen AI SDK** (`@google/genai`) and the **Gemini Live API**. It enables low-latency bidirectional voice conversations with live speech-to-text transcriptions and multimodal image input.

<img width="483" height="740" alt="image" src="https://github.com/user-attachments/assets/4153c7f7-af13-4bc4-8c50-e7ba1d980ba1" />

---

## ✨ Features

- 🎙️ **Real-Time Bidirectional Voice**: Stream microphone input directly using raw 16kHz PCM audio to Gemini Live and stream back synthesized natural voice responses at 24kHz.
- 🗣️ **Live Transcriptions**: Simultaneous real-time transcription display for both user speech and Gemini assistant responses.
- 🖼️ **Multimodal Vision Input**: Upload images (PNG, JPEG, WebP) during your conversation so Gemini can analyze and talk about what you show it.
- ⚡ **Natural Barge-In & Interruption**: Audio playback automatically cancels when the user begins speaking, mimicking a natural conversational flow.
- 🎨 **Minimalist Responsive UI**: Modern dark theme with audio waveform indicators and clean typography.

---

## 🛠️ Tech Stack

- **Framework / Bundler**: [Vite](https://vitejs.dev/) + TypeScript
- **AI SDK**: [`@google/genai`](https://www.npmjs.com/package/@google/genai)
- **Model**: `gemini-2.5-flash-native-audio-preview-09-2025`
- **Voice**: Prebuilt voice `Zephyr`
- **Audio APIs**: HTML5 Web Audio API (`AudioContext`, `ScriptProcessorNode`, `AudioBufferSourceNode`)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the repository

bash git clone https://github.com/your-username/gemini-live-voice-assistant.git cd gemini-live-voice-assistant

### 2. Install dependencies
npm install

### 3. Configure Environment Variables
Create a .env file in the root directory and add your Gemini API key:
GEMINI_API_KEY=your_actual_api_key_here
(Note: The project supports either GEMINI_API_KEY or API_KEY)

### 4. Run the Development Server
npm run dev

Open your browser at http://localhost:5173 (or the URL shown in your terminal).
🎯 How to Use
Microphone Permission: Allow microphone access in your browser when prompted.
Start Conversation: Click the Talk button with the microphone icon.
Speak: Talk naturally. You will see your transcription appear in real-time alongside Gemini's responses.
Multimodal Analysis: Click Upload Image to send an image (e.g. diagrams, photos, documents) and ask Gemini questions about it.
Stop: Click the Stop button whenever you want to end the session.

📁 Project Structure
code
Code
├── index.html          # Main HTML entry with audio controls & chat UI
├── index.css           # Styling and animations for waveform & dark interface
├── index.tsx           # Application logic, Gemini Live WebSocket session, & Web Audio pipeline
├── vite.config.ts      # Vite configuration & environment variable mappings
├── package.json        # Project scripts and dependencies
├── tsconfig.json       # TypeScript compiler configuration
└── README.md           # Project documentation

📜 Available Scripts
npm run dev - Start local development server
npm run build - Compile and build production assets into dist/
npm run preview - Preview production build locally

📄 License
This project is open source and available under the MIT License.
