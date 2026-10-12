/* Lecture 19–20 atlas. Diagram parameters are illustrative, not observed data. */
(() => {
  'use strict';
  const R=window.MIT1402Refined.renderers,NS='http://www.w3.org/2000/svg';
  const C={ink:'#19334b',muted:'#718094',blue:'#117b91',red:'#bf493f',green:'#328365',gold:'#ad791c'};
  const el=(s,t,a={},v='')=>{const n=document.createElementNS(NS,t);Object.entries(a).forEach(([k,x])=>n.setAttribute(k,x));n.textContent=v;s.appendChild(n);return n;};
  const text=(s,x,y,v,c=C.ink,size=16,anchor='start')=>el(s,'text',{x,y,fill:c,'font-size':size,'text-anchor':anchor},v);
  const line=(s,x1,y1,x2,y2,c=C.ink,dash=false,w=2)=>el(s,'line',{x1,y1,x2,y2,stroke:c,'stroke-width':w,...(dash?{'stroke-dasharray':'6 5','data-layer':'guides'}:{})});
  function init(s,title,h=560){s.replaceChildren();s.setAttribute('viewBox',`0 0 960 ${h}`);s.setAttribute('role','img');s.setAttribute('aria-label',title);s.dataset.calibrated='true';el(s,'title',{},title);text(s,38,36,title,C.ink,23);}
  function chart(s,xlabel,ylabel,o={}){
    const l=90,r=610,t=o.top||100,b=o.bottom||430,xmin=o.xmin??0,xmax=o.xmax??10,ymin=o.ymin??0,ymax=o.ymax??10;
    const X=x=>l+(x-xmin)/(xmax-xmin)*(r-l),Y=y=>b-(y-ymin)/(ymax-ymin)*(b-t);
    for(let j=1;j<5;j++)line(s,l,Y(ymin+(ymax-ymin)*j/5),r,Y(ymin+(ymax-ymin)*j/5),'#e6edef',false,1);
    line(s,l,t-7,l,b);line(s,l,b,r+8,b);text(s,l,t-23,ylabel,C.muted,15);text(s,(l+r)/2,b+(o.xlabelGap||57),xlabel,C.ink,16,'middle');text(s,l-10,b+20,String(ymin),C.muted,12,'end');
    let ly=t+10;
    function curve(fn,c,label,dash=false){let d='',on=false;for(let j=0;j<=300;j++){const x=xmin+(xmax-xmin)*j/300,y=fn(x);if(Number.isFinite(y)&&y>=ymin&&y<=ymax){d+=`${on?'L':'M'}${X(x)} ${Y(y)} `;on=true;}else on=false;}el(s,'path',{d,fill:'none',stroke:c,'stroke-width':3.2,...(dash?{'stroke-dasharray':'7 5'}:{})});if(label){line(s,650,ly-5,674,ly-5,c,false,3);text(s,685,ly,label,c,15);ly+=34;}}
    function point(x,y,label,c=C.ink,dy=-12){el(s,'circle',{cx:X(x),cy:Y(y),r:6,fill:c,stroke:'white','stroke-width':2,'data-x':x,'data-y':y});text(s,X(x)+10,Y(y)+dy,label,c,15);}
    function proj(x,y,label,offset=0){line(s,X(x),Y(y),X(x),b,C.muted,true,1.3);line(s,l,Y(y),X(x),Y(y),C.muted,true,1.3);if(label)text(s,X(x),b+24+offset,label,C.ink,14,'middle');}
    const note=(v,y=300,c=C.muted)=>text(s,650,y,v,c,15);
    return {curve,point,proj,note};
  }
  function flow(s,title,rows){init(s,title,150+rows.length*115);rows.forEach((r,i)=>{const y=70+i*115,c=[C.blue,C.green,C.gold,C.red][i%4];el(s,'rect',{x:45,y,width:870,height:87,rx:12,fill:'#f3f7f8',stroke:'#d4e1e5'});text(s,70,y+30,r[0],c,19);text(s,70,y+62,r[1],C.ink,16);if(i<rows.length-1){line(s,480,y+87,480,y+106,c);el(s,'path',{d:`M474 ${y+101}L480 ${y+111}L486 ${y+101}Z`,fill:c});}});}
  R['uip-path19']=s=>flow(s,'统一成同一种货币，再比较债券回报',[['本国债券：1 单位本币 → 1+i 单位本币','本金与到期收入均以本币计量'],['外国债券：先按 E 换成外币，再获得利息','1 本币 → E 外币 → E(1+i*) 外币'],['到期按预期未来汇率换回本币','预期本币收入 = E(1+i*)/Eᵉ'],['UIP：课程忽略风险补偿，令预期收益相等','1+i = E(1+i*)/Eᵉ；未来汇率仍有风险']]);
  R['open-demand19']=s=>{init(s,'DD、AA、ZZ：由国内支出走到本国产品需求');const p=chart(s,'产出 Y','需求（本国产品单位）');p.curve(x=>2+.8*x,C.blue,'DD：2+0.8Y');p.curve(x=>2+.5*x,C.gold,'AA：DD−0.3Y');p.curve(x=>3+.5*x,C.green,'ZZ：AA+出口 1');p.curve(x=>x,C.muted,'45°：Z=Y',true);p.point(6,6,'均衡',C.green);p.proj(6,6,'Y=6');p.note('进口随 Y 上升，AA 更平缓',290);p.note('出口不由本国 Y 决定',325);p.note('本国产出由 ZZ 决定',360);text(s,40,540,'教学示意：利率、汇率、外国收入固定。',C.muted,13);};
  function goods(s,key){const domestic=key==='domestic-shock19',foreign=key==='foreign-shock19',shift=domestic||foreign;init(s,domestic?'国内需求扩张：产出提高，贸易余额恶化':foreign?'外国需求扩张：产出与贸易余额同时提高':'商品市场均衡不要求贸易平衡',790);const p=chart(s,'产出 Y','本国产品需求 Z',{top:100,bottom:285}),q=chart(s,'产出 Y','净出口 NX',{top:460,bottom:645,ymin:-2,ymax:2});p.curve(x=>x,C.muted,'45°：Z=Y',true);p.curve(x=>3+.5*x,C.blue,'原 ZZ：3+0.5Y');q.curve(x=>1-.3*x,C.blue,'原 NX：1−0.3Y');q.curve(x=>0,C.muted,'贸易平衡 NX=0',true);p.point(6,6,'A',C.blue,20);q.point(6,-.8,'A',C.blue);p.proj(6,6,'Y₀=6');q.proj(6,-.8,'Y₀=6');if(shift){p.curve(x=>4+.5*x,C.green,'新 ZZ：4+0.5Y',true);p.point(8,8,'B',C.green);p.proj(8,8,'Y₁=8');if(foreign)q.curve(x=>2-.3*x,C.green,'新 NX：2−0.3Y',true);const nx=foreign?-.4:-1.4;q.point(8,nx,'B',C.green);q.proj(8,nx,'Y₁=8');p.note('自主需求增加 1，ΔY=2',245);q.note(foreign?'出口 +1，诱发进口 +0.6':'出口不变，进口增加 0.6',590);q.note(foreign?'ΔNX=+0.4':'ΔNX=−0.6',620);}else{q.point(1/.3,0,'贸易平衡点',C.gold);q.proj(1/.3,0,'Yᵀᴮ');p.note('均衡要求 Y=Z',235);q.note('Y=6 时，NX=−0.8',590);q.note('商品市场均衡与逆差可并存',620);}text(s,40,760,'教学示意：模型参数为 Z=3+0.5Y、NX=1−0.3Y；保持利率与汇率不变。',C.muted,13);}
  ['trade-equilibrium19','domestic-shock19','foreign-shock19'].forEach(k=>R[k]=s=>goods(s,k));
  R['policy-mix19']=s=>flow(s,'贬值与财政整顿：改变需求构成',[['在 Marshall–Lerner 条件下，实际贬值','给定 Y 时 NX 增加，ZZ 上移，产出趋于提高'],['同时降低政府购买 G','降低国内需求，使 ZZ 回到原来位置'],['最终产出可以保持原水平','需求构成改变：较少国内支出、较多净出口；ΔG=−ΔNX']]);
  const baseForeign=.02,baseEe=1,baseI=4,beta=.6,bi=.2,eta=20;
  const fx=(i,foreign=baseForeign,ee=baseEe)=>(1+i/100)*ee/(1+foreign);
  const baseA=(1-beta)*6+bi*baseI+eta*(fx(baseI)-1);
  const output=(i,a=baseA,foreign=baseForeign,ee=baseEe)=>(a-bi*i-eta*(fx(i,foreign,ee)-1))/(1-beta);
  const is=(y,a,foreign,ee)=>(a-eta*(ee/(1+foreign)-1)-(1-beta)*y)/(bi+eta*ee/(100*(1+foreign)));
  const uip=(e,foreign,ee)=>100*((1+foreign)*e/ee-1);
  R['uip20']=s=>{init(s,'UIP：本国利率与当期汇率同向变化');const p=chart(s,'名义汇率 E（外币 / 本币）','本国名义利率 i（%）',{xmin:.95,xmax:1.1,ymax:10});p.curve(e=>uip(e,.02,1),C.green,'i*=2%，Eᵉ=1');p.point(fx(4),4,'A',C.blue);p.point(fx(8),8,'B',C.red);p.proj(fx(4),4,'E₀');p.proj(fx(8),8,'E₁');p.note('提高 i：沿同一条 UIP 上移',280);p.note('E↑ 表示本币当期升值',315);p.note('给定 Eᵉ，之后预期贬值',350);text(s,40,540,'教学示意：使用 E=(1+i)/(1+i*)×Eᵉ 精确计算，各利率在计算时换成小数。',C.muted,13);};
  function mf(s,key){
    const monetary=key==='mf-monetary20',fiscal=key==='mf-fiscal20',expected=key==='mf-expectation20',foreign=key==='mf-foreign20',changed=monetary||fiscal||expected||foreign;
    const titles={'mf-baseline20':'Mundell–Fleming：同一利率连接产出与汇率','mf-monetary20':'加息：投资与净出口两个渠道压低产出','mf-fiscal20':'央行维持利率：财政扩张提高产出','mf-expectation20':'未来本币更强的预期：当期升值、产出下降','mf-foreign20':'外国加息：本币当期贬值、净出口需求增加'};
    init(s,titles[key],790);
    const p=chart(s,'产出 Y','本国名义利率 i（%）',{top:100,bottom:285,ymax:10}),q=chart(s,'名义汇率 E（外币 / 本币）','同一本国利率 i（%）',{top:460,bottom:645,xmin:.95,xmax:1.1,ymax:10,xlabelGap:75});
    p.curve(y=>is(y,baseA,.02,1),C.blue,'原开放经济 IS');p.curve(y=>4,C.red,'原 LM：i=4%');q.curve(e=>uip(e,.02,1),C.green,'原 UIP：i*=2%，Eᵉ=1');
    const e0=fx(4);p.point(6,4,'A',C.ink,20);p.proj(6,4,'Y₀=6');q.point(e0,4,'A',C.ink,20);q.proj(e0,4,'E₀');
    if(changed){
      const a=baseA+(fiscal?.8:0),i=monetary?5:4,star=foreign?.04:.02,ee=expected?1.02:1,y=output(i,a,star,ee),e=fx(i,star,ee);
      if(monetary)p.curve(y=>i,C.gold,'新 LM：i=5%',true);else p.curve(y=>is(y,a,star,ee),C.gold,'新开放经济 IS',true);
      if(expected||foreign)q.curve(e=>uip(e,star,ee),C.gold,expected?'新 UIP：Eᵉ=1.02':'新 UIP：i*=4%',true);
      p.point(y,i,'B',C.gold);q.point(e,i,'B',C.gold);p.proj(y,i,`Y₁=${y.toFixed(2)}`);
      if(!fiscal)q.proj(e,i,`E₁=${e.toFixed(3)}`,monetary?18:0);
      p.note(monetary?'沿 IS 移动；IS 不因 i 改变而移动':fiscal?'G↑ → IS 右移；LM 不动':expected?'给定 i，升值使 IS 左移':'给定 i，贬值使 IS 右移',235);
      q.note(monetary?'沿 UIP 移动，本币升值':fiscal?'i、i*、Eᵉ 不变 → E 不变':expected?'UIP 右移，当期 E 上升':'UIP 左移，当期 E 下降',590);
    }else{p.note('先由 IS–LM 求 i 与 Y',235);q.note('再由同一 i 在 UIP 上求 E',590);}
    text(s,40,760,'教学示意：浮动汇率、固定价格、无风险溢价；财政实验中央行维持 i 不变。',C.muted,13);
  }
  ['mf-baseline20','mf-monetary20','mf-fiscal20','mf-expectation20','mf-foreign20'].forEach(k=>R[k]=s=>mf(s,k));
  R['channels20']=s=>flow(s,'开放经济加息的两个需求渠道',[['投资渠道：本国利率提高','i↑ → I↓ → 本国产出需求下降'],['汇率渠道：给定 i* 与 Eᵉ，本币当期升值','i↑ → E↑ → NX↓（给定 Y）→ 本国产出需求下降'],['总产出下降后还有进口反馈','Y↓ → 进口减少，抵消部分净出口下降；最终 NX 需另算']]);
})();
