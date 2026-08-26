export class AudioPlayer {
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    this.nextPlayTime = 0;
    this.isPlaying = false;
    this.onPlayStateChange = null;
    
    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setPlayStateChangeCallback(callback) {
    this.onPlayStateChange = callback;
  }

  playChunk(base64PCM) {
    if (!base64PCM) return;
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const binaryStr = window.atob(base64PCM);
    const length = Math.floor(binaryStr.length / 2) * 2; // ensure even length
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < length; i++) {
      view[i] = binaryStr.charCodeAt(i);
    }
    
    // Int16 Array from bytes
    const pcm16 = new Int16Array(buffer);
    
    // Convert to Float32 Array (-1.0 to 1.0) for Web Audio API
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Schedule playback sequentially
    const currentTime = this.audioContext.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime;
    }
    
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    // Handle speaking state
    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    source.onended = () => {
      // If we've reached the end of the scheduled audio
      if (this.audioContext.currentTime >= this.nextPlayTime - 0.05) {
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
      }
    };
  }

  stop() {
    this.nextPlayTime = 0;
    this.isPlaying = false;
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    // Ideally we would keep track of scheduled sources and stop them
    // For simplicity, we can close and recreate the context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
    }
  }
}
