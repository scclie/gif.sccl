(function(){'use strict';

var grid=document.getElementById('gallery-grid');
var userGrid=document.getElementById('user-gallery-grid');
var userSection=document.getElementById('user-gallery-section');
var empty=document.getElementById('gallery-empty');
var loading=document.getElementById('gallery-loading');
var errorEl=document.getElementById('gallery-error');
var page=1;
var loadingFlag=false;
var hasMore=true;
var showAll=false;
var isAdmin=false;
var localTokens={};try{localTokens=JSON.parse(localStorage.getItem('gif_tokens')||'{}')}catch(e){}
var ownIds={}; // IDs owned by current user (populated by ?tokens= fetch)

// Check auth
var cachedUser=localStorage.getItem('gif_user');
var cachedAdmin=localStorage.getItem('gif_admin')==='1';
if(cachedUser){try{var u=JSON.parse(cachedUser);if(u&&u.discord_id&&cachedAdmin){isAdmin=true;addAdminToggle()}}catch(e){}}
var lastCheck=parseInt(localStorage.getItem('gif_auth_check')||'0');
if(Date.now()-lastCheck<3600000){}else{fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){if(d.admin&&!isAdmin){isAdmin=true;addAdminToggle()}}).catch(function(){})}

function addAdminToggle(){
  var nav=document.querySelector('.nav');
  if(!nav)return;
  var toggle=document.createElement('div');toggle.className='nav-admin';toggle.style.cssText='display:flex;align-items:center';
  toggle.innerHTML='<label style="font-size:0.75rem;color:var(--fg-dim);cursor:pointer"><input type="checkbox" id="admin-toggle"> show all (admin)</label>';
  var navAuth=nav.querySelector('.nav-auth');
  if(navAuth)nav.insertBefore(toggle,navAuth);else nav.appendChild(toggle);
  document.getElementById('admin-toggle').addEventListener('change',function(){
    showAll=this.checked;reset();loadGifs()})}

function reset(){grid.innerHTML='';userGrid.innerHTML='';userSection.style.display='none';page=1;hasMore=true;loadingFlag=false;ownIds={}
  var ft=document.getElementById('gallery-footer');if(ft)ft.innerHTML=''}

function start(){
  var tokens=Object.keys(localTokens);
  if(tokens.length){
    fetch('/api/gifs?tokens='+tokens.join(',')).then(function(r){return r.json()}).then(function(data){
      if(data.gifs){data.gifs.forEach(function(g){ownIds[g.id]=true;addGif(g)})}
      loadGifs()}).catch(function(){loadGifs()})
  }else{loadGifs()}}

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
      data.gifs.forEach(function(g){if(!ownIds[g.id])addGif(g)}); // skip owned — already rendered
      hasMore=data.gifs.length===24;
      page++;
      updateFooter()})
    .catch(function(err){loading.style.display='none';loadingFlag=false;errorEl.style.display='block';errorEl.querySelector('.error-msg').textContent='failed to load: '+err.message})}

function addGif(g){
  var item=document.createElement('div');item.className='gallery-item';
  var img=document.createElement('a');img.href=g.direct_url;img.target='_blank';img.innerHTML='<img src="'+g.direct_url+'" alt="gif" loading="lazy">';
  var info=document.createElement('div');info.className='gif-info';
  var infoText=g.size;
  if(g.public!==undefined)infoText+=g.public?' · public':' · private';
  if(g.discord_id)infoText+=' · user:'+g.discord_id.slice(0,6);
  info.textContent=infoText;
  var tagsEl=document.createElement('div');tagsEl.className='gif-tags';
  if(g.tags&&g.tags.length)tagsEl.innerHTML=g.tags.map(function(t){return'<span class="tag">'+esc(t)+'</span>'}).join('');
  var btnRow=document.createElement('div');btnRow.className='btn-row';
  var copyBtn=document.createElement('button');copyBtn.className='btn';copyBtn.textContent='[ copy url ]';
  copyBtn.addEventListener('click',function(){
    navigator.clipboard.writeText(g.url).then(function(){copyBtn.textContent='copied!';setTimeout(function(){copyBtn.textContent='[ copy url ]'},1500)}).catch(function(){})});
  btnRow.appendChild(copyBtn);
  item.appendChild(img);item.appendChild(info);item.appendChild(tagsEl);item.appendChild(btnRow);
  if(isAdmin||localTokens[g.id])addOwnButtons(g,item,btnRow)
  if(ownIds[g.id]||localTokens[g.id]){userGrid.appendChild(item);userSection.style.display='block'}else{grid.appendChild(item)}}

