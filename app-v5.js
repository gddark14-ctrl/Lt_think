const DATA_URLS=[
  "https://raw.githubusercontent.com/papaya5rhw1984/lotto-data/main/all.json",
  "https://smok95.github.io/lotto/results/all.json"
];
let draws=[], best=null;
const $=id=>document.getElementById(id);
const pct=x=>(x*100).toFixed(3)+"%";
const f3=x=>x.toFixed(3);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function norm(a){return a.map(d=>({draw_no:+d.draw_no,numbers:(d.numbers||[]).map(Number).filter(n=>n>=1&&n<=45).sort((a,b)=>a-b)})).filter(d=>d.numbers.length===6).sort((a,b)=>a.draw_no-b.draw_no)}
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function freq(hist,w){let c=Array(46).fill(0),s=Math.max(0,hist.length-w);for(let i=s;i<hist.length;i++)for(const n of hist[i].numbers)c[n]++;return c}
function gap(hist,n){for(let i=hist.length-1,g=1;i>=0;i--,g++)if(hist[i].numbers.includes(n))return g;return hist.length+1}
function overlap(a,b){let c=0;for(const n of a)if(b.includes(n))c++;return c}
function sum(a){return a.reduce((x,y)=>x+y,0)}
function consec(a){let c=0;for(let i=1;i<a.length;i++)if(a[i]===a[i-1]+1)c++;return c}

function makePattern(r){
  const ws=[5,10,20,30,50,75,100],w1=ws[Math.floor(r()*ws.length)],w2=ws[Math.floor(r()*ws.length)],w3=ws[Math.floor(r()*ws.length)];
  return {
    a:w1,b:w2,c:w3,
    wa:.15+r()*1.4,wb:.15+r()*1.4,wc:.15+r()*1.4,
    gap:(r()-.5)*.7, recent:(r()-.5)*.7, parity:(r()-.5)*.5,
    sumW:(r()-.5)*.35, consecW:(r()-.5)*.3,
    targetSum:105+r()*130,targetEven:1+r()*5,targetConsec:r()*3,
    seed:(r()*4294967295)>>>0
  }
}

function numberScores(hist,p){
  const A=freq(hist,p.a),B=freq(hist,p.b),C=freq(hist,p.c);
  const mxA=Math.max(1,...A.slice(1)),mxB=Math.max(1,...B.slice(1)),mxC=Math.max(1,...C.slice(1));
  const last=hist.length?hist[hist.length-1].numbers:[], prev=hist.length>1?hist[hist.length-2].numbers:[];
  const s=Array(46).fill(0);
  for(let n=1;n<=45;n++){
    let z=p.wa*A[n]/mxA+p.wb*B[n]/mxB+p.wc*C[n]/mxC;
    z+=p.gap*clamp(gap(hist,n),1,30)/30;
    if(last.includes(n))z+=p.recent;
    if(prev.includes(n))z+=p.recent*.5;
    z+=p.parity*((n%2===0?1:-1)*(p.targetEven-3)/2);
    z+=p.sumW*(n/45);
    s[n]=z;
  }
  return s;
}
function ticket(hist,p,seed,loose=false){
  const s=numberScores(hist,p),r=rng(seed),rank=Array.from({length:45},(_,i)=>i+1).sort((a,b)=>s[b]-s[a]);
  const pool=rank.slice(0,loose?30:24),a=[];
  while(a.length<6){
    const n=pool[Math.floor(r()*pool.length)];
    if(!a.includes(n))a.push(n);
    if(a.length===4 && !loose){
      // diversify last two numbers
      while(a.length<6){const n=1+Math.floor(r()*45);if(!a.includes(n))a.push(n)}
    }
  }
  a.sort((x,y)=>x-y);return a;
}
function tickets(hist,p,seed,K=10){
  const out=[],r=rng(seed);
  for(let k=0;k<K;k++)out.push(ticket(hist,p,(seed+k*0x9e3779b9)>>>0));
  return out;
}

