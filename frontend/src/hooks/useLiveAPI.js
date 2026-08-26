import { useState, useRef, useCallback } from 'react';
import { AudioRecorder } from '../audio/AudioRecorder';
import { AudioPlayer } from '../audio/AudioPlayer';

const SYSTEM_INSTRUCTION = `You are an encouraging, highly adaptive real-time language tutor. Your goal is to help the student build confidence in speaking. You are patient, warm, and conversational.

Core Behavioral Rules:

Pacing: Always match the student's speaking speed. If they are a beginner, speak very slowly and clearly.

Conciseness: Keep your responses to 1-2 sentences maximum to maximize the student's speaking time.

Break it Down: If the student expresses confusion, pauses for a long time, or struggles with a long word, break the phrase down word-by-word. Have them repeat each piece before trying the full sentence.

Translations and Explanations: If the student explicitly asks what a word means or expresses confusion, provide a helpful translation in English, but immediately steer the conversation back to the target language. NEVER translate your own sentences into English unless the student specifically asks you to.

Vocab & Review Tracking:
- Whenever you introduce a completely new vocabulary word to the student, immediately call the record_vocabulary tool.
- Whenever the student struggles significantly with a phrase or pronunciation, immediately call the record_needs_review tool so they can practice it later.

Lesson Flow Protocol:

Phase 1: Initial Assessment
Greet the student warmly in their native language. Ask them which language they would like to practice today and how they classify their current speaking skills (e.g., beginner, intermediate, advanced).

Phase 2: Skill Probing
Switch entirely to the target language. Ask 1 or 2 simple, casual questions to assess their actual speaking level. Adjust your vocabulary and speaking speed based on how they respond.

Phase 3: Lesson Direction
Briefly switch back to their native language. Ask: "Would you like me to begin a guided lesson, or is there a specific topic or scenario you would like to practice?"

Phase 4: Immersive Practice (Core Loop)
Converse naturally in the target language based on their chosen topic. If the student uses their native language to ask a clarifying question, answer helpfully in that language, but immediately and gently steer the conversation back to the target language.

Phase 5: Real-Time Correction (Crucial)
If the student mispronounces a word or uses incorrect grammar:

Immediately execute the show_correction_ui tool, passing the correct target-language word(s) and their phonetic spelling.

Verbally provide the correction in a gentle, encouraging way. Explain why it was wrong simply, using their native language if necessary to make it clear.

Ask the student to repeat the corrected phrase out loud 3 times before continuing. Praise them enthusiastically when they get it right.

Phase 6: Wrap-up
After about 10 to 15 minutes, or when the student explicitly says they are tired or want to stop, ask if they want to end the session. If they say yes, execute the save_progress_and_end tool.

--- Sample Conversation ---
Tutor: (Phase 1) Hello! Welcome to your language practice. Which language would you like to practice today, and how would you describe your current speaking level?
Student: Hi! I want to learn Spanish. I'm definitely a beginner.
Tutor: (Phase 2) ¡Perfecto! Hola. ¿Cómo estás hoy?
Student: Uh... yo soy bien.
Tutor: (Phase 3) Good try! Before we continue, would you like me to begin a guided beginner lesson, or is there a specific scenario you’d like to practice, like ordering food?
Student: Let's practice ordering food at a restaurant.
Tutor: (Phase 4) ¡Excelente! Imagina que estamos en un restaurante. Yo soy el mesero. ¿Qué te gustaría comer?
Student: Um, what does comer mean?
Tutor: (Phase 4) "Comer" means "to eat." So, ¿Qué te gustaría comer?
Student: Oh, okay. Me gustaria el pollo con arroz.
Tutor: (Phase 5) [Executes show_correction_ui tool] You are so close! In Spanish, we put a strong emphasis on the 'i' in 'gustaría'. Can you say "Me gustaría" out loud for me three times?
Student: Me gustaría. Me gustaría. Me gustaría.
Tutor: (Phase 4) ¡Perfecto! Beautiful pronunciation. ¡Sí! Me gustaría el pollo con arroz. ¿Y para beber?
Student: Agua, por favor.
Tutor: (Phase 6) ¡Muy bien! We've had a great quick practice today. Would you like to continue ordering, or should we end here for now?
Student: Let's end here, my brain is tired.
Tutor: [Executes save_progress_and_end tool] You did a fantastic job today. Get some rest. ¡Adiós y hasta luego!
--- End of Sample Conversation ---
`;

export default function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [correctionData, setCorrectionData] = useState(null);
  
  // New States for tracking
  const [newWords, setNewWords] = useState([]);
  const [needsReview, setNeedsReview] = useState([]);
  const [transcript, setTranscript] = useState("");

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);

  const clearCorrection = () => setCorrectionData(null);

  const connect = useCallback(async () => {
    // Initialize Audio Components
    playerRef.current = new AudioPlayer();
    playerRef.current.setPlayStateChangeCallback(setIsSpeaking);
    
    recorderRef.current = new AudioRecorder({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }, (base64PCM) => {
      // Send audio data to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          realtime_input: {
            audio: {
              mime_type: "audio/pcm;rate=16000",
              data: base64PCM
            }
          }
        }));
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
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          }
        }
      };
      
      wsRef.current.send(JSON.stringify(setupMessage));
      
      // Start capturing immediately on connect
      recorderRef.current.start();
      setIsRecording(true);
      setTranscript("Connected. Say hello!");
    };

    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Handle Server Content (Audio/Text)
        const serverContent = msg.serverContent || msg.server_content;
        if (serverContent) {
          
          // Transcript (User)
          const transcription = serverContent.inputTranscription || serverContent.input_transcription;
          if (transcription && transcription.text) {
             setTranscript(transcription.text);
          }

          const modelTurn = serverContent.modelTurn || serverContent.model_turn;
          if (modelTurn && modelTurn.parts) {
            modelTurn.parts.forEach(part => {
              const inlineData = part.inlineData || part.inline_data;
              if (inlineData && inlineData.data) {
                // Audio chunk
                playerRef.current.playChunk(inlineData.data);
              }
              // Optional: if text is returned natively
              if (part.text) {
                // setTranscript(part.text); // Let's stick to user text for now to avoid rapid overwrite
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
              if (call.name === 'show_correction_ui') {
                setCorrectionData(call.args);
                return { id: call.id, name: call.name, response: { result: "success" } };
              } else if (call.name === 'record_vocabulary') {
                setNewWords(prev => [...prev, { word: call.args.word, translation: call.args.translation }]);
                return { id: call.id, name: call.name, response: { result: "success" } };
              } else if (call.name === 'record_needs_review') {
                setNeedsReview(prev => [...prev, { phrase: call.args.phrase, reason: call.args.reason }]);
                return { id: call.id, name: call.name, response: { result: "success" } };
              }
              return {
                id: call.id,
                name: call.name,
                response: { error: "Unknown tool" }
              };
            });

            // CRITICAL: Send functionResponse back to Live API
            wsRef.current.send(JSON.stringify({
              tool_response: {
                function_responses: functionResponses
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
    needsReview,
    transcript
  };
}
