class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512; // 512 frames = 32ms at 16kHz (Optimized for low latency)
    this.buffer = new Int16Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        
        if (this.offset >= this.bufferSize) {
          // Create a copy to send to the main thread
          const copy = new Int16Array(this.buffer);
          this.port.postMessage(copy.buffer, [copy.buffer]);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
