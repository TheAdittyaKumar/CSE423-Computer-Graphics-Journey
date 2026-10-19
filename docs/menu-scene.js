/* Faithful illustration and flashlight interaction recreated from the source Python
 * drawRescueSceneBackground() and drawMenuSearchlight() in portable Canvas2D.
 * This runs independently of WebGL, so the menu always remains interactive.
 */
(() => {
 'use strict';
 const menu=document.querySelector('#menu'), canvas=document.querySelector('#menu-scene');
 if(!menu||!canvas)return;
 const ctx=canvas.getContext('2d'); let hover='START', exitPulse=0, clickFlash=0, last=0;
 const $$=id=>document.getElementById(id);
 function color(rgb,a=1){return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;}
 function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
 function poly(points,fill,stroke=null,width=1){ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
 function line(points,stroke,width=2){ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
 function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
 function ring(x,y,rx,ry,stroke,width=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
 function draw(t){
   // Extend the scene beyond its original 1000px artboard so widescreen
   // layouts do not have visible vertical seams at the sides.
   const g=ctx.createLinearGradient(0,0,0,800);g.addColorStop(0,'#112636');g.addColorStop(.56,'#0c2935');g.addColorStop(1,'#062f3c');ctx.fillStyle=g;ctx.fillRect(-800,0,2600,800);
   // The flooded Dhaka skyline from the Python source.
   for(let i=-12;i<26;i++){let x=i*84-40,h=110+(((i*57)%210)+210)%210;
     rect(x,560-h,74,h,i%2?'#17313b':'#1b3942');
     for(let row=0;row<Math.floor(h/37);row++)for(let col=0;col<3;col++)if((i*7+row*5+col*3)%6===0)rect(x+11+col*18,570-h+row*36,10,12,'#797356');
   }
   rect(-800,520,2600,280,'#073846');rect(-800,520,2600,32,'#164853');
   for(let i=0;i<230;i++){let x=(i*137+29)%2600-800,y=555+(i*47+Math.floor(t*9))%244;line([[x,y],[x+14+i%5*8,y]],'#598e9680',.8);}
   // The illuminated BRAC University island / sanctuary.
   const sunshine=ctx.createLinearGradient(570,170,570,500);sunshine.addColorStop(0,'#f9e9bd00');sunshine.addColorStop(1,'#f9df8b45');poly([[440,110],[690,110],[710,532],[410,532]],sunshine);
   ellipse(556,438,158,197,'#f2d79113');ring(557,535,152,33,'#dfb461b0',3);
   rect(449,289,65,229,'#bbb7a7');rect(514,289,145,65,'#bdb7a6');rect(614,355,46,154,'#a8ae9e');
   rect(532,360,78,140,'#284a4a');rect(545,383,54,95,'#255f45');rect(612,345,18,147,'#256449');
   for(let col=0;col<4;col++)for(let row=0;row<6;row++){let x=455+col*14,y=490-row*30;rect(x,y,9,21,'#182f48');if(row%2===0)line([[x,y+9],[x+9,y+9]],'#64858d',1);}
   for(let col=0;col<10;col++)rect(520+col*13,294,9,42,'#24394c');
   poly([[433,288],[660,288],[675,272],[445,272]],'#142f3e');rect(500,508,110,17,'#7a8e7f');
   ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#ebedca';ctx.fillText('BRAC UNIVERSITY',555,520);
   ctx.font='bold 14px system-ui';ctx.fillStyle='#efd98b';ctx.fillText('ONLY HERE, THE RAIN STOPS',555,246);
   // SOS swimmer; the arm waves while the head bobs among ripple rings.
   const sway=Math.sin(t*3.8)*6,bob=Math.sin(t*3.8)*5;
   for(let i=0;i<3;i++)ring(522,614,24+i*13+6*Math.sin(t*1.8+i),8+i*3,`rgba(130,215,223,${.46-i*.1})`);
   rect(510,600,24,15+bob,'#d65341');ellipse(522,579-bob,15,15,'#dcb18a');ellipse(519,570-bob,10,5,'#263038');
   line([[532,603-bob],[543,578-bob],[537,554-bob]],'#deb694',8);ellipse(537,554-bob,5,5,'#ebc49b');
   // Sampan rower and flashlight, following Python's original 2D illustration.
   const rock=Math.sin(t*1.9)*3,by=607-rock;
   poly([[194,by-18],[427,by-18],[451,by-43],[203,by-47]],'#8c4c29');
   poly([[203,by-28],[436,by-28],[418,by+6],[230,by+6]],'#126d73');
   poly([[220,by-26],[433,by-26],[413,by-14],[235,by-12]],'#30999a');
   line([[216,by-46],[432,by-43]],'#efb855',5);
   poly([[311,by-47],[351,by-47],[345,by-94],[318,by-94]],'#ec9654');
   ellipse(334,by-109,18,18,'#db9d6b');poly([[312,by-122],[325,by-141],[345,by-140],[354,by-122]],'#152a30');
   line([[319,by-78],[297,by-67]],'#e6aa7d',8);ellipse(295,by-66,5,5,'#f1be8c');
   line([[344,by-83],[372,by-72]],'#e6aa7d',10);ellipse(374,by-71,5,5,'#f1be8c');
   line([[374,by-71],[392,by-67],[408,by-63]],'#394247',11);
   ellipse(412,by-63,8,8,'#ecdfac');
   line([[277,by-35],[290,by+12],[310,by+17]],'#855538',8);
   // Correct flashlight pivot and target vary with the hovered menu item.
   const pivot=[412,by-63];const target=hover==='HELP'?[715,410]:hover==='EXIT'?[504,400]:[715,325];
   if(hover==='EXIT'||hover==='CLOSE'||exitPulse>0){
     const alpha=Math.max(exitPulse,hover==='EXIT'||hover==='CLOSE'?.9:0);
     const radial=ctx.createRadialGradient(pivot[0],pivot[1],2,pivot[0],pivot[1],650);
     radial.addColorStop(0,`rgba(255,255,250,${.98*alpha})`);radial.addColorStop(.15,`rgba(255,254,226,${.78*alpha})`);radial.addColorStop(.55,`rgba(255,237,176,${.4*alpha})`);radial.addColorStop(1,'rgba(255,241,204,0)');
     ctx.fillStyle=radial;ctx.fillRect(0,0,1000,800);
     for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[pivot[0]+Math.cos(a)*20,pivot[1]+Math.sin(a)*20],[pivot[0]+Math.cos(a)*(i%2?240:340),pivot[1]+Math.sin(a)*(i%2?240:340)]],`rgba(255,255,216,${.52*alpha})`,i%2?3:7);}
     rect(0,0,1000,800,`rgba(255,251,231,${.15*alpha})`);
   } else {
     const [tx,ty]=target,dx=tx-pivot[0],dy=ty-pivot[1],d=Math.hypot(dx,dy),px=-dy/d,py=dx/d;
     poly([[pivot[0]+px*5,pivot[1]+py*5],[tx+px*34,ty+py*34],[tx-px*34,ty-py*34],[pivot[0]-px*5,pivot[1]-py*5]],'#ffe0a029');
     line([pivot,target],'#ffe8adad',1.5);ellipse(tx,ty,18,18,'#ffdc6833');ellipse(tx,ty,7,7,'#ffedb1e0');
   }
   ellipse(pivot[0],pivot[1],8,8,'#fff2d1');
   // Wind and storm streaks, matching the deterministic scatter in the Python menu.
   for(let i=0;i<275;i++){const x=(i*73+19)%2600-800,y=(i*149+Math.floor(t*95))%790;if(x>413&&x<694&&y<525)continue;line([[x,y],[x-5,y+19]],'#acd0dc60',1.2);}
   if(clickFlash>0)rect(0,0,1000,800,`rgba(255,255,242,${clickFlash*.8})`);
 }
 function tick(now){const t=now/1000;const dt=last?Math.min((now-last)/1000,.08):0;last=now;if(menu.classList.contains('hidden')){requestAnimationFrame(tick);return;}const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}// Keep the source illustration's 5:4 proportions at every browser width.
   // Independent x/y stretching made the boat, spotlight and BRACU look squashed.
   const cw=canvas.width,ch=canvas.height;
   ctx.setTransform(1,0,0,1,0,0);
   const backdrop=ctx.createLinearGradient(0,0,0,ch);
   backdrop.addColorStop(0,'#112636');backdrop.addColorStop(.60,'#0c2935');backdrop.addColorStop(1,'#062f3c');
   ctx.fillStyle=backdrop;ctx.fillRect(0,0,cw,ch);
   const unit=Math.min(cw/1000,ch/800);
   const offsetX=(cw-1000*unit)*.54;
   const offsetY=(ch-800*unit)*.50;
   ctx.setTransform(unit,0,0,unit,offsetX,offsetY);
   exitPulse=Math.max(0,exitPulse-dt*.7);clickFlash=Math.max(0,clickFlash-dt*.65);
   draw(t);requestAnimationFrame(tick);}
 for(const [id,name] of [['play-button','START'],['help-button','HELP'],['exit-button','EXIT'],['menu-close','CLOSE']]){const el=$$(id);if(!el)continue;el.addEventListener('pointerenter',()=>{hover=name;});el.addEventListener('focus',()=>{hover=name;});el.addEventListener('pointerleave',()=>{hover='START';});}
 function exit(){hover='EXIT';exitPulse=1;clickFlash=1;const status=$$('engine-status');status.textContent='The Majhi shines his flashlight at you! Close this tab if you want to leave.';status.style.color='#ffddab';setTimeout(()=>{hover='START';},1900);}
 $$('exit-button')?.addEventListener('click',exit);$$('menu-close')?.addEventListener('click',exit);
 window.majhiMenuFlash=exit;
 requestAnimationFrame(tick);
})();
