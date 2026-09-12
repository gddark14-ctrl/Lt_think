const DATA="https://smok95.github.io/lotto/results/all.json";let draws=[],$=id=>document.getElementById(id);
const ranges=[5,10,20,30,50,100];
function freq(h,w){let c=Array(46).fill(0);h.slice(-w).forEach(d=>d.numbers.forEach(n=>c[n]++));return c}
function gap(h,n){for(let i=h.length-1,g=1;i>=0;i--,g++)if(h[i].numbers.includes(n))return g;return h.length+1}
function sum(a){return a.reduce((x,y)=>x+y,0)}
function even(a){return a.filter(n=>n%2===0).length}
function overlap(a,b){return a.filter(n=>b.includes(n)).length}
function baseScore(h, cfg){
 const fs=Object.fromEntries(ranges.map(w=>[w,freq(h,w)]));let s=Array(46).fill(0);
 for(let n=1;n<=45;n++){
  let z=0, total=0;
  for(const [w,wgt] of Object.entries(cfg.fw)){let mx=Math.max(...fs[w],1);z+=wgt*fs[w][n]/mx;total+=wgt}
  z/=total;
  z+=cfg.gap*Math.min(gap(h,n),20)/20;
  s[n]=z;
 }return s;
}
const configs=[
 {name:"단기형",fw:{5:1,10:2,20:1},gap:.10},
 {name:"중기형",fw:{10:1,20:3,50:2},gap:.10},
 {name:"장기형",fw:{20:1,50:2,100:2},gap:.06},
 {name:"추세형",fw:{5:2,20:1,50:1},gap:.16},
 {name:"균형형",fw:{10:1,20:2,50:1,100:1},gap:.10}
];
function deterministicPick(h,cfg,seed){
 let s=baseScore(h,cfg),r=[...Array(45)].map((_,i)=>i+1).sort((a,b)=>s[b]-s[a]),pool=r.slice(0,24),out=[],x=(seed>>>0);
 const rnd=()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296};
 for(let t=0;t<10;t++){let p=pool.slice(),a=[];
  while(a.length<4){let i=Math.floor(rnd()*p.length);a.push(p.splice(i,1)[0])}
  while(a.length<6){let n=1+Math.floor(rnd()*45);if(!a.includes(n))a.push(n)}
  a.sort((u,v)=>u-v);out.push({nums:a,score:a.reduce((q,n)=>q+s[n],0)});
 }return out.sort((a,b)=>b.score-a.score);
}
function hcount(p,a){return p.filter(n=>a.includes(n)).length}
function evaluateConfig(cfg,start,end,tickets=10){
 let hist=[],bs=[],hit3=0,hit4=0,hit5=0,hit6=0;
 for(let i=0;i<end;i++){hist.push(draws[i]);if(i<start)continue;
  let ps=deterministicPick(hist,cfg,7919+i).slice(0,tickets),best=Math.max(...ps.map(p=>hcount(p.nums,draws[i].numbers)));
  bs.push(best);if(best>=3)hit3++;if(best>=4)hit4++;if(best>=5)hit5++;if(best===6)hit6++;
 }
 return {n:bs.length,avg:bs.reduce((a,b)=>a+b,0)/bs.length,p3:hit3/bs.length,p4:hit4/bs.length,p5:hit5/bs.length,p6:hit6/bs.length};
}
function selectPatterns(){
 const n=draws.length,trainEnd=Math.floor(n*.60),valEnd=Math.floor(n*.80);
 return configs.map(c=>({cfg:c,train:evaluateConfig(c,100,trainEnd),val:evaluateConfig(c,trainEnd,valEnd)}))
 .sort((a,b)=>b.val.p4-a.val.p4 || b.val.p3-a.val.p3 || b.val.avg-a.val.avg);
}
function renderStats(best){
 let v=best.val;let random3=0.02383,random4=.001394,random5=.0000287;
 $("stats").innerHTML=`<div class="stat"><span>전체 데이터</span><b>${draws.length}회</b></div>
 <div class="stat"><span>훈련 구간</span><b>1 ~ ${Math.floor(draws.length*.60)}회</b></div>
 <div class="stat"><span>검증 구간</span><b>${Math.floor(draws.length*.60)+1} ~ ${Math.floor(draws.length*.80)}회</b></div>
 <div class="stat"><span>검증 평균 최고 적중(10게임)</span><b>${v.avg.toFixed(3)}개</b></div>
 <div class="stat"><span>3개 이상</span><b>${(v.p3*100).toFixed(3)}%</b></div>
 <div class="stat"><span>4개 이상</span><b>${(v.p4*100).toFixed(3)}%</b></div>
 <div class="stat"><span>5개 이상</span><b>${(v.p5*100).toFixed(4)}%</b></div>
 <div class="stat"><span>6개</span><b>${(v.p6*100).toFixed(6)}%</b></div>
 <div class="stat"><span>랜덤 3개+ 기준</span><b>${(random3*100).toFixed(3)}%</b></div>
 <div class="stat"><span>랜덤 4개+ 기준</span><b>${(random4*100).toFixed(4)}%</b></div>`;
}
function renderPatterns(results){
 $("patterns").innerHTML=results.map((r,i)=>`<div class="pattern"><b>${i+1}. ${r.cfg.name}</b><span class="muted">훈련 3+ ${(r.train.p3*100).toFixed(2)}% · 검증 3+ ${(r.val.p3*100).toFixed(2)}% · 검증 4+ ${(r.val.p4*100).toFixed(3)}% · 평균 ${r.val.avg.toFixed(3)}개</span></div>`).join("");
}
function renderPicks(ps){$("picks").innerHTML='<div class="picks">'+ps.map((p,i)=>`<div class="pick"><b>${String(i+1).padStart(2,"0")} 게임</b><div class="balls">${p.nums.map(n=>`<span class="ball">${n}</span>`).join("")}</div><div class="score">AI 점수 ${p.score.toFixed(3)}</div></div>`).join("")+"</div>"}
async function load(){let r=await fetch(DATA,{cache:"no-store"});if(!r.ok)throw Error();draws=await r.json();draws.sort((a,b)=>a.draw_no-b.draw_no)}
$("run").onclick=async()=>{try{$("status").textContent="데이터 로드 중…";await load();$("status").textContent="패턴 탐색/검증 중…";setTimeout(()=>{let res=selectPatterns();renderStats(res[0]);renderPatterns(res);renderPicks(deterministicPick(draws,res[0].cfg,draws.length*7919).slice(0,10));$("status").textContent=`완료 · 최신 ${draws.at(-1).draw_no}회`;},20)}catch(e){$("status").textContent="데이터 로드 실패"}};
$("pick").onclick=async()=>{try{if(!draws.length)await load();let res=selectPatterns();renderPicks(deterministicPick(draws,res[0].cfg,draws.length*7919).slice(0,10));$("status").textContent=`추천 완료 · 선택 모델 ${res[0].cfg.name}`}catch(e){$("status").textContent="실패"}};
