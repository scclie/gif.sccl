(function(){'use strict';

var DZ=document.getElementById('drop-zone');
var FI=document.getElementById('file-input');
var SP=document.getElementById('source-preview');
var VP=document.getElementById('video-preview');
var VI=document.getElementById('video-player');
var IP=document.getElementById('image-preview');
var IL=document.getElementById('image-list');
var TS=document.getElementById('trim-start');
var TE=document.getElementById('trim-end');
var RS=document.getElementById('trim-range-start');
var RE=document.getElementById('trim-range-end');
var RF=document.getElementById('range-fill');
var SET=document.getElementById('settings');
var ACT=document.getElementById('actions');
var BC=document.getElementById('btn-create');
var PROG=document.getElementById('progress');
var PP=document.getElementById('progress-pct');
var PF=document.getElementById('progress-fill');
var RES=document.getElementById('result');
var GP=document.getElementById('gif-preview');
var BD=document.getElementById('btn-download');
var SAV=document.getElementById('save-area');
var CHP=document.getElementById('chk-public');
var BSAVE=document.getElementById('btn-save');
var SR=document.getElementById('save-result');
var GU=document.getElementById('gif-url');
var BCP=document.getElementById('btn-copy-perm');
var DH=document.getElementById('delete-hint');
var ERR=document.getElementById('error');
var EM=document.querySelector('#error .error-msg');
var AP=document.getElementById('auth-prompt');
var OF=document.getElementById('opt-fps');

var CI=document.getElementById('crop-img');
var CX=document.getElementById('crop-box');
var CT=document.getElementById('crop-top');
var CB=document.getElementById('crop-bottom');
var CL=document.getElementById('crop-left');
var CR=document.getElementById('crop-right');

var inputType=null;
var videoFile=null;
var imageFiles=[];
var currentGifBlob=null;
var originalBaseName='gif.sccl.cc';
var savedGifUrl=null;
var savedDeleteToken=null;
var savedGifId=null;
var user=null;
var cropSrcW=0;
var cropSrcH=0;

function resetDefaults(){
  document.getElementById('opt-width').value=480;
  document.getElementById('opt-fps').value=10;
  document.getElementById('opt-colors').value=256;
  document.getElementById('opt-quality').value=10;
  document.getElementById('opt-repeat').value=0;
  document.getElementById('chk-public').checked=true;
  document.getElementById('opt-tags-input').value='';
  document.getElementById('opt-tags').value='';
  document.getElementById('opt-dither').value='FloydSteinberg';
  tagList=[];renderTags()}

function checkAuth(){fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){if(d.user){user=d.user;if(AP)AP.style.display='none'}}).catch(function(){})}

function handleFiles(files){ERR.style.display='none';var arr=Array.from(files);var vf=arr.find(function(f){return f.type.startsWith('video/')});if(vf){originalBaseName=vf.name.replace(/\.[^.]+$/,'');loadVideo(vf);return}
var imf=arr.filter(function(f){return f.type.startsWith('image/')});if(imf.length>0){originalBaseName=imf[0].name.replace(/\.[^.]+$/,'');loadImages(imf);return}
showError('unsupported file type')}

function setupCrop(srcW,srcH){
  cropSrcW=srcW;cropSrcH=srcH;
  CL.value=0;CR.value=0;CT.value=0;CB.value=0;
  CI.style.maxHeight='';CI.style.width='';CI.style.height='';
  syncCropBox();
}

function syncCropBox(){
  if(!cropSrcW)return;
  var r=CI.offsetWidth/cropSrcW;
  var l=Math.round((parseInt(CL.value)||0)*r);
  var t=Math.round((parseInt(CT.value)||0)*r);
  var r2=Math.round((parseInt(CR.value)||0)*r);
  var b=Math.round((parseInt(CB.value)||0)*r);
  CX.style.left=l+'px';CX.style.top=t+'px';
  CX.style.width=Math.max(0,CI.offsetWidth-l-r2)+'px';
  CX.style.height=Math.max(0,CI.offsetHeight-t-b)+'px';
}

