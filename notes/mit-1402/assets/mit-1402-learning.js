(() => {
  'use strict';
  const data=window.MIT1402LearningData,models=window.MIT1402LearningModels;
  if(!data||!models)return;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const make=(tag,cls,html)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(html!==undefined)el.innerHTML=html;return el;};
  const fmt=(v,d=2)=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d});
  const key=n=>`mit1402-learning-v1-lecture-${n}`;
  const read=n=>{try{return JSON.parse(localStorage.getItem(key(n))||'{}')||{};}catch{return {};}};
  const write=(n,value)=>{try{localStorage.setItem(key(n),JSON.stringify(value));return true;}catch{return false;}};
  const ids=Object.keys(data).map(Number).sort((a,b)=>a-b);
  const url=(n,kind='notes')=>`mit14-02-lec${n}-${kind}/mit14-02-lec${n}-${kind}.html#interactive-lab`;
  function chart(host,result){
    const w=Math.max(250,Math.round(host.clientWidth||650)),h=310,l=w<400?44:54,r=16,top=28,bottom=252;
    let spec=result.plot;
    if(result.bars){
      const values=result.bars.map(b=>b[1]),min=Math.min(0,...values)-.5,max=Math.max(1,...values)+.5;
      spec={xmin:0,xmax:4,ymin:min,ymax:max,x:'增长贡献分解',y:'贡献（百分点）',series:[]};
    }
    const xmin=spec.xmin??0,xmax=spec.xmax,ymin=spec.ymin??0,ymax=spec.ymax,X=x=>l+(x-xmin)/(xmax-xmin)*(w-l-r),Y=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
    const text=(x,y,t,anchor='start',color='#596c68')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="11" font-family="Microsoft YaHei, sans-serif">${esc(t)}</text>`;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(spec.y+' 随 '+spec.x+' 的变化')}"><title>${esc(spec.y+' 随 '+spec.x+' 的变化')}</title>`;
    const ticks=w<400?3:4;
    for(let j=0;j<=ticks;j++){
      const y=ymin+(ymax-ymin)*j/ticks;
      svg+=`<line x1="${l}" x2="${w-r}" y1="${Y(y)}" y2="${Y(y)}" stroke="#d6dfd4"/>`+text(l-7,Y(y)+4,fmt(y,1),'end');
      if(!result.bars){const x=xmin+(xmax-xmin)*j/ticks;svg+=text(X(x),bottom+20,fmt(x,1),'middle');}
    }
    svg+=text(l,15,spec.y)+text(l,bottom+50,spec.x);
    svg+=`<path d="M${l} ${top}V${bottom}H${w-r}" fill="none" stroke="#91a295"/>`;
    if(ymin<0&&ymax>0)svg+=`<line x1="${l}" x2="${w-r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#91a295" stroke-dasharray="4 4"/>`;
    if(result.bars){
      result.bars.forEach(([label,v],j)=>{const bw=(w-l-r)/6,x=X(j+1),y=Y(v),zero=Y(0),color=['#236e61','#366ba4','#b34b29'][j];svg+=`<rect x="${x-bw/2}" y="${Math.min(y,zero)}" width="${bw}" height="${Math.max(1,Math.abs(zero-y))}" fill="${color}"/>`+text(x,v>=0?y-8:y+16,fmt(v),'middle',color)+text(x,bottom+22,label,'middle');});
    }else{
      for(const series of spec.series){
        let d='',active=false;
        for(const [x,y] of series.points){
          if(Number.isFinite(x)&&Number.isFinite(y)&&x>=xmin&&x<=xmax&&y>=ymin&&y<=ymax){d+=`${active?'L':'M'}${X(x).toFixed(2)} ${Y(y).toFixed(2)} `;active=true;}else active=false;
        }
        svg+=`<path d="${d}" fill="none" stroke="${series.color}" stroke-width="2.6"${series.dash?' stroke-dasharray="6 5"':''}/>`;
      }
      for(const [x,y] of spec.points||[]){if(x>=xmin&&x<=xmax&&y>=ymin&&y<=ymax)svg+=`<circle cx="${X(x)}" cy="${Y(y)}" r="4.5" fill="#193c38" stroke="white" stroke-width="1.5"><title>${esc(fmt(x)+', '+fmt(y))}</title></circle>`;}
    }
    host.innerHTML=svg+'</svg>';
  }
  function mountModel(host,id,n){
    const m=models[id],values=Object.fromEntries(m.controls.map(c=>[c.key,c.value]));
    host.replaceChildren();
    host.append(make('h3','',m.title));
    const presets=make('div','learn-actions');
    const controls=make('div','learn-controls');
    for(const c of m.controls){
      const domid=`learn-${n}-${id}-${c.key}`,wrap=make('div','learn-control');
      wrap.innerHTML=`<label for="${domid}"><span>${esc(c.label)}</span><output for="${domid}"></output></label><input id="${domid}" data-param="${c.key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}">`;
      wrap.querySelector('input').addEventListener('input',e=>{values[c.key]=+e.target.value;render();});controls.append(wrap);
    }
    const metrics=make('div','learn-metrics'),plot=make('div','learn-plot'),legend=make('div','learn-legend'),insight=make('p','learn-insight');
    const reset=make('button','','重置本实验');reset.type='button';reset.onclick=()=>{Object.assign(values,Object.fromEntries(m.controls.map(c=>[c.key,c.value])));render(true);};
    for(const scenario of m.presets){const b=make('button','',esc(scenario.label));b.type='button';b.addEventListener('click',()=>{Object.assign(values,scenario.values);render(true);});presets.append(b);}
    presets.append(reset);
    host.append(presets,controls,metrics,plot,legend,insight,make('div','learn-equation',esc(m.equation)),make('p','learn-assumption','模型边界 · '+esc(m.assumption)));
    function render(sync=false){
      for(const c of m.controls){const el=controls.querySelector(`[data-param="${c.key}"]`);if(sync)el.value=values[c.key];el.previousElementSibling.querySelector('output').textContent=fmt(values[c.key])+(c.unit||'');}
      for(let j=0;j<m.presets.length;j++){const s=m.presets[j];presets.children[j].setAttribute('aria-pressed',String(Object.entries(s.values).every(([k,v])=>values[k]===v)));}
      const result=m.calculate(values);metrics.innerHTML=result.metrics.map(x=>{const match=String(x.value).match(/^([\d.,+−-]+)\s*([\u4e00-\u9fff].*)$/);return `<div><span>${esc(x.label)}</span><strong>${match?esc(match[1])+`<small>${esc(match[2])}</small>`:esc(x.value)}</strong></div>`;}).join('');
      chart(plot,result);legend.innerHTML=(result.plot?.series||[]).map(s=>`<span><i style="border-color:${s.color};border-top-style:${s.dash?'dashed':'solid'}"></i>${esc(s.name)}</span>`).join('');
      insight.textContent=result.insight;
    }
    render();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(host.isConnected&&plot.clientWidth>0)chart(plot,m.calculate(values));}):null;
    observer?.observe(plot);
    return ()=>observer?.disconnect();
  }
  function chapter(n,kind){
    const d=data[n];if(!d||document.getElementById('interactive-lab'))return;
    const state=read(n),block=make('section','learn learn-chapter');block.id='interactive-lab';block.setAttribute('aria-labelledby','learn-heading');
    block.innerHTML=`<p class="learn-eyebrow">LECTURE ${String(n).padStart(2,'0')} / ${kind==='review'?'主动回忆':'动手理解'}</p><h2 id="learn-heading">${esc(d.title)}</h2><p class="learn-lead">${esc(d.intro)}</p><div class="learn-route"><span>01 先判断</span><span>02 动手验证</span><span>03 说清原因</span></div>`;
    const predict=make('div','learn-predict',`<h3>先别看答案</h3><p>${esc(d.question)}</p>`),options=make('div','learn-options'),feedback=make('p','learn-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
    d.options.forEach((label,i)=>{const b=make('button','',esc(label));b.type='button';b.setAttribute('aria-pressed','false');b.onclick=()=>{for(const other of options.children)other.setAttribute('aria-pressed',String(other===b));feedback.hidden=false;feedback.textContent=(i===d.answer?'判断正确。':'再看一下因果链。')+d.why;};options.append(b);});
    predict.append(options,feedback);block.append(predict);
    const experiment=make(kind==='review'?'details':'div','learn-experiments');
    if(kind==='review')experiment.append(make('summary','','用实验验证这道题'));
    experiment.append(make('p','learn-task','<strong>试一试 · </strong>'+esc(d.task)));
    const tabs=make('div','learn-tabs'),lab=make('div','learn-lab');lab.id=`learn-model-${n}`;
    let cleanup;
    const select=id=>{cleanup?.();for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.model===id));cleanup=mountModel(lab,id,n);};
    d.models.forEach((id,i)=>{const b=make('button','',esc(models[id].title.split('：')[0]));b.type='button';b.dataset.model=id;b.setAttribute('aria-controls',lab.id);b.setAttribute('aria-pressed',String(i===0));b.onclick=()=>select(id);tabs.append(b);});
    if(d.models.length>1)experiment.append(tabs);
    experiment.append(lab);block.append(experiment);select(d.models[0]);
    const recap=make('details','learn-recap',`<summary>三分钟复盘：把图形说回语言</summary><p>${esc(d.recap)}</p><p><strong>换个情景：</strong>${esc(d.transfer)}</p>`);if(kind==='notes')recap.open=true;block.append(recap);
    const notes=make('details','learn-notes',`<summary>写下我的解释与下次要检查的问题</summary><label class="learn-note-label" for="learn-note-${n}">试着写：我改变了什么 → 哪个变量响应 → 结论依赖什么条件</label><textarea id="learn-note-${n}" placeholder="不用抄公式，先用自己的话讲清楚因果关系。"></textarea><p class="learn-save-state" role="status"></p>`);
    const area=notes.querySelector('textarea'),saveState=notes.querySelector('.learn-save-state');area.value=typeof state.note==='string'?state.note:'';saveState.textContent='记录只保存在当前浏览器；更换设备或清理浏览器前请导出。';
    area.addEventListener('input',()=>{state.note=area.value;state.updated=new Date().toISOString();const ok=write(n,state);saveState.textContent=ok?'已保存在当前浏览器。':'浏览器暂不允许保存，请使用“导出我的记录”保留文字。';});
    const noteActions=make('div','learn-actions'),exportButton=make('button','','导出我的记录');exportButton.type='button';exportButton.onclick=()=>{
      const text=`MIT 14.02 · Lecture ${n}\n${d.title}\n\n复习问题：${d.question}\n\n我的解释：\n${area.value}\n\n迁移问题：${d.transfer}\n`;
      const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`MIT1402-L${n}-我的复习记录.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
    };noteActions.append(exportButton);notes.append(noteActions);block.append(notes);
    const bottom=make('div','learn-bottom'),done=make('button');done.type='button';const doneStatus=make('span','learn-status');doneStatus.setAttribute('role','status');
    const updateDone=()=>{done.textContent=state.done?'✓ 已完成本讲主动复习':'标记本讲已主动复习';done.setAttribute('aria-pressed',String(!!state.done));};
    done.onclick=()=>{state.done=!state.done;const ok=write(n,state);updateDone();doneStatus.textContent=ok?'进度已保存；可在课程首页查看。':'当前浏览器无法保存进度，本次页面仍可正常使用。';};updateDone();
    const reading=document.querySelector('.container > section:not(.learn)');
    if(reading&&!reading.id)reading.id='lecture-reading';
    const destination=reading?.id||d.anchor;
    bottom.append(done,make('a','',`<span>回到${kind==='review'?'速记正文':'完整推导'} ↓</span>`));bottom.lastChild.href='#'+destination;bottom.append(make('a','','课程目录 ↗'));bottom.lastChild.href='../index.html';block.append(bottom,doneStatus);
    const toc=document.querySelector('.container > .toc');
    if(toc)toc.after(block);else if(reading)reading.before(block);else document.querySelector('.hero')?.after(block);
    const jump=make('a','learn-jump',`进入本讲互动：${esc(d.title)} ↓`);jump.href='#interactive-lab';document.querySelector('.hero')?.append(jump);
    const list=toc?.querySelector('ol,ul');if(list){const item=make('li','',`<a href="#interactive-lab">互动实验与主动回忆</a>`);list.prepend(item);}
    window.addEventListener('pagehide',()=>cleanup?.(),{once:true});
  }
  function home(){
    const grid=document.querySelector('.grid');if(!grid)return;
    const section=make('section','learn learn-home');section.id='learning-hub';section.innerHTML=`<p class="learn-eyebrow">READ · EXPERIMENT · EXPLAIN</p><h2>把“看懂了”，变成“我能解释”。</h2><p>每讲从一个问题开始：先判断，再改变条件，最后用自己的话解释结果。完整讲义负责推导，互动实验帮助你检验直觉。</p><div class="learn-home-grid"><a href="${url(3)}"><b>短期：一笔支出的回声</b><small>从消费反馈理解乘数 → 第 3 讲</small></a><a href="${url(15)}"><b>长期：更高，还是更快？</b><small>储蓄与技术的对照实验 → 第 15 讲</small></a><a href="${url(20)}"><b>开放经济：降息之后</b><small>追踪利率、汇率和产出 → 第 20 讲</small></a></div><p class="learn-progress" role="status"></p><div class="learn-progress-line"><span></span></div><label for="learn-search">找一个想弄懂的问题</label><input class="learn-search" id="learn-search" type="search" placeholder="搜索：通胀、储蓄、汇率、15…"><div class="learn-filter-row"></div><p class="learn-status learn-result-count" role="status"></p>`;
    grid.before(section);
    const cards=[...grid.querySelectorAll('.card')].map(el=>{const a=el.querySelector('a.notes'),n=Number(a?.href.match(/lec(\d+)-/)?.[1]);if(!data[n])return null;const experiment=make('a','review','互动实验');experiment.href=url(n);el.querySelector('.links').append(experiment);const mark=make('span','learn-complete');el.append(mark);return {el,n,mark,text:el.textContent+' '+data[n].title+' '+data[n].recap};}).filter(Boolean);
    let group='all';const groups=[['all','全部'],['short','短期与通胀'],['growth','长期增长'],['open','开放经济'],['expectation','预期与复习']];
    const belong=(n,g)=>g==='all'||(g==='short'&&n<=12)||(g==='growth'&&n>=13&&n<=16)||(g==='open'&&[17,19,20,21].includes(n))||(g==='expectation'&&[18,22,23,24,25].includes(n));
    const search=section.querySelector('input');
    function filter(){const q=search.value.trim().toLowerCase();let visible=0;for(const c of cards){const show=belong(c.n,group)&&(!q||c.text.toLowerCase().includes(q)||String(c.n)===q);c.el.classList.toggle('learn-course-hidden',!show);if(show)visible++;}section.querySelector('.learn-result-count').textContent=visible?`显示 ${visible} / ${cards.length} 讲`:'没有匹配的章节；试试其他关键词或切回“全部”。';}
    for(const [id,label] of groups){const b=make('button','',label);b.type='button';b.setAttribute('aria-pressed',String(id===group));b.onclick=()=>{group=id;for(const other of b.parentElement.children)other.setAttribute('aria-pressed',String(other===b));filter();};section.querySelector('.learn-filter-row').append(b);}search.addEventListener('input',filter);
    function progress(){let count=0;for(const c of cards){const done=!!read(c.n).done;if(done)count++;c.mark.textContent=done?'✓ 已主动复习':'';}section.querySelector('.learn-progress').textContent=`主动复习 ${count} / ${cards.length} 讲 · 由你手动标记，笔记与速记页共享记录。`;section.querySelector('.learn-progress-line span').style.width=(100*count/cards.length)+'%';}
    window.addEventListener('pageshow',progress);window.addEventListener('storage',progress);progress();filter();
  }
  const match=location.pathname.match(/mit14-02-lec(\d+)-(notes|review)/);
  if(match)chapter(+match[1],match[2]);else home();
})();
