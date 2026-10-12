/* Independent model calculations used by the interactive lecture components.
   Rates labelled % are percentage inputs; growth models convert them to fractions.
   Solow transitions solve the continuous-time sqrt production model analytically. */
(() => {
  'use strict';
  const C=['#236e61','#366ba4','#b34b29','#787e76'];
  const f=(v,d=1)=>Number(v).toFixed(d);
  const control=(key,label,min,max,step,value,unit='')=>({key,label,min,max,step,value,unit});
  const sample=(fn,a,b,n=100)=>Array.from({length:n+1},(_,j)=>[a+(b-a)*j/n,fn(a+(b-a)*j/n)]);
  const line=(name,fn,a,b,color=C[0],dash=false)=>({name,points:sample(fn,a,b),color,dash});
  const path=(name,points,color=C[0],dash=false)=>({name,points,color,dash});
  const metric=(label,value)=>({label,value});
  const model=(title,controls,presets,equation,assumption,calculate)=>({title,controls,presets,equation,assumption,calculate});
  const p=(label,values)=>({label,values});
  const models={};
  models.cross=model('支出乘数：跟着收入走一轮',[
    control('c','边际消费倾向 c',.2,.85,.05,.6),control('g','新增政府购买 ΔG',-10,30,1,0,' 单位')
  ],[p('增加购买',{c:.6,g:10}),p('更强的消费反馈',{c:.8,g:10}),p('减少购买',{c:.6,g:-10})],
  'Z = 20 + ΔG + cY；Y* = (20 + ΔG)/(1−c)；ΔY = ΔG/(1−c)',
  '短期封闭经济，价格、税收、利率与自主投资固定，有闲置产能。20 为合并后的基准自主需求；基准与实验使用同一个 c。单位为教学尺度。',v=>{
    const y0=20/(1-v.c),y=(20+v.g)/(1-v.c),max=Math.max(y0,y)*1.3;
    return {metrics:[metric('基准产出',f(y0)),metric('新均衡产出',f(y)),metric('财政乘数',f(1/(1-v.c),2))],
      plot:{x:'产出 Y',y:'计划支出 Z',xmax:max,ymax:max,series:[line('45°：Z=Y',x=>x,0,max,C[3],true),line('基准需求',x=>20+v.c*x,0,max,C[1],true),line('调整后需求',x=>20+v.g+v.c*x,0,max)],points:[[y,y]]},
      insight:`首轮购买变化为 ${f(v.g)}，均衡产出变化为 ${f(y-y0)}。每轮新增消费只保留上一轮的 ${f(v.c*100,0)}%，因此反馈逐步收敛。`,values:{y,y0,multiplier:1/(1-v.c)}};
  });
  models.gdp=model('把价格与数量拆开',[
    control('price','当期价格指数',60,160,5,100),control('quantity','当期数量指数',60,160,5,100)
  ],[p('只涨价 20%',{price:120,quantity:100}),p('只多生产 20%',{price:100,quantity:120}),p('价量都涨 20%',{price:120,quantity:120})],
  '名义 GDP 指数 = 价格指数 × 数量指数 / 100；实际 GDP 指数 = 数量指数',
  '基期价格和数量均标准化为 100，使用单一代表性商品篮子。此例说明固定基期方法，不模拟链式加权与商品结构变化。',v=>{
    const nominal=v.price*v.quantity/100;
    return {metrics:[metric('名义 GDP',f(nominal)),metric('实际 GDP',f(v.quantity)),metric('平减指数',f(v.price))],plot:{x:'价格指数（基期=100）',y:'GDP 指数',xmin:60,xmax:160,ymax:270,series:[line('名义 GDP',x=>x*v.quantity/100,60,160),line('实际 GDP',()=>v.quantity,60,160,C[1])],points:[[v.price,nominal]]},insight:`相对基期，销售金额变化 ${f(nominal-100)}%，实际生产变化 ${f(v.quantity-100)}%。两者的差别来自价格，不能把销售金额的增长全算成实际增长。`,values:{nominal,real:v.quantity,deflator:v.price}};
  });
  models.money=model('货币数量与利率的交点',[
    control('income','实际收入 Y',150,250,5,200),control('money','实际货币供给 M/P',40,85,1,60)
  ],[p('增加货币供给',{income:200,money:80}),p('收入上升',{income:240,money:60})],
  'Mᵈ/P = 0.6Y − 4i；i* = (0.6Y − M/P)/4（i 以百分数代入）',
  '价格固定，央行控制实际货币数量；线性货币需求为自编示例。与现代 IS–LM 中央行直接设定利率的实验区分使用。',v=>{
    const i=(.6*v.income-v.money)/4;
    return {metrics:[metric('实际货币供给',f(v.money,0)),metric('均衡利率',f(i)+'%'),metric('收入',f(v.income,0))],plot:{x:'实际货币 M/P',y:'利率 i（%）',xmax:160,ymax:40,series:[line('货币需求',x=>(.6*v.income-x)/4,0,.6*v.income),path('货币供给',[[v.money,0],[v.money,40]],C[2])],points:[[v.money,i]]},insight:`交点利率为 ${f(i)}%。给定收入时增加供给，交点向右下移动；给定供给时提高收入，货币需求上移。`,values:{i}};
  });
  models.islm=model('财政、政策利率与借款成本',[
    control('g','政府购买 G',20,60,1,40),control('i','政策名义利率 i',0,8,.25,4,'%'),control('pi','预期通胀 πᵉ',-2,4,.25,2,'%'),control('risk','风险溢价 x',0,6,.25,2,' 个百分点')
  ],[p('增加购买',{g:50,i:4,pi:2,risk:2}),p('财政整顿',{g:32,i:4,pi:2,risk:2}),p('整顿并降息',{g:32,i:2,pi:2,risk:2}),p('信用风险上升',{g:40,i:4,pi:2,risk:4})],
  'Y = 40 + 0.6(Y−20) + G − 4(i−πᵉ+x)；企业实际借款成本 ≈ i−πᵉ+x',
  '短期价格固定、封闭经济；税收为 20，利率以百分数代入。40 合并自主消费与投资；采用费雪近似和水平 LM。曲线延长部分仅作教学示意。',v=>{
    const cost=v.i-v.pi+v.risk,y=(28+v.g-4*cost)/.4;
    return {metrics:[metric('均衡产出 Y',f(y)),metric('政策实际利率',f(v.i-v.pi)+'%'),metric('企业实际成本',f(cost)+'%')],plot:{x:'产出 Y',y:'政策名义利率 i（%）',xmax:280,ymin:-4,ymax:16,series:[line('基准 IS',x=>(68-.4*x)/4,0,280,C[1],true),line('调整后 IS',x=>(28+v.g-.4*x)/4+v.pi-v.risk,0,280),line('当前 LM',()=>v.i,0,280,C[2])],points:[[y,v.i]]},insight:`相对基准产出 130，当前变化 ${f(y-130)}。先把 i、πᵉ、x 合成为融资成本，再判断投资与产出；只有 G、πᵉ、x 变化才使这里的 IS 移动。`,values:{y,cost}};
  });
  models.labor=model('WS–PS：寻找相容的实际工资',[
    control('markup','企业加成 m',.05,.3,.01,.1),control('z','工资议价因素 z',0,.15,.01,.05)
  ],[p('更高企业加成',{markup:.25,z:.05}),p('更强工资要求',{markup:.1,z:.13})],
  'WS：W/P = 1+z−0.02u；PS：W/P = 1/(1+m)；u 以百分数代入',
  '生产率标准化为 1，预期价格等于实际价格。WS 的线性系数是教学设定；z 代表影响工资要求的其他因素。',v=>{
    const wage=1/(1+v.markup),u=(1+v.z-wage)/.02;
    return {metrics:[metric('自然失业率',f(u)+'%'),metric('相容实际工资',f(wage,3)),metric('企业加成',f(v.markup*100,0)+'%')],plot:{x:'失业率 u（%）',y:'实际工资 W/P',xmax:25,ymin:.4,ymax:1.2,series:[line('WS',x=>1+v.z-.02*x,0,25),line('PS',()=>wage,0,25,C[2])],points:[[u,wage]]},insight:`两条线在 u=${f(u)}% 相交。m 提高使 PS 下降；z 提高使 WS 上移。在这组假设下，两者都会提高自然失业率。`,values:{u,wage}};
  });
  function inflation(v,gap){
    const initial=v.initial??2,pressure=gap*.5,series=Array.from({length:9},(_,t)=>[t,t===0?initial:v.mode===0?2+pressure:initial+t*pressure]),last=series.at(-1)[1];
    return {metrics:[metric('产出缺口',f(gap)+'%'),metric('每期缺口贡献',f(pressure)+' 个百分点'),metric('第 8 期通胀',f(last)+'%')],plot:{x:'期数（缺口每期保持不变）',y:'通胀 π（%）',xmax:8,ymin:Math.min(-1,last-1,initial-1),ymax:Math.max(5,last+1,initial+1),series:[line('2% 基准',()=>2,0,8,C[3],true),path(v.mode===0?'锚定预期':'适应性预期',series)]},insight:v.mode===0?`预期始终锚定在 2%。持续 ${f(gap)}% 的产出缺口使通胀保持在 ${f(last)}%，而不会逐期累加。`:`预期等于上一期通胀。持续缺口每期带来 ${f(pressure)} 个百分点的变化，8 期后为 ${f(last)}%。缺口为零只意味着不再变化。`,values:{gap,pressure,last}};
  }
  const mode=control('mode','预期机制（0=锚定，1=适应）',0,1,1,1);
  models.pc=model('预期决定通胀怎样走',[
    control('u','失业率 u',3,7,.25,5,'%'),mode
  ],[p('低失业·锚定预期',{u:4,mode:0}),p('低失业·适应预期',{u:4,mode:1}),p('自然失业率',{u:5,mode:1})],
  'πₜ = πᵉₜ − 0.8(u−5)；锚定：πᵉₜ=2%；适应：πᵉₜ=πₜ₋₁',
  '自然失业率固定为 5%，初始通胀 2%。失业率每期固定，忽略额外供给冲击。纵轴是通胀水平，不是价格水平。',v=>{
    const result=inflation(v,-1.6*(v.u-5));
    result.metrics[0]=metric('失业率缺口',f(v.u-5)+' 个百分点');
    result.insight=(v.mode===0?'预期保持在 2%。':'预期跟随上一期通胀。')+`失业率缺口 ${f(v.u-5)} 个百分点，带来 ${f(-.8*(v.u-5))} 个百分点的通胀贡献。`+(v.mode===0?'通胀一次调整后保持新水平。':'只要缺口持续，通胀就继续逐期改变。');
    return result;
  });
  models.gap=model('产出缺口与通胀路径',[
    control('gap','产出缺口 (Y−Yⁿ)/Yⁿ',-4,4,.5,0,'%'),mode,control('initial','起点通胀 π₀',0,8,.5,2,'%')
  ],[p('需求过热',{gap:2,mode:1,initial:2}),p('高通胀，回到潜在产出',{gap:0,mode:1,initial:6}),p('负缺口降通胀',{gap:-2,mode:1,initial:6})],
  'πₜ = πᵉₜ + 0.5 × 产出缺口（百分数）；起点通胀由滑块指定',
  '这是 IS–LM–PC 中的 PC 环节：把 IS–LM 给出的产出缺口作为输入。系数 0.5 为教学设定；不模拟央行逐期反应。每次试验从指定起点重新计算，锚定预期始终为 2%。',v=>inflation(v,v.gap));
  models.supply=model('供给基准变了，同一个产出意味着什么？',[
    control('loss','潜在产出损失',0,6,.5,0,'%'),control('demand','实际产出相对原水平变化',-6,2,.5,0,'%')
  ],[p('供给受损，产出暂不变',{loss:4,demand:0}),p('产出调整到新潜在水平',{loss:4,demand:-4})],
  '原 Yⁿ=100；新 Yⁿ=100−损失；Y=100+实际变化；Δπ=0.5×100(Y/Yⁿ−1)',
  '用潜在产出下降概括持续供给冲击，采用适应性预期。此图只展示缺口渠道，不另外添加一次性能源价格冲击。',v=>{
    const yn=100-v.loss,y=100+v.demand,gap=100*(y/yn-1),dp=.5*gap;
    return {metrics:[metric('新潜在产出',f(yn)),metric('实际产出',f(y)),metric('通胀变化',f(dp)+' 个百分点')],plot:{x:'实际产出 Y',y:'通胀变化 Δπ（百分点）',xmin:90,xmax:110,ymin:-6,ymax:9,series:[line('原 PC',x=>.5*(x-100),90,110,C[1],true),line('新 PC',x=>50*(x/yn-1),90,110)],points:[[y,dp]]},insight:`当前实际产出 ${f(y)}，相对新潜在产出的缺口是 ${f(gap)}%。让通胀不再上升所需的产出基准已由 100 变为 ${f(yn)}。`,values:{y,yn,gap,dp}};
  });
  models.production=model('资本深化，还是生产率改善？',[
    control('k','每名工人资本 k',1,16,.5,4),control('b','生产率系数 B',.5,2,.1,1)
  ],[p('更多机器',{k:9,b:1}),p('相同机器、更高效率',{k:4,b:1.5})],
  'y = B√k；资本增加 1 单位的产出增量 = B(√(k+1)−√k)',
  '工人数标准化，B 为直接乘在生产函数前的生产率系数，不与劳动增进型 A 混同。资本指数 1/2 是教学设定。',v=>{
    const y=v.b*Math.sqrt(v.k),marginal=v.b*(Math.sqrt(v.k+1)-Math.sqrt(v.k));
    return {metrics:[metric('人均产出 y',f(y,2)),metric('再加 1 单位资本',f(marginal,3)),metric('当前资本 k',f(v.k))],plot:{x:'人均资本 k',y:'人均产出 y',xmax:18,ymax:9,series:[line('基准 B=1',Math.sqrt,0,18,C[1],true),line('当前生产函数',x=>v.b*Math.sqrt(x),0,18)],points:[[v.k,y]]},insight:`再加一单位资本带来 ${f(marginal,3)} 单位产出。提高 k 沿曲线走，提高 B 抬高整条曲线；前者受到边际报酬递减约束。`,values:{y,marginal}};
  });
  function solowCalc(v,effective){
    const s=v.s/100,d=(v.delta+v.n+(effective?v.ga:0))/100,k=(s/d)**2,y=Math.sqrt(k),c=(1-s)*y,max=Math.max(4,k*1.5);
    return {metrics:[metric(effective?'有效劳动资本 k̃*':'稳态人均资本 k*',f(k,2)),metric('稳态产出（同分母）',f(y,2)),metric('稳态消费（同分母）',f(c,2))],plot:{x:effective?'每单位有效劳动资本 k̃':'人均资本 k',y:'投资 / 维持投资',xmax:max,ymax:Math.max(s*Math.sqrt(max),d*max)*1.12,series:[line('实际投资 s√k',x=>s*Math.sqrt(x),0,max),line('维持投资',x=>d*x,0,max,C[2])],points:[[k,d*k]]},insight:effective?`维持投资需覆盖折旧、人口与技术增长。k̃*=${f(k,2)} 保持不变时，人均产出仍按 gA=${f(v.ga)}% 增长；总产出连续增长率为 gA+n=${f(v.ga+v.n)}%。`:`提高 s 会提高 k*，但消费需扣除储蓄。本例 c*=s(1−s)/(δ+n)，在 s=50% 最大；当前 c*=${f(c,2)}。`,values:{k,y,c,d,s}};
  }
  const solowControls=[control('s','储蓄率 s',10,80,1,25,'%'),control('delta','折旧率 δ',4,15,.5,8,'%'),control('n','人口增长率 n',0,3,.25,0,'%')];
  models.solow=model('Solow 稳态与黄金律',solowControls,[p('低储蓄',{s:20,delta:8,n:0}),p('黄金律',{s:50,delta:8,n:0}),p('很高储蓄',{s:80,delta:8,n:0})],
  'dk/dt = s√k − (δ+n)k；k*=[s/(δ+n)]²；c*=(1−s)√k*',
  '连续时间、无技术进步，生产函数 y=√k。参数以每年比例计算，图中均为稳态；不把稳态消费当作冲击发生当年的消费。',v=>solowCalc(v,false));
  models.solowEffective=model('有效劳动稳态：稳住了什么？',[...solowControls.slice(0,2),control('n','人口增长率 n',0,3,.25,1,'%'),control('ga','技术增长率 gA',0,5,.25,2,'%')],
  [p('提高储蓄率',{s:40,delta:8,n:1,ga:2}),p('加快技术进步',{s:25,delta:8,n:1,ga:4})],
  'k̃=K/(AN)；dk̃/dt=s√k̃−(δ+n+gA)k̃；Y/N=A√k̃',
  '连续时间 Solow，Y=K^(1/2)(AN)^(1/2)。输入增长率为连续年率，因此维持投资中的增长率可直接相加；不是年度离散精确公式。',v=>solowCalc(v,true));
  const growthPath=(s,g,t,x0)=>{const d=.08+.01+g,x=s/d+(x0-s/d)*Math.exp(-d*t/2);return {x,y:Math.exp(g*t)*x,rate:g+(s-d*x)/(2*x)};};
  models.growth=model('储蓄率与技术进步：从同一个起点出发',[
    control('s','储蓄情景：新储蓄率',10,60,1,40,'%'),control('ga','技术情景：新技术增长率',0,5,.25,4,'%'),control('horizon','观察第几年',5,120,5,60,' 年')
  ],[p('先看第 10 年',{s:40,ga:4,horizon:10}),p('拉长到第 120 年',{s:40,ga:4,horizon:120})],
  '基准 s=25%、gA=2%、δ=8%、n=1%；三条路径从同一个 k̃* 出发。纵轴为 ln[(Y/N)/(Y/N)₀]。',
  '连续时间 Solow，Y=√(K·AN)。蓝线仅改储蓄率，橙线仅改技术增长率，绿色为基准。冲击发生在第 0 年；折旧、人口增长与其他条件固定。',v=>{
    const x0=.25/.11,t=v.horizon,save=growthPath(v.s/100,.02,t,x0),tech=growthPath(.25,v.ga/100,t,x0),base=growthPath(.25,.02,t,x0);
    const series=[line('基准路径',u=>Math.log(growthPath(.25,.02,u,x0).y/x0),0,120),line('仅改变储蓄率',u=>Math.log(growthPath(v.s/100,.02,u,x0).y/x0),0,120,C[1]),line('仅改变技术增长率',u=>Math.log(growthPath(.25,v.ga/100,u,x0).y/x0),0,120,C[2])];
    const ys=series.flatMap(s=>s.points.map(p=>p[1]));
    return {metrics:[metric(`第 ${t} 年·基准增长率`,'2.00%'),metric('储蓄情景增长率',f(save.rate*100,2)+'%'),metric('技术情景增长率',f(tech.rate*100,2)+'%')],plot:{x:'冲击后的年数',y:'人均产出的对数变化',xmax:120,ymin:Math.min(0,...ys)-.1,ymax:Math.max(...ys)+.2,series,points:[[t,Math.log(save.y/x0)],[t,Math.log(tech.y/x0)]]},insight:`第 ${t} 年，储蓄情景收入为基准的 ${f(save.y/base.y,2)} 倍，技术情景为 ${f(tech.y/base.y,2)} 倍。储蓄情景的长期增长率仍回到 2%；技术情景趋向 ${f(v.ga,2)}%。对数图的斜率表示连续增长率。`,values:{saveRate:save.rate,techRate:tech.rate,saveIncome:save.y,techIncome:tech.y,baseIncome:base.y}};
  });
  models.accounting=model('增长核算：剩下的究竟是什么？',[
    control('gy','产出增长率 gY',0,10,.25,5,'%'),control('gk','资本增长率 gK',0,12,.25,6,'%'),control('gn','劳动增长率 gN',0,4,.25,1,'%'),control('beta','资本份额 β',.2,.5,.05,.35)
  ],[p('资本驱动的增长',{gy:5,gk:10,gn:1,beta:.35}),p('更高产出增长',{gy:8,gk:6,gn:1,beta:.35})],
  'Y=K^β(AN)^(1−β)；TFP 残差 R=gY−βgK−(1−β)gN；gA=R/(1−β)',
  '对数增长核算；β 专门表示资本份额，避免与课件中可能表示劳动份额的 α 混淆。R 是未被资本和劳动解释的剩余，不自动等于纯技术进步。',v=>{
    const capital=v.beta*v.gk,labor=(1-v.beta)*v.gn,residual=v.gy-capital-labor,ga=residual/(1-v.beta);
    return {metrics:[metric('资本贡献',f(capital,2)+' 个百分点'),metric('TFP 残差 R',f(residual,2)+'%'),metric('隐含 gA',f(ga,2)+'%')],bars:[['资本贡献',capital],['劳动贡献',labor],['TFP 残差',residual]],insight:`${f(capital,2)} + ${f(labor,2)} + ${f(residual,2)} = ${f(v.gy,2)} 个百分点。劳动增进型 gA 需将残差再除以劳动份额 ${f(1-v.beta,2)}；两者不能直接混用。`,values:{capital,labor,residual,ga}};
  });
  models.convergence=model('两国会走向同一个终点吗？',[
    control('sa','甲国储蓄率',10,50,1,25,'%'),control('sb','乙国储蓄率',10,50,1,25,'%'),control('ka','甲国初始人均资本',.5,12,.5,1),control('kb','乙国初始人均资本',.5,12,.5,9)
  ],[p('相同条件，不同起点',{sa:25,sb:25,ka:1,kb:9}),p('不同储蓄率',{sa:15,sb:35,ka:1,kb:9})],
  'y=√k；d√k/dt=[s−0.1√k]/2；y*=s/0.1',
  '连续时间，无技术和人口增长，折旧率 10%。两国仅改变储蓄率与初始资本，用来隔离条件趋同的逻辑；真实跨国差异还包括技术、人力资本、制度等。',v=>{
    const a=v.sa/10,b=v.sb/10,fa=t=>a+(Math.sqrt(v.ka)-a)*Math.exp(-.05*t),fb=t=>b+(Math.sqrt(v.kb)-b)*Math.exp(-.05*t);
    return {metrics:[metric('甲国稳态人均产出',f(a,2)),metric('乙国稳态人均产出',f(b,2)),metric('是否同一稳态',v.sa===v.sb?'是':'否')],plot:{x:'年数',y:'人均产出 y',xmax:100,ymax:6,series:[line('甲国路径',fa,0,100),line('乙国路径',fb,0,100,C[1]),line('甲国稳态',()=>a,0,100,C[0],true),line('乙国稳态',()=>b,0,100,C[1],true)]},insight:v.sa===v.sb?'两国条件相同，尽管起点不同，长期趋向相同的人均产出。低起点一方只有在低于自身稳态时才会增长。':'储蓄率不同，稳态不同。两国都在趋向自身稳态，并不意味着彼此的收入差距一定消失。',values:{a,b}};
  });
  models.exchange=model('先换币，再比较商品篮子',[
    control('e','名义汇率 E（外币/本币）',.5,1.5,.05,1),control('price','本国篮子价格 P',60,140,5,100),control('foreign','外国篮子价格 P*',60,140,5,100)
  ],[p('本币名义升值',{e:1.2,price:100,foreign:100}),p('汇率不变，本国涨价',{e:1,price:120,foreign:100})],
  'ε = EP/P*；EP 是本国篮子的外币价格；ε 是本国篮子相对外国篮子的价格',
  '两种篮子视为可比商品；课程报价是外币/本币。ε 上升称为实际升值，但并不直接计算贸易余额。',v=>{
    const eps=v.e*v.price/v.foreign;
    return {metrics:[metric('本国篮子·外币价',f(v.e*v.price)),metric('外国篮子·外币价',f(v.foreign)),metric('实际汇率 ε',f(eps,2))],plot:{x:'名义汇率 E（外币/本币）',y:'实际汇率 ε',xmin:.5,xmax:1.5,ymax:3.6,series:[line('相对商品价格',x=>x*v.price/v.foreign,.5,1.5),line('相同篮子价格 ε=1',()=>1,.5,1.5,C[3],true)],points:[[v.e,eps]]},insight:`本国篮子换成外币后值 ${f(v.e*v.price)}，相当于 ${f(eps,2)} 个外国篮子。ε>1 表示本国篮子更贵；“升值”则描述 ε 相对于此前的上升。`,values:{eps}};
  });
  models.open=model('需求增加，贸易余额如何变化？',[
    control('g','政府购买 G',10,50,1,20),control('x','出口 X',10,50,1,20),control('m','边际进口倾向 m',.1,.4,.05,.2)
  ],[p('政府购买 +10',{g:30,x:20,m:.2}),p('出口 +10',{g:20,x:30,m:.2}),p('出口 +10、购买 −10',{g:10,x:30,m:.2})],
  'Z=20+0.7Y+G+X−mY；Y*=(20+G+X)/(0.3+m)；NX=X−mY',
  '固定价格、利率和汇率；进口已经换成本国产品单位。20 合并自主消费与投资。基准为 G=X=20、m=0.2，对应 Y=120、NX=−4。',v=>{
    const y=(20+v.g+v.x)/(.3+v.m),nx=v.x-v.m*y;
    return {metrics:[metric('均衡产出 Y',f(y)),metric('贸易余额 NX',f(nx)),metric('财政乘数',f(1/(.3+v.m),2))],plot:{x:'产出 Y',y:'贸易余额 NX',xmax:300,ymin:-110,ymax:55,series:[line('基准净出口',x=>20-.2*x,0,300,C[1],true),line('当前净出口',x=>v.x-v.m*x,0,300),line('贸易平衡',()=>0,0,300,C[3],true)],points:[[y,nx]]},insight:`相对基准，产出变化 ${f(y-120)}，贸易余额变化 ${f(nx+4)}。G 增加沿 NX 曲线移动；X 增加把 NX 曲线本身上移。`,values:{y,nx}};
  });
  models.mf=model('浮动汇率下的利率传导',[
    control('i','本国名义利率',0,8,.25,4,'%'),control('g','政府购买 G',20,50,1,30),control('ee','预期未来汇率 Eᵉ',.8,1.2,.02,1)
  ],[p('本国降息',{i:2,g:30,ee:1}),p('财政扩张',{i:4,g:40,ee:1}),p('未来本币更强',{i:4,g:30,ee:1.1})],
  'E=Eᵉ(1+i/100)/1.04；NX=20−20(E−1)−0.2Y；Y=[100+G−3i−20(E−1)]/0.6',
  '浮动汇率，外国利率 4%，风险中性、无风险溢价，价格固定且 P=P*。投资利率使用百分数；线性 NX 假定实际贬值提高给定 Y 下的净出口，系数为教学设定。',v=>{
    const e=v.ee*(1+v.i/100)/1.04,y=(100+v.g-3*v.i-20*(e-1))/.6,nx=20-20*(e-1)-.2*y;
    return {metrics:[metric('当前汇率 E',f(e,3)),metric('均衡产出 Y',f(y)),metric('贸易余额 NX',f(nx))],plot:{x:'当前 E（外币/本币）',y:'本国利率 i（%）',xmin:.7,xmax:1.35,ymin:-15,ymax:20,series:[line('利率平价 UIP',x=>100*(1.04*x/v.ee-1),.7,1.35),line('央行利率',()=>v.i,.7,1.35,C[2])],points:[[e,v.i]]},insight:`E=${f(e,3)}；相对 E=1 的基准，本币${e>1?'升值':e<1?'贬值':'汇率不变'}。汇率改变给定 Y 下的净出口，产出提高又带动进口，因此最终 NX 还需联立计算。`,values:{e,y,nx}};
  });
  models.peg=model('守住盯住汇率需要怎样的利率？',[
    control('foreign','外国利率 i*',0,8,.25,4,'%'),control('depreciation','预期本币贬值幅度',0,15,.5,0,'%')
  ],[p('完全可信的盯住',{foreign:4,depreciation:0}),p('预期贬值 5%',{foreign:4,depreciation:5}),p('外部加息',{foreign:6,depreciation:0})],
  '当前 E=1；Eᵉ=1−d；1+i=(1+i*)/(1−d)',
  '课程报价为外币/本币；d 为未来 E 的预期下降比例。资本自由流动、无风险溢价、未抛补利率平价成立。没有模拟外汇储备耗尽或实际危机发生概率。',v=>{
    const ee=1-v.depreciation/100,i=100*((1+v.foreign/100)/ee-1);
    return {metrics:[metric('当前盯住汇率','1.000'),metric('预期未来 E',f(ee,3)),metric('所需本国利率',f(i,2)+'%')],plot:{x:'预期 E 下跌幅度（%）',y:'所需本国利率（%）',xmax:15,ymax:30,series:[line('UIP 所需利率',x=>100*((1+v.foreign/100)/(1-x/100)-1),0,15)],points:[[v.depreciation,i]]},insight:v.depreciation===0?'未来盯住完全可信，本国利率等于外国利率。独立改变利率会与这组资本流动和汇率条件冲突。':`预期贬值 ${f(v.depreciation)}% 时，需要约 ${f(i,2)}% 的本国利率补偿汇率损失。这个利率要求可能与国内经济需要冲突。`,values:{ee,i}};
  });
  models.bond=model('固定现金流的今天价格',[
    control('r','市场贴现率 r',0,12,.25,5,'%'),control('years','剩余期限',1,20,1,5,' 年'),control('coupon','每年票息（面值 100）',0,10,.5,5)
  ],[p('利率下降',{r:2,years:5,coupon:5}),p('利率上升',{r:8,years:5,coupon:5}),p('长期债券',{r:8,years:20,coupon:5})],
  'P=Σ[t=1…T] C/(1+r)^t + 100/(1+r)^T；现金流从一年后开始',
  '面值 100、每年年末付息、到期还本；同一个年有效贴现率适用于所有期限，不考虑违约、税收与交易成本。r=0 时直接求现金流之和。',v=>{
    const price=r=>Array.from({length:v.years},(_,j)=>v.coupon/(1+r/100)**(j+1)).reduce((a,b)=>a+b,0)+100/(1+r/100)**v.years,now=price(v.r);
    return {metrics:[metric('当前债券价格',f(now,2)),metric('未来未折现总额',f(100+v.coupon*v.years,2)),metric('票息率',f(v.coupon)+'%')],plot:{x:'市场贴现率 r（%）',y:'债券价格',xmax:12,ymax:price(0)*1.08,series:[line('现金流现值',price,0,12),line('面值 100',()=>100,0,12,C[3],true)],points:[[v.r,now]]},insight:`承诺支付总额为 ${f(100+v.coupon*v.years)}，今天价格为 ${f(now,2)}。票息率等于市场贴现率时价格为面值；提前卖出时的价格会随市场利率变化。`,values:{price:now}};
  });
  models.wealth=model('一次性收入与持续收入的财富效应',[
    control('income','每年新增收入',100,2000,100,1000,' 元'),control('years','持续年数',1,20,1,10,' 年'),control('r','年贴现率',0,12,.5,4,'%')
  ],[p('只多一年',{income:1000,years:1,r:4}),p('持续十年',{income:1000,years:10,r:4}),p('更高贴现率',{income:1000,years:10,r:8})],
  '财富增量 = Σ[t=1…T] Δ收入/(1+r)^t；一年期增量 = Δ收入/(1+r)',
  '确定性的税后收入从一年后开始，每年年末收到；利率固定。仅计算现值，不直接给出消费函数，不假定所有人都能自由借贷。',v=>{
    const values=Array.from({length:v.years},(_,j)=>[j+1,v.income/(1+v.r/100)**(j+1)]),wealth=values.reduce((a,p)=>a+p[1],0),one=v.income/(1+v.r/100);
    return {metrics:[metric('持续收入的现值',f(wealth,0)+' 元'),metric('仅一年收入现值',f(one,0)+' 元'),metric('现值倍数',f(wealth/one,2)+' 倍')],plot:{x:'收到现金流的年份',y:'该年新增收入的现值（元）',xmax:Math.max(2,v.years),ymax:v.income*1.1,series:[path('每期收入现值',values)],points:values},insight:`持续 ${v.years} 年增加的财富是一次性变化的 ${f(wealth/one,2)} 倍。未来越远折现越多，但“现值增加多少”仍不等于“今天消费增加多少”。`,values:{wealth,one}};
  });
  models.yield23=model('两年债券：短率路径、风险与收益率',[
    control('i','当前一年利率',0,10,.25,4,'%'),control('future','预期下一年一年利率',0,10,.25,6,'%'),control('risk','一年持有期风险补偿 xᵇ',-2,5,.25,0,' 个百分点')
  ],[p('预期未来降息',{i:4,future:2,risk:0}),p('预期未来加息',{i:4,future:6,risk:0}),p('加入价格风险补偿',{i:4,future:6,risk:2}),p('负的风险补偿',{i:4,future:6,risk:-1})],
  'P₂=100/[(1+(i+xᵇ)/100)(1+iᵉ/100)]；两年 YTM=100(√(100/P₂)−1)',
  '两年零息债，到期付 100；按年交易，无违约风险。xᵇ 是第一年持有到中途卖出的要求补偿，仅加在第一因子；未来利率采用课件预期路径简化。负补偿用于说明对冲价值。',v=>{
    const price=100/((1+(v.i+v.risk)/100)*(1+v.future/100)),ytm=100*(Math.sqrt(100/price)-1),approx=(v.i+v.future+v.risk)/2;
    const fn=(future,risk)=>100*(Math.sqrt((1+(v.i+risk)/100)*(1+future/100))-1);
    return {metrics:[metric('两年债券价格',f(price,2)),metric('精确两年 YTM',f(ytm,3)+'%'),metric('小利率近似',f(approx,3)+'%')],plot:{x:'预期下一年一年利率（%）',y:'两年到期收益率（%）',xmax:10,ymin:-2,ymax:14,series:[line('不加风险补偿',x=>fn(x,0),0,10,C[1],true),line('当前风险补偿',x=>fn(x,v.risk),0,10)],points:[[v.future,ytm]]},insight:`风险补偿 xᵇ=${f(v.risk,2)} 个百分点；精确 YTM 为 ${f(ytm,3)}%，近似为 ${f(approx,3)}%。xᵇ 不是直接加在两年年化收益率上；当前承诺终值仍为 100，预期更高的回报通过较低价格实现。`,values:{price,ytm,approx}};
  });
  models.stock23=model('股票：现金流、折现与风险补偿',[
    control('dividend','下一年预期分红 D₁',1,10,.5,4),control('i','无风险利率 i',1,8,.25,3,'%'),control('risk','股票风险溢价 xˢ',1,8,.25,5,' 个百分点'),control('g','永续分红增长率 g',-2,6,.25,2,'%')
  ],[p('只降低利率',{dividend:4,i:1,risk:5,g:2}),p('只提高风险溢价',{dividend:4,i:3,risk:7,g:2}),p('更高分红',{dividend:5,i:3,risk:5,g:2}),p('检查不收敛的假设',{dividend:4,i:1,risk:1,g:3})],
  'q=i+xˢ；Q=D₁/[(i+xˢ−g)/100]，仅在 q>g 时成立',
  '固定增长股利模型为本讲学习补充：从下一年开始支付，永续增长率、名义要求回报及风险溢价固定，终值折现项消失。没有声称真实股票永远符合这些条件。q≤g 时不提供有限估值。',v=>{
    const q=v.i+v.risk,spread=q-v.g,valid=spread>0,price=valid?100*v.dividend/spread:null,ymax=Math.max(100,valid?price*1.25:300);
    const value=r=>v.i+r>v.g?100*v.dividend/(v.i+r-v.g):NaN;
    return {metrics:[metric('模型价格',valid?f(price,2):'不收敛'),metric('要求回报 q',f(q,2)+'%'),metric('q−g',f(spread,2)+' 个百分点')],plot:{x:'股票风险溢价 xˢ（百分点）',y:'模型股价 Q（只显示 q>g）',xmax:10,ymax,series:[line('分红现值',value,0,10)],points:valid?[[v.risk,price]]:[]},insight:valid?`分子是下一年分红 ${f(v.dividend,2)}；要求回报 ${f(q,2)}% 减去增长率 ${f(v.g,2)}%，得到 ${f(spread,2)} 个百分点。模型价格为 ${f(price,2)}。接近 q=g 时高度敏感，应先检查永续假设。`:'q≤g，永续分红现值级数不收敛，不能报告一个有限模型价格。这说明当前增长和贴现假设需要调整，不是实际股票真的价值无限大。图中仅保留 q>g 的区域。',values:{price,q,spread}};
  });
  models.news23=model('盈利改善，能抵消利率上升吗？',[
    control('dividendChange','下一年分红相对基准变化',-40,40,5,0,'%'),control('i','新的无风险利率',0,8,.25,3,'%'),control('risk','新的股票风险溢价',3,10,.25,5,' 个百分点')
  ],[p('分红改善，利率不变',{dividendChange:10,i:3,risk:5}),p('分红改善，利率也升',{dividendChange:10,i:5,risk:5}),p('降息，但盈利与风险恶化',{dividendChange:-30,i:1,risk:7})],
  '基准 D₁=4、i=3%、xˢ=5%、g=2%，Q₀=66.67；Q₁=4(1+ΔD/100)/[(i+xˢ−2)/100]',
  '固定增长股利模型，g 始终为 2%。滑块分别指定新闻后的分红与融资条件，隔离各渠道；不估计央行反应函数，不自动把产出变化换算为分红变化。',v=>{
    const dividend=4*(1+v.dividendChange/100),price=dividend/((v.i+v.risk-2)/100),baseline=4/.06,change=100*(price/baseline-1);
    return {metrics:[metric('基准模型价格',f(baseline,2)),metric('新闻后模型价格',f(price,2)),metric('总价格变化',f(change,1)+'%')],plot:{x:'无风险利率 i（%）',y:'股票模型价格 Q',xmax:8,ymax:Math.max(600,price*1.2),series:[line('基准分红与风险',x=>4/((x+5-2)/100),0,8,C[1],true),line('新闻后分红与风险',x=>dividend/((x+v.risk-2)/100),0,8)],points:[[v.i,price]]},insight:`分红变为 ${f(dividend,2)}，要求回报变为 ${f(v.i+v.risk,2)}%。合并后的价格变化为 ${f(change,1)}%。先分别判断分子与分母，再比较合力，不能仅用“好消息”或“降息”给出方向。`,values:{price,baseline,change}};
  });
  window.MIT1402LearningModels=models;
})();
