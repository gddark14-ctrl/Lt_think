const URL="https://smok95.github.io/lotto/results/all.json";
let draws=[];
const $=x=>document.getElementById(x);

function countFreq(h,w){let c=Array(46).fill(0);h.slice(-w).forEach(d=>d.numbers.forEach(n=>c[n]++));return c}
function lastGap(h,n){for(let i=h.length-1,g=1;i>=0;i--,g++)if(h[i].numbers.includes(n))return g;return h.length+1}
function pairFreq(h,n,m,w=100){let x=0;for(const d of h.slice(-w))if(d.numbers.includes(n)&&d.numbers.includes(m))x++;return x}
function makeScore(h){
 let a=countFreq(h,10),b=countFreq(h,20),c=countFreq(h,50),d=countFreq(h,h.length);
 let s=Array(46).fill(0);
 for(let n=1;n<=45;n++){
  let gap=Math.min(lastGap(h,n),20)/20;
  s[n]=.32*a[n]+.30*b[n]+.15*c[n]+.08*d[n]+.15*gap;
 }
 return s;
}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function candidate(h,seed){
 const r=rng(seed),s=makeScore(h), rank=[...Array(45)].map((_,i)=>i+1).sort((x,y)=>s[y]-s[x]);
 let pool=rank.slice(0,24), out=[];
 for(let t=0;t<10;t++){
  let p=pool.slice(), a=[];
  while(a.length<4){let i=Math.floor(r()*p.length);a.push(p.splice(i,1)[0])}
  while(a.length<6){let n=1+Math.floor(r()*45);if(!a.includes(n))a.push(n)}
  a.sort((x,y)=>x-y);out.push({nums:a,score:a.reduce((q,n)=>q+s[n],0)});
 }
 return out.sort((x,y)=>y.score-x.score);
}
function renderPicks(ps){$("picks").innerHTML='<div class="picks">'+ps.map((p,i)=>`<div class="pick"><b>${String(i+1).padStart(2,"0")} 게임</b><div class="balls">${p.nums.map(n=>`<span class="ball">${n}</span>`).join("")}</div><div class="score">AI 점수 ${p.score.toFixed(2)}</div></div>`).join("")+'</div>'}
function hit(p,a){return p.filter(x=>a.includes(x)).length}
function backtest(){
 let start=Math.min(100,draws.length-1), best=[], dist=Array(7).fill(0);
 for(let i=start;i<draws.length;i++){
  let ps=candidate(draws.slice(0,i),10000+i).slice(0,10);
  let h=Math.max(...ps.map(p=>hit(p.nums,draws[i].numbers)));
  best.push(h);dist[h]++;
 }
 let n=best.length,avg=best.reduce((a,b)=>a+b,0)/n;
 $("stats").innerHTML=`<div class="stat"><span>검증 회차</span><b>${n}</b></div><div class="stat"><span>10게임 최고 적중 평균</span><b>${avg.toFixed(3)}개</b></div>`+
 [3,4,5,6].map(k=>`<div class="stat"><span>${k}개 이상</span><b>${(100*best.filter(x=>x>=k).length/n).toFixed(3)}%</b></div>`).join("")+
 `<div class="stat"><span>6개 적중 회차</span><b>${dist[6]}</b></div>`;
 $("patterns").innerHTML=[
 ["단기 빈도","최근 10회 출현 빈도 32%"],
 ["중기 빈도","최근 20회 출현 빈도 30%"],
 ["장기 빈도","최근 50회 + 전체 빈도 23%"],
 ["출현 간격","최근 미출현 간격을 최대 20회까지만 15% 반영"],
 ["미래 누수 차단","각 예측은 목표 회차 이전 데이터만 사용"]
 ].map(x=>`<div class="pattern"><b>${x[0]}</b><span class="muted">${x[1]}</span></div>`).join("");
}
async function load(){
 $("status").textContent="로또 데이터 불러오는 중…";
 try{
  const res=await fetch(URL,{cache:"no-store"}); if(!res.ok)throw Error("HTTP "+res.status);
  draws=await res.json();draws.sort((a,b)=>a.draw_no-b.draw_no);
  $("status").textContent=`${draws.length}개 회차 로드 완료 · 최신 ${draws.at(-1).draw_no}회`;
 }catch(e){$("status").textContent="데이터 로드 실패: 인터넷 연결을 확인하세요."}
}
$("refresh").onclick=load;
$("analyze").onclick=async()=>{if(!draws.length)await load();if(draws.length){$("status").textContent="백테스트 실행 중…";setTimeout(()=>{backtest();renderPicks(candidate(draws,draws.length*7919).slice(0,10));$("status").textContent="분석 완료";},30)}};
load();