// White brush marks + difference compositing invert the live page underneath.
export function startPaintBrush(){
 if(!matchMedia('(hover:hover) and (pointer:fine) and (min-width:861px)').matches||matchMedia('(prefers-reduced-motion:reduce)').matches)return ()=>{};
 const canvas=document.createElement('canvas');canvas.className='paint-trail';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return ()=>{}}
 let points=[],raf=0,last=null,tip=null,target=null,lastFrame=0,visible=false,w=innerWidth,h=innerHeight;
 const lifetime=1500,hold=450;
 let pageX=window.scrollX,pageY=window.scrollY;
 function size(){w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);clear()}
 function clear(){points=[];last=null;tip=null;target=null;lastFrame=0;ctx.clearRect(0,0,w,h)}
 function frame(now){
  raf=0;
  const dt=lastFrame?Math.min(now-lastFrame,40):16.67;lastFrame=now;
  let chasing=false;
  if(visible&&tip&&target){
   const ax=tip.x,ay=tip.y;
   // Time-based easing keeps a soft delay at both 60 Hz and high refresh rates.
   const follow=1-Math.exp(-dt/115);
   tip.x+=(target.x-tip.x)*follow;tip.y+=(target.y-tip.y)*follow;
   const distance=Math.hypot(tip.x-ax,tip.y-ay);
   chasing=Math.hypot(target.x-tip.x,target.y-tip.y)>.08;
   if(distance>.05){const width=Math.max(16,Math.min(36,34-distance/dt*6));points.push({ax,ay,x:tip.x,y:tip.y,t:now,width});if(points.length>650)points.splice(0,points.length-650)}
  }
  ctx.clearRect(0,0,w,h);points=points.filter(p=>now-p.t<lifetime);
  ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
  // Render the oldest marks first. Fresh strokes fully invert; their tails fade out.
  for(const p of points){const age=now-p.t;ctx.globalAlpha=age<=hold?1:Math.pow(1-(age-hold)/(lifetime-hold),1.6);ctx.lineWidth=p.width;ctx.beginPath();ctx.moveTo(p.ax,p.ay);ctx.lineTo(p.x,p.y);ctx.stroke();
   // Fine parallel bristles keep the outline from looking like a perfectly smooth tube.
   ctx.lineWidth=1.2;for(const offset of [-.58,-.52,.52,.58]){ctx.beginPath();ctx.moveTo(p.ax+offset*p.width,p.ay-1);ctx.lineTo(p.x+offset*p.width,p.y-1);ctx.stroke()}
  }
  if(visible&&tip){ctx.globalAlpha=1;ctx.beginPath();ctx.ellipse(tip.x,tip.y,4,9,-.45,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;if(points.length||chasing)raf=requestAnimationFrame(frame);else lastFrame=0;
 }
 function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame)}
 function move(e){
  if(e.pointerType!=='mouse')return;
  target={x:e.clientX,y:e.clientY};
  if(!tip)tip={...target};
  visible=true;document.body.classList.add('paint-brush-active');schedule();
 }
 function leave(){visible=false;last=null;tip=null;target=null;document.body.classList.remove('paint-brush-active');schedule()}
 // Move existing paint with the document, then ease the brush back toward the
 // stationary screen-space pointer. Scrolling alone therefore draws new marks.
 function scroll(){
  const dx=window.scrollX-pageX,dy=window.scrollY-pageY;
  pageX=window.scrollX;pageY=window.scrollY;
  if(!dx&&!dy)return;
  for(const p of points){p.ax-=dx;p.x-=dx;p.ay-=dy;p.y-=dy}
  if(tip){tip.x-=dx;tip.y-=dy}
  schedule();
 }
 function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;leave();clear()}}
 document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);window.addEventListener('blur',leave);window.addEventListener('resize',size);window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('visibilitychange',visibility);size();
 return ()=>{cancelAnimationFrame(raf);document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave);window.removeEventListener('resize',size);window.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',visibility);document.body.classList.remove('paint-brush-active');canvas.remove()};
}
