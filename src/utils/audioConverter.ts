/**
 * Audio conversion utilities for converting WAV to MP3 in the browser
 * Uses lamejs for encoding
 */

// @ts-ignore - lamejs doesn't have TypeScript types
import lamejs from 'lamejs';

/**
 * Check if a file is a WAV file based on its MIME type
 */
export function isWavFile(file: File | Blob): boolean {
  const type = file.type.toLowerCase();
  return type === 'audio/wav' || 
         type === 'audio/wave' || 
         type === 'audio/x-wav';
}

/**
 * Convert a WAV blob to MP3 format
 * @param wavBlob The WAV audio blob to convert
 * @returns A new Blob containing the MP3 audio
 */
export async function convertWavToMp3(wavBlob: Blob): Promise<Blob> {
  const arrayBuffer = await wavBlob.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  
  // Parse WAV header
  const channels = dataView.getUint16(22, true);
  const sampleRate = dataView.getUint32(24, true);
  const bitsPerSample = dataView.getUint16(34, true);
  
  // Find data chunk
  let dataOffset = 44; // Standard WAV header size
  let dataLength = arrayBuffer.byteLength - dataOffset;
  
  // Try to find actual data chunk position
  const textDecoder = new TextDecoder('ascii');
  for (let i = 12; i < Math.min(arrayBuffer.byteLength - 8, 1000); i++) {
    const chunkId = textDecoder.decode(new Uint8Array(arrayBuffer, i, 4));
    if (chunkId === 'data') {
      dataOffset = i + 8;
      dataLength = dataView.getUint32(i + 4, true);
      break;
    }
  }
  
  // Calculate number of samples
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataLength / (bytesPerSample * channels));
  
  // Read samples as Int16
  const samples = new Int16Array(numSamples * channels);
  
  if (bitsPerSample === 16) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = dataView.getInt16(dataOffset + i * 2, true);
    }
  } else if (bitsPerSample === 8) {
    for (let i = 0; i < samples.length; i++) {
      // Convert 8-bit unsigned to 16-bit signed
      samples[i] = (dataView.getUint8(dataOffset + i) - 128) * 256;
    }
  } else if (bitsPerSample === 32) {
    for (let i = 0; i < samples.length; i++) {
      // Convert 32-bit float to 16-bit signed
      const floatValue = dataView.getFloat32(dataOffset + i * 4, true);
      samples[i] = Math.max(-32768, Math.min(32767, Math.round(floatValue * 32767)));
    }
  }
  
  // Initialize MP3 encoder
  const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  const mp3Data: Int8Array[] = [];
  const sampleBlockSize = 1152;
  
  if (channels === 1) {
    // Mono
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const chunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
    }
  } else {
    // Stereo - separate channels
    const left = new Int16Array(Math.floor(samples.length / 2));
    const right = new Int16Array(Math.floor(samples.length / 2));
    for (let i = 0, j = 0; i < samples.length - 1; i += 2, j++) {
      left[j] = samples[i];
      right[j] = samples[i + 1];
    }
    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
    }
  }
  
  // Flush the encoder
  const endBuf = mp3Encoder.flush();
  if (endBuf.length > 0) mp3Data.push(new Int8Array(endBuf));
  
  // Combine all chunks
  const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
  const mp3Array = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    mp3Array.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
    offset += chunk.length;
  }
  
  return new Blob([mp3Array], { type: 'audio/mp3' });
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

/**
 * Replace the file extension with a new one
 */
export function replaceFileExtension(filename: string, newExtension: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename + newExtension;
  return filename.slice(0, lastDot) + newExtension;
}
