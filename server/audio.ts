import { ServiceError } from './errors.ts';

export const sampleRate=24000;
export function pcmToWave(pcm:Buffer) {
  if(!pcm.length||pcm.length%2)throw new ServiceError('AUDIO_INVALID',502,'PCM audio is invalid.');
  const header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
export function readWavePcm(wave:Buffer) {
  if(wave.length<44||wave.toString('ascii',0,4)!=='RIFF'||wave.toString('ascii',8,12)!=='WAVE')throw new ServiceError('AUDIO_INVALID',502,'Narration is not WAV audio.');
  let valid=false;
  for(let offset=12;offset+8<=wave.length;){
    const tag=wave.toString('ascii',offset,offset+4);const length=wave.readUInt32LE(offset+4);const start=offset+8;
    if(start+length>wave.length)break;
    if(tag==='fmt ')valid=length>=16&&wave.readUInt16LE(start)===1&&wave.readUInt16LE(start+2)===1&&wave.readUInt32LE(start+4)===sampleRate&&wave.readUInt16LE(start+14)===16;
    if(tag==='data'&&valid&&length>0&&length%2===0)return wave.subarray(start,start+length);
    offset=start+length+(length%2);
  }
  throw new ServiceError('AUDIO_INVALID',502,'Narration must be 24kHz mono 16-bit PCM.');
}
export function assembleNarration(segments: readonly Buffer[]) {
  if(segments.length!==4||segments.some(segment=>!segment.length||segment.length%2))throw new ServiceError('AUDIO_INVALID',502,'Four PCM scenes are required.');
  let samples=0;
  const boundaries=segments.map(segment=>{const startTime=samples/sampleRate;samples+=segment.length/2;return {startTime,endTime:samples/sampleRate,sampleCount:segment.length/2};});
  return {bytes:pcmToWave(Buffer.concat(segments)),boundaries,duration:samples/sampleRate};
}
