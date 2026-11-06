/** Web Audio renders a quiet timing track; it is never represented as spoken narration. */
export async function createTimingTone(duration: number) {
  const sampleRate = 8000;
  const context = new OfflineAudioContext(1, Math.ceil(Math.max(1, duration) * sampleRate), sampleRate);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 220;
  gain.gain.value = 0;
  for (let time = 0; time < duration; time += 1) {
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(.025, Math.min(duration, time + .025));
    gain.gain.linearRampToValueAtTime(0, Math.min(duration, time + .2));
  }
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.start(); oscillator.stop(Math.max(1, duration));
  const rendered = await context.startRendering();
  const data = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, data.length * 2, true);
  data.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true));
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}
