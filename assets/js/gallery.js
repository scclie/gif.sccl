(function(){'use strict';

var grid=document.getElementById('gallery-grid');
var empty=document.getElementById('gallery-empty');
var loading=document.getElementById('gallery-loading');
var errorEl=document.getElementById('gallery-error');
var page=1;
var loadingFlag=false;
var hasMore=true;
var showAll=false;
var isAdmin=false;

// Check auth
fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){
  if(d.admin){isAdmin=true;addAdminToggle()}
}).catch(function(){})

function addAdminToggle(){
  var nav=document.querySelector('.nav');
  if(!nav)return;
  var toggle=document.createElement('div');toggle.className='nav-admin';toggle.style.cssText='display:flex;align-items:center';
  toggle.innerHTML='<label style="font-size:0.75rem;color:var(--fg-dim);cursor:pointer"><input type="checkbox" id="admin-toggle"> show all (admin)</label>';
  var navAuth=nav.querySelector('.nav-auth');
  if(navAuth)nav.insertBefore(toggle,navAuth);else nav.appendChild(toggle);
  document.getElementById('admin-toggle').addEventListener('change',function(){
    showAll=this.checked;reset();loadGifs()})}

function reset(){grid.innerHTML='';page=1;hasMore=true;loadingFlag=false
  var ft=document.getElementById('gallery-footer');if(ft)ft.remove()}

function loadGifs(){
  if(loadingFlag||!hasMore)return;
  loadingFlag=true;
  loading.style.display='block';
  errorEl.style.display='none';
  var url='/api/gifs?page='+page+'&limit=24';
  if(showAll&&isAdmin)url+='&all=true';
  fetch(url,{credentials:'same-origin'})
    .then(function(r){return r.json()})
    .then(function(data){
      loading.style.display='none';
      loadingFlag=false;
      if(data.error){errorEl.style.display='block';errorEl.querySelector('.error-msg').textContent=data.error;return}
      if(data.gifs.length===0&&page===1){empty.style.display='block';return}
      data.gifs.forEach(function(g){addGif(g)});
      hasMore=data.gifs.length===24;
      page++;
      updateFooter()})
    .catch(function(err){loading.style.display='none';loadingFlag=false;errorEl.style.display='block';errorEl.querySelector('.error-msg').textContent='failed to load: '+err.message})}

function addGif(g){
  var item=document.createElement('div');item.className='gallery-item';
  var img=document.createElement('a');img.href=g.url;img.target='_blank';img.innerHTML='<img src="'+g.url+'" alt="gif" loading="lazy">';
  var info=document.createElement('div');info.className='gif-info';
  var infoText=g.size;
  if(g.public!==undefined)infoText+=g.public?' · public':' · private';
  if(g.discord_id)infoText+=' · user:'+g.discord_id.slice(0,6);
  info.textContent=infoText;
  var copyBtn=document.createElement('button');copyBtn.className='btn';copyBtn.textContent='[ copy url ]';
  copyBtn.addEventListener('click',function(){
    navigator.clipboard.writeText(g.url).then(function(){copyBtn.textContent='copied!';setTimeout(function(){copyBtn.textContent='[ copy url ]'},1500)}).catch(function(){})});
  item.appendChild(img);item.appendChild(info);item.appendChild(copyBtn);
  if(isAdmin){
    var delBtn=document.createElement('button');delBtn.className='btn';delBtn.style.cssText='margin-left:0.4rem;border-color:var(--nord11);color:var(--nord11);font-size:0.7rem;padding:0.2rem 0.4rem';
    delBtn.textContent='[x]';
    delBtn.addEventListener('click',function(){
      if(!confirm('delete this gif?'))return;
      fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,delete_token:''})})
        .then(function(r){return r.json()}).then(function(d){
          if(d.success){item.remove()}else{delBtn.textContent='failed'}})
        .catch(function(){delBtn.textContent='error'})});
    copyBtn.parentNode.insertBefore(delBtn,copyBtn.nextSibling)}
  grid.appendChild(item)}

function updateFooter(){
  var footer=document.getElementById('gallery-footer');
  if(!footer){footer=document.createElement('div');footer.id='gallery-footer';footer.style.cssText='text-align:center;margin-top:1rem'}
  if(hasMore){
    footer.innerHTML='<button id="load-more">[ load more ]</button>';
    document.getElementById('load-more').addEventListener('click',loadGifs)}
  else{footer.innerHTML='<span class="hint">all gifs loaded</span>'}
  if(footer.parentNode!==document.getElementById('gallery-app'))document.getElementById('gallery-app').appendChild(footer)}

empty.style.display='none';
loadGifs()})();
