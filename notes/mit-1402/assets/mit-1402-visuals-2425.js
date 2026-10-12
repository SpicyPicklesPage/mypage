/* Coordinate-based diagrams for IS–LM with expectations and Quiz 3 review. */
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
    if(o.ticks)for(const x of o.ticks){line(s,X(x),b,X(x),b+5,C.muted,false,1);text(s,X(x),b+43,String(x),C.muted,12,'middle');}
    let ly=t+10;
    function curve(fn,c,label,dash=false){let d='',on=false;for(let j=0;j<=400;j++){const x=xmin+(xmax-xmin)*j/400,y=fn(x);if(Number.isFinite(y)&&y>=ymin&&y<=ymax){d+=`${on?'L':'M'}${X(x)} ${Y(y)} `;on=true;}else on=false;}el(s,'path',{d,fill:'none',stroke:c,'stroke-width':3.2,...(dash?{'stroke-dasharray':'7 5'}:{})});if(label){line(s,650,ly-5,674,ly-5,c,false,3);text(s,685,ly,label,c,15);ly+=34;}}
    function point(x,y,label,c=C.ink,dx=10,dy=-12){el(s,'circle',{cx:X(x),cy:Y(y),r:6,fill:c,stroke:'white','stroke-width':2,'data-x':x,'data-y':y});text(s,X(x)+dx,Y(y)+dy,label,c,15);}
    function proj(x,y,label,offset=0){line(s,X(x),Y(y),X(x),b,C.muted,true,1.3);line(s,l,Y(y),X(x),Y(y),C.muted,true,1.3);if(label)text(s,X(x),b+24+offset,label,C.ink,14,'middle');}
    return {curve,point,proj,X,Y,note:(v,y=300,c=C.muted)=>text(s,650,y,v,c,15)};
  }
  function flow(s,title,rows){init(s,title,150+rows.length*115);rows.forEach((r,i)=>{const y=70+i*115,c=[C.blue,C.green,C.gold,C.red][i%4];el(s,'rect',{x:45,y,width:870,height:87,rx:12,fill:'#f3f7f8',stroke:'#d4e1e5'});text(s,70,y+30,r[0],c,19);text(s,70,y+62,r[1],C.ink,16);if(i<rows.length-1){line(s,480,y+87,480,y+106,c);el(s,'path',{d:`M474 ${y+101}L480 ${y+111}L486 ${y+101}Z`,fill:c});}});}
  R['wealth24']=s=>flow(s,'消费面对的是一生资源与当前现金流',[['金融净财富 F：资产市值减去债务','未来资产现金流已经反映在资产市值中，不重复加一次'],['人力财富 H：当前及预期税后劳动收入现值','未来收入预期提高或贴现条件改善，都可能提高 H'],['总财富 W=F+H：支持跨期消费平滑','相同当期收入增量，持续越久，财富效应通常越大'],['现实仍要看当前可支配收入 Y−T','借贷约束使未来赚钱能力不能完全转换成今天的现金']]);
  R['income-duration24']=s=>{
    init(s,'相同当期收入增量：一次性与持续的消费反应');
    const p=chart(s,'剩余消费期数 N（年）','每年消费增量（教学单位）',{xmin:1,xmax:20,ymax:33,ticks:[1,5,10,15,20]});
    p.curve(n=>30/n,C.blue,'一次性多得 30');p.curve(n=>30,C.green,'每年都多得 30');
    p.point(10,3,'A',C.blue);p.point(10,30,'B',C.green);p.proj(10,3,'',0);
    p.note('N=10 时：',275);p.note('一次性：每年多消费 3',310);p.note('持续：每年多消费 30',345);
    text(s,40,540,'自编例子：r=0、无借贷约束、无不确定性、完全平滑消费；比较相同当期增量。',C.muted,13);
  };
  R['investment-value24']=s=>{
    init(s,'机器未来利润的现值：贴现率上升压低 V');
    const p=chart(s,'长期固定实际利率 r（%）','利润现值 V（机器价格为 1）',{ymax:1.6,ticks:[0,2,4,6,8,10]});
    p.curve(r=>.12/(r/100+.08),C.blue,'V=0.12/(r+0.08)');p.curve(r=>1,C.gold,'机器购买价格 1',true);
    p.point(4,1,'临界点',C.ink);p.proj(4,1,'');p.point(6,.12/.14,'V≈0.857',C.red,10,23);
    p.note('每期利润 Π=0.12',280);p.note('折旧率 δ=0.08',315);p.note('r=4% 时 V=1',350);p.note('图中 r 轴用百分数',385);
    text(s,40,540,'自编例子：按课件第一期不乘折旧的时点，固定利润与实际利率，等比级数收敛。',C.muted,13);
  };
  R['steep-is24']=s=>{
    init(s,'未来预期固定：仅当前降息的作用可能较小');
    const p=chart(s,'当前产出 Y','当前实际利率 r（%）');
    p.curve(y=>8-.8*y,C.muted,'较平 IS：示意比较',true);p.curve(y=>16-2.4*y,C.blue,'较陡 IS：未来固定');
    p.curve(y=>4,C.gold,'初始 r=4%',true);p.curve(y=>2,C.green,'降息后 r=2%',true);
    p.point(5,4,'A',C.ink,-20,-12);p.point(14/2.4,2,'B',C.blue,10,-12);p.point(7.5,2,'D',C.muted,10,-12);
    p.proj(5,4,'5');p.proj(14/2.4,2,'5.83',20);p.proj(7.5,2,'7.5');
    p.note('同样降息 2 个百分点',300);p.note('陡 IS：ΔY≈0.83',335);p.note('平 IS：ΔY=2.5',370);
    text(s,40,540,'教学示意：两条曲线通过同一初始均衡；不是对任何经济体利率弹性的估计。',C.muted,13);
  };
  R['monetary-expectations24']=s=>{
    init(s,'货币宽松：当期降息与未来预期改善分开画');
    const p=chart(s,'当前产出 Y','当前实际利率 r（%）');
    p.curve(y=>16-2.4*y,C.blue,'原 IS：未来预期固定');p.curve(y=>20.8-2.4*y,C.green,'新 IS：rᵉ↓、Yᵉ↑',true);
    p.curve(y=>4,C.muted,'原 LM：r=4%',true);p.curve(y=>2,C.gold,'新 LM：r=2%');
    p.point(5,4,'A',C.ink,-18,-12);p.point(14/2.4,2,'B',C.blue,10,23);p.point(18.8/2.4,2,'C',C.green,10,-12);
    p.proj(5,4,'Yₐ=5');p.proj(14/2.4,2,'Yᵦ≈5.83',20);p.proj(18.8/2.4,2,'Y꜀≈7.83');
    p.note('A→B：沿原 IS',300);p.note('B→C：IS 右移',335);p.note('可信预期带来额外作用',370);
    text(s,40,540,'教学示意：图中参数用于分解作用，与正文代数练习不是同一组参数。',C.muted,13);
  };
  R['fiscal-expectations24']=s=>{
    init(s,'财政整顿：直接收缩与未来预期的反向作用');
    const p=chart(s,'当前产出 Y','当前实际利率 r（%）');
    p.curve(y=>16-2.4*y,C.blue,'初始 IS');p.curve(y=>13.6-2.4*y,C.red,'仅 G↓ 的 IS',true);p.curve(y=>18.4-2.4*y,C.green,'G↓ + 较强预期改善',true);p.curve(y=>4,C.gold,'当前 r 保持 4%');
    p.point(5,4,'A',C.blue,10,-12);p.point(4,4,'B',C.red,-20,24);p.point(6,4,'C',C.green,10,-12);
    p.proj(4,4,'Yᵦ=4');p.proj(5,4,'Yₐ=5',20);p.proj(6,4,'Y꜀=6');
    p.note('A→B：需求直接减少',300);p.note('B→C：未来条件改善',335);p.note('这里只展示净扩张情景',370);
    text(s,40,540,'教学示意：预期改善未必如此强；总效果也可能仍收缩或恰好抵消，不能预设方向。',C.muted,13);
  };
  R['review-map25']=s=>flow(s,'Quiz 3：三组模型的复习顺序',[['开放经济：D 与 Z、贸易余额、MF 与 UIP','先分清本国产品需求，再联立产出、利率与汇率'],['金融估值：付款日期、EPDV、债券与股票','把未来收入折到同一日期，区分价格、收益率与风险'],['预期 IS–LM：未来条件改变今天的消费和投资','财富与机器现值连接资产估值和总需求']]);
  R['asset-news25']=s=>flow(s,'为什么好消息未必使股票价格上涨',[['未来利润和股息预期提高','给定贴现率与风险，现金流渠道提高价值'],['同一消息也可能提高未来利率预期','更高贴现率压低未来股息的当前价值'],['风险补偿也可能一起改变','风险更高需要额外回报，给定现金流时价格承压'],['最终价格取决于各项合力','需要写明政策反应，不能仅凭“经济更强”判定涨跌']]);
  R['solve-checklist25']=s=>flow(s,'跨章节题目：四步检查',[['① 单位与时点','本币/外币？名义/实际？今天/下一期？共有几笔付款？'],['② 模型与约束','浮动/盯住？央行是否跟随？预期固定吗？是否有风险补偿？'],['③ 曲线或现值分解','当前轴上变量变化，还是未来参数移动曲线？现金流还是贴现率？'],['④ 联立求解与交叉检查','求 Y、E 后再算最终 NX；比较收益时统一币种与持有期']]);
})();
