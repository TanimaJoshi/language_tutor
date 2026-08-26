export class AudioRecorder {
  constructor(options, onAudioData) {
    if (typeof options === 'function') {
      this.onAudioData = options;
      this.options = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
    } else {
      this.onAudioData = onAudioData;
      this.options = options;
    }
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.workletNode = null;
    this.isRecording = false;
  }

  async start() {
    if (this.isRecording) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone access is not supported or blocked. Ensure you are using HTTPS or localhost (Secure Context).");
      throw new Error("navigator.mediaDevices is undefined. Not in a secure context.");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          ...this.options
        } 
      });

      // Force 16kHz sample rate for Gemini API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      
      await this.audioContext.audioWorklet.addModule('/audio-worklet.js');
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      
      this.workletNode.port.onmessage = (event) => {
        if (!this.isRecording) return;
        const pcmBuffer = event.data;
        const base64Audio = this.bufferToBase64(pcmBuffer);
        if (this.onAudioData) {
          this.onAudioData(base64Audio);
        }
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (err) {
      console.error('Error starting audio recording:', err);
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Convert ArrayBuffer to Base64
  bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
