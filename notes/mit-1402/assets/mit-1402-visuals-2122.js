/* Native SVG model diagrams for exchange-rate regimes and present values. */
(() => {
  'use strict';
  const R=window.MIT1402Refined.renderers,NS='http://www.w3.org/2000/svg';
  const C={ink:'#19334b',muted:'#718094',blue:'#117b91',red:'#bf493f',green:'#328365',gold:'#ad791c'};
  const el=(s,t,a={},v='')=>{const n=document.createElementNS(NS,t);Object.entries(a).forEach(([k,x])=>n.setAttribute(k,x));n.textContent=v;s.appendChild(n);return n;};
  const text=(s,x,y,v,c=C.ink,size=16,anchor='start')=>el(s,'text',{x,y,fill:c,'font-size':size,'text-anchor':anchor},v);
  const line=(s,x1,y1,x2,y2,c=C.ink,dash=false,w=2)=>el(s,'line',{x1,y1,x2,y2,stroke:c,'stroke-width':w,...(dash?{'stroke-dasharray':'6 5','data-layer':'guides'}:{})});
  function init(s,title,h=560){s.replaceChildren();s.setAttribute('viewBox',`0 0 960 ${h}`);s.setAttribute('aria-label',title);s.setAttribute('role','img');s.dataset.calibrated='true';el(s,'title',{},title);text(s,38,36,title,C.ink,23);}
  function chart(s,xlabel,ylabel,o={}){
    const l=90,r=610,t=100,b=430,xmin=o.xmin??0,xmax=o.xmax??10,ymin=o.ymin??0,ymax=o.ymax??10;
    const X=x=>l+(x-xmin)/(xmax-xmin)*(r-l),Y=y=>b-(y-ymin)/(ymax-ymin)*(b-t);
    for(let j=1;j<5;j++)line(s,l,Y(ymin+(ymax-ymin)*j/5),r,Y(ymin+(ymax-ymin)*j/5),'#e6edef',false,1);
    line(s,l,t-7,l,b);line(s,l,b,r+8,b);text(s,l,t-23,ylabel,C.muted,15);text(s,(l+r)/2,b+65,xlabel,C.ink,16,'middle');text(s,l-10,b+20,String(ymin),C.muted,12,'end');
    if(o.xmin!==undefined)for(let j=0;j<=4;j++){const v=xmin+(xmax-xmin)*j/4;line(s,X(v),b,X(v),b+5,C.muted,false,1);text(s,X(v),b+44,xmin<1?v.toFixed(3):String(v),C.muted,12,'middle');}
    let ly=t+10;
    function curve(fn,c,label,dash=false){let d='',on=false;for(let j=0;j<=320;j++){const x=xmin+(xmax-xmin)*j/320,y=fn(x);if(Number.isFinite(y)&&y>=ymin&&y<=ymax){d+=`${on?'L':'M'}${X(x)} ${Y(y)} `;on=true;}else on=false;}el(s,'path',{d,fill:'none',stroke:c,'stroke-width':3.2,...(dash?{'stroke-dasharray':'7 5'}:{})});if(label){line(s,650,ly-5,674,ly-5,c,false,3);text(s,685,ly,label,c,15);ly+=34;}}
    function point(x,y,label,c=C.ink,dx=10,dy=-12){el(s,'circle',{cx:X(x),cy:Y(y),r:6,fill:c,stroke:'white','stroke-width':2,'data-x':x,'data-y':y});text(s,X(x)+dx,Y(y)+dy,label,c,15);}
    function proj(x,y,label,offset=0){line(s,X(x),Y(y),X(x),b,C.muted,true,1.3);line(s,l,Y(y),X(x),Y(y),C.muted,true,1.3);if(label)text(s,X(x),b+24+offset,label,C.ink,14,'middle');}
    return {curve,point,proj,X,Y,note:(v,y=300,c=C.muted)=>text(s,650,y,v,c,15)};
  }
  function flow(s,title,rows){init(s,title,150+rows.length*115);rows.forEach((r,i)=>{const y=70+i*115,c=[C.blue,C.green,C.gold,C.red][i%4];el(s,'rect',{x:45,y,width:870,height:87,rx:12,fill:'#f3f7f8',stroke:'#d4e1e5'});text(s,70,y+30,r[0],c,19);text(s,70,y+62,r[1],C.ink,16);if(i<rows.length-1){line(s,480,y+87,480,y+106,c);el(s,'path',{d:`M474 ${y+101}L480 ${y+111}L486 ${y+101}Z`,fill:c});}});}
  R['peg-logic21']=s=>flow(s,'可信固定汇率：利率为何必须跟随锚国',[['固定当前汇率，市场也相信未来不会调整','E=Eᵉ=Ē'],['代入未抛补利率平价','1+i = E(1+i*)/Eᵉ = 1+i*'],['自由资本流动、无风险溢价时：i=i*','本国不能再随自身周期任意设定政策利率'],['约束的前提不能省略','不可信的盯住、风险溢价、资本管制都可能使利差存在']]);
  R['trilemma21']=s=>flow(s,'三项政策目标的取舍',[['固定汇率 + 自由资本流动','放弃独立货币政策：可信盯住下 i 跟随 i*'],['独立货币政策 + 自由资本流动','允许汇率浮动：E 随金融条件调整'],['固定汇率 + 独立货币政策','需要限制资本流动，削弱跨境资产替代机制']]);
  function fixed(s,fiscal){init(s,fiscal?'可信盯住下的财政扩张：利率与汇率保持不变':'锚国加息：盯住汇率的本国被动收紧');const p=chart(s,'本国产出 Y','本国名义利率 i（%）');p.curve(y=>8-.8*y,C.blue,'IS：给定固定 E');p.curve(y=>2,C.red,'初始 i=i*=2%');p.point(7.5,2,'A',C.blue,10,20);p.proj(7.5,2,'Y₀=7.5');if(fiscal){p.curve(y=>9.6-.8*y,C.green,'G↑ 后的 IS',true);p.point(9.5,2,'B',C.green);p.proj(9.5,2,'Y₁=9.5');p.note('IS 右移，i 与 E 不变',290);p.note('进口泄漏使乘数较小',325);}else{p.curve(y=>4,C.gold,'锚国加息：i=i*=4%',true);p.point(5,4,'B',C.gold);p.proj(5,4,'Y₁=5');p.note('E=Eᵉ=Ē，可信盯住',290);p.note('本国 i 必须随 i* 上升',325);p.note('投资下降，产出收缩',360);}text(s,40,540,'教学示意：本图 IS 以固定 E 为条件；不同于把浮动汇率 UIP 代入后的 IS。',C.muted,13);}
  R['peg-foreign21']=s=>fixed(s,false);R['peg-fiscal21']=s=>fixed(s,true);
  R['peg-defense21']=s=>{init(s,'预期贬值：维持同一汇率需要更高利率');const p=chart(s,'当前汇率 E（外币 / 本币）','本国利率 i（%）',{xmin:.85,xmax:1.1,ymax:15});p.curve(e=>100*(1.02*e-1),C.blue,'原 UIP：Eᵉ=1');p.curve(e=>100*(1.02*e/.92-1),C.gold,'新 UIP：Eᵉ=0.92',true);line(s,p.X(1),p.Y(0),p.X(1),p.Y(14),C.red,false,3);p.point(1,2,'A',C.blue,10,20);p.point(1,100*(1.02/.92-1),'B',C.gold);p.proj(1,2,'盯住 E=1');p.note('外国 i*=2% 不变',280);p.note('新所需 i≈10.87%',315);p.note('防守成本：投资与产出下降',350);text(s,40,540,'教学示意：预期汇率下降 8%；利率按一年期计算，不是任何现实危机的观测值。',C.muted,13);};
  R['future-fx21']=s=>flow(s,'当前汇率反映未来政策路径',[['本期：Eₜ = [(1+iₜ)/(1+i*ₜ)] × Eᵉₜ₊₁','未来汇率预期影响当期价格'],['继续向前展开：预期未来相对利率与更远汇率','不只是下一次会议；多个时期的政策路径都会影响今天'],['浮动的好处与成本同时出现','可以独立调整利率，但预期变化也会带来汇率波动']]);
  R['real-adjust21']=s=>flow(s,'固定名义汇率仍可能发生实际汇率调整',[['实际汇率 ε = EP/P*','盯住 E 只固定了其中一项'],['如果本国价格相对下降','P/P*↓，即使 E 不变，ε 也下降，出现实际贬值'],['工资与价格能否调整，影响制度成本','价格较黏时，调整可能伴随更长的低迷和失业']]);
  R['policy-choice21']=s=>flow(s,'国内衰退：两种汇率制度下的政策选择',[['浮动汇率：央行可以独立降低 i','给定 i* 与 Eᵉ，E↓，投资与净出口需求得到支持'],['可信盯住：不能任意脱离锚国降息','E=Eᵉ=Ē，rp=0 与资本自由流动下，需要 i=i*'],['财政扩张在本课程两种制度下都可以有效','若财政实验中 i 与 E 都不变，G↑ 推动产出提高'],['制度差别在于货币政策约束','浮动允许独立调息；盯住使本国利率受到锚国和可信度制约']]);
  R['risk-premium21']=s=>{
    init(s,'风险溢价上升：通过汇率还是利率调整？');
    const p=chart(s,'当前汇率 E（外币 / 本币）','本国利率 i（%）',{xmin:.85,xmax:1.1,ymax:15});
    p.curve(e=>100*(1.02*e-1),C.blue,'原 UIP：rp=0');
    p.curve(e=>100*(1.10*e-1),C.red,'新 UIP：rp=8 个百分点',true);
    line(s,p.X(.85),p.Y(2),p.X(1.1),p.Y(2),C.muted,true,1.3);
    line(s,p.X(1),p.Y(0),p.X(1),p.Y(12),C.muted,true,1.3);
    p.point(1,2,'A',C.blue,10,20);
    p.point(1.02/1.10,2,'B',C.red,-18,-12);
    p.point(1,10,'C',C.green,10,-12);
    p.note('i*=2%、Eᵉ=1 不变',265);
    p.note('A：初始 i=2%、E=1',300);
    p.note('B：浮动且 i 保持 2%',335);
    p.note('E≈0.9273，本币贬值',362);
    p.note('C：维持 E=1，需 i=10%',397);
    text(s,40,540,'教学示意：按课件 E=(1+i)Eᵉ/(1+i*+rp) 计算，数字不代表俄罗斯历史观测。',C.muted,13);
  };
  R['cashflow22']=s=>flow(s,'把不同日期的现金流放到同一时点',[['今天收到 Zₜ：无需折现','今天的 1 元，就是今天的 1 元'],['下一期收到 Zₜ₊₁：除以 1+iₜ','用今天的钱投资一期，可复制该未来收入'],['两期后收到 Zₜ₊₂：除以两个增长因子','现值 = Zₜ₊₂ / [(1+iₜ)(1+iₜ₊₁)]'],['把各期现值加总','未来现金流与未来利率不确定时，先写明预期信息集']]);
  R['discount22']=s=>{init(s,'时间越远、贴现率越高，同一现金流的现值越小');const p=chart(s,'距今期数 j','未来 1 元的当前价值',{ymax:1.1});p.curve(t=>1/1.05**t,C.blue,'利率 5%');p.curve(t=>1/1.10**t,C.red,'利率 10%');p.point(5,1/1.05**5,'A',C.blue);p.point(5,1/1.10**5,'B',C.red);p.proj(5,1/1.10**5,'5 期后');p.note('5%：现值约 0.784',280);p.note('10%：现值约 0.621',315);p.note('同一未来收入，估值不同',350);text(s,40,540,'教学示意：每期利率固定，现金流确定。',C.muted,13);};
  R['annuity22']=s=>flow(s,'先确认第一笔和最后一笔付款日期',[['下一期起、共 n 笔付款','t+1,…,t+n：普通年金，现值 Z[1−(1+i)⁻ⁿ]/i'],['今天起、到 t+n 为止','t,…,t+n：共 n+1 笔，现值 Z∑ⱼ₌₀ⁿ(1+i)⁻ʲ'],['下一期起、永久付款','i>0 时，永续年金现值 Z/i'],['今天起、永久付款','比上一种多今天这一笔：Z+Z/i = Z(1+i)/i']]);
  R['bond-price22']=s=>{init(s,'债券价格与收益率反向，远期现金流更敏感');const p=chart(s,'到期收益率（%）','零息债价格（面值 100）',{ymax:110});p.curve(i=>100/(1+i/100),C.blue,'一年期零息债');p.curve(i=>100/(1+i/100)**10,C.red,'十年期零息债');p.point(5,100/1.05,'约 95.24',C.blue);p.point(5,100/1.05**10,'约 61.39',C.red);p.proj(5,100/1.05**10,'收益率 5%');p.note('P=100/(1+y)ⁿ',280);p.note('比较同一收益率变动',315);p.note('期限越长，价格变化越明显',350);text(s,40,540,'教学示意：确定到期偿付的零息债；不含违约风险与中间票息。',C.muted,13);};
  R['rollover22']=s=>flow(s,'用相同持有期比较一年债与两年债',[['策略 A：买一年期债，持有到期','投入 1 元，下一年收到 1+i₁ₜ'],['策略 B：买两年期债，一年后出售','投入 1 元买到 1/P₂ₜ 单位；预期收入 Pᵉ₁,ₜ₊₁/P₂ₜ'],['忽略风险补偿，令两者预期回报相同','P₂ₜ = Pᵉ₁,ₜ₊₁/(1+i₁ₜ)'],['代入一年后剩余一年债的价格','课程近似：P₂ₜ ≈ F/[(1+i₁ₜ)(1+iᵉ₁,ₜ₊₁)]']]);
  R['yieldcurve22']=s=>{init(s,'收益率曲线：长期利率汇总预期短期利率');const rates=[.05,.04,.03,.02,.02],ys=rates.map((_,j)=>100*(rates.slice(0,j+1).reduce((a,r)=>a*(1+r),1)**(1/(j+1))-1));const f=n=>{const k=Math.min(3,Math.floor(n)-1),v=n-(k+1);return ys[k]+v*(ys[k+1]-ys[k]);};const p=chart(s,'到期期限 n（年）','n 年期零息债收益率（%）',{xmin:1,xmax:5,ymax:6});p.curve(f,C.blue,'由预期短率路径计算');ys.forEach((v,j)=>p.point(j+1,v,`${v.toFixed(2)}%`,C.blue,j===4?-56:8,-12));p.note('预期一年短率：5%、4%、',280);p.note('3%、2%、2%',305);p.note('无期限溢价的教学例子',350);text(s,40,540,'教学示意：以各期总收益因子的几何平均计算，不代表任何日期的市场曲线。',C.muted,13);};
  R['pricing-levers22']=s=>flow(s,'估值为何会在现金流实现之前改变',[['预期现金流改变','其他条件相同，未来收入预期更高，今天的现值更高'],['预期贴现利率路径改变','其他条件相同，未来利率更高，今天的现值更低'],['现金流分布的时间改变','收入越晚实现，对贴现率变化越敏感'],['现实中的风险补偿也会改变','无风险利率不能直接定价全部风险资产，下一讲进一步加入风险']]);
})();
