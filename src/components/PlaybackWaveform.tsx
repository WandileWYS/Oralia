import { formatTime } from '../lib/utils';

/** A real media-clock progress control; no fabricated audio amplitude data. */
export function PlaybackWaveform({currentTime,duration,onSeek}:{currentTime:number;duration:number;playing:boolean;onSeek:(seconds:number)=>void}){
  return <div className="real-playback-progress"><input className="audio-draft-range" aria-label="Story progress" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`} type="range" min={0} max={duration||0} step={0.01} value={Math.min(currentTime,duration)} disabled={!duration} onChange={event=>onSeek(Number(event.target.value))}/></div>;
}
