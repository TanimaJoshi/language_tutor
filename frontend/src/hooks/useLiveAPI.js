import { useState, useRef, useCallback } from 'react';
import { AudioRecorder } from '../audio/AudioRecorder';
import { AudioPlayer } from '../audio/AudioPlayer';
import { CURRICULUM } from '../curriculum';

const SYSTEM_INSTRUCTION = `You are a native speaker of the target language the student wants to learn. You speak your native language with flawless, authentic pronunciation and perfectly natural phrasing. You are also fully fluent in English. You must use your bilingual skills to teach students of varying levels.

You are an encouraging, patient, and highly adaptive real-time language tutor. Your goal is to help the student build confidence in speaking.

Core Behavioral Rules (CRITICAL FOR BEGINNERS):

1. Native Pronunciation: You MUST pronounce words in the target language exactly as a native speaker would, complete with the authentic native accent. Never sound like an English speaker translating to the target language.
2. Bilingual Guidance: Guide the student in English when you have to explain concepts or vocabulary.
3. Active Correction: Pay close attention to the student's speech. You MUST gently correct their pronunciation and grammar mistakes.
4. Extreme Simplicity & Speed: Speak extremely slowly but respond INSTANTLY to the user. Do not pause before speaking.
5. One Step at a Time: Only introduce 1 or 2 new words in the target language at a time. NEVER speak more than 1 sentence per turn.
6. Always Translate: Whenever you use a sentence or word in the target language, immediately translate it to English.
7. Vocabulary Tracking: Whenever you introduce a new vocabulary word to the student, immediately call the record_vocabulary tool.



Lesson Flow Protocol:

Phase 1: Initial Assessment
Greet the student warmly in English. Ask them which language they would like to practice today and how they classify their current speaking skills (e.g., beginner, intermediate, advanced).

Phase 2: Curriculum Selection
If the student says they want a "guided lesson", DO NOT ask them what they want to talk about. Instead, immediately select "Lesson 1" from the curriculum provided below for their chosen language, and begin teaching it step-by-step.

Phase 3: Immersive Practice
Converse naturally but very simply based on their chosen topic or the curriculum lesson. Introduce a word, translate it, and ask them to repeat it.

Phase 4: Real-Time Correction
If the student mispronounces a word or uses incorrect grammar:
- Verbally correct them gently.
- Ask the student to repeat the corrected phrase out loud 3 times before continuing.

AVAILABLE CURRICULUM KNOWLEDGE BASE:
${JSON.stringify(CURRICULUM, null, 2)}
`;

export default function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [correctionData, setCorrectionData] = useState(null);
  
  const [newWords, setNewWords] = useState([]);
  const [needsReview, setNeedsReview] = useState([]);

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);
  const isSpeakingRef = useRef(false);

  const clearCorrection = () => setCorrectionData(null);

  const connect = useCallback(async () => {
    // Initialize Audio Components
    playerRef.current = new AudioPlayer();
    playerRef.current.setPlayStateChangeCallback((speaking) => {
      setIsSpeaking(speaking);
      isSpeakingRef.current = speaking;
    });
    
    let silenceChunks = 0;
    const SILENCE_THRESHOLD = 0.005; // Lowered significantly so quiet speech isn't ignored
    const REQUIRED_SILENCE_CHUNKS = 40; // 40 chunks of 32ms = ~1.28 seconds of silence before cutting off

    recorderRef.current = new AudioRecorder({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }, (base64PCM, volume) => {
      // HALF-DUPLEX MUTE: Completely block the microphone while the AI is speaking
      // This guarantees the AI can never hear itself and get stuck in an echo loop!
      if (isSpeakingRef.current) return;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Always send the audio chunks
        wsRef.current.send(JSON.stringify({
          realtime_input: {
            audio: {
              mime_type: "audio/pcm;rate=16000",
              data: base64PCM
            }
          }
        }));

        // Client-side VAD: Force end of turn on silence
        if (volume < SILENCE_THRESHOLD) {
          silenceChunks++;
          if (silenceChunks === REQUIRED_SILENCE_CHUNKS) {
            console.log(`[VAD] Silence detected (${silenceChunks} chunks). Sending turnComplete!`);
            wsRef.current.send(JSON.stringify({
              clientContent: {
                turnComplete: true
              }
            }));
          }
        } else {
          // Reset silence counter when we hear speech/noise
          if (silenceChunks > 0) {
            console.log(`[VAD] Speech detected (Volume: ${volume.toFixed(4)}). Resetting silence counter.`);
          }
          silenceChunks = 0;
        }
      }
    });

    const BACKEND_WS_URL = 'ws://localhost:8080';
    wsRef.current = new WebSocket(BACKEND_WS_URL);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      // Send Setup Message
      const setupMessage = {
        setup: {
          model: "models/gemini-3.1-flash-live-preview",
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: "Aoede"
                }
              }
            }
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "record_vocabulary",
                  description: "Record a newly introduced vocabulary word so the student can see it on their screen.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      word: { type: "STRING", description: "The word in the target language" },
                      translation: { type: "STRING", description: "The English translation" }
                    },
                    required: ["word", "translation"]
                  }
                }
              ]
            }
          ],
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          }
        }
      };
      
      wsRef.current.send(JSON.stringify(setupMessage));
      
      // Start capturing immediately on connect
      recorderRef.current.start();
      setIsRecording(true);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Handle Server Content (Audio/Text)
        const serverContent = msg.serverContent || msg.server_content;
        if (serverContent) {
          
          if (serverContent.interrupted) {
            if (playerRef.current) {
              playerRef.current.clear();
            }
          }

          const modelTurn = serverContent.modelTurn || serverContent.model_turn;
          if (modelTurn && modelTurn.parts) {
            modelTurn.parts.forEach(part => {
              const inlineData = part.inlineData || part.inline_data;
              if (inlineData && inlineData.data) {
                // Audio chunk
                playerRef.current.playChunk(inlineData.data);
              }
            });
          }
        }
        
        // Handle Tool Calls
        const toolCall = msg.toolCall || msg.tool_call;
        if (toolCall) {
          const functionCalls = toolCall.functionCalls || toolCall.function_calls;
          if (functionCalls && functionCalls.length > 0) {
            
            const functionResponses = functionCalls.map(call => {
              if (call.name === 'record_vocabulary') {
                setNewWords(prev => {
                  // Prevent duplicates
                  if (prev.some(w => w.word === call.args.word)) return prev;
                  return [...prev, { word: call.args.word, translation: call.args.translation }];
                });
                return { id: call.id, name: call.name, response: { result: "success" } };
              }
              return {
                id: call.id,
                name: call.name,
                response: { error: "Unknown tool" }
              };
            });

            // Send functionResponse back to Live API
            wsRef.current.send(JSON.stringify({
              toolResponse: {
                functionResponses: functionResponses
              }
            }));
          }
        }

      } catch (e) {
        console.error("Error parsing message from Gemini", e);
      }
    };

    wsRef.current.onclose = () => {
      disconnect();
    };

  }, []);

  const disconnect = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
    if (playerRef.current) {
      playerRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
  }, []);

  return {
    isConnected,
    isRecording,
    isSpeaking,
    connect,
    disconnect,
    correctionData,
    clearCorrection,
    newWords,
    needsReview
  };
}
