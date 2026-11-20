const Nat = (() => {
  const {days, words, readings}=natCourse;
  const names=['Vocabulary','Kanji','Grammar','Reading','Listening','Revision'];
  const minutes=[20,20,30,25,20,5];
  const months=[...new Set(days.map(d=>d.date.slice(0,7)))];
  const blank=()=>({last:0,days:{}});
  const store=()=>state.nat ||= blank();
  const entry=i=>store().days[i] ||= {done:[],answers:{},misses:{},note:''};
  let i=0, block=0, month=0, panel='lesson';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const fmt=(iso,opts)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',...opts});
  const dateLabel=iso=>fmt(iso,{month:'short',day:'numeric'});
  const link=(n,label)=>'<a class="nat-link" href="#nat/'+(n+1)+'">'+escape(label)+'</a>';
  function route(n,section=0){
    if(!days[n])return;
    i=n;block=section;month=months.indexOf(days[i].date.slice(0,7));panel='lesson';
    store().last=n;save();history.replaceState(null,'','#nat/'+(n+1));go('nat');
  }
  function fromHash(){
    const n=Number(location.hash.split('/')[1])-1;
    route(Number.isInteger(n)&&days[n]?n:store().last||0);
  }
  function calendar(){
    const key=months[month], first=new Date(key+'-01T12:00:00Z').getUTCDay();
    const count=new Date(Date.UTC(+key.slice(0,4),+key.slice(5),0)).getUTCDate();
    const cells=Array.from({length:count},(_,j)=>{
      const iso=key+'-'+String(j+1).padStart(2,'0'), n=days.findIndex(d=>d.date===iso);
      if(n<0)return '<span class="nat-out">'+(j+1)+'</span>';
      const done=store().days[n]?.done.length===6;
      return '<button data-day="'+n+'" class="'+(i===n?'current ':'')+(done?'finished':'')+'" aria-label="'+dateLabel(iso)+', day '+(n+1)+(done?', completed':'')+'" '+(i===n?'aria-current="date"':'')+'>'+ (j+1)+(done?' ✓':'')+'</button>';
    }).join('');
    return '<section class="card nat-calendar"><div class="row"><button data-month="-1" aria-label="Previous month" '+(!month?'disabled':'')+'>‹</button><b>'+fmt(key+'-01',{month:'long',year:'numeric'})+'</b><button data-month="1" aria-label="Next month" '+(month===3?'disabled':'')+'>›</button></div><div class="nat-grid">'+['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=>'<b>'+x+'</b>').join('')+'<span></span>'.repeat(first)+cells+'</div><p>Choose any study date. ✓ marks a completed lesson.</p></section>';
  }
  function totals(){
    const records=Object.values(store().days);
    return {completed:records.filter(e=>e.done.length===6).length,minutes:records.reduce((s,e)=>s+e.done.reduce((a,k)=>a+minutes[k],0),0)};
  }
  function summary(){
    const t=totals();
    return '<div class="card lesson-card"><div class="row"><div><span class="eyebrow">NAT-TEST 3Q</span><h2>80-day study calendar</h2><p>'+t.completed+' of 80 lessons complete · '+t.minutes+' study minutes checked off</p></div><button class="primary" data-nat-open>Open study calendar</button></div></div>';
  }
  function addSummary(){const anchor=view.querySelector('.hero')||view.querySelector('.heading');if(anchor)anchor.insertAdjacentHTML('afterend',summary());else view.insertAdjacentHTML('afterbegin',summary());view.querySelector('[data-nat-open]').onclick=()=>route(store().last);}
  const readingFor=n=>n>=49&&n<=52?natLongReads[n-49]:readings[days[n].reading];
  function questionSet(n){
    const day=days[n], q=[];
    function add(skill,prompt,answer,others,why,extra={}){
      let options=[...new Set([answer,...others])].slice(0,4);
      const shift=(n*3+q.length*7+1)%options.length;
      q.push({skill,prompt,answer,options:options.slice(shift).concat(options.slice(0,shift)),why,...extra});
    }
    function word(id,skill){
      const w=words[id], field=skill===0?'meaning':'reading';
      const other=Array.from({length:words.length},(_,j)=>words[(id+1+3*j)%words.length][field]).filter(s=>s!==w[field]);
      add(skill,(skill===0?'Choose the meaning of ':'Choose the hiragana for ')+w.word,w[field],other,w.word+'（'+w.reading+'） · '+w.meaning);
    }
    day.words.forEach(id=>word(id,0));day.words.forEach(id=>word(id,1));
    function grammar(id){
      const g=natPatterns[id-1];
      const others=Array.from({length:8},(_,j)=>natPatterns[(id+7*j+13)%natPatterns.length].en);
      add(2,g.ja,g.en,others,g.kana+' · '+g.note);
    }
    day.grammar.forEach(grammar);
    function read(r){add(3,r.question,r.correct,[r.wrong1,r.wrong2,r.wrong3],'Read the passage again and find the phrase supporting '+r.correct+'。',{passage:r.text,heading:r.title});}
    function listen(k){const a=natAudio(k);add(4,a.prompt,a.answer,a.options,a.why,{audio:k});}
    read(readingFor(n));listen(n);
    if([27,34,41,48,55,56,63,70,74,76,79].includes(n)){
      [0,1,2].forEach(j=>read(natLongReads[(j+n)%4]));
      [1,3,5].forEach(j=>days[Math.max(0,n-j)].grammar.forEach(grammar));
    }
    if([53,54,57,61,64,68,71,75,78].includes(n))for(let j=1;j<8;j++)listen(n-j);
    return q;
  }
  function play(k,button){
    const status=button.parentNode.querySelector('[role=status]');
    if(!window.speechSynthesis){status.textContent='Audio is unavailable here. Open the transcript or try a browser with Japanese speech support.';return;}
    const u=new SpeechSynthesisUtterance(natAudio(k).script), synth=window.speechSynthesis;
    synth.cancel();u.lang='ja-JP';const voice=synth.getVoices().find(v=>/^ja/i.test(v.lang));
    if(voice)u.voice=voice;
    u.rate=button.dataset.slow?0.74:0.97;
    u.onstart=()=>status.textContent='Playing Japanese audio…';
    u.onend=()=>status.textContent='Playback finished.';
    u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))status.textContent='Japanese playback is unavailable. Enable a Japanese voice on your device or open the transcript.'};
    status.textContent='Starting audio…';synth.speak(u);
  }
  function quiz(q,k){
    const rec=entry(i), chosen=rec.answers[k], graded=Number.isInteger(chosen);
    const audio=q.audio!==undefined?'<div class="nat-player"><button data-play="'+q.audio+'">Play Japanese</button> <button data-play="'+q.audio+'" data-slow="1">Play slowly</button> <span role="status"></span><details><summary>Transcript</summary><p lang="ja">'+escape(natAudio(q.audio).script)+'</p></details></div>':'';
    return '<article class="nat-q" id="nat-q-'+k+'">'+(q.passage?'<h3 lang="ja">'+escape(q.heading)+'</h3><p class="nat-passage" lang="ja">'+escape(q.passage)+'</p>':'')+audio+'<strong>'+escape(q.prompt)+'</strong><div class="nat-answers">'+q.options.map((o,j)=>'<button data-question="'+k+'" data-option="'+j+'" '+(graded?'disabled':'')+' class="'+(graded&&o===q.answer?'right':graded&&j===chosen?'miss':'')+'">'+escape(o)+'</button>').join('')+'</div>'+(graded?'<div role="status"><b>'+(q.options[chosen]===q.answer?'Correct.':'Review · '+escape(q.answer)+'.')+'</b> '+escape(q.why)+' <button class="textbtn" data-retry="'+k+'">Try again</button></div>':'')+'</article>';
  }
  const instructions=[
    'Spend 5 minutes reading the ten words aloud, 10 minutes recalling their meanings with the list closed, and 5 minutes using three of them in sentences.',
    'Spend 5 minutes studying the compounds, 10 minutes writing them from the hiragana, and 5 minutes checking each character and testing your readings.',
    'Read the formation and examples for 10 minutes. Spend 10 minutes on the day’s writing task, then 10 minutes translating without looking and checking your answers.',
    'Skim for 5 minutes. Spend 10 minutes finding the evidence for your answer, then 10 minutes rereading aloud and summarizing the passage in your own words.',
    'Listen once with the transcript closed. Spend 5 minutes identifying the situation, 10 minutes answering and checking key phrases, then 5 minutes shadowing at normal speed.',
    'Spend 2 minutes recalling earlier material, 2 minutes correcting one mistake, and 1 minute recording what you want to remember tomorrow.'
  ];
  function lesson(){
    const d=days[i],e=entry(i), qs=questionSet(i);
    const vocabulary=d.words.map(id=>words[id]);
    const wordsHtml='<details><summary>Study today’s ten words</summary><div class="nat-words">'+vocabulary.map(w=>'<div><b lang="ja">'+escape(w.word)+'</b><span lang="ja">'+escape(w.reading)+'</span><span>'+escape(w.meaning)+'</span></div>').join('')+'</div></details>';
    const spelling='<details><summary>Handwriting prompts and model spellings</summary>'+vocabulary.map(w=>'<details><summary lang="ja">'+escape(w.reading)+' · '+escape(w.meaning)+'</summary><b lang="ja">'+escape(w.word)+'</b></details>').join('')+'</details>';
    const grammar=d.grammar.map(id=>{const g=natPatterns[id-1];return '<article class="nat-grammar"><h3 lang="ja">'+escape(g.name)+'</h3><b>'+escape(g.meaning)+'</b><p>'+escape(g.formation)+'</p><p>'+escape(g.note)+'</p><div class="lesson-example"><b lang="ja">'+escape(g.ja)+'</b><div lang="ja">'+escape(g.kana)+'</div><p>'+escape(g.en)+'</p></div></article>'}).join('');
    const past=[1,7,21].filter(n=>i>=n).map(n=>link(i-n,(n===1?'Yesterday':n+' days ago')+' · '+days[i-n].title));
    const guide='<h3>Recall without notes</h3><p>Say one grammar example, give the reading of '+escape(vocabulary[0].word)+' and explain the listening answer. Check the lesson after your first attempt.</p>'+(past.length?'<h3>Spaced review</h3><div class="nat-links">'+past.join('')+'</div>':'')+'<h3>Corrections</h3>'+mistakes(i)+'<label for="nat-note">My example or correction</label><textarea id="nat-note" rows="3" maxlength="3000">'+escape(e.note)+'</textarea>';
    let body=[wordsHtml,spelling,grammar,'','',''][block];
    if(block===5)body=guide;
    const isMock=/^Mock/.test(d.title), test=isMock?'<p><b>Mock-day routine</b> · '+(d.title.includes('listening')?'Combine the 20-minute listening block with 20 minutes of replay and corrections from your reading block.':'Use the vocabulary, kanji, grammar and reading blocks plus the 5-minute revision block as a 100-minute written session. Keep 20 minutes for listening.')+'</p>':'';
    return '<section class="card nat-lesson"><span class="eyebrow">DAY '+(i+1)+' OF 80 · '+escape(dateLabel(d.date))+'</span><h2>'+escape(d.title)+'</h2><p>'+escape(d.focus)+'</p><div class="nat-task"><b>Today’s assignment</b><p>'+escape(natWriting[i])+'</p></div>'+test+'<div class="nat-blocks">'+names.map((s,k)=>'<button data-block="'+k+'" aria-pressed="'+(k===block)+'">'+(e.done.includes(k)?'✓ ':'')+s+' · '+minutes[k]+'m</button>').join('')+'</div><h3>'+names[block]+' · '+minutes[block]+' minutes</h3><p>'+instructions[block]+'</p>'+body+qs.map((q,k)=>q.skill===block?quiz(q,k):'').join('')+'<div class="nat-controls"><button class="wide" data-done>'+ (e.done.includes(block)?'✓ Block complete · undo':'Mark block complete')+'</button>'+(block<5?'<button class="primary" data-block="'+(block+1)+'">Next block</button>':i<79?'<button class="primary" data-day="'+(i+1)+'">Next lesson</button>':'')+'</div></section>';
  }
  function mistakes(n){
    const rec=store().days[n];if(!rec)return '';
    const qs=questionSet(n);const missed=Object.keys(rec.misses).filter(k=>qs[k]);
    return missed.length?missed.map(k=>'<button class="nat-error" data-fix="'+n+','+k+'">'+escape(names[qs[k].skill]+' · '+qs[k].prompt)+'</button>').join(''):'<p>No missed questions recorded for this lesson.</p>';
  }
  function testItems(n){
    const qs=questionSet(n);
    if(days[n].title.startsWith('Mock'))return qs.map((q,k)=>k).filter(k=>days[n].title.includes('listening')?qs[k].skill===4:qs[k].skill!==4);
    return [n%10,10+(n+3)%10,qs.findIndex(q=>q.skill===2),qs.findIndex(q=>q.skill===3),qs.findIndex(q=>q.skill===4)];
  }
  function testView(){
    const qs=questionSet(i), ids=testItems(i), rec=entry(i), test=rec.test ||= {choices:{},submitted:false};
    const score=ids.filter(k=>qs[k].options[test.choices[k]]===qs[k].answer).length;
    return '<section class="card nat-lesson"><span class="eyebrow">DAY '+(i+1)+' · '+dateLabel(days[i].date)+'</span><h2>'+(/Mock/.test(days[i].title)?escape(days[i].title):'Daily practice test')+'</h2><p>'+ids.length+' questions · Choose an answer for each item, then submit to see your score.</p>'+(test.submitted?'<h3 role="status">Score · '+score+' / '+ids.length+'</h3>':'')+ids.map((k,j)=>{
      const q=qs[k];
      return '<fieldset class="nat-test"><legend>'+(j+1)+'. '+escape(q.prompt)+'</legend>'+(q.passage?'<p class="nat-passage" lang="ja">'+escape(q.passage)+'</p>':'')+(q.audio!==undefined?'<div class="nat-player"><button data-play="'+q.audio+'">Play Japanese</button> <span role="status"></span></div>':'')+q.options.map((o,a)=>'<label><input type="radio" data-test-choice="'+k+'" name="test-'+k+'" value="'+a+'" '+(test.choices[k]===a?'checked ':'')+(test.submitted?'disabled':'')+'>'+escape(o)+'</label>').join('')+(test.submitted?'<p><b>'+(q.options[test.choices[k]]===q.answer?'Correct':'Answer · '+escape(q.answer))+'</b> '+escape(q.why)+'</p>':'')+'</fieldset>';
    }).join('')+'<button class="primary" '+(test.submitted?'data-retest':'data-submit')+'>'+(test.submitted?'Retake test':'Submit answers')+'</button> <span id="nat-test-message" role="status"></span></section>';
  }
  function dashboard(){
    const t=totals(),acc=names.slice(0,5).map(()=>[0,0]);
    const errors=[];
    Object.entries(store().days).forEach(([n,r])=>{
      const qs=questionSet(+n);Object.entries(r.answers).forEach(([k,a])=>{const q=qs[k];if(q){acc[q.skill][1]++;if(q.options[a]===q.answer)acc[q.skill][0]++}});
      if(Object.keys(r.misses).length)errors.push('<details><summary>Day '+(+n+1)+' · '+escape(days[n].title)+'</summary>'+mistakes(+n)+'</details>');
    });
    return '<section class="card nat-lesson"><span class="eyebrow">NAT-TEST 3Q</span><h2>Your course progress</h2><p>'+t.completed+' / 80 lessons complete · '+t.minutes+' of 9,600 planned minutes checked off</p><progress max="80" value="'+t.completed+'"></progress><h3>Current practice results</h3>'+acc.map(([a,b],k)=>'<div class="nat-stat"><b>'+names[k]+'</b><span>'+(b?a+' / '+b+' correct · '+Math.round(a/b*100)+'%':'No answers yet')+'</span></div>').join('')+'<h3>Practice test scores</h3>'+ (Object.entries(store().days).filter(([,r])=>r.test?.submitted).map(([n,r])=>{const qs=questionSet(+n),ids=testItems(+n);return '<p>'+link(+n,'Day '+(+n+1))+' · '+ids.filter(k=>qs[k].options[r.test.choices[k]]===qs[k].answer).length+' / '+ids.length+'</p>'}).join('')||'<p>No submitted tests yet.</p>')+'<h3>Revision notebook</h3><p>Select a missed question to retry it. Your notes and completed blocks are included in the site’s backup.</p>'+ (errors.join('')||'<p>Your corrections will appear here after your first missed question.</p>')+'</section>';
  }
  function draw(){
    const d=days[i];view.innerHTML=title('日本語NAT-TEST対策','NAT-TEST 3Q study calendar','November 20, 2026 – February 7, 2027 · 80 days · 2 hours a day')+'<div class="nat"><div class="nat-rail">'+calendar()+'<div class="card nat-nav"><button data-panel="lesson" aria-pressed="'+(panel==='lesson')+'">Daily lesson</button><button data-panel="test" aria-pressed="'+(panel==='test')+'">Practice test</button><button data-panel="dashboard" aria-pressed="'+(panel==='dashboard')+'">Course progress & revision</button></div></div><div id="nat-content">'+(panel==='dashboard'?dashboard():panel==='test'?testView():lesson())+'</div></div>';
    bind();const note=view.querySelector('#nat-note');if(note)note.oninput=()=>{entry(i).note=note.value;save()};
  }
  function bind(){
    view.querySelector('.nat').onchange=event=>{const b=event.target;if(b.matches('[data-test-choice]')){entry(i).test.choices[b.dataset.testChoice]=Number(b.value);save()}};
    view.querySelector('.nat').onclick=event=>{
      const dayLink=event.target.closest('a.nat-link');if(dayLink){event.preventDefault();route(Number(dayLink.hash.split('/')[1])-1);return}
      const b=event.target.closest('button');if(!b)return;const a=b.dataset;
      if('day'in a){route(+a.day);return}
      if('month'in a){month+=Number(a.month);draw();return}
      if('panel'in a){panel=a.panel;draw();return}
      if('block'in a){block=+a.block;window.speechSynthesis?.cancel();draw();view.querySelector('.nat-blocks').scrollIntoView({block:'start'});return}
      if('play'in a){play(+a.play,b);return}
      if('fix'in a){const [n,k]=a.fix.split(',').map(Number);const q=questionSet(n)[k];delete entry(n).answers[k];route(n,q.skill);document.getElementById('nat-q-'+k)?.scrollIntoView();return}
      const rec=entry(i),qs=questionSet(i);
      if('retest'in a){rec.test={choices:{},submitted:false};save();draw();return}
      if('submit'in a){
        const ids=testItems(i),missing=ids.find(k=>!Number.isInteger(rec.test.choices[k]));
        if(missing!==undefined){view.querySelector('#nat-test-message').textContent='Choose an answer for every question.';view.querySelector('[data-test-choice="'+missing+'"]').focus();return}
        rec.test.submitted=true;
        ids.forEach(k=>{const v=rec.test.choices[k];rec.answers[k]=v;if(qs[k].options[v]!==qs[k].answer)rec.misses[k]=true});
        save();draw();view.querySelector('#nat-content').scrollIntoView();return;
      }
      if('done'in a){rec.done=rec.done.includes(block)?rec.done.filter(k=>k!==block):[...rec.done,block];save();draw();return}
      const k=Number(a.question??a.retry);if(!qs[k])return;
      if('retry'in a)delete rec.answers[k];
      else{rec.answers[k]=+a.option;if(qs[k].options[+a.option]!==qs[k].answer)rec.misses[k]=true}
      save();const el=document.getElementById('nat-q-'+k);el.outerHTML=quiz(qs[k],k);const target=document.getElementById('nat-q-'+k);target.tabIndex=-1;target.focus({preventScroll:true});
    };
  }
  function merge(a,b){
    const out=blank();
    for(const s of [a,b])if(s&&typeof s==='object'){
      if(Number.isInteger(s.last)&&days[s.last])out.last=s.last;
      for(const [n,r] of Object.entries(s.days||{})){
        if(!/^([0-9]|[1-7][0-9])$/.test(n)||!r||typeof r!=='object')continue;
        const e=out.days[n] ||= {done:[],answers:{},misses:{},note:''};
        e.done=[...new Set([...e.done,...(Array.isArray(r.done)?r.done:[]).filter(k=>Number.isInteger(k)&&k>=0&&k<6)])];
        const qs=questionSet(+n);for(const [k,q] of qs.entries()){
          if(Number.isInteger(r.answers?.[k])&&q.options[r.answers[k]]!==undefined)e.answers[k]=r.answers[k];
          if(r.misses?.[k]===true)e.misses[k]=true;
        }
        if(r.test?.choices){const choices={};const ids=testItems(+n);for(const k of ids){const v=r.test.choices[k];if(Number.isInteger(v)&&qs[k].options[v]!==undefined)choices[k]=v}e.test={choices,submitted:r.test.submitted===true&&ids.every(k=>k in choices)}}
        if(typeof r.note==='string'&&r.note)e.note=r.note.slice(0,3000);
      }
    }return out;
  }
  return {draw,route,fromHash,addSummary,merge,questionSet,open:()=>route(store().last)};
})();
