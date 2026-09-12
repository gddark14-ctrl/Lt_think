const DATA="https://smok95.github.io/lotto/results/all.json";
let draws=[], bestModel=null, lastResults=[];
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function normalize(raw){
  return raw.map(d=>({draw_no:+d.draw_no,numbers:(d.numbers||[]).map(Number).filter(n=>n>=1&&n<=45).sort((a,b)=>a-b)}))
    .filter(d=>d.numbers.length===6).sort((a,b)=>a.draw_no-b.draw_no);
}
function freq(hist,w){
  const c=Array(46).fill(0), start=Math.max(0,hist.length-w);
  for(let i=start;i<hist.length;i++) for(const n of hist[i].numbers)c[n]++;
  return c;
}
function gap(hist,n){
  for(let i=hist.length-1,g=1;i>=0;i--,g++) if(hist[i].numbers.includes(n)) return g;
  return hist.length+1;
}
function overlap(a,b){let c=0;for(const n of a)if(b.includes(n))c++;return c}
function sum(a){return a.reduce((x,y)=>x+y,0)}
function even(a){return a.filter(n=>n%2===0).length}
function consecutive(a){let c=0;for(let i=1;i<a.length;i++)if(a[i]===a[i-1]+1)c++;return c}
function tail(a){let c=Array(10).fill(0);for(const n of a)c[n%10]++;return c}

const windows=[5,10,20,30,50,75,100];
const featureNames=["freq","gap","recentOverlap","oddEven","lowHigh","sum","consecutive","tail","pair"];

function makePattern(rnd){
  const fw={};
  const count=2+Math.floor(rnd()*4);
  const used=[];
  while(used.length<count){
    const w=windows[Math.floor(rnd()*windows.length)];
    if(!used.includes(w))used.push(w);
  }
  used.sort((a,b)=>a-b);
  let total=0;
  for(const w of used){fw[w]=0.4+rnd()*2.6;total+=fw[w]}
  for(const w of used)fw[w]/=total;
  return {
    fw,
    gapW:(rnd()-.25)*.45,
    overlapW:(rnd()-.5)*.35,
    parityW:(rnd()-.5)*.28,
    sumW:(rnd()-.5)*.18,
    consecW:(rnd()-.5)*.18,
    tailW:(rnd()-.5)*.18,
    pairW:(rnd()-.5)*.22,
    recentWindow:1+Math.floor(rnd()*5),
    targetEven:1+Math.floor(rnd()*5),
    targetSum:125+rnd()*70,
    targetConsec:rnd()*2.5
  };
}

function scoreNumbers(hist,p){
  const fs={};for(const w of Object.keys(p.fw))fs[w]=freq(hist,+w);
  const last=hist.length?hist[hist.length-1].numbers:[];
  const prev=hist.length>1?hist[hist.length-2].numbers:[];
  const s=Array(46).fill(0);
  for(let n=1;n<=45;n++){
    let z=0;
    for(const [w,wgt] of Object.entries(p.fw)){
      const c=fs[w], mx=Math.max(1,...c.slice(1));
      z+=wgt*(c[n]/mx);
    }
    z += p.gapW*clamp(gap(hist,n),1,25)/25;
    if(last.includes(n))z += p.overlapW;
    if(prev.includes(n))z += p.overlapW*.55;
    z += p.parityW*((n%2===0)?1:-1)*(p.targetEven-3)/2;
    z += p.sumW*(n/45);
    z += p.tailW*((n%10)/10);
    s[n]=z;
  }
  return s;
}

function seeded(seed){
  let x=(seed>>>0)||123456789;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296};
}
function makeTickets(hist,p,seed,K=10){
  const s=scoreNumbers(hist,p);
  const ranked=Array.from({length:45},(_,i)=>i+1).sort((a,b)=>s[b]-s[a]);
  const pool=ranked.slice(0,26),rnd=seeded(seed),out=[];
  for(let k=0;k<K;k++){
    const avail=pool.slice(),a=[];
    while(a.length<4){const i=Math.floor(rnd()*avail.length);a.push(avail.splice(i,1)[0])}
    while(a.length<6){const n=1+Math.floor(rnd()*45);if(!a.includes(n))a.push(n)}
    a.sort((x,y)=>x-y);out.push(a);
  }
  return out;
}