function proxyPatternScore(p,start,end){
  let hit3=0,hit4=0,avg=0,n=0;
  const span=end-start, step=Math.max(1,Math.floor(span/40));
  for(let i=start;i<end;i+=step){
    const t=ticket(draws.slice(0,i),p,(p.seed+i)>>>0);
    const h=overlap(t,draws[i].numbers);avg+=h;n++;
    if(h>=3)hit3++;if(h>=4)hit4++;
  }
  return .50*(hit4/n)+.30*(hit3/n)+.20*(avg/6);
}
function fullEval(p,start,end,K=10){
  let bsum=0,c3=0,c4=0,c5=0,c6=0,n=0;
  for(let i=start;i<end;i++){
    const ts=tickets(draws.slice(0,i),p,(p.seed^((i+1)*2654435761))>>>0,K);
    let b=0;for(const t of ts)b=Math.max(b,overlap(t,draws[i].numbers));
    bsum+=b;n++;if(b>=3)c3++;if(b>=4)c4++;if(b>=5)c5++;if(b===6)c6++;
  }
  return {n,avg:bsum/n,p3:c3/n,p4:c4/n,p5:c5/n,p6:c6/n};
}
function score(e){return .55*e.p4+.25*e.p3+.20*(e.avg/6)}
function random10(){
  const p3=0.023834102,p4=0.00139348,p5=0.000028729,p6=0.00000012277;
  return {p3:1-Math.pow(1-p3,10),p4:1-Math.pow(1-p4,10),p5:1-Math.pow(1-p5,10),p6:1-Math.pow(1-p6,10)};
}
function prog(x,s){$("bar").style.width=clamp(x,0,100)+"%";$("status").textContent=s}

function render(results,tr,va,te){
  best=results[0];const rb=random10();
  $("stats").innerHTML=`
  <div class=stat><span>전체 데이터</span><b>${draws.length}회</b></div>
  <div class=stat><span>훈련</span><b>1 ~ ${draws[tr-1].draw_no}회</b></div>
  <div class=stat><span>검증</span><b>${draws[tr].draw_no} ~ ${draws[va-1].draw_no}회</b></div>
  <div class=stat><span>최종 테스트</span><b>${draws[va].draw_no} ~ ${draws[te-1].draw_no}회</b></div>
  <div class=stat><span>검증 평균 최고 적중(10게임)</span><b>${f3(best.val.avg)}</b></div>
  <div class=stat><span>검증 3개+</span><b>${pct(best.val.p3)}</b></div>
  <div class=stat><span>검증 4개+</span><b>${pct(best.val.p4)}</b></div>
  <div class=stat><span>⭐ 최종 테스트 평균 최고 적중</span><b>${f3(best.test.avg)}</b></div>
  <div class=stat><span>⭐ 최종 테스트 3개+</span><b>${pct(best.test.p3)}</b></div>
  <div class=stat><span>⭐ 최종 테스트 4개+</span><b>${pct(best.test.p4)}</b></div>
  <div class=stat><span>⭐ 최종 테스트 5개+</span><b>${pct(best.test.p5)}</b></div>
  <div class=stat><span>⭐ 최종 테스트 6개</span><b>${pct(best.test.p6,6)}</b></div>
  <div class=stat><span>랜덤 10게임 3개+ 참고</span><b>${pct(rb.p3)}</b></div>
  <div class=stat><span>랜덤 10게임 4개+ 참고</span><b>${pct(rb.p4)}</b></div>`;
  $("patterns").innerHTML=results.map((r,i)=>`<div class=pattern><b>${i+1}. 패턴 #${r.p.seed}${i===0?" ⭐ 최종선택":""}</b><span class=muted>훈련 proxy ${pct(r.proxy3)} · 검증 3+ ${pct(r.val.p3)} · 검증 4+ ${pct(r.val.p4)} · 최종 3+ ${pct(r.test.p3)} · 최종 4+ ${pct(r.test.p4)} · 최종 평균 ${f3(r.test.avg)}</span></div>`).join("");
  renderPicks(tickets(draws,best.p,(draws.length*7919)>>>0,10));
}
function renderPicks(ts){$("picks").innerHTML=ts.map((a,i)=>`<div class=pick><b>${String(i+1).padStart(2,"0")} 게임</b><div class=balls>${a.map(n=>`<span class=ball>${n}</span>`).join("")}</div></div>`).join("")}