function addOwnButtons(g,item,btnRow){
  var editBtn=document.createElement('button');editBtn.className='btn own-btn';editBtn.style.cssText='font-size:0.7rem;padding:0.2rem 0.4rem';
  editBtn.textContent='[edit]';
  editBtn.onclick=function(){editTags(g,editBtn,item)};
  btnRow.appendChild(editBtn);
  var delBtn=document.createElement('button');delBtn.className='btn own-btn';delBtn.style.cssText='border-color:var(--nord11);color:var(--nord11);font-size:0.7rem;padding:0.2rem 0.4rem';
  delBtn.textContent='[x]';
  delBtn.addEventListener('click',function(){
    if(!confirm('delete this gif?'))return;
    fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,delete_token:localTokens[g.id]||''})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success){item.remove()}else{delBtn.textContent='failed'}})
      .catch(function(){delBtn.textContent='error'})});
  btnRow.appendChild(delBtn)}

function updateFooter(){
  var app=document.getElementById('gallery-app');
  var footer=document.getElementById('gallery-footer');
  if(!footer){footer=document.createElement('div');footer.id='gallery-footer';footer.style.cssText='text-align:center;margin-top:1rem';app.appendChild(footer)}
  if(hasMore){
    footer.innerHTML='<button class="load-more">[ load more ]</button>';
    footer.querySelector('.load-more').addEventListener('click',loadGifs)}
  else{footer.innerHTML='<span class="hint">all gifs loaded</span>'}}

empty.style.display='none';

function esc(s){var d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML}

function editTags(g,btn,item){
  var tagsEl=item.querySelector('.gif-tags')||document.createElement('div');tagsEl.className='gif-tags';
  var wrapper=document.createElement('span');wrapper.style.cssText='display:inline-flex;flex-wrap:wrap;gap:.2rem;align-items:center;background:var(--nord0);border:1px solid var(--nord3);padding:.2rem .4rem;width:100%;cursor:text';
  var chips=document.createElement('span');
  var input=document.createElement('input');input.type='text';input.placeholder='add tag...';input.style.cssText='border:none;background:transparent;color:var(--fg);font-family:Space Mono,monospace;font-size:.75rem;outline:none;width:80px;padding:0';
  wrapper.appendChild(chips);wrapper.appendChild(input);
  tagsEl.innerHTML='';tagsEl.appendChild(wrapper);
  var tagList=(g.tags||[]).slice();
  function renderChips(){
    chips.innerHTML='';
    tagList.forEach(function(t){
      var chip=document.createElement('span');chip.style.cssText='display:inline-flex;align-items:center;gap:.15rem;font-size:.65rem;color:var(--nord14);border:1px solid var(--nord3);border-radius:3px;padding:0 .2rem;background:var(--nord1)';
      chip.textContent='#'+t;
      var rm=document.createElement('span');rm.textContent='x';rm.style.cssText='cursor:pointer;margin-left:.15rem;color:var(--nord11)';
      rm.onclick=function(){tagList=tagList.filter(function(x){return x!==t});renderChips()};
      chip.appendChild(rm);chips.appendChild(chip)})}
  renderChips();
  input.addEventListener('keydown',function(e){
    if(e.key===' '||e.key==='Enter'||e.key===','){e.preventDefault();var val=input.value.trim().slice(0,30);if(val&&tagList.indexOf(val)===-1&&tagList.length<10){tagList.push(val);renderChips()};input.value=''}
    if(e.key==='Backspace'&&input.value===''&&tagList.length){tagList.pop();renderChips()}})
  btn.textContent='[save]';
  btn.onclick=function(){
    fetch('/api/gif/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:g.id,tags:tagList.join(','),delete_token:localTokens[g.id]||''})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.success){g.tags=d.tags;tagsEl.innerHTML=g.tags.length?g.tags.map(function(t){return'<span class="tag">'+esc(t)+'</span>'}).join(''):'';btn.textContent='[edit]';btn.onclick=function(){editTags(g,btn,item)}}
        else{btn.textContent='failed'}}).catch(function(){btn.textContent='error'})}}

start()})();
