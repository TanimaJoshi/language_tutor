# Language Tutor App

A real-time AI language tutor powered by the Gemini Live API.

## Architecture

This application uses a Node.js backend relay server to establish a secure WebSocket connection to the Gemini Live API, and a React frontend that streams 16kHz PCM audio directly to the API for real-time conversational learning.

## Gemini Live API Optimizations

To achieve near-instantaneous response times and completely eradicate acoustic echo without relying on Push-to-Talk (PTT), this application implements several highly customized Web Audio API configurations:

### 1. Client-Side Software Noise Gate (VAD)
Relying on Gemini's server-side Voice Activity Detection (VAD) introduces latency, especially in noisy environments, because the server waits for absolute silence. 
* **Implementation:** The frontend calculates the Root Mean Square (RMS) volume of the microphone input in real-time. If the volume drops below a strict threshold (`0.005`) for `~1.28` seconds, the client instantly fires a `clientContent: { turnComplete: true }` signal to the API.
* **Result:** This overrides the server-side VAD, forcing the Gemini model to respond immediately the moment the user stops speaking.

### 2. Micro-Audio Chunking
* **Implementation:** By default, standard Web Audio processors buffer large amounts of audio before processing. We customized the `audio-worklet.js` to process extremely small `512` frame chunks.
* **Result:** Audio is streamed to Gemini in `32ms` increments (instead of `256ms`). This drastically reduces the "Time-to-First-Token" latency because the model no longer waits for massive audio buffers to fill up before tokenization.

### 3. Half-Duplex Auto-Mute (Acoustic Echo Prevention)
Because the application is entirely hands-free, the microphone easily picks up the AI's voice playing through the computer speakers, leading to infinite echo feedback loops (the AI talking to itself).
* **Implementation:** We linked a `isSpeakingRef` directly to the `AudioPlayer`'s `activeSources` array length. If the array length is `> 0` (meaning audio is actively playing), the microphone drops all recording operations.
* **Result:** The microphone is physically muted during the AI's turn, completely eradicating acoustic echo. The exact millisecond the audio queue empties, the microphone re-opens.

### 4. toolResponse Payload Formatting
* **Implementation:** When handling tool calls (like `record_vocabulary`), the frontend uses camelCase payload formatting (`toolResponse: { functionResponses: [...] }`).
* **Result:** The Gemini Live API requires strict camelCase for tool responses. Failing to format this correctly results in the model silently accumulating "pending" tool calls in its context window until it hits a hard limit (usually after ~5 turns) and permanently stagnates.
