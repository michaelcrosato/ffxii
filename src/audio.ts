export class Soundscape {
  private ctx?:AudioContext;private master?:GainNode;private musicTimer?:ReturnType<typeof setInterval>;private step=0;
  sound=true;music=true;
  unlock(){if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.15;this.master.connect(this.ctx.destination);}void this.ctx.resume();this.startMusic();}
  private tone(freq:number,duration:number,type:OscillatorType='sine',volume=.25,delay=0){
    if(!this.ctx||!this.master)return;const time=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.025);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  play(kind:'click'|'move'|'damage'|'heal'|'cast'|'victory'|'defeat'|'turn'){
    if(!this.sound)return;
    if(kind==='click')this.tone(440,.08,'sine',.1);
    if(kind==='move'){this.tone(140,.09,'triangle',.18);this.tone(170,.08,'triangle',.12,.1);}
    if(kind==='damage'){this.tone(90,.18,'sawtooth',.2);this.tone(63,.25,'triangle',.15);}
    if(kind==='heal'||kind==='cast'){[392,523,659].forEach((f,i)=>this.tone(f,.7,'sine',.14,i*.08));}
    if(kind==='turn'){this.tone(330,.17,'sine',.1);this.tone(440,.3,'sine',.12,.1);}
    if(kind==='victory')[262,330,392,523,659,784].forEach((f,i)=>this.tone(f,1.1,'triangle',.18,i*.13));
    if(kind==='defeat')[220,196,165,131].forEach((f,i)=>this.tone(f,1,'triangle',.15,i*.2));
  }
  startMusic(){
    if(this.musicTimer||!this.ctx)return;
    const chords=[[146.83,220,293.66,349.23],[130.81,196,261.63,329.63],[116.54,174.61,233.08,293.66],[130.81,196,261.63,349.23]];
    this.musicTimer=setInterval(()=>{
      if(!this.music||document.hidden)return;
      const chord=chords[Math.floor(this.step/4)%4];this.tone(chord[this.step%4],2.6,'sine',.055);if(this.step%4===0)this.tone(chord[0]/2,4,'triangle',.045);this.step++;
    },720);
  }
}
