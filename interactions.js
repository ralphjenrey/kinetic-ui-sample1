/* Elron-style interactions, reimplemented in framework-agnostic JS.
   1) seededLayout(): non-overlapping scattered tiles
   2) startFloatingPhysics(): idle drift + pointer repulsion + spring
   3) startCustomCursor(): dot + morphing ring
   Use only on (hover:hover) and (pointer:fine) and when motion is allowed. */

/* ---------- seeded RNG ---------- */
export function hashString(s){let t=1779033703^s.length;for(let i=0;i<s.length;i++){t=Math.imul(t^s.charCodeAt(i),3432918353);t=(t<<13)|(t>>>19)}return t>>>0}
export function mulberry32(seed){let t=seed;return function(){t|=0;t=(t+1831565813)|0;let e=Math.imul(t^(t>>>15),1|t);e=(e+Math.imul(e^(e>>>7),61|e))^e;return((e^(e>>>14))>>>0)/4294967296}}

export const MATCH_FANCY = '(hover: hover) and (pointer: fine)';
export const canUseFancy = () =>
  matchMedia(MATCH_FANCY).matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- layout ---------- */
/* items: [{id, aspect, minWidth, maxWidth}]
   opts: {width,height,padding=24,minGap=22,seed,iterations=220,exclusions=[{x,y,width,height}]} */
export function seededLayout(items, opts){
  const {width:W,height:H,padding:P=24,minGap=22,seed,iterations=220,exclusions=[]}=opts;
  const rand=mulberry32(seed);
  const x0=P,y0=P,x1=Math.max(P,W-P),y1=Math.max(P,H-P),aw=Math.max(1,x1-x0),ah=Math.max(1,y1-y0);
  const n=items.length,ratio=aw/ah;
  let cols=Math.max(1,Math.round(Math.sqrt(Math.max(1,n)*ratio))),rows=Math.max(1,Math.ceil(n/cols));
  while(cols*rows<n)cols++;
  const cw=aw/cols,ch=ah/rows,jx=cw*.3,jy=ch*.3;
  const cells=Array.from({length:cols*rows},(_,i)=>i);
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]]}
  const rects=items.map((it,i)=>{
    const w=Math.min(it.minWidth+rand()*(it.maxWidth-it.minWidth),aw),h=w*it.aspect;
    const c=cells[i],col=c%cols,row=Math.floor(c/cols),cx=x0+col*cw,cy=y0+row*ch;
    const lx=Math.max(x0,cx-jx),hx=Math.min(x1-w,cx+cw+jx-w),ly=Math.max(y0,cy-jy),hy=Math.min(y1-h,cy+ch+jy-h);
    return {id:it.id,x:hx>lx?lx+rand()*(hx-lx):lx,y:hy>ly?ly+rand()*(hy-ly):ly,width:w,height:h};
  });
  const clamp=r=>{r.x=Math.min(Math.max(r.x,x0),Math.max(x0,x1-r.width));r.y=Math.min(Math.max(r.y,y0),Math.max(y0,y1-r.height))};
  const overlapAxis=(a,b,gap)=>{
    const ax=a.x+a.width/2,ay=a.y+a.height/2,bx=b.x+b.width/2,by=b.y+b.height/2;
    const ox=(a.width+b.width)/2+gap-Math.abs(ax-bx),oy=(a.height+b.height)/2+gap-Math.abs(ay-by);
    if(ox<=0||oy<=0)return null;
    if(ox<oy){let s=Math.sign(ax-bx)||(rand()<.5?-1:1);return[ox/2*s,0]}
    let s=Math.sign(ay-by)||(rand()<.5?-1:1);return[0,oy/2*s];
  };
  for(let it=0;it<iterations;it++){
    for(const r of rects)for(const ex of exclusions){ // push out of reserved bands (e.g. under the nav)
      const ax=r.x+r.width/2,ay=r.y+r.height/2,bx=ex.x+ex.width/2,by=ex.y+ex.height/2;
      const ox=(r.width+ex.width)/2-Math.abs(ax-bx),oy=(r.height+ex.height)/2-Math.abs(ay-by);
      if(ox>0&&oy>0){ if(ox<oy)r.x+=ox*(ax>=bx?1:-1); else r.y+=oy*(ay>=by?1:-1); clamp(r); }
    }
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const d=overlapAxis(rects[i],rects[j],minGap); if(!d)continue;
      rects[i].x+=d[0];rects[i].y+=d[1];rects[j].x-=d[0];rects[j].y-=d[1];clamp(rects[i]);clamp(rects[j]);
    }
  }
  return rects.map(r=>({...r,phaseX:rand()*Math.PI*2,phaseY:rand()*Math.PI*2,speed:.35+rand()*.5,ampX:5+rand()*5,ampY:5+rand()*7}));
}

