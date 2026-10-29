/* Majhi Jaben?! — Visual Lab 01. Standalone WebGL2 scene, no packages, no gameplay dependencies.
 * The existing game.js, audio and exported source geometry are NEVER loaded or modified here.
 * Mechanical design: each oar rotates around a FIXED oarlock, and its inner grip drives the hand/arm pose.
 */
(()=>{'use strict';
const canvas=document.getElementById('preview'),stage=document.getElementById('stage');
const error=document.getElementById('error');
const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'high-performance'});
if(!gl){error.hidden=false;error.textContent='This visual lab requires WebGL 2. Try a current version of Chrome, Edge, or Firefox with graphics acceleration enabled.';return;}
const PI=Math.PI,TAU=2*PI;
const C={water:[.065,.23,.27],teal:[.12,.40,.43],tealLight:[.26,.59,.57],tealShade:[.08,.25,.28],gold:[.88,.67,.37],wood:[.58,.34,.18],woodHi:[.78,.53,.27],woodDk:[.31,.20,.13],skin:[.67,.40,.27],skinLight:[.79,.53,.37],hair:[.075,.09,.105],shirt:[.22,.65,.65],shirtHi:[.27,.73,.69],pants:[.19,.27,.36],offwhite:[.91,.84,.70],orange:[.91,.44,.25],black:[.09,.14,.17],metal:[.36,.42,.44],shadow:[.045,.12,.15]};
const VERT=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;in vec3 aTint;
uniform mat4 uModel,uView,uProjection;
uniform mat3 uNormal;uniform vec3 uColor;uniform float uVertexColors;
out vec3 vNormal,vWorld,vTint;
void main(){vec4 w=uModel*vec4(aPosition,1.);vWorld=w.xyz;vNormal=normalize(uNormal*aNormal);vTint=mix(uColor,aTint,uVertexColors);gl_Position=uProjection*uView*w;}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vNormal,vWorld,vTint;
uniform vec3 uEye,uSun,uFog;
uniform float uMaterial,uTime,uDusk,uAlpha;
out vec4 frag;
float wave(vec2 p){return sin(dot(p,vec2(.79,.27))*2.4+uTime*.67)*.045+sin(dot(p,vec2(-.38,.92))*3.6-uTime*.94)*.027+sin(dot(p,vec2(.61,-.78))*5.1+uTime*1.27)*.010;}
void main(){
 vec3 sun=normalize(uSun),v=normalize(uEye-vWorld);
 if(uMaterial>1.5){
   vec2 p=vWorld.xz;float a=wave(p);float e=.045;
   vec3 n=normalize(vec3((wave(p-vec2(e,0.))-wave(p+vec2(e,0.)))/(2.*e),1.,(wave(p-vec2(0.,e))-wave(p+vec2(0.,e)))/(2.*e)));
   float nl=max(dot(n,sun),0.0),fres=pow(1.-max(dot(n,v),0.),3.0);
   vec3 h=normalize(sun+v);float spec=pow(max(dot(n,h),0.),90.);
   float linear=.5+.5*sin(p.x*.67+p.y*.30-uTime*.51);
   float caustic=pow(max(0.,sin(p.x*1.8-p.y*.38+uTime*.8)),13.);
   vec3 dark=mix(vec3(.043,.183,.214),vec3(.06,.256,.270),uDusk);
   vec3 water=dark+vec3(.018,.069,.070)*linear+vec3(.018,.042,.033)*nl;
   water+=vec3(.47,.60,.51)*spec*.55+vec3(.075,.14,.13)*caustic*.44+vec3(.20,.32,.33)*fres*.32;
   float fog=smoothstep(16.,46.,distance(vWorld,uEye));
   water=mix(water,uFog,fog*.54);
   frag=vec4(water,1.);return;
 }
 vec3 n=normalize(vNormal);
 float diffuse=max(dot(n,sun),0.),back=max(dot(n,normalize(vec3(-.5,.4,-.5))),0.);
 float hemi=n.y*.5+.5;
 float lit=.35+.52*diffuse+.13*back+.17*hemi;
 vec3 base=vTint*lit;
 float spec=pow(max(dot(n,normalize(sun+v)),0.),mix(70.,12.,clamp(uMaterial,0.,1.)));
 base+=vec3(.72,.74,.59)*spec*mix(.29,.05,clamp(uMaterial,0.,1.));
 float fog=smoothstep(17.,47.,distance(vWorld,uEye));base=mix(base,uFog,fog*.67);
 // Gentle warm color grading, no expensive post-processing pipeline.
 base=mix(base,base*vec3(1.09,1.025,.92),.26);
 frag=vec4(pow(max(base,vec3(0.)),vec3(.92)),uAlpha);
}`;
function compile(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERT));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}catch(e){error.hidden=false;error.textContent='Shader error: '+e.message;return;}
gl.useProgram(program);
const A={pos:gl.getAttribLocation(program,'aPosition'),norm:gl.getAttribLocation(program,'aNormal'),tint:gl.getAttribLocation(program,'aTint')};
const U={model:gl.getUniformLocation(program,'uModel'),view:gl.getUniformLocation(program,'uView'),proj:gl.getUniformLocation(program,'uProjection'),normal:gl.getUniformLocation(program,'uNormal'),color:gl.getUniformLocation(program,'uColor'),eye:gl.getUniformLocation(program,'uEye'),sun:gl.getUniformLocation(program,'uSun'),fog:gl.getUniformLocation(program,'uFog'),mat:gl.getUniformLocation(program,'uMaterial'),vertexColors:gl.getUniformLocation(program,'uVertexColors'),time:gl.getUniformLocation(program,'uTime'),dusk:gl.getUniformLocation(program,'uDusk'),alpha:gl.getUniformLocation(program,'uAlpha')};
const v3=(x,y,z)=>[x,y,z],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),norm=a=>mul(a,1/(len(a)||1)),lerp=(a,b,t)=>a+(b-a)*t;
function transform(p,scale=[1,1,1],r=0,pos=[0,0,0]){let c=Math.cos(r),s=Math.sin(r);return [pos[0]+scale[0]*(p[0]*c-p[2]*s),pos[1]+p[1]*scale[1],pos[2]+scale[2]*(p[0]*s+p[2]*c)];}
function matrix(pos=[0,0,0],s=[1,1,1],angle=0){const c=Math.cos(angle),sn=Math.sin(angle);return new Float32Array([c*s[0],0,sn*s[0],0,0,s[1],0,0,-sn*s[2],0,c*s[2],0,pos[0],pos[1],pos[2],1]);}
function matrixBetween(a,b,r1,r2=r1){let y=norm(sub(b,a)),basis=Math.abs(y[1])<.9?[0,1,0]:[1,0,0],x=norm(cross(basis,y)),z=norm(cross(x,y)),d=len(sub(b,a));return new Float32Array([x[0]*r1,x[1]*r1,x[2]*r1,0,y[0]*d,y[1]*d,y[2]*d,0,z[0]*r2,z[1]*r2,z[2]*r2,0,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5,1]);}
function lookAt(eye,target){let z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2),q=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0]);}
// Geometry generation is intentionally separate from draw transforms; all meshes are GPU-cached.
function makeMesh(vertices){const vao=gl.createVertexArray(),buf=gl.createBuffer(),data=new Float32Array(vertices);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(A.pos);gl.vertexAttribPointer(A.pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(A.norm);gl.vertexAttribPointer(A.norm,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);return {vao,count:vertices.length/6,data};}
function builder(){const v=[];const triangle=(a,b,c,n=null)=>{let normal=n||norm(cross(sub(b,a),sub(c,a)));for(let p of [a,b,c])v.push(...p,...normal);};const quad=(a,b,c,d)=>{triangle(a,b,c);triangle(a,c,d);};return {v,tri:triangle,quad,done:()=>makeMesh(v)};}
function boxMesh(){const b=builder(),q=[[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]];for(let x of q)b.quad(...x);return b.done();}
function uvSphere(rings=18,segments=25){let b=builder(),point=(u,v)=>[Math.sin(v*PI)*Math.cos(u*TAU),Math.cos(v*PI),Math.sin(v*PI)*Math.sin(u*TAU)];for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){let a=point(j/segments,i/rings),c=point((j+1)/segments,(i+1)/rings),d=point(j/segments,(i+1)/rings),bb=point((j+1)/segments,i/rings);for(let tri of [[a,bb,c],[a,c,d]])for(let p of tri)b.v.push(...p,...norm(p));}return b.done();}
function cylinderMesh(sides=18){let b=builder();for(let i=0;i<sides;i++){let a=i*TAU/sides,bb=(i+1)*TAU/sides;let p=t=>[Math.cos(t)*.5,Math.sin(t)*.5];let [x1,z1]=p(a),[x2,z2]=p(bb);b.quad([x1,-.5,z1],[x2,-.5,z2],[x2,.5,z2],[x1,.5,z1]);b.tri([0,.5,0],[x2,.5,z2],[x1,.5,z1]);b.tri([0,-.5,0],[x1,-.5,z1],[x2,-.5,z2]);}return b.done();}
function ringMesh(segs=56){let b=builder();for(let i=0;i<segs;i++){let a=i*TAU/segs,bb=(i+1)*TAU/segs;let p=(ang,rad)=>[Math.cos(ang)*rad,0,Math.sin(ang)*rad];b.quad(p(a,.96),p(bb,.96),p(bb,1.04),p(a,1.04));}return b.done();}
const mesh={box:boxMesh(),sphere:uvSphere(),cyl:cylinderMesh(),ring:ringMesh()};
// Physically-shaped boat hull with flared, narrowing bow/stern and inset wooden interior.
function boatHull(){let b=builder(),z=[-2.78,-2.52,-2.05,-1.51,-.88,-.17,.55,1.23,1.87,2.38,2.68],w=[.08,.40,.70,.89,1.03,1.07,1.03,.94,.74,.43,.06],y=[1.05,.84,.70,.64,.61,.61,.64,.69,.77,.88,1.05];
 for(let i=0;i<z.length-1;i++)for(let side of [-1,1]){
  const row=(k,f,h)=>[side*w[k]*f,y[k]+h,z[k]];
  b.quad(row(i,1,0),row(i+1,1,0),row(i+1,.77,-.72),row(i,.77,-.72));
  b.quad(row(i,.77,-.72),row(i+1,.77,-.72),row(i+1,.28,-.93),row(i,.28,-.93));
  b.quad(row(i,.96,-.05),row(i,.75,-.20),row(i+1,.75,-.20),row(i+1,.96,-.05));
 }
 return {mesh:b.done(),z,w,y};}
const hull=boatHull();
function draw(m,model,col,rough=.70,alpha=1){gl.uniformMatrix4fv(U.model,false,model);let a=model;let x=[a[0],a[1],a[2]],y=[a[4],a[5],a[6]],z=[a[8],a[9],a[10]];let nx=mul(norm(x),1/(len(x)||1)),ny=mul(norm(y),1/(len(y)||1)),nz=mul(norm(z),1/(len(z)||1));gl.uniformMatrix3fv(U.normal,false,new Float32Array([...nx,...ny,...nz]));gl.uniform3fv(U.color,col);gl.uniform1f(U.mat,rough);gl.uniform1f(U.vertexColors,0);gl.uniform1f(U.alpha,alpha);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}
function ball(pos,s,color,rough=.78){draw(mesh.sphere,matrix(pos,s),color,rough);}
function box(pos,size,color,rough=.78,angle=0){draw(mesh.box,matrix(pos,size,angle),color,rough);}
function bar(a,b,r,color,rough=.72){draw(mesh.cyl,matrixBetween(a,b,r*2,r*2),color,rough);}
function ellipsoidBetween(a,b,r,color){let y=norm(sub(b,a)),basis=Math.abs(y[1])<.90?[0,1,0]:[1,0,0],x=norm(cross(basis,y)),z=norm(cross(x,y)),d=len(sub(b,a));let m=new Float32Array([x[0]*r,x[1]*r,x[2]*r,0,y[0]*(d*.60),y[1]*(d*.60),y[2]*(d*.60),0,z[0]*r,z[1]*r,z[2]*r,0,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5,1]);draw(mesh.sphere,m,color,.78);}
const staticObjects=[];
const pushBox=(p,s,col,rough=.8,rot=0)=>staticObjects.push({type:'box',p,s,col,rough,rot});
const pushBall=(p,s,col,rough=.8)=>staticObjects.push({type:'ball',p,s,col,rough});
const pushBar=(a,b,r,col)=>staticObjects.push({type:'bar',a,b,r,col});
function buildDhaka(){
 const blocks=[{x:-17,z:15,w:4.3,h:8.8,d:4.9,c:[.56,.57,.52]},{x:-11.9,z:17,w:4.1,h:11.4,d:4.2,c:[.64,.56,.48]},{x:-6.7,z:19,w:3.9,h:7.5,d:4.4,c:[.61,.67,.60]},{x:0,z:21,w:4.5,h:11,d:4.7,c:[.56,.65,.64]},{x:6.0,z:18,w:4.4,h:9,d:5.4,c:[.73,.58,.51]},{x:12,z:17.5,w:4.8,h:12.2,d:4.5,c:[.59,.63,.64]},{x:17.9,z:15.9,w:4,h:8.5,d:4.4,c:[.68,.67,.60]}];
 for(let [bi,b] of blocks.entries()){
   pushBox([b.x,b.h*.5-.50,b.z],[b.w,b.h,b.d],b.c,.94);
   pushBox([b.x,b.h-.30,b.z],[b.w+.3,.22,b.d+.25],[.38,.45,.44]);
   for(let level=1;level<Math.floor(b.h/1.65);level++){
     const y=.6+level*1.60;
     for(let k=-1;k<=1;k++){
       let xx=b.x+k*b.w*.28;
       pushBox([xx,y,b.z-b.d*.5-.018],[.56,.72,.05],[.14,.29,.35],.22);
       pushBox([xx,y+.33,b.z-b.d*.5-.07],[.63,.045,.09],[.57,.61,.59],.68);
       pushBox([xx,y-.36,b.z-b.d*.5-.07],[.63,.045,.09],[.39,.46,.46]);
       pushBar([xx-.31,y-.36,b.z-b.d*.5-.09],[xx-.31,y+.35,b.z-b.d*.5-.09],.022,[.32,.36,.37]);
     }
     if(level%2===bi%3){
       pushBox([b.x,y-.53,b.z-b.d*.5-.39],[b.w*.78,.12,.78],[.48,.51,.50]);
       for(let k=-2;k<=2;k++)pushBar([b.x+k*.53,y-.47,b.z-b.d*.5-.72],[b.x+k*.53,y-.02,b.z-b.d*.5-.72],.017,[.28,.35,.36]);
     }
   }
   if(bi%3===0){pushBox([b.x+b.w*.20,b.h+.11,b.z],[.85,.18,.85],[.34,.37,.35]);pushBox([b.x+b.w*.20,b.h+.58,b.z],[.68,.78,.68],[.17,.28,.33]);}
   if(bi%3===1){for(let k=-1;k<=1;k++)pushBar([b.x+k*.55,b.h-.28,b.z-b.d*.25],[b.x+k*.55,b.h+.9,b.z-b.d*.25],.035,[.49,.47,.42]);}
   // Bengali neighborhood market, painted awnings, warm light below street level.
   if(bi===1||bi===4){pushBox([b.x,.85,b.z-b.d*.50-.42],[b.w*.84,.20,1.12],bi===1?[.37,.60,.59]:[.78,.40,.24]);pushBox([b.x,1.18,b.z-b.d*.5-.14],[b.w*.89,.47,.09],[.20,.36,.34]);}
 }
 // Two narrow roadside palms and a few rooftop shades enrich the skyline without overwhelming the lab.
 for(let x of [-8,10,20]){let z=9.5;pushBar([x,-.3,z],[x,2.7,z],.15,[.42,.33,.23]);for(let a=0;a<7;a++){let t=a*TAU/7;pushBar([x,2.8,z],[x+Math.cos(t)*1.25,3.3+Math.sin(a)*.18,z+Math.sin(t)*1.25],.22,[.17,.39,.30]);}}
 // Loose wires are integral to this Dhaka skyline.
 for(let k=0;k<3;k++){let yy=6.2+k*.38;for(let j=0;j<15;j++){let t=j/14,p=[-17+j*2.42,yy-.36*Math.sin(PI*t),13.9];if(j)pushBar([-17+(j-1)*2.42,yy-.36*Math.sin(PI*(j-1)/14),13.9],p,.013,[.24,.27,.29]);}}
}
buildDhaka();
// One merged, vertex-colored buffer for distant static scenery: keeps hundreds
// of apartments, balconies, grills and cables to ONE draw call (not hundreds).
function staticSceneBatch(){
 const data=[];
 for(const o of staticObjects){
   const base=o.type==='box'?mesh.box:o.type==='ball'?mesh.sphere:mesh.cyl;
   const m=o.type==='box'?matrix(o.p,o.s,o.rot):o.type==='ball'?matrix(o.p,o.s):matrixBetween(o.a,o.b,o.r*2,o.r*2);
   let ax=[m[0],m[1],m[2]],ay=[m[4],m[5],m[6]],az=[m[8],m[9],m[10]];
   let sx=len(ax)||1,sy=len(ay)||1,sz=len(az)||1;
   for(let i=0;i<base.data.length;i+=6){
     const p=[base.data[i],base.data[i+1],base.data[i+2]],n=[base.data[i+3],base.data[i+4],base.data[i+5]];
     const world=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
     const nn=norm(add(add(mul(norm(ax),n[0]/sx),mul(norm(ay),n[1]/sy)),mul(norm(az),n[2]/sz)));
     data.push(...world,...nn,...o.col);
   }
 }
 const arr=new Float32Array(data),vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);
 gl.enableVertexAttribArray(A.pos);gl.vertexAttribPointer(A.pos,3,gl.FLOAT,false,36,0);
 gl.enableVertexAttribArray(A.norm);gl.vertexAttribPointer(A.norm,3,gl.FLOAT,false,36,12);
 gl.enableVertexAttribArray(A.tint);gl.vertexAttribPointer(A.tint,3,gl.FLOAT,false,36,24);
 gl.bindVertexArray(null);return {vao,count:arr.length/9,objects:staticObjects.length};
}
const scenery=staticSceneBatch();staticObjects.length=0;
// Rig and boat are rendered from their own adjustable transforms; no global mesh edits.
const ui={play:document.getElementById('play'),playLabel:document.getElementById('playLabel'),playIcon:document.getElementById('playIcon'),speed:document.getElementById('speed'),speedValue:document.getElementById('speedValue'),light:document.getElementById('lighting'),lightValue:document.getElementById('lightValue'),rig:document.getElementById('rig')};
let playing=true,rowSpeed=1,dusk=0,showRig=false,time=0,last=0;
ui.play.addEventListener('click',()=>{playing=!playing;ui.playLabel.textContent=playing?'Pause rowing':'Resume rowing';ui.playIcon.textContent=playing?'Ⅱ':'▶';});
ui.speed.addEventListener('input',()=>{rowSpeed=+ui.speed.value;ui.speedValue.textContent=rowSpeed.toFixed(1)+'×';});
ui.light.addEventListener('input',()=>{dusk=+ui.light.value;ui.lightValue.textContent=dusk?'Overcast':'Golden hour';});
ui.rig.addEventListener('change',()=>showRig=ui.rig.checked);
let theta=2.38,phi=.31,dist=11.7,dragging=false,lastX=0,lastY=0;
canvas.addEventListener('pointerdown',e=>{dragging=true;canvas.setPointerCapture(e.pointerId);lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;theta-=(e.clientX-lastX)*.0065;phi=Math.min(.84,Math.max(.10,phi+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(7.1,Math.min(17.0,dist+Math.sign(e.deltaY)*.8));},{passive:false});
const water=builder();water.quad([-50,-.02,-50],[50,-.02,-50],[50,-.02,50],[-50,-.02,50]);const waterMesh=water.done();
function paintBoat(){
  draw(hull.mesh,matrix(),C.teal,.43);
  // Interior slats make the vessel read as a real wooden sampan, not an opaque plastic bathtub.
  for(let z=-1.93;z<=1.99;z+=.22){let width=1.03*Math.pow(Math.max(.10,1-(z/2.8)**2),.65);box([0,.02,z],[width*1.45,.07,.194],z*5%2===0?C.woodHi:C.wood,.92);}
  for(let z of [-1.82,-.60,.45,1.52]){
    let width=1.01*Math.pow(Math.max(.05,1-(z/2.8)**2),.64);
    box([0,.32,z],[width*1.9,.13,.23],C.woodHi,.86);
    box([0,.235,z],[width*1.82,.06,.26],C.woodDk,.91);
  }
  // Rails follow the actual complex boat contour and rise toward bow/stern.
  for(let side of [-1,1]){
    for(let i=0;i<hull.z.length-1;i++){
      let a=[side*hull.w[i],hull.y[i]+.025,hull.z[i]],b=[side*hull.w[i+1],hull.y[i+1]+.025,hull.z[i+1]];
      bar(a,b,.065,C.woodHi);
      if(i%2===0)ball(a,[.085,.065,.085],C.gold,.47);
    }
  }
  bar([0,hull.y[0],hull.z[0]],[0,hull.y[0]+.18,hull.z[0]-.05],.078,C.woodHi);
  bar([0,hull.y[hull.y.length-1],hull.z[hull.z.length-1]],[0,hull.y[hull.y.length-1]+.10,hull.z[hull.z.length-1]+.02],.07,C.woodHi);
  // Decorative hull stripe and wooden ribs.
  for(let i=2;i<hull.z.length-1;i++)for(let side of [-1,1]){
    let z=hull.z[i],x=side*hull.w[i]*.82;ball([x,.22,z],[.035,.034,.035],[.90,.72,.39],.26);
  }
  for(let side of [-1,1]){
    // Oarlocks remain fixed in the hull, and all oars rotate around them.
    let x=side*1.07;bar([x,.66,.23],[x,.89,.23],.040,C.metal);ball([x,.83,.23],[.14,.08,.13],[.22,.27,.30],.35);
  }
}
function paintMajhi(phase){
 const pull=Math.cos(phase),drive=Math.sin(phase),lean=.13*pull;
 const torso=[0,1.52,.50+lean],head=[0,2.30,.47+lean*1.5];
 // Lungi-trousers, knees, bare visible ankles and modest everyday shirt.
 ball([0,.97,.58],[.42,.21,.39],C.pants,.94);
 for(let side of [-1,1]){
  let hip=[side*.23,.94,.42],knee=[side*.29,.73,-.16],ankle=[side*.28,.49,-.72];
  ellipsoidBetween(hip,knee,.16,C.pants);ball(knee,[.16,.16,.15],C.pants);
  ellipsoidBetween(knee,ankle,.125,C.pants);
  ball([side*.28,.43,-.82],[.19,.115,.36],[.18,.18,.17]);
 }
 ball(torso,[.45,.51,.34],C.shirt,.87);
 ball([0,1.83,.45+lean],[.38,.21,.32],C.shirtHi,.75);
 // Short neck -- deliberately avoid the previous long tube-like neck.
 draw(mesh.cyl,matrix([0,2.003,.46+lean],[.20,.15,.20]),C.skinLight,.91);
 ball(head,[.30,.33,.278],C.skinLight,.93);
 // Hairline, textured volume made of overlapping rounded tufts.
 ball([0,2.55,.50+lean*1.5],[.33,.16,.295],C.hair,.96);
 for(let k=-2;k<=2;k++)ball([k*.106,2.54+(k%2)*.035,.266+lean*1.5],[.083,.083,.075],C.hair,.95);
 // Face looks toward the bow (-Z), with readable eyes and nose.
 for(let side of [-1,1]){
   ball([side*.127,2.318,.211+lean*1.5],[.033,.035,.025],[.95,.95,.90],.10);
   ball([side*.125,2.316,.187+lean*1.5],[.018,.024,.011],[.09,.115,.12],.25);
   bar([side*.08,2.399,.22+lean*1.5],[side*.163,2.395,.22+lean*1.5],.018,C.hair);
   ball([side*.291,2.27,.455+lean*1.5],[.046,.081,.063],C.skin,.93);
 }
 ball([0,2.22,.194+lean*1.5],[.055,.075,.049],C.skinLight,.91);
 ball([0,2.138,.215+lean*1.5],[.080,.018,.011],[.36,.20,.19],.94);
 // Paddles and hands: the hand grip is used as the actual rig target.
 for(const side of [-1,1]){
   const shoulder=[side*.35,1.77,.40+lean],elbow=[side*.52,1.48,.16+lean*.6+.13*pull];
   const grip=[side*.47,1.13+.086*drive,.21-.52*pull],pivot=[side*1.07,.82,.23];
   const extension=sub(pivot,grip),blade=add(pivot,mul(extension,2.15));
   // Grip-end -> oarlock -> blade share one line, the oar doesn't float independently.
   ellipsoidBetween(shoulder,elbow,.112,C.shirt);
   ball(elbow,[.11,.115,.112],C.shirt);
   ellipsoidBetween(elbow,grip,.092,C.skinLight);
   ball(grip,[.107,.084,.10],C.skinLight);
   const handleEnd=add(grip,mul(sub(grip,pivot),.15));
   bar(handleEnd,blade,.038,C.woodHi,.75);
   const bladeA=add(pivot,mul(extension,1.65)),bladeB=add(pivot,mul(extension,2.25));
   let bdir=norm(sub(bladeB,bladeA)),perp=norm(cross([0,1,0],bdir));
   // Wider sculpted wooden blade, with a central ridge.
   ball(mul(add(bladeA,bladeB),.5),[.12,.22,.15],C.woodHi);
   const cm=matrixBetween(bladeA,bladeB,.30,.12);
   draw(mesh.sphere,cm,C.woodHi,.69);
   ball(pivot,[.07,.07,.065],C.metal,.32);
   if(showRig){
      ball(grip,[.081,.081,.081],[.92,.37,.18],.10);
      ball(pivot,[.095,.095,.095],[.90,.92,.30],.12);
   }
   // Contact ripples occur only when a blade enters water during its stroke.
   if(blade[1]<.18){
     const age=.5+.5*Math.sin(phase+side*.08);
     const r=.28+.11*age;
     let m=matrix([blade[0],.024,blade[2]],[r,1,r]);
     draw(mesh.ring,m,[.51,.77,.71],.25,.45);
   }
 }
}
function background(){
 gl.uniformMatrix4fv(U.model,false,matrix());
 gl.uniformMatrix3fv(U.normal,false,new Float32Array([1,0,0,0,1,0,0,0,1]));
 gl.uniform1f(U.vertexColors,1);gl.uniform1f(U.mat,.86);gl.uniform1f(U.alpha,1);
 gl.bindVertexArray(scenery.vao);gl.drawArrays(gl.TRIANGLES,0,scenery.count);
 gl.uniform1f(U.vertexColors,0);
}
function resize(){const d=Math.min(window.devicePixelRatio||1,1.75),w=Math.floor(canvas.clientWidth*d),h=Math.floor(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,canvas.width,canvas.height);}
function frame(now){let dt=last?Math.min((now-last)/1000,.045):0;last=now;if(playing)time+=dt*rowSpeed;resize();
 const focus=[0,1.1,.42],eye=[Math.sin(theta)*Math.cos(phi)*dist,focus[1]+Math.sin(phi)*dist,Math.cos(theta)*Math.cos(phi)*dist+focus[2]];
 const view=lookAt(eye,focus),proj=perspective(52*PI/180,canvas.width/Math.max(1,canvas.height),.1,95);
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.uniformMatrix4fv(U.view,false,view);gl.uniformMatrix4fv(U.proj,false,proj);gl.uniform3fv(U.eye,eye);gl.uniform3fv(U.sun,dusk?norm([-.65,.7,.2]):norm([-.39,.87,.27]));gl.uniform3fv(U.fog,dusk?[.23,.32,.34]:[.47,.61,.60]);gl.uniform1f(U.time,time);gl.uniform1f(U.dusk,dusk);
 // The water is a single analytic surface; no diamond-shaped tessellation is exposed.
 draw(waterMesh,matrix(),C.water,2.0);
 background();
 // Waterline contacts, hull and rower use consistent world-space coordinates.
 paintBoat();paintMajhi(time*4.1);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.majhiVisualLab={getStatus:()=>({renderer:'WebGL2',playing,rowSpeed,dusk,version:'visual-lab-01',gameFilesUntouched:true,staticObjectsBatched:scenery.objects,drawCallsForStaticScenery:1})};
})();