async function run(){
  $("run").disabled=true;$("pick").disabled=true;
  try{
    prog(2,"최신 1~현재 데이터 불러오는 중…");
    let raw=null,lastErr=null;
    for(const url of DATA_URLS){
      try{
        prog(2,`데이터 연결 중… ${url.includes("raw.githubusercontent")?"대체 데이터 서버":"기본 데이터 서버"}`);
        const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),8000);
        const rr=await fetch(url,{cache:"no-store",signal:ctrl.signal});
        clearTimeout(timer);
        if(!rr.ok)throw Error("HTTP "+rr.status);
        raw=await rr.json(); break;
      }catch(e){lastErr=e}
    }
    if(!raw)throw lastErr||Error("data");
    draws=norm(raw);
    if(draws.length<300)throw Error("few data");
    const n=draws.length,tr=Math.floor(n*.60),va=Math.floor(n*.80),te=n,start=100;
    const r=rng(0x20260912),cand=[];
    prog(4,"10만 패턴 생성 중… (v5)");
    for(let i=0;i<100000;i+=2000){
      for(let j=i;j<Math.min(i+2000,100000);j++)cand.push(makePattern(r));
      await new Promise(requestAnimationFrame);
      prog(5+8*(i/100000),`10만 패턴 생성 ${Math.min(i+2000,100000).toLocaleString()}/100,000`);
    }
    const screen=[];
    for(let i=0;i<cand.length;i+=250){
      const end=Math.min(i+250,cand.length);
      for(let j=i;j<end;j++){
        const p=cand[j],q=proxyPatternScore(p,start,tr);
        screen.push({p,q});
      }
      await new Promise(requestAnimationFrame);
      prog(13+27*(end/cand.length),`10만 패턴 1차 탐색 ${end.toLocaleString()}/100,000`);
    }
    screen.sort((a,b)=>b.q-a.q);
    const survivors=screen.slice(0,200);
    const vals=[];
    for(let i=0;i<survivors.length;i++){
      const x=survivors[i],v=fullEval(x.p,tr,va,10);
      vals.push({p:x.p,q:x.q,val:v});
      if(i%5===0)prog(40+25*i/survivors.length,`검증 ${i+1}/200`);
    }
    vals.sort((a,b)=>score(b.val)-score(a.val));
    const finalists=vals.slice(0,20),tests=[];
    for(let i=0;i<finalists.length;i++){
      const x=finalists[i],t=fullEval(x.p,va,te,10);
      tests.push({...x,test:t});
      prog(65+30*i/finalists.length,`최종 테스트 ${i+1}/20`);
    }
    tests.sort((a,b)=>score(b.test)-score(a.test));
    render(tests,tr,va,te);prog(100,`완료 · ${draws.at(-1).draw_no}회까지 최종 테스트 완료`);
  }catch(e){console.error(e);$("status").textContent="분석 실패: 데이터 연결을 확인하세요"}
  finally{$("run").disabled=false;$("pick").disabled=false}
}
$("run").onclick=run;
$("pick").onclick=async()=>{if(!draws.length){const r=await fetch(DATA,{cache:"no-store"});draws=norm(await r.json())}if(!best){$("status").textContent="먼저 전체 탐색을 실행하세요";return}renderPicks(tickets(draws,best.p,(draws.length*12345)>>>0,10));$("status").textContent="최종 선택 패턴으로 10게임 생성 완료"};