/* ---------- physics ---------- */
const RADIUS=135,PUSH=16,SPRING=.1,DAMPING=.78;
/* tiles: [{el, x,y,width,height, phaseX,phaseY,speed,ampX,ampY, id}]  container: positioned parent
   getHoveredId: () => id|null.  Returns stop(). */
export function startFloatingPhysics(container, tiles, getHoveredId){
  const pointer={x:0,y:0,active:false}, vel=new Map();
  const move=e=>{const r=container.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;pointer.active=true};
  const leave=()=>{pointer.active=false};
  container.addEventListener('pointermove',move);container.addEventListener('pointerleave',leave);
  let raf=0,running=true;
  const frame=ms=>{
    if(!running)return; const t=ms/1000, hovered=getHoveredId();
    for(const tile of tiles){
      const isHover=tile.id===hovered; let tx=0,ty=0,prox=isHover?1:0;
      if(!isHover){
        tx=Math.sin(t*tile.speed+tile.phaseX)*tile.ampX; ty=Math.cos(t*tile.speed*.9+tile.phaseY)*tile.ampY;
        if(pointer.active){
          const cx=tile.x+tile.width/2+tx,cy=tile.y+tile.height/2+ty,dx=cx-pointer.x,dy=cy-pointer.y,d=Math.hypot(dx,dy)||1;
          if(d<RADIUS){const k=1-d/RADIUS;prox=k;tx+=dx/d*k*PUSH;ty+=dy/d*k*PUSH}
        }
      }
      let s=vel.get(tile.id); if(!s){s={x:tx,y:ty,vx:0,vy:0};vel.set(tile.id,s)}
      s.vx=(s.vx+(tx-s.x)*SPRING)*DAMPING; s.vy=(s.vy+(ty-s.y)*SPRING)*DAMPING; s.x+=s.vx; s.y+=s.vy;
      tile.el.style.transform=`translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
      tile.el.style.setProperty('--proximity',prox.toFixed(2));
    }
    raf=requestAnimationFrame(frame);
  };
  const vis=()=>{ if(document.hidden){running=false;cancelAnimationFrame(raf)} else if(!running){running=true;raf=requestAnimationFrame(frame)} };
  document.addEventListener('visibilitychange',vis); raf=requestAnimationFrame(frame);
  return ()=>{running=false;cancelAnimationFrame(raf);container.removeEventListener('pointermove',move);container.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',vis)};
}

/* Hover-card placement beside a tile */
export function hoverCardPlacement(tile, containerWidth, containerHeight, cardHeight=90, gap=35){
  const side = containerWidth-(tile.x+tile.width)>255 ? 'right' : 'left';
  return { align:side, left: side==='right' ? tile.x+tile.width+gap : tile.x-gap,
           top: Math.min(Math.max(tile.y,0), Math.max(containerHeight-cardHeight,0)) };
}

/* ---------- custom cursor ---------- */
/* Markup: <div class="custom-cursor__dot"></div><div class="custom-cursor__ring"><span class="custom-cursor__label"></span></div>
   Put data-cursor="view|close|default|circle" on elements to pick a state. */
export function startCustomCursor(dot, ring, label){
  if(!canUseFancy())return ()=>{};
  const SIZES={default:[40,40],view:[76,76],close:[52,52],circle:[40,40]};
  const INTERACTIVE='a, button, [role="button"], input, select, textarea, label';
  const p={x:innerWidth/2,y:innerHeight/2},d={...p};
  let state='default',target=null;
  const r={x:p.x-20,y:p.y-20,w:40,h:40,rad:20},v={x:0,y:0,w:0,h:0};
  document.body.classList.add('custom-cursor-active');
  const move=e=>{
    p.x=e.clientX;p.y=e.clientY;dot.classList.add('is-visible');ring.classList.add('is-visible');
    const t=e.target,tagged=t.closest('[data-cursor]');let next='default',rect=null;
    if(tagged)next=tagged.dataset.cursor||'default';
    else{const i=t.closest(INTERACTIVE);if(i){next='interactive';rect=i.getBoundingClientRect()}}
    target=rect; if(next!==state){state=next;ring.className=`custom-cursor__ring is-visible state-${next}`;label.textContent=next==='view'?'View':next==='close'?'Close':''}
  };
  const out=()=>{dot.classList.remove('is-visible');ring.classList.remove('is-visible')};
  document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',out);
  const down=()=>ring.classList.add('is-pressed'),up=()=>ring.classList.remove('is-pressed');document.addEventListener('pointerdown',down);document.addEventListener('pointerup',up);
  let raf,running=true;const K=.16,DAMP=.72;
  const tick=()=>{
    if(!running)return;
    d.x+=(p.x-d.x)*.6;d.y+=(p.y-d.y)*.6;
    let w,h,x,y,rad;
    if(state==='interactive'&&target){w=target.width+20;h=target.height+20;x=target.left-10;y=target.top-10;rad=Math.abs(target.width-target.height)<14?Math.min(w,h)/2:12}
    else{[w,h]=SIZES[state==='interactive'?'default':state]||SIZES.default;x=p.x-w/2;y=p.y-h/2;rad=w/2}
    v.x=(v.x+(x-r.x)*K)*DAMP;v.y=(v.y+(y-r.y)*K)*DAMP;v.w=(v.w+(w-r.w)*K)*DAMP;v.h=(v.h+(h-r.h)*K)*DAMP;
    r.x+=v.x;r.y+=v.y;r.w+=v.w;r.h+=v.h;r.rad+=(rad-r.rad)*.2;
    dot.style.transform=`translate3d(${d.x.toFixed(1)}px,${d.y.toFixed(1)}px,0) translate(-50%,-50%)`;
    Object.assign(ring.style,{left:r.x+'px',top:r.y+'px',width:Math.max(r.w,0)+'px',height:Math.max(r.h,0)+'px',borderRadius:Math.max(r.rad,0)+'px'});
    raf=requestAnimationFrame(tick);
  };
  const vis=()=>{if(document.hidden){running=false;cancelAnimationFrame(raf)}else if(!running){running=true;raf=requestAnimationFrame(tick)}};document.addEventListener('visibilitychange',vis);raf=requestAnimationFrame(tick);
  return ()=>{running=false;document.removeEventListener('visibilitychange',vis);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',up);dot.classList.remove('is-visible');ring.classList.remove('is-visible');cancelAnimationFrame(raf);document.body.classList.remove('custom-cursor-active');document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',out)};
}

/* ---------- filter fade-swap (280ms) ---------- */
export function createFilterSwap(stageEl, render, delay=280){
  let timer=0,frame=0;
  return function swap(next){
    clearTimeout(timer);cancelAnimationFrame(frame);
    stageEl.classList.add('is-hidden');stageEl.setAttribute('inert','');stageEl.setAttribute('aria-hidden','true');
    timer=setTimeout(()=>{render(next);frame=requestAnimationFrame(()=>{
      stageEl.classList.remove('is-hidden');stageEl.removeAttribute('inert');stageEl.removeAttribute('aria-hidden')})},delay);
  };
}
/* CSS: .stage{opacity:1;transition:opacity .28s} .stage.is-hidden{opacity:0;pointer-events:none} */
