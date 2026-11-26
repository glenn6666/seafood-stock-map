type Effect='hook'|'bucket'|'drop'|'shoe'|'attack'|'jump'|'win'|'end';
/** Original, quiet pentatonic loop; starts only from a player's gesture. */
export class GameAudio{
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private timer:ReturnType<typeof setInterval>|null=null;
 private enabled=true;
 private playing=false;
 private beat=0;
 private next=0;
 private tone(note:number,at:number,length=.15,level=.12,type:OscillatorType='sine'){
  const c=this.context;if(!c||!this.master)return;
  const osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.value=440*2**((note-69)/12);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+length);
  osc.connect(gain);gain.connect(this.master);osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(at);osc.stop(at+length+.02);
 }
 async unlock(){
  try{if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.35:0;this.master.connect(this.context.destination)}await this.context.resume();return true}catch{return false}
 }
 setEnabled(enabled:boolean){this.enabled=enabled;if(this.master&&this.context)this.master.gain.setTargetAtTime(enabled?.35:0,this.context.currentTime,.03)}
 startMusic(){
  if(!this.context)return;this.stopMusic();this.playing=true;this.beat=0;this.next=this.context?.currentTime??0;
  const melody=[72,76,79,76,74,76,79,81,79,76,74,72,74,76,79,76];
  const schedule=()=>{const c=this.context;if(!c||c.state!=='running'||!this.playing)return;if(this.next<c.currentTime)this.next=c.currentTime;
   while(this.next<c.currentTime+.15){this.tone(melody[this.beat%melody.length],this.next,.16,.1,'triangle');if(this.beat%4===0)this.tone([48,53,55,48][Math.floor(this.beat/4)%4],this.next,.32,.075);this.beat++;this.next+=.25}
  };schedule();this.timer=setInterval(schedule,80);
 }
 stopMusic(){this.playing=false;if(this.timer)clearInterval(this.timer);this.timer=null}
 effect(effect:Effect){
  const c=this.context;if(!this.enabled||!c||c.state!=='running')return;
  const notes:Record<Effect,number[]>={hook:[76,81],bucket:[72,76,79],drop:[67,60],shoe:[48,43],attack:[52,49,52],jump:[79,86],win:[72,76,79,84],end:[76,72]};
  notes[effect].forEach((note,i)=>this.tone(note,c.currentTime+i*.075,.14,.2,effect==='attack'?'triangle':'sine'));
 }
 pause(){this.context?.suspend().catch(()=>{})}
 resume(){if(this.playing){this.context?.resume().catch(()=>{});this.next=this.context?.currentTime??0}}
 close(){this.stopMusic();this.context?.close().catch(()=>{});this.context=null;this.master=null}
}