function initCropDrag(){
  CX.addEventListener('mousedown',function(e){
    var edge=e.target.getAttribute&&e.target.getAttribute('data-edge');
    if(!edge)return;
    e.preventDefault();
    var r=cropSrcW/CI.offsetWidth;
    var sx=parseInt(CL.value)||0;var sr=parseInt(CR.value)||0;var st=parseInt(CT.value)||0;var sb=parseInt(CB.value)||0;
    var mx=e.clientX;var my=e.clientY;
    function onMove(me){
      var dx=Math.round((me.clientX-mx)*r);
      var dy=Math.round((me.clientY-my)*r);
      var nl=sx,nr=sr,nt=st,nb=sb;
      if(edge==='n'){nt=Math.max(0,Math.min(cropSrcH-nb-2,st+dy))}
      if(edge==='s'){nb=Math.max(0,Math.min(cropSrcH-nt-2,sb-dy))}
      if(edge==='w'){nl=Math.max(0,Math.min(cropSrcW-nr-2,sx+dx))}
      if(edge==='e'){nr=Math.max(0,Math.min(cropSrcW-nl-2,sr-dx))}
      CL.value=nl;CR.value=nr;CT.value=nt;CB.value=nb;
      syncCropBox();
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',function(){document.removeEventListener('mousemove',onMove)},{once:true});
  });
}
CL.addEventListener('input',syncCropBox);
CR.addEventListener('input',syncCropBox);
CT.addEventListener('input',syncCropBox);
CB.addEventListener('input',syncCropBox);
window.addEventListener('resize',syncCropBox);
initCropDrag();

function syncTrim(){var sv=parseFloat(RS.value);var ev=parseFloat(RE.value);if(sv>ev){RS.value=ev;TS.value=ev.toFixed(1)}else{TS.value=sv.toFixed(1)}TE.value=ev.toFixed(1);updateRangeFill()}
RS.addEventListener('input',syncTrim);
RE.addEventListener('input',syncTrim);
TS.addEventListener('input',function(){var v=parseFloat(this.value)||0;var max=parseFloat(RS.max);if(v>parseFloat(RE.value))v=parseFloat(RE.value);if(v<0)v=0;RS.value=v;this.value=v.toFixed(1);updateRangeFill()});
TE.addEventListener('input',function(){var v=parseFloat(this.value)||0;var max=parseFloat(RE.max);if(v<parseFloat(RS.value))v=parseFloat(RS.value);if(v>max)v=max;RE.value=v;this.value=v.toFixed(1);updateRangeFill()});

function updateRangeFill(){var min=parseFloat(RS.min);var max=parseFloat(RS.max);var sv=parseFloat(RS.value);var ev=parseFloat(RE.value);var pct=((ev-sv)/(max-min))*100;RF.style.width=Math.max(0,Math.min(100,pct))+'%';RF.style.marginLeft=((sv-min)/(max-min))*100+'%'}

function loadVideo(file){inputType='video';videoFile=file;VI.src=URL.createObjectURL(file);VP.style.display='block';IP.style.display='none';SP.style.display='block';document.getElementById('crop-controls').style.display='block';OF.value=10;VI.addEventListener('loadedmetadata',function(){var d=VI.duration;TS.value=0;TE.value=d.toFixed(1);TS.max=d;TE.max=d;TS.step=0.1;TE.step=0.1;RS.max=d;RS.value=0;RS.step=0.1;RE.max=d;RE.value=d;RE.step=0.1;showSettings();VI.currentTime=0.01;updateRangeFill()});VI.addEventListener('seeked',function onSeek(){var c=document.createElement('canvas');c.width=VI.videoWidth;c.height=VI.videoHeight;c.getContext('2d').drawImage(VI,0,0);CI.src=c.toDataURL();CI.onload=function(){setupCrop(VI.videoWidth,VI.videoHeight)};VI.removeEventListener('seeked',onSeek)})}

function loadImages(files){inputType='image';imageFiles=files;IL.innerHTML='';VP.style.display='none';IP.style.display='block';SP.style.display='block';document.getElementById('crop-controls').style.display='block';OF.value=1
files.forEach(function(f){var img=document.createElement('img');img.className='img-thumb';img.src=URL.createObjectURL(f);img.title=f.name;IL.appendChild(img)})
var img=new Image();img.onload=function(){var w=img.naturalWidth||img.width;var h=img.naturalHeight||img.height;CI.src=img.src;CI.onload=function(){setupCrop(w,h)};if(w&&w<480)document.getElementById('opt-width').value=w};img.src=URL.createObjectURL(files[0])
showSettings()}

function showSettings(){SET.style.display='block';ACT.style.display='block'}

function showError(msg){EM.textContent=msg;ERR.style.display='block'}

function createGif(){var width=parseInt(document.getElementById('opt-width').value)||480;var fps=parseInt(document.getElementById('opt-fps').value)||10;var colors=parseInt(document.getElementById('opt-colors').value)||256;var dither=document.getElementById('opt-dither').value||false;var quality=parseInt(document.getElementById('opt-quality').value)||10;var repeat=parseInt(document.getElementById('opt-repeat').value)||0
PROG.style.display='block';RES.style.display='none';ERR.style.display='none';SR.style.display='none';BC.disabled=true;PP.textContent='0%';PF.style.width='0%'
var gif=new GIF({workers:2,quality:quality,width:width,workerScript:'/js/gif.worker.js',dither:dither,colors:colors,repeat:repeat})
gif.on('progress',function(p){var pct=Math.round(p*100);PP.textContent=pct+'%';PF.style.width=pct+'%'})
gif.on('finished',function(blob){currentGifBlob=blob;GP.src=URL.createObjectURL(blob);RES.style.display='block';PROG.style.display='none';BC.disabled=false
BD.onclick=function(){var a=document.createElement('a');a.href=GP.src;a.download='gif.sccl.cc-'+originalBaseName+'.gif';a.click()}
})
if(inputType==='video')addVideoFrames(gif,fps)
else if(inputType==='image')addImageFrames(gif,fps)}

function addVideoFrames(gif,fps){var width=parseInt(document.getElementById('opt-width').value)||480;var start=parseFloat(TS.value);var end=parseFloat(TE.value);var vw=cropSrcW;var vh=cropSrcH;var cl=Math.min(parseInt(CL.value)||0,vw-1);var cr=Math.min(parseInt(CR.value)||0,vw-cl-1);var ct=Math.min(parseInt(CT.value)||0,vh-1);var cb=Math.min(parseInt(CB.value)||0,vh-ct-1);var cw=vw-cl-cr;var ch=vh-ct-cb;var canvas=document.createElement('canvas');var ctx=canvas.getContext('2d');canvas.width=width;canvas.height=Math.max(1,Math.round(width*ch/cw));var delay=1000/fps;var total=Math.max(1,Math.ceil((end-start)*fps));var idx=0
function next(){if(idx>=total){gif.render();return};VI.currentTime=start+idx/fps}
VI.addEventListener('seeked',function cap(){ctx.drawImage(VI,cl,ct,cw,ch,0,0,canvas.width,canvas.height);gif.addFrame(ctx.getImageData(0,0,canvas.width,canvas.height),{delay:delay});idx++;setTimeout(next,0)})
next()}

function addImageFrames(gif,fps){var width=parseInt(document.getElementById('opt-width').value)||480;var delay=1000/fps;var loaded=0
imageFiles.forEach(function(file,i){var img=new Image();img.onload=function(){var w=cropSrcW;var h=cropSrcH;if(!w||!h||!isFinite(w)||!isFinite(h)){showError('failed to load image: '+file.name);return}var cl=Math.min(parseInt(CL.value)||0,w-1);var cr=Math.min(parseInt(CR.value)||0,w-cl-1);var ct=Math.min(parseInt(CT.value)||0,h-1);var cb=Math.min(parseInt(CB.value)||0,h-ct-1);var cw=w-cl-cr;var ch=h-ct-cb;var canvas=document.createElement('canvas');var ctx=canvas.getContext('2d');canvas.width=width;canvas.height=Math.max(1,Math.round(width*ch/cw));ctx.drawImage(img,cl,ct,cw,ch,0,0,canvas.width,canvas.height);gif.addFrame(ctx.getImageData(0,0,canvas.width,canvas.height),{delay:delay});loaded++;if(loaded>=imageFiles.length)gif.render()};img.onerror=function(){showError('failed to load image: '+file.name)};img.src=URL.createObjectURL(file)})}

function saveGif(){BSAVE.disabled=true;BSAVE.textContent='uploading...';var tg=(document.getElementById('opt-tags').value||'').trim();if(!tg){showError('add at least one tag before uploading');BSAVE.disabled=false;BSAVE.textContent='[ get permanent link ]';return};var fd=new FormData();fd.append('gif',currentGifBlob,'gif.sccl.cc.gif');fd.append('public',CHP.checked?'true':'false');if(tg)fd.append('tags',tg)
fetch('/api/upload',{method:'POST',body:fd,credentials:'same-origin'}).then(function(r){if(!r.ok){return r.text().then(function(txt){throw new Error(txt||'HTTP '+r.status)})};return r.json()}).then(function(data){if(data.error){showError(data.error);BSAVE.disabled=false;BSAVE.textContent='[ get permanent link ]';return}
savedGifUrl=data.url;savedDeleteToken=data.delete_token;savedGifId=data.id;SR.style.display='block';GU.href=data.url;GU.target='_blank';GU.rel='noopener noreferrer';GU.textContent=data.url;DH.textContent='delete token: '+data.delete_token+' (save this to delete your gif)'
try{var tokens=JSON.parse(localStorage.getItem('gif_tokens')||'{}');tokens[data.id]=data.delete_token;localStorage.setItem('gif_tokens',JSON.stringify(tokens))}catch(e){}
BSAVE.disabled=false;BSAVE.textContent='[ get permanent link ]'}).catch(function(err){showError('upload failed: '+err.message);BSAVE.disabled=false;BSAVE.textContent='[ get permanent link ]'})}

function copyText(t,btn){navigator.clipboard.writeText(t).then(function(){var orig=btn.textContent;btn.textContent='copied!';setTimeout(function(){btn.textContent=orig},1500)}).catch(function(){})}


DZ.addEventListener('click',function(){FI.click()})
DZ.addEventListener('dragover',function(e){e.preventDefault();DZ.classList.add('drag-over')})
DZ.addEventListener('dragleave',function(){DZ.classList.remove('drag-over')})
DZ.addEventListener('drop',function(e){e.preventDefault();DZ.classList.remove('drag-over');handleFiles(e.dataTransfer.files)})
FI.addEventListener('change',function(){if(FI.files.length)handleFiles(FI.files)})
document.addEventListener('paste',function(e){var items=e.clipboardData&&e.clipboardData.items;if(!items)return;var files=[];for(var i=0;i<items.length;i++){if(items[i].kind==='file'){var f=items[i].getAsFile();if(f)files.push(f)}}if(files.length>0){e.preventDefault();handleFiles(files)}})
BC.addEventListener('click',createGif)
BSAVE.addEventListener('click',saveGif)
BCP.addEventListener('click',function(){copyText(savedGifUrl,BCP)})
var tagsInput=document.getElementById('opt-tags-input');
var tagsChips=document.getElementById('tags-chips');
var tagsHidden=document.getElementById('opt-tags');
var tagList=[];
function renderTags(){
  tagsChips.innerHTML='';
  tagList.forEach(function(t){
    var chip=document.createElement('span');
    chip.style.cssText='display:inline-flex;align-items:center;gap:.15rem;font-size:.7rem;color:var(--nord14);border:1px solid var(--nord3);border-radius:3px;padding:0 .2rem;background:var(--nord1)';
    chip.textContent='#'+t;
    var rm=document.createElement('span');
    rm.textContent='x';rm.style.cssText='cursor:pointer;margin-left:.15rem;color:var(--nord11)';
    rm.onclick=function(){tagList=tagList.filter(function(x){return x!==t});renderTags()};
    chip.appendChild(rm);tagsChips.appendChild(chip)});
  tagsHidden.value=tagList.join(',')}
if(tagsInput)tagsInput.addEventListener('keydown',function(e){
  if(e.key===' '||e.key==='Enter'||e.key===','){e.preventDefault();var val=tagsInput.value.trim();if(val&&tagList.indexOf(val)===-1){tagList.push(val);renderTags()};tagsInput.value=''}
  if(e.key==='Backspace'&&tagsInput.value===''&&tagList.length){tagList.pop();renderTags()}})
resetDefaults();checkAuth()})();
