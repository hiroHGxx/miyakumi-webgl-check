/* 便4: HTMLの閲覧と入力。進行・取得・正誤・助けの判定はUnityの芯が持つ。 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), dialog = $('storyDialog'), body = $('storyBody');
  const send = (method, value = '') => { if (window.unityInstance) unityInstance.SendMessage('Hitoyo', method, value); };
  const elements = ['木','火','土','金','水'];
  let journal = {pages:[],hints:[],read:0}, mode = '', clue = 'c1', ledgerPage = 0, selected = 0, lamps = Array(5).fill(''), pending = false, ready = false, message = '', previousFocus;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function marked(text, id) {
    const words = {c1:['相生','主の五行'],c2:['姉'],c3:['妹','字の内']}[id] || [];
    return esc(text).replace(new RegExp(words.join('|') || '(?!)','g'), '<mark>$&</mark>');
  }
  function action(label, name, extra = '') { return '<button type="button" class="story-action" data-action="'+name+'" '+extra+'>'+label+'</button>'; }
  function hints() {
    return journal.hints.length ? '<details class="story-hints"><summary>栞の言葉を読み返す（'+journal.hints.length+'）</summary><ol>'+journal.hints.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ol></details>' : '';
  }
  function paper(id, notebook) {
    const p = journal.pages.find(p=>p.id===id); if (!p) return '';
    const index = journal.pages.indexOf(p), kinds = ['scroll','tablet','ledger'];
    let content = '<h3>'+esc(p.collected ? p.title : p.place)+'</h3>';
    if (!p.collected) content += '<div class="story-empty"><span class="seal">まだ、空の頁</span><p>'+esc(p.place.replace('にて',''))+'の手掛かりを見つけると、<br>ここに書き留められます。</p></div>';
    else {
      if (id==='c2') content += '<div class="unlit" role="img" aria-label="消えた五つの灯"><i></i><i></i><i></i><i></i><i></i></div>';
      if (id==='c3' && !notebook) {
        const parts=p.text.split('\n\n'), lines=(parts[1]||'').split('\n');
        ledgerPage=Math.min(ledgerPage,lines.length-1);
        content += '<div class="story-prose">'+marked(parts[0],id)+'</div><div class="story-prose ledger-line" aria-live="polite">'+marked(lines[ledgerPage],id)+'</div>';
        content += '<div class="ledger-nav">'+action('前の頁','prev',ledgerPage===0?'disabled':'')+'<span>'+(ledgerPage+1)+' / '+lines.length+'</span>'+action('次の頁','next',ledgerPage===lines.length-1?'disabled':'')+'</div>';
      } else content += '<div class="story-prose">'+marked(p.text,id)+'</div>';
      content += '<div class="folio">第'+(index+1)+'頁　'+p.day+'日目に写した手掛かり</div>';
    }
    return '<article class="story-paper '+(notebook?'notebook':kinds[index])+'" data-clue="'+id+'">'+content+'</article>';
  }
  function paintLockControls() {
    body.querySelectorAll('[data-slot]').forEach(b=>{const i=Number(b.dataset.slot);b.innerHTML='<small>'+(i+1)+'の灯</small>'+esc(lamps[i]||'・');b.setAttribute('aria-pressed',String(i===selected));b.setAttribute('aria-label',(i+1)+'の灯、'+(lamps[i]||'未選択'));b.disabled=pending;});
    body.querySelectorAll('[data-element]').forEach(b=>b.disabled=pending);
    const submit=$('lockSubmit');if(submit)submit.disabled=pending||lamps.some(x=>!x);
    const note=$('lockSelection');if(note)note.textContent=pending?'灯を確かめています…':(selected+1)+'の灯を選ぶ · '+lamps.filter(Boolean).length+' / 5';
  }
  function render() {
    $('storyKicker').textContent = mode==='won'?'一の宮':mode==='hint'?'翌朝、玄関にて':mode==='lock'?'奥の間':mode==='notebook'?'栞の式書':'手掛かりを見つけた';
    $('storyTitle').textContent = {notebook:'三頁の手帳',clue:((journal.pages.find(p=>p.id===clue)||{}).title||'').replace('（書院）',''),hint:'栞のひとこと',lock:'五つの灯の錠',won:'満願'}[mode] || '';
    $('storyClose').textContent = mode==='clue'?'手帳に収める':mode==='hint'?'心に留める':mode==='won'?'屋敷へ戻る':'閉じる';
    if(mode==='notebook') {
      body.innerHTML='<p class="story-lead">三頁を集め、奥の錠へ。朝に間取りが消えても、写した頁は残ります。<br>手掛かり '+journal.read+' / 3</p><nav class="story-tabs" aria-label="手帳の三頁">'+journal.pages.map(p=>'<button type="button" data-page="'+p.id+'" class="'+(p.collected?'collected':'')+'" aria-pressed="'+(p.id===clue)+'">'+esc(p.place)+'<small>'+(p.collected?'写しあり':'未収集')+'</small></button>').join('')+'</nav>'+paper(clue,true)+hints();
    } else if(mode==='clue') {
      body.innerHTML='<p class="story-lead">手帳に '+journal.read+' / 3 頁。大切な言葉は、金泥で書き留めました。</p>'+paper(clue,false)+'<div class="story-actions">'+action('三頁の手帳を見る','notebook')+'</div>';
    } else if(mode==='hint') {
      body.innerHTML='<article class="story-paper notebook"><p class="story-kicker">栞</p><p class="hint-voice">「'+esc(message)+'」</p><p class="story-lead">手帳にも、この言葉を残しておきます。<br>栞の助けを受けた宮は、番付には送りません。</p></article><div class="story-actions">'+action('手帳を読み返す','notebook')+'</div>';
    } else if(mode==='lock') {
      body.innerHTML='<p class="story-lead">'+(ready?'三頁がそろいました。手掛かりを合わせ、はじめの灯から順に選んでください。':'灯の皿は、まだ伏せられています。<br>栞「……頁が、まだ足りませんこと」')+'</p><div class="lock-slots">'+lamps.map((l,i)=>ready?'<button type="button" class="lock-slot" data-slot="'+i+'"></button>':'<div class="lock-slot covered" aria-label="伏せられた灯">―</div>').join('')+'</div>';
      if(ready) body.innerHTML+='<div id="lockSelection" class="lock-note" aria-live="polite"></div><div class="lock-elements">'+elements.map(e=>'<button type="button" class="lock-element" data-element="'+e+'" aria-label="'+e+'を選ぶ">'+e+'</button>').join('')+'</div><p class="lock-note">残り '+journal.steps+' 歩 · 外すと三歩を失います</p>';
      else body.innerHTML+='<p class="lock-note">手掛かり '+journal.read+' / 3 · 書院・祭壇・蔵を探しましょう</p>';
      body.innerHTML+='<p id="lockMessage" role="status" tabindex="-1">'+esc(message)+'</p><div class="story-actions">'+action('手帳を開く','notebook')+(ready?action('やり直す','reset')+'<button type="button" class="story-action primary" id="lockSubmit" data-action="submit">この順に灯す</button>':'')+'</div>';
      paintLockControls();
    } else if(mode==='won') {
      body.innerHTML='<article class="story-paper notebook"><div class="won-seal">錠が、開いた。</div><p class="story-score">この宮の主は、'+esc(journal.lord)+'。<br>'+journal.day+'日目の満願 · 総歩数 '+journal.total+'</p><p class="lock-note">'+(journal.assisted?'栞の助けあり · 番付対象外':'自力で三頁の謎を解きました。')+'</p></article><div class="story-actions">'+action('手帳を振り返る','notebook')+'</div>';
    }
  }
  body.addEventListener('click', e=>{
    const b=e.target.closest('button');if(!b||b.disabled||pending)return;
    if(b.dataset.page){clue=b.dataset.page;render();body.querySelector('[data-page="'+clue+'"]').focus();return;}
    if(b.dataset.slot!==undefined){selected=Number(b.dataset.slot);paintLockControls();return;}
    if(b.dataset.element){lamps[selected]=b.dataset.element;selected=Math.min(4,selected+1);paintLockControls();return;}
    switch(b.dataset.action){
      case 'notebook':send('OpenNotebook');break;
      case 'prev':ledgerPage--;render();body.querySelector('[data-action=prev]:not(:disabled),[data-action=next]').focus();break;
      case 'next':ledgerPage++;render();body.querySelector('[data-action=next]:not(:disabled),[data-action=prev]').focus();break;
      case 'reset':lamps.fill('');selected=0;paintLockControls();break;
      case 'submit':if(lamps.every(Boolean)){pending=true;paintLockControls();send('TryLamps',lamps.join(''));}break;
    }
  });
  $('bookBtn').addEventListener('click',()=>send('OpenNotebook'));
  $('storyClose').addEventListener('click',()=>send('CloseStory'));
  dialog.addEventListener('cancel',e=>{e.preventDefault();send('CloseStory');});
  window.HitoyoStory={
    receive(m){
      if(m.t==='journal') {journal=m;window.__hitoyo.journal=m;$('bookBtn').textContent='手帳 '+m.read+' / 3';return;}
      if(m.t!=='story')return;
      const old=mode;mode=m.mode;window.__hitoyo.story=m;pending=false;if(mode)$('deNext').disabled=false;
      if(!mode){if(dialog.open)dialog.close();document.body.classList.remove('reading');if(previousFocus?.isConnected)previousFocus.focus();else $('bookBtn').focus();return;}
      if(m.clue){clue=m.clue;ledgerPage=0;}
      if(mode==='lock'&&!old){lamps.fill('');selected=0;}
      ready=!!m.ready;message=m.message||'';render();body.scrollTop=0;
      if(!dialog.open){previousFocus=document.activeElement;document.body.classList.add('reading');dialog.showModal();}
      if(mode==='lock'&&message)$('lockMessage').focus();else $('storyClose').focus();
    },
    canRead(value){$('bookBtn').disabled=!value;}
  };
})();
