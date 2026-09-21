(function(root){
  'use strict';
  function brightness(pixels){
    if(!pixels.length || pixels.length%4) throw new Error('Expected RGBA pixels');
    let total=0;
    for(let i=0;i<pixels.length;i+=4) total+=2126*pixels[i]+7152*pixels[i+1]+722*pixels[i+2];
    return Math.max(0,Math.min(100,total/(pixels.length/4)/25500));
  }
  class Experiment{
    constructor(){this.reset();}
    reset(){this.samples=[];this.total=0;this.minimum=Infinity;this.maximum=-Infinity;this.accumulated=0;this.started=null;}
    start(now){if(this.started===null)this.started=now;}
    elapsed(now){return this.accumulated+(this.started===null?0:Math.max(0,now-this.started));}
    stop(now){this.accumulated=this.elapsed(now);this.started=null;}
    add(now,value){if(this.started===null||!Number.isFinite(value))return;value=Math.max(0,Math.min(100,value));const sample={time:this.elapsed(now)/1000,value};this.samples.push(sample);this.total+=value;this.minimum=Math.min(this.minimum,value);this.maximum=Math.max(this.maximum,value);return sample;}
    stats(){return this.samples.length?{mean:this.total/this.samples.length,min:this.minimum,max:this.maximum}:null;}
    csv(){return 'Elapsed time (s),Relative Light Intensity (%)\r\n'+this.samples.map(s=>s.time.toFixed(3)+','+s.value.toFixed(2)).join('\r\n')+(this.samples.length?'\r\n':'');}
  }
  const api={brightness,Experiment};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LightLab=api;
})(typeof window!=='undefined'?window:globalThis);
