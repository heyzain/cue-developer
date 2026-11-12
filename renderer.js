/* Cue: task-first, keyboard-friendly tool launcher. No framework, no account, no analytics. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const STORAGE = 'cue-local-demo-v1';
  const PACKS = ['Design', 'Assets', 'Build', 'Other'];
  const ICONS = {Design:'icon-spark',Assets:'icon-squares',Build:'icon-bolt',Other:'icon-folder'};
  const PACK_DESC = {Design:'Inspiration, layouts & icons',Assets:'Optimize, convert & export',Build:'Docs, testing & debugging',Other:'Everything else, one place'};
  const ESCAPE = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>ESCAPE[c]);
  const icon = (name, cls='') => `<svg class="${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
  const host = url => {try {return new URL(url).hostname.replace(/^www\./,'');}catch{return ''}};
  const isUrl = text => {try {const x=new URL(/^https?:\/\//i.test(text)?text:`https://${text}`);return ['https:','http:'].includes(x.protocol)&&Boolean(x.hostname);}catch{return false}};
  const safeUrl = value => /^https?:\/\//i.test(value) ? value.trim() : `https://${String(value).trim()}`;
  const letters = name => name.replace(/[^a-z0-9. ]/gi,'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const glyph = item => `<span class="tool-glyph ${esc(item.pack.toLowerCase())}">${esc(letters(item.title) || 'T')}</span>`;
  let items = [], view = 'all', query = '', selectedIndex = 0, visibleResults = [], editing = null, toastTimer;
  const fallback = {
    async list(){let saved;try{saved=JSON.parse(localStorage.getItem(STORAGE))}catch{} if(!Array.isArray(saved)){saved=window.CUE_SEED.map(x=>({...x,createdAt:new Date().toISOString()}));localStorage.setItem(STORAGE,JSON.stringify(saved))}return saved},
    async upsert(item){const arr=await this.list();const old=arr.find(x=>x.id===item.id); const record={...old,...item,id:old?.id || (crypto.randomUUID?.() || String(Date.now()+Math.random())), createdAt:old?.createdAt || new Date().toISOString(),openCount:old?.openCount||0,lastUsed:old?.lastUsed||null}; if(old) arr[arr.indexOf(old)]=record;else arr.unshift(record);localStorage.setItem(STORAGE,JSON.stringify(arr));return arr},
    async remove(id){const arr=(await this.list()).filter(x=>x.id!==id);localStorage.setItem(STORAGE,JSON.stringify(arr));return arr},
    async launch(id){const arr=await this.list(),item=arr.find(x=>x.id===id);if(!item)return arr;window.open(item.url,'_blank','noopener,noreferrer');item.openCount=(item.openCount||0)+1;item.lastUsed=new Date().toISOString();localStorage.setItem(STORAGE,JSON.stringify(arr));return arr},
    async launchPack(pack){const arr=await this.list();for(const item of arr.filter(x=>x.pack===pack).slice(0,8)){window.open(item.url,'_blank','noopener,noreferrer');item.openCount=(item.openCount||0)+1;item.lastUsed=new Date().toISOString()}localStorage.setItem(STORAGE,JSON.stringify(arr));return arr},
    async clipboard(){try{return await navigator.clipboard.readText()}catch{return ''}},
    hide(){showToast('Tray access is available in the desktop app. This browser preview stays open.')},
    minimize(){showToast('Minimize works in the Electron desktop app.')},
    async getPreferences(){try{return JSON.parse(localStorage.getItem('cue-preferences-v1')) || {keepOpenAfterLaunch:true}}catch{return {keepOpenAfterLaunch:true}}},
    async setPreferences(prefs){localStorage.setItem('cue-preferences-v1', JSON.stringify(prefs));return prefs},
    async getShortcut(){return 'Desktop: Ctrl + Shift + Space'},
    async exportData(){const blob = new Blob([JSON.stringify({version:1,items:await this.list()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download='cue-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {ok:true}},
    async importData(){return await new Promise(resolve=>{const f=document.createElement('input');f.type='file';f.accept='.json,application/json';f.addEventListener('change',async()=>{try{const parsed=JSON.parse(await f.files[0].text());if(!Array.isArray(parsed.items)||parsed.items.length>2000)throw Error('Invalid Cue backup.');const arr=await this.list(),urls=new Set(arr.map(x=>x.url));let count=0;for(const c of parsed.items){if(typeof c.url!=='string'||!isUrl(c.url))continue;const url=safeUrl(c.url);if(urls.has(url))continue;urls.add(url);arr.unshift({id:crypto.randomUUID?.()||String(Math.random()),url,title:String(c.title||host(url)).slice(0,100),purpose:String(c.purpose||'').slice(0,240),keywords:String(c.keywords||'').slice(0,280),pack:PACKS.includes(c.pack)?c.pack:'Other',pinned:Boolean(c.pinned),openCount:0,lastUsed:null,createdAt:new Date().toISOString()});count++}localStorage.setItem(STORAGE,JSON.stringify(arr));resolve({ok:true,count,items:arr})}catch(e){resolve({error:e.message})}});f.click()})}
  };
  const api = window.cue || fallback;
  function showToast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
  function byName(a,b){return a.title.localeCompare(b.title)}
  function pinned(){return items.filter(x=>x.pinned).sort((a,b)=>(b.openCount||0)-(a.openCount||0)||byName(a,b))}
  function recents(){return items.filter(x=>x.lastUsed).sort((a,b)=>new Date(b.lastUsed)-new Date(a.lastUsed))}
  function packItems(pack){return items.filter(x=>x.pack===pack).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||byName(a,b))}
  function searchItems(text){
    const phrase=text.toLowerCase().trim().replace(/\s+/g,' ');
    const words=phrase.split(' ').filter(x=>x && !['a','an','to','for','the','my','in','and'].includes(x));
    if(!words.length)return [...items].sort(byName);
    return items.map(item=>{
      const title=item.title.toLowerCase(),purpose=(item.purpose||'').toLowerCase(),keywords=(item.keywords||'').toLowerCase(),pack=item.pack.toLowerCase(),domain=host(item.url).toLowerCase();
      const combined=`${title} ${purpose} ${keywords} ${pack} ${domain}`;
      const passes=words.every(word => combined.includes(word) || (word.endsWith('s') && combined.includes(word.slice(0,-1))) || combined.includes(word+'s'));
      let score=0;
      if(title.includes(phrase))score+=120;
      if(purpose.includes(phrase))score+=100;
      if(keywords.includes(phrase))score+=100;
      for(const word of words){if(title.includes(word))score+=16;if(purpose.includes(word))score+=12;if(keywords.includes(word))score+=14;if(pack.includes(word))score+=4;if(domain.includes(word))score+=7;}
      if(item.pinned)score+=2;if(item.lastUsed)score+=1;
      return {item,passes,score};
    }).filter(x=>x.passes).sort((a,b)=>b.score-a.score||byName(a.item,b.item)).map(x=>x.item);
  }
  function card(item){return `<article class="tool-card" data-open="${esc(item.id)}" tabindex="0" role="button" aria-label="Open ${esc(item.title)}"><div class="tool-card-top">${glyph(item)}<div style="min-width:0"><div class="tool-name">${esc(item.title)}</div><div class="tool-domain">${esc(host(item.url))}</div></div></div><p class="tool-card-desc">${esc(item.purpose || 'Open this website in your browser.')}</p><div class="tool-card-foot"><span class="pack-tag">${esc(item.pack)}</span><span class="card-actions"><button class="card-icon-btn ${item.pinned?'is-pinned':''}" title="${item.pinned?'Unpin':'Pin'}" data-action="pin" data-id="${esc(item.id)}">${icon('icon-pin')}</button><button class="card-icon-btn" title="Edit" data-action="edit" data-id="${esc(item.id)}">${icon('icon-edit')}</button><span class="card-icon-btn card-open">${icon('icon-arrow')}</span></span></div></article>`}
  function grid(these){return `<div class="tool-grid">${these.map(card).join('')}</div>`}
  function quickTile(item){return `<div class="quick-tile" data-open="${esc(item.id)}" tabindex="0" role="button" aria-label="Open ${esc(item.title)}">${glyph(item)}<div class="quick-tile-main"><div class="tool-name">${esc(item.title)}</div><div class="quick-purpose">${esc(item.purpose||host(item.url))}</div></div>${icon('icon-arrow','quick-arrow')}</div>`}
  function recentRow(item){return `<div class="recent-item" data-open="${esc(item.id)}" tabindex="0" role="button">${glyph(item)}<div><div class="recent-name">${esc(item.title)}</div><div class="recent-detail">${esc(item.purpose||host(item.url))}</div></div><span class="recent-arrow">${icon('icon-arrow')}</span></div>`}
  function empty(title,desc,action='Save your first tool'){return `<div class="empty-state"><div class="empty-icon">${icon('icon-search')}</div><strong>${esc(title)}</strong><p>${esc(desc)}</p><button data-action="add">${esc(action)}</button></div>`}
  function resultRow(item,index){return `<div class="result-row ${index===selectedIndex?'active':''}" data-open="${esc(item.id)}" tabindex="0" role="button">${glyph(item)}<div class="result-main"><div class="result-name">${esc(item.title)}</div><div class="result-purpose">${esc(item.purpose||'Open this website in your browser')}</div><div class="result-domain">${esc(host(item.url))} <span style="padding:0 5px;color:#4b605b">·</span> ${esc(item.pack)}</div></div><span class="result-actions"><button class="card-icon-btn ${item.pinned?'is-pinned':''}" data-action="pin" data-id="${esc(item.id)}" title="Pin/unpin">${icon('icon-pin')}</button><button class="card-icon-btn" data-action="edit" data-id="${esc(item.id)}" title="Edit">${icon('icon-edit')}</button><button class="card-icon-btn" data-action="delete" data-id="${esc(item.id)}" title="Delete">${icon('icon-trash')}</button><button class="result-open-btn" data-action="open" data-id="${esc(item.id)}">Open ${icon('icon-arrow')}</button></span></div>`}
  function renderSearch(){
    visibleResults=searchItems(query);
    const resultText=`${visibleResults.length} matching ${visibleResults.length===1?'tool':'tools'}`;
    return `<div class="filter-heading"><div><div class="eyebrow">SEARCH YOUR CUE</div><h1>Find your next tool<span class="accent">.</span></h1><p>Search by what you want to accomplish—not just by website name.</p></div></div><div class="result-count">${resultText} for <span class="result-query">“${esc(query)}”</span></div>${visibleResults.length?visibleResults.map(resultRow).join(''):empty('Nothing matches that yet.', 'Add this tool once, then find it by purpose whenever you need it.','Save a matching tool')}`;
  }
  function renderWelcome(){
    const top=pinned().slice(0,2);
    const actions=[
      {label:'Explore tools',ico:'icon-squares',nav:'discover'},
      {label:'Find inspiration',ico:'icon-spark',search:'ui inspiration'},
      {label:'Convert & optimize',ico:'icon-image',search:'convert'},
      {label:'Build resources',ico:'icon-folder',nav:'Build'},
      {label:'Browse icons',ico:'icon-box',search:'svg icons'}
    ];
    const actionTiles=actions.map(a=>`<button class="action-tile" ${a.nav?`data-navigate="${esc(a.nav)}"`:`data-search="${esc(a.search)}"`}>${icon(a.ico)}<span>${esc(a.label)}</span></button>`).join('');
    const captions={Design:'UI & visuals',Assets:'Media & icons',Build:'Dev & code'};
    const cards=['Design','Assets','Build'].map(pack=>`<button class="pack-card" data-navigate="${pack}"><span class="pack-cover ${pack.toLowerCase()}" aria-hidden="true"></span><span class="pack-card-body"><span class="pack-card-copy"><strong>${pack}</strong><small>${captions[pack]} · ${packItems(pack).length} tools</small></span><span class="pack-card-arrow">${icon('icon-arrow')}</span></span></button>`).join('');
    return `<section class="hero"><div class="hero-copy"><span class="greeting">Welcome back! <span aria-hidden="true">👋</span></span><h1>What are you<br><em>working</em> on?</h1><p>Turn ideas into reality with Cue.</p></div><div class="hero-art" aria-hidden="true"></div></section>
    <section class="actions-section" aria-label="Quick actions"><div class="action-grid">${actionTiles}</div></section>
    <section class="pack-section"><div class="section-header"><div><h2 class="section-title">Your task packs</h2></div><button class="inline-action" data-navigate="discover">View all ${icon('icon-arrow')}</button></div><div class="pack-cards">${cards}</div></section>
    <section class="reach-section"><div class="section-header"><div><h2 class="section-title">Within reach</h2><p class="section-sub">The tools you want to find without thinking.</p></div><button class="inline-action" data-navigate="pinned">View pinned ${icon('icon-arrow')}</button></div>${top.length?`<div class="quick-grid">${top.map(quickTile).join('')}</div>`:empty('No pinned tools yet.','Pin a few favorites to keep them right here.')}</section>
    <section class="recent-section"><div class="section-header"><div><h2 class="section-title">Recently opened</h2><p class="section-sub">Pick up exactly where you left off.</p></div><button class="inline-action" data-navigate="recent">View recent ${icon('icon-arrow')}</button></div>${recents().length?recents().slice(0,3).map(recentRow).join(''):`<p class="soft-note">Your recently opened tools will appear here.</p>`}</section>`;
  }
  function renderFiltered(){
    let heading='',sub='',these=[];
    if(view==='discover'){heading='Explore all tools';sub='Everything saved in Cue, ready when you need it.';these=[...items].sort(byName)}
    else if(view==='pinned'){heading='Pinned tools';sub='Your shortcuts to the essentials.';these=pinned()}
    else if(view==='recent'){heading='Recently used';sub='Pick up exactly where you left off.';these=recents()}
    else {heading=`${view} tools`;sub=PACK_DESC[view];these=packItems(view)}
    const canLaunch=PACKS.includes(view)&&these.length>0;
    return `<div class="filter-heading"><button class="back-btn" data-navigate="all" aria-label="Back">${icon('icon-back')}</button><div><h1>${esc(heading)}<span class="accent">.</span></h1><p>${esc(sub)} · ${these.length} ${these.length===1?'tool':'tools'}</p></div>${canLaunch?`<div class="filter-heading-right"><button class="launch-pack-btn" data-action="launch-pack" data-pack="${esc(view)}">Open pack ${icon('icon-arrow')}</button></div>`:''}</div>${these.length?grid(these):empty('This shelf is empty.',view==='recent'?'Open a tool to see it here.':'Add a tool or pin one you already saved.')}`;
  }
  function render(){
    $$('#main-nav [data-view]').forEach(x=>x.classList.toggle('selected',x.dataset.view===view&&!query));
    $$('#pack-nav [data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view&&!query));
    $('#pin-count').textContent=pinned().length;
    $$('[data-pack-count]').forEach(x=>{const count=packItems(x.dataset.packCount).length;x.textContent=count?String(count):''});
    $('#search-clear').classList.toggle('hidden',!query);
    $('#content-body').innerHTML=query?renderSearch():view==='all'?renderWelcome():renderFiltered();
  }
  function navigate(target){view=target;query='';selectedIndex=0;$('#search-input').value='';render();$('#content-scroll').scrollTop=0}
  function setSearch(text){query=text;view='all';selectedIndex=0;$('#search-input').value=text;render();$('#search-input').focus();$('#content-scroll').scrollTop=0}
  async function refresh(){items=await api.list();render()}
  async function openResource(id){try{items=await api.launch(id);render()}catch(e){showToast(e.message||'Could not open that link.')}}
  async function togglePin(id){const item=items.find(x=>x.id===id);if(!item)return;try{items=await api.upsert({...item,pinned:!item.pinned});render();showToast(`${item.title} ${item.pinned?'unpinned':'pinned'}.`)}catch(e){showToast(e.message)}}
  async function removeResource(id){const item=items.find(x=>x.id===id);if(!item)return;if(!confirm(`Remove ${item.title} from Cue?`))return;try{items=await api.remove(id);render();showToast('Tool removed.')}catch(e){showToast(e.message)}}
  function openModal(item=null,clipboardText=''){
    editing=item?.id||null;
    $('#tool-form').reset();$('#tool-id').value=item?.id||'';
    $('#tool-url').value=item?.url || (isUrl(clipboardText) ? safeUrl(clipboardText) : '');
    $('#tool-title').value=item?.title||'';$('#tool-purpose').value=item?.purpose||'';
    $('#tool-keywords').value=item?.keywords||'';$('#tool-pack').value=item?.pack||'Design';
    $('#tool-pinned').checked=item?.pinned||false;
    $('#modal-heading').innerHTML=item?'Edit this tool<span class="accent">.</span>':'Save a useful tool<span class="accent">.</span>';
    $('#save-label').textContent=item?'Save changes':'Save tool';
    $('#modal-layer').classList.remove('hidden');$('#modal-layer').setAttribute('aria-hidden','false');
    setTimeout(()=>($('#tool-url').value?$('#tool-purpose'):$('#tool-url')).focus(),20);
  }
  function closeModal(){editing=null;$('#modal-layer').classList.add('hidden');$('#modal-layer').setAttribute('aria-hidden','true');$('#search-input').focus()}
  async function addFromClipboard(){let text='';try{text=await api.clipboard()}catch{}openModal(null,text);}
  async function submitTool(e){
    e.preventDefault();
    const url=$('#tool-url').value.trim();if(!isUrl(url)){showToast('Enter a valid website URL.');$('#tool-url').focus();return;}
    const normalized=safeUrl(url);
    if(items.some(x=>x.url===normalized && x.id!==editing)){showToast('You already saved this URL. Search for it instead.');return;}
    const value={id:editing,url:normalized,title:$('#tool-title').value.trim(),purpose:$('#tool-purpose').value.trim(),keywords:$('#tool-keywords').value.trim(),pack:$('#tool-pack').value,pinned:$('#tool-pinned').checked};
    try{const wasEditing=Boolean(editing);items=await api.upsert(value);closeModal();render();showToast(wasEditing?'Tool updated.':'Tool saved. You can now find it by its purpose.')}catch(err){showToast(err.message||'Could not save tool.')}
  }
  async function exportData(){try{const res=await api.exportData();if(res?.ok)showToast('Your Cue backup was exported.')}catch(e){showToast(e.message||'Export failed.')}}
  async function importData(){try{const res=await api.importData();if(res?.ok){items=res.items||await api.list();render();showToast(`${res.count} new links imported.`)}else if(res?.error)showToast(res.error)}catch(e){showToast(e.message||'Import failed.')}}
  async function launchPack(pack){const count=items.filter(x=>x.pack===pack).length;if(count>8){if(!confirm(`This pack has ${count} tools. Cue will open the first 8. Continue?`))return;}else if(count>3){if(!confirm(`Open ${count} websites in your browser?`))return;}try{items=await api.launchPack(pack);render()}catch(e){showToast(e.message||'Could not open that pack.')}}
  $('#content-body').addEventListener('click',async e=>{
    const action=e.target.closest('[data-action]');
    if(action){e.stopPropagation();const id=action.dataset.id;
      switch(action.dataset.action){case 'pin':await togglePin(id);break;case 'edit':openModal(items.find(x=>x.id===id));break;case 'delete':await removeResource(id);break;case 'open':await openResource(id);break;case 'add':await addFromClipboard();break;case 'launch-pack':await launchPack(action.dataset.pack);break;}return;
    }
    const suggestion=e.target.closest('[data-search]');if(suggestion){setSearch(suggestion.dataset.search);return;}
    const go=e.target.closest('[data-navigate]');if(go){navigate(go.dataset.navigate);return;}
    const resource=e.target.closest('[data-open]');if(resource)await openResource(resource.dataset.open);
  });
  $('#content-body').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ') && e.target.matches('[data-open]')){e.preventDefault();openResource(e.target.dataset.open)}});
  $$('#main-nav [data-view],#pack-nav [data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
  $('#search-input').addEventListener('input',e=>{query=e.target.value.trim();selectedIndex=0;render();$('#content-scroll').scrollTop=0});
  $('#search-clear').addEventListener('click',()=>setSearch(''));
  $('#hide-button').addEventListener('click',()=>api.hide());
  $('#tray-button').addEventListener('click',()=>api.hide());
  $('#minimize-button').addEventListener('click',()=>api.minimize());
  $('#keep-open-toggle').addEventListener('change',async e=>{
    try { await api.setPreferences({keepOpenAfterLaunch:e.target.checked}); }
    catch(err) { e.target.checked = !e.target.checked; showToast(err.message||'Could not update preferences.'); }
  });
  $('#add-floating').addEventListener('click',addFromClipboard);
  $('#sidebar-add').addEventListener('click',addFromClipboard);
  $('#sidebar-discover').addEventListener('click',()=>navigate('discover'));
  $('#import-button').addEventListener('click',importData);
  $('#export-button').addEventListener('click',exportData);
  $('#modal-close').addEventListener('click',closeModal);
  $('#modal-cancel').addEventListener('click',closeModal);
  $('[data-close]').addEventListener('click',closeModal);
  $('#paste-url').addEventListener('click',async()=>{try{const clip=await api.clipboard();if(isUrl(clip)){ $('#tool-url').value=safeUrl(clip);showToast('URL pasted.')}else showToast('Clipboard does not contain a website URL.')}catch{showToast('Could not read clipboard.')}});
  $('#tool-form').addEventListener('submit',submitTool);
  document.addEventListener('keydown',e=>{
    const modalOpen=!$('#modal-layer').classList.contains('hidden');
    if(e.key==='Escape'){e.preventDefault();if(modalOpen)closeModal();else if(query)setSearch('');else api.hide();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();if(!modalOpen)addFromClipboard();return;}
    if(modalOpen)return;
    if(e.key==='/'&&e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();$('#search-input').focus();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search-input').focus();return;}
    if(document.activeElement===$('#search-input')&&query){
      if(e.key==='ArrowDown'){e.preventDefault();selectedIndex=Math.min(visibleResults.length-1,selectedIndex+1);render();}
      else if(e.key==='ArrowUp'){e.preventDefault();selectedIndex=Math.max(0,selectedIndex-1);render();}
      else if(e.key==='Enter'&&visibleResults.length){e.preventDefault();openResource(visibleResults[Math.max(0,selectedIndex)].id)}
    }
  });
  if(window.cue?.onPreferencesChanged)window.cue.onPreferencesChanged(prefs=>$('#keep-open-toggle').checked=prefs.keepOpenAfterLaunch!==false);
  if(window.cue?.onQuickAdd)window.cue.onQuickAdd(text=>openModal(null,text));
  if(window.cue?.onWarning)window.cue.onWarning(showToast);
  (async()=>{
    try {await refresh();const preferences=await api.getPreferences();$('#keep-open-toggle').checked=preferences.keepOpenAfterLaunch!==false;const shortcut=await api.getShortcut();if(shortcut==='Ctrl+Alt+Space')$('#shortcut-pill').textContent='Ctrl + Alt + Space';else if(shortcut==='Tray only')$('#shortcut-pill').textContent='Tray access';$('#search-input').focus()}
    catch(e){console.error(e);showToast('Unable to load your saved tools.')}
  })();
})();
