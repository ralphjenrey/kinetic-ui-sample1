// Progressive, desktop-only easing. Touch, nested scrollers and reduced motion stay native.
const reduce=matchMedia('(prefers-reduced-motion:reduce)');
const desktop=matchMedia('(hover:hover) and (pointer:fine) and (min-width:861px)');
let frame=0,target=scrollY,previous=0;
const maxScroll=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
function stop(){cancelAnimationFrame(frame);frame=0;previous=0;target=scrollY}
function step(now){
 const dt=previous?Math.min(now-previous,50):16.67;previous=now;
 target=Math.max(0,Math.min(target,maxScroll()));
 const next=scrollY+(target-scrollY)*(1-Math.exp(-dt/110));
 window.scrollTo({top:Math.abs(target-next)<.5?target:next,behavior:'instant'});
 if(Math.abs(target-scrollY)>.5)frame=requestAnimationFrame(step);else{frame=0;previous=0}
}
function hasScroller(node){for(let el=node instanceof Element?node:null;el&&el!==document.body;el=el.parentElement){const style=getComputedStyle(el);if(/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1)return true}return false}
function wheel(e){
 if(reduce.matches||!desktop.matches||e.ctrlKey||e.metaKey||e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)||document.querySelector('dialog[open]')||hasScroller(e.target))return;
 const delta=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?innerHeight:1);
 if(!delta)return;e.preventDefault();if(!frame)target=scrollY;
 target=Math.max(0,Math.min(maxScroll(),target+delta));
 if(!frame)frame=requestAnimationFrame(step);
}
window.addEventListener('wheel',wheel,{passive:false});
window.addEventListener('pointerdown',stop,{passive:true});
window.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Tab'].includes(e.key))stop()});
window.addEventListener('resize',stop);window.addEventListener('hashchange',stop);
function preferences(){stop();document.documentElement.classList.toggle('eased-scroll',desktop.matches&&!reduce.matches)}
reduce.addEventListener('change',preferences);desktop.addEventListener('change',preferences);preferences();
const strip=document.querySelector('.brand-strip'),pause=document.querySelector('#strip-pause');
pause.addEventListener('click',()=>{const paused=pause.getAttribute('aria-pressed')!=='true';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'Resume':'Pause';strip.classList.toggle('paused',paused)});
// Reveal once; focus immediately exposes any section reached by keyboard.
const sections=[...document.querySelectorAll('.section-top,.brand-strip,.approach,.contact')];
let observer;
function reveals(){observer?.disconnect();sections.forEach(el=>el.classList.remove('motion-reveal','is-revealed'));if(reduce.matches||!('IntersectionObserver' in window))return;
 observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target)}}),{threshold:.08,rootMargin:'0px 0px -24px 0px'});
 sections.forEach(el=>{el.classList.add('motion-reveal');observer.observe(el)});
}
reduce.addEventListener('change',reveals);reveals();
document.addEventListener('focusin',e=>e.target.closest('.motion-reveal')?.classList.add('is-revealed'));

// Parallax uses the individual translate property so it composes with tile physics
// and reveal transforms rather than overwriting either animation.
let layers=[],parallaxFrame=0;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function collectLayers(){
 layers.forEach(({el})=>{el.style.removeProperty('--parallax-y');el.classList.remove('parallax-layer')});
 layers=[];if(reduce.matches||!desktop.matches)return;
 document.querySelectorAll('.sculpture .orbit').forEach((el,i)=>layers.push({el,anchor:document.querySelector('.hero'),speed:.1+i*.035,limit:125,hero:true}));
 document.querySelectorAll('.section-top h2,.approach h2,.contact h2').forEach((el,i)=>layers.push({el,anchor:el.closest('section'),speed:i===1?-.075:.09,limit:22}));
 document.querySelectorAll('.projects .project').forEach((el,i)=>layers.push({el,anchor:document.querySelector('#projects'),speed:[.075,-.065,.045,-.09][i%4],limit:20}));
 layers.forEach(({el})=>el.classList.add('parallax-layer'));queueParallax();
}
function updateParallax(){
 parallaxFrame=0;if(document.hidden||reduce.matches||!desktop.matches)return;
 const measurements=layers.map(layer=>{const rect=layer.anchor.getBoundingClientRect();const distance=layer.hero?-rect.top:innerHeight*.5-(rect.top+rect.height*.5);return {...layer,y:clamp(distance*layer.speed,-layer.limit,layer.limit)}});
 for(const {el,y} of measurements)el.style.setProperty('--parallax-y',y.toFixed(2)+'px');
}
function queueParallax(){if(!parallaxFrame&&!document.hidden)parallaxFrame=requestAnimationFrame(updateParallax)}
window.addEventListener('scroll',queueParallax,{passive:true});
window.addEventListener('resize',queueParallax,{passive:true});
reduce.addEventListener('change',collectLayers);desktop.addEventListener('change',collectLayers);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(parallaxFrame);parallaxFrame=0}else queueParallax()});
new MutationObserver(collectLayers).observe(document.querySelector('#projects'),{childList:true});
new ResizeObserver(queueParallax).observe(document.querySelector('main'));
collectLayers();