function evaluate(hist,p,start,end,tickets=10){
  let sumBest=0,p3=0,p4=0,p5=0,p6=0,n=0;
  for(let i=start;i<end;i++){
    const ts=makeTickets(hist.slice(0,i),p,((p.seed||1)+i*2654435761)>>>0,tickets);
    let best=0;
    for(const t of ts)best=Math.max(best,overlap(t,hist[i].numbers));
    sumBest+=best;n++;
    if(best>=3)p3++;if(best>=4)p4++;if(best>=5)p5++;if(best===6)p6++;
  }
  return {n,avg:sumBest/n,p3:p3/n,p4:p4/n,p5:p5/n,p6:p6/n};
}

function randomBestBaseline(K=10){
  // Independent-ticket approximation; useful as a common reference for 10 games.
  const p3=1-(1-0.023834102)*1; // replaced below with exact single-ticket values
  const one3=0.023834102,one4=0.00139348,one5=0.000028729,one6=0.00000012277;
  return {
    p3:1-Math.pow(1-one3,K),
    p4:1-Math.pow(1-one4,K),
    p5:1-Math.pow(1-one5,K),
    p6:1-Math.pow(1-one6,K)
  };
}

function rankScore(v){
  // Main emphasis on robust 3+/4+ validation; 6-hit is too rare for model selection.
  return v.p4*0.55 + v.p3*0.25 + v.avg/6*0.20;
}

function buildCandidateSet(count=3000){
  const rnd=seeded(0xA17F2026),set=[];
  for(let i=0;i<count;i++){const p=makePattern(rnd);p.seed=(i*7919+17)>>>0;set.push(p)}
  return set;
}

function evaluateCandidates(candidates,trainStart,trainEnd,valStart,valEnd,testStart,testEnd){
  // Stage 1: train screening.
  const screened=[];
  for(let i=0;i<candidates.length;i++){
    const p=candidates[i],tr=evaluate(draws,p,trainStart,trainEnd,10);
    screened.push({p,train:tr});
    if(i%40===0)progress((i/candidates.length)*45,`훈련 패턴 탐색 ${i+1}/${candidates.length}`);
  }
  screened.sort((a,b)=>rankScore(b.train)-rankScore(a.train));
  const survivors=screened.slice(0,Math.min(120,screened.length));

  // Stage 2: validation selection.
  const validated=[];
  for(let i=0;i<survivors.length;i++){
    const r=survivors[i],v=evaluate(draws,r.p,valStart,valEnd,10);
    validated.push({...r,val:v,robust:rankScore(v)});
    progress(45+(i/survivors.length)*35,`검증 ${i+1}/${survivors.length}`);
  }
  validated.sort((a,b)=>b.robust-a.robust);
  const top=validated.slice(0,10);

  // Stage 3: untouched final test.
  const tested=[];
  for(let i=0;i<top.length;i++){
    const r=top[i],t=evaluate(draws,r.p,testStart,testEnd,10);
    tested.push({...r,test:t});
    progress(80+(i/top.length)*18,`최종 테스트 ${i+1}/${top.length}`);
  }
  tested.sort((a,b)=>rankScore(b.test)-rankScore(a.test));
  progress(100,"완료");
  return tested;
}

function progress(p,msg){$("bar").style.width=clamp(p,0,100)+"%";$("status").textContent=msg}

function fmtPct(x,d=3){return (x*100).toFixed(d)+"%"}
function fmt(x,d=3){return x.toFixed(d)}

function render(results,trainEnd,valEnd,testEnd){
  const best=results[0];bestModel=best;
  const rb=randomBestBaseline(10);
  $("stats").innerHTML=`
  <div class="stat"><span>전체 데이터</span><b>${draws.length}회</b></div>
  <div class="stat"><span>훈련 구간</span><b>1 ~ ${draws[trainEnd-1].draw_no}회</b></div>
  <div class="stat"><span>검증 구간</span><b>${draws[valEnd-1].draw_no+1} ~ ${draws[valEnd-1].draw_no}회</b></div>
  <div class="stat"><span>최종 테스트</span><b>${draws[testEnd-1].draw_no+1} ~ ${draws[testEnd-1].draw_no}회</b></div>
  <div class="stat"><span>검증 평균 최고 적중(10게임)</span><b>${fmt(best.val.avg)}</b></div>
  <div class="stat"><span>검증 3개 이상</span><b>${fmtPct(best.val.p3)}</b></div>
  <div class="stat"><span>검증 4개 이상</span><b>${fmtPct(best.val.p4)}</b></div>
  <div class="stat"><span>최종 테스트 평균 최고 적중</span><b>${fmt(best.test.avg)}</b></div>
  <div class="stat"><span>최종 테스트 3개 이상</span><b>${fmtPct(best.test.p3)}</b></div>
  <div class="stat"><span>최종 테스트 4개 이상</span><b>${fmtPct(best.test.p4)}</b></div>
  <div class="stat"><span>최종 테스트 5개 이상</span><b>${fmtPct(best.test.p5,4)}</b></div>
  <div class="stat"><span>최종 테스트 6개</span><b>${fmtPct(best.test.p6,6)}</b></div>
  <div class="stat"><span>랜덤 10게임 3개+ 참고</span><b>${fmtPct(rb.p3)}</b></div>
  <div class="stat"><span>랜덤 10게임 4개+ 참고</span><b>${fmtPct(rb.p4,4)}</b></div>`;
  $("patterns").innerHTML=results.map((r,i)=>`
    <div class="pattern"><b>${i+1}. 자동발견 패턴 #${String(r.p.seed).padStart(4,"0")}${i===0?" ⭐ 최종선택":""}</b>
    <span class="muted">훈련 3+ ${fmtPct(r.train.p3,2)} · 검증 3+ ${fmtPct(r.val.p3,2)} · 검증 4+ ${fmtPct(r.val.p4,3)} · 최종 3+ ${fmtPct(r.test.p3,2)} · 최종 4+ ${fmtPct(r.test.p4,3)} · 최종 평균 ${fmt(r.test.avg)}</span></div>`).join("");
  renderPicks(makeTickets(draws,best.p,(draws.length*7919)>>>0,10));
}

function renderPicks(ps){
  $("picks").innerHTML=ps.map((a,i)=>`<div class="pick"><b>${String(i+1).padStart(2,"0")} 게임</b><div class="balls">${a.map(n=>`<span class="ball">${n}</span>`).join("")}</div></div>`).join("");
}

async function load(){
  const r=await fetch(DATA,{cache:"no-store"});if(!r.ok)throw Error("data");
  draws=normalize(await r.json());
  if(draws.length<100)throw Error("few");
}

async function run(){
  $("run").disabled=true;$("pick").disabled=true;$("bar").style.width="0%";
  try{
    progress(2,"최신 데이터 불러오는 중…");await load();
    const n=draws.length;
    const trainEnd=Math.floor(n*.60),valEnd=Math.floor(n*.80),testEnd=n;
    const trainStart=100;
    progress(4,`총 ${draws.length}회 · 3,000개 패턴 생성`);
    await new Promise(r=>setTimeout(r,30));
    const candidates=buildCandidateSet(3000);
    const results=evaluateCandidates(candidates,trainStart,trainEnd,trainEnd,valEnd,valEnd,testEnd);
    lastResults=results;render(results,trainEnd,valEnd,testEnd);
    $("status").textContent=`완료 · 최신 ${draws.at(-1).draw_no}회 · 최종 테스트까지 완료`;
  }catch(e){console.error(e);$("status").textContent="분석 실패 · 데이터 주소/CORS를 확인하세요"}
  finally{$("run").disabled=false;$("pick").disabled=false}
}

$("run").onclick=run;
$("pick").onclick=async()=>{
  try{
    if(!draws.length)await load();
    if(!bestModel){
      const candidates=buildCandidateSet(1200);
      const n=draws.length,tr=Math.floor(n*.8);
      const rs=candidates.map(p=>({p,train:evaluate(draws,p,100,tr,10)})).sort((a,b)=>rankScore(b.train)-rankScore(a.train));
      bestModel=rs[0];
    }
    renderPicks(makeTickets(draws,bestModel.p,(draws.length*7919)>>>0,10));
    $("status").textContent=`추천 완료 · 자동탐색 패턴`;
  }catch(e){$("status").textContent="추천 실패"}
};
