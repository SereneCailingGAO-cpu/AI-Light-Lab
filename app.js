(function(){
'use strict';
const $=id=>document.getElementById(id), video=$('video'), chart=$('chart');
const experiment=new LightLab.Experiment(), frame=document.createElement('canvas');
frame.width=64;frame.height=48;
const frameContext=frame.getContext('2d'), graph=chart.getContext('2d');
let stream=null, phase='idle', generation=0, animation=0, lastSample=-Infinity, lastVideoTime=-1;
function message(text){$('status').textContent=text;}
function controls(){ $('start').disabled=phase!=='idle';$('stop').disabled=phase==='idle';$('export').disabled=!experiment.samples.length;$('state').textContent=phase==='running'?'Recording':phase==='starting'?'Connecting':experiment.samples.length?'Paused':'Ready'; }
function release(){cancelAnimationFrame(animation);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.pause();video.srcObject=null;}
function stop(text){generation++;if(phase==='running')experiment.stop(performance.now());phase='idle';release();controls();render();if(text)message(text);}
function cameraError(error){const messages={NotAllowedError:'Camera access was not allowed. Enable camera permission for this website in your browser settings, then tap Start.',NotFoundError:'No camera was found. Open this page on a phone or computer with a camera.',NotReadableError:'The camera is unavailable. Close other apps using it, then try Start again.',OverconstrainedError:'This camera could not use the requested settings. Try another camera or browser.',SecurityError:'Camera access is blocked. Open this page directly over HTTPS and check browser permissions.'};return messages[error.name]||'Could not start the camera. Check camera permissions and try Start again.';}
function waitForVideo(token){return new Promise((resolve,reject)=>{const begun=performance.now();function check(){if(token!==generation)return reject(new Error('Cancelled'));if(video.readyState>=2&&video.videoWidth)return resolve();if(performance.now()-begun>15000)return reject(new Error('Camera timed out'));setTimeout(check,100);}check();});}
async function start(){
 if(phase!=='idle')return;
 if(!window.isSecureContext){message('Camera access needs HTTPS, or localhost on this device. A phone opening a computer’s plain HTTP network address cannot access its camera.');return;}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){message('Camera access is not available here. Open this page directly in Safari or Chrome over HTTPS.');return;}
 const token=++generation;phase='starting';controls();message('Allow camera access when your browser asks. You can tap Stop to cancel.');
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
  if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;video.muted=true;video.setAttribute('playsinline','');video.srcObject=stream;
  stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(token===generation)stop('Camera disconnected. Your data is preserved; tap Start to reconnect.');}));
  await video.play();await waitForVideo(token);
  if(token!==generation)return;
  phase='running';experiment.start(performance.now());lastSample=-Infinity;lastVideoTime=-1;controls();message('Recording locally. Keep the camera steady and change one condition at a time.');tick(performance.now());
 }catch(error){if(token!==generation)return;stop(cameraError(error));}
}
function tick(now){
 if(phase!=='running')return;
 if(video.readyState>=2&&now-lastSample>=500&&video.currentTime!==lastVideoTime){
  try{frameContext.drawImage(video,0,0,64,48);const value=LightLab.brightness(frameContext.getImageData(0,0,64,48).data);experiment.add(now,value);lastSample=now;lastVideoTime=video.currentTime;render();}
  catch(error){stop('Could not read camera frames. Your data is preserved. Tap Start to retry.');return;}
 }
 $('elapsed').textContent=(experiment.elapsed(now)/1000).toFixed(1);
 animation=requestAnimationFrame(tick);
}
function render(){
 const samples=experiment.samples, latest=samples[samples.length-1],stats=experiment.stats();
 $('intensity').textContent=latest?latest.value.toFixed(1):'—';$('level').style.width=(latest?latest.value:0)+'%';
 $('elapsed').textContent=(experiment.elapsed(performance.now())/1000).toFixed(1);$('count').textContent=samples.length+' samples';
 ['mean','min','max'].forEach(k=>$(k).textContent=stats?stats[k].toFixed(1)+'%':'—');
 $('rows').innerHTML=samples.length?samples.slice(-20).reverse().map(s=>'<tr><td>'+s.time.toFixed(2)+'</td><td>'+s.value.toFixed(2)+'</td></tr>').join(''):'<tr><td colspan="2">Your readings will appear here.</td></tr>';
 $('export').disabled=!samples.length;draw();
}
function draw(){
 const width=chart.clientWidth,height=chart.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);chart.width=Math.round(width*dpr);chart.height=Math.round(height*dpr);graph.setTransform(dpr,0,0,dpr,0,0);
 const left=34,top=12,right=16,bottom=30,w=width-left-right,h=height-top-bottom;graph.font='12px system-ui';graph.lineWidth=1;
 for(let value=0;value<=100;value+=25){const y=top+h*(1-value/100);graph.strokeStyle='#e2e9dd';graph.beginPath();graph.moveTo(left,y);graph.lineTo(left+w,y);graph.stroke();graph.fillStyle='#52665d';graph.textAlign='right';graph.fillText(value,left-7,y+4);}
 const samples=experiment.samples,end=Math.max(10,samples.length?samples[samples.length-1].time:0);
 graph.textAlign='center';for(let i=0;i<=4;i++)graph.fillText((end*i/4).toFixed(end>100?0:1),left+w*i/4,height-8);
 if(!samples.length){graph.fillStyle='#52665d';graph.fillText('Start to see light change over time',left+w/2,top+h/2);return;}
 // Reduce graph work while retaining each screen column's brightness extremes.
 const points=[];let bucket=-1,group=[];
 function flush(){if(!group.length)return;const lo=group.reduce((a,b)=>a.value<b.value?a:b),hi=group.reduce((a,b)=>a.value>b.value?a:b);const chosen=[group[0],lo,hi,group[group.length-1]];chosen.sort((a,b)=>a.time-b.time);points.push(...chosen);group=[];}
 samples.forEach(s=>{const next=Math.floor(s.time/end*w);if(next!==bucket){flush();bucket=next;}group.push(s);});flush();
 graph.strokeStyle='#3e7854';graph.lineWidth=2;graph.beginPath();points.forEach((s,i)=>{const x=left+s.time/end*w,y=top+h*(1-s.value/100);if(i===0)graph.moveTo(x,y);else graph.lineTo(x,y);});graph.stroke();const last=samples[samples.length-1];graph.fillStyle='#173c34';graph.beginPath();graph.arc(left+last.time/end*w,top+h*(1-last.value/100),4,0,Math.PI*2);graph.fill();
}
$('start').addEventListener('click',start);$('stop').addEventListener('click',()=>stop('Stopped. Your data is preserved. Tap Start to continue.'));
$('reset').addEventListener('click',()=>{if(experiment.samples.length&&!window.confirm('Clear all recorded data? Export your CSV first if you want to keep it.'))return;stop();experiment.reset();controls();render();message('Experiment reset. Tap Start for a new recording.');});
$('export').addEventListener('click',()=>{if(!experiment.samples.length)return;const blob=new Blob(['\uFEFF',experiment.csv()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ai-light-lab-'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('CSV prepared. Check Downloads; if Safari opens a preview, use Share → Save to Files.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase!=='idle')stop('Recording paused while the page was hidden. Tap Start to continue.');});
window.addEventListener('pagehide',()=>stop());window.addEventListener('resize',draw);
controls();render();if(!window.isSecureContext)message('Open this page over HTTPS, or localhost on this device, to enable camera access.');
})();
