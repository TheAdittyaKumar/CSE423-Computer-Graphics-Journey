/*
 * MAJHI JABEN?! / VISUAL LAB 02
 * Visual Lab 02.1: custom curved 3D mesh + inverse-kinematic rowing.
 * No dependencies, downloads, build step, or changes to the main game.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('scene');
  const gl = canvas.getContext('webgl2', { antialias: true, depth: true, alpha: false });
  const status = $('rendererStatus');
  const errorPanel = $('errorPanel');
  const errorMessage = $('errorMessage');
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = v => v * v * (3 - 2 * v);
  const mix = (a, b, t) => a + (b - a) * t;
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const mul = (a, s) => a.map(v => v * s);
  const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = v => mul(v, 1 / (Math.hypot(...v) || 1));
  const mid = (a, b) => mul(add(a, b), .5);

  function fail(message) {
    status.textContent = '3D preview unavailable';
    errorMessage.textContent = message;
    errorPanel.hidden = false;
  }
  if (!gl) { fail('WebGL 2 is not enabled in this browser. Try Chrome or Edge with hardware acceleration enabled.'); return; }

  const vertex = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  uniform mat4 uModel, uView, uProjection;
  uniform float uTime;
  uniform highp int uType;
  out vec3 vNormal, vWorld;
  out float vDistance;
  void main() {
    vec4 p = uModel * vec4(aPosition, 1.0);
    if (uType == 1) {
      float A = sin(p.x*.89 + p.z*.32 - uTime*.61);
      float B = sin(p.x*-.43 + p.z*1.08 + uTime*.48);
      float C = sin(p.x*1.47 - p.z*.66 - uTime*.78);
      p.y += .028*A + .017*B + .009*C;
    }
    vWorld = p.xyz;
    vNormal = normalize(transpose(inverse(mat3(uModel))) * aNormal);
    vec4 view = uView * p;
    vDistance = length(view.xyz);
    gl_Position = uProjection * view;
  }`;

  const fragment = `#version 300 es
  precision highp float;
  in vec3 vNormal, vWorld;
  in float vDistance;
  uniform vec3 uTint;
  uniform float uTime;
  uniform highp int uType;
  uniform int uLighting;
  out vec4 fragColor;
  float hash21(vec2 p) { p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
               mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
  }
  void main() {
    vec3 color=uTint;
    vec3 sun = normalize(uLighting==0 ? vec3(-.6,1.0,.9) : vec3(-.35,1.0,.2));
    if (uType == 1) {
      vec2 p=vWorld.xz;
      float n1=noise(p*2.7 + vec2(uTime*.16,-uTime*.10));
      float n2=noise(p*6.8 + vec2(-uTime*.18,uTime*.12));
      float n3=noise(p*14.0 - vec2(uTime*.11,uTime*.20));
      float dx=(noise((p+vec2(.065,0.))*2.7+vec2(uTime*.16,-uTime*.10))-n1)*.23;
      float dz=(noise((p+vec2(0.,.065))*2.7+vec2(uTime*.16,-uTime*.10))-n1)*.23;
      vec3 normal=normalize(vec3(-dx,1.,-dz));
      float highlight=pow(max(dot(reflect(-sun,normal),normalize(vec3(0.,1.0,.42))),0.),38.);
      float detail=(n1-.5)*.052+(n2-.5)*.035+(n3-.5)*.014;
      color=mix(vec3(.036,.18,.22),vec3(.075,.31,.34),clamp(.50+detail*7.0,0.,1.));
      color+=vec3(.10,.17,.15)*highlight*.50;
      if(uLighting==1) color*=.77;
    } else {
      vec3 n=normalize(vNormal);
      float diffuse=max(0.,dot(n,sun));
      float wrapped=clamp(diffuse*.75+.25,0.,1.);
      color*=uLighting==0 ? (.50+.57*wrapped) : (.49+.42*wrapped);
      color+=vec3(.08,.09,.085)*pow(max(dot(reflect(-sun,n),vec3(0.,1.,0.)),0.),18.)*.09;
    }
    vec3 fog=uLighting==0?vec3(.65,.77,.74):vec3(.57,.66,.69);
    color=mix(color,fog,smoothstep(21.,70.,vDistance));
    fragColor=vec4(color,1.);
  }`;

  function shader(kind, src) {
    const s=gl.createShader(kind);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  let program;
  try {
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  } catch(err) { fail('Graphics shader error: '+err.message); return; }
  gl.useProgram(program);
  const uni={
    model:gl.getUniformLocation(program,'uModel'),view:gl.getUniformLocation(program,'uView'),
    proj:gl.getUniformLocation(program,'uProjection'),tint:gl.getUniformLocation(program,'uTint'),
    type:gl.getUniformLocation(program,'uType'),time:gl.getUniformLocation(program,'uTime'),
    lighting:gl.getUniformLocation(program,'uLighting')
  };
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // Hand-built curved meshes are deliberately rendered double-sided.
  gl.disable(gl.CULL_FACE);

  // CPU-side model generation is done ONCE. Only transformation matrices change per frame.
  class Geometry {
    constructor() { this.vertices=[]; }
    tri(a,b,c) {
      const n=unit(cross(sub(b,a),sub(c,a)));
      for(const p of [a,b,c])this.vertices.push(...p,...n);
    }
    quad(a,b,c,d) { this.tri(a,b,c);this.tri(a,c,d); }
    upload() {
      const data=new Float32Array(this.vertices);
      const vao=gl.createVertexArray(),vbo=gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
      gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
      gl.bindVertexArray(null);
      return {vao,count:data.length/6};
    }
  }
  function sphereGeo(rings=14,slices=22) {
    const m=new Geometry();
    for(let j=0;j<rings;j++) {
      const lo=-PI/2+j*PI/rings,hi=-PI/2+(j+1)*PI/rings;
      for(let i=0;i<slices;i++) {
        const a=i*TAU/slices,b=(i+1)*TAU/slices;
        const p=(t,v)=>[Math.cos(t)*Math.cos(v),Math.sin(t),Math.cos(t)*Math.sin(v)];
        m.quad(p(lo,a),p(lo,b),p(hi,b),p(hi,a));
      }
    }
    return m.upload();
  }
  function cylinderGeo(n=16) {
    const m=new Geometry();
    for(let k=0;k<n;k++) {
      const a=k*TAU/n,b=(k+1)*TAU/n;
      const p=(angle,y)=>[Math.cos(angle),y,Math.sin(angle)];
      m.quad(p(a,-.5),p(b,-.5),p(b,.5),p(a,.5));
      m.tri([0,.5,0],p(a,.5),p(b,.5));
      m.tri([0,-.5,0],p(b,-.5),p(a,-.5));
    }
    return m.upload();
  }
  function cubeGeo() {
    const m=new Geometry();
    const p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])m.quad(...f.map(i=>p[i]));
    return m.upload();
  }
  function waterGeo() {
    const m=new Geometry(),N=72,SIZE=42;
    for(let i=0;i<N;i++)for(let j=0;j<N;j++){
      const x=-SIZE/2+i*SIZE/N,z=-SIZE/2+j*SIZE/N,d=SIZE/N;
      m.quad([x,.035,z],[x+d,.035,z],[x+d,.035,z+d],[x,.035,z+d]);
    }
    return m.upload();
  }
  const sphere=sphereGeo(),cylinder=cylinderGeo(),cube=cubeGeo(),water=waterGeo();

  function mat(position=[0,0,0],scale=[1,1,1]) {
    return new Float32Array([
      scale[0],0,0,0, 0,scale[1],0,0, 0,0,scale[2],0,
      position[0],position[1],position[2],1
    ]);
  }
  function between(a,b,radiusX,radiusZ=radiusX) {
    const direction=unit(sub(b,a));
    const seed=Math.abs(direction[2])>.94?[1,0,0]:[0,0,1];
    const axisX=unit(cross(seed,direction));
    const axisZ=unit(cross(axisX,direction));
    const len=Math.hypot(...sub(b,a));
    const center=mid(a,b);
    return new Float32Array([
      ...mul(axisX,radiusX),0, ...mul(direction,len),0,
      ...mul(axisZ,radiusZ),0, ...center,1
    ]);
  }
  function draw(mesh,matrix,color,type=0) {
    gl.uniformMatrix4fv(uni.model,false,matrix);
    gl.uniform3fv(uni.tint,color);
    gl.uniform1i(uni.type,type);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  const ball=(at,rgb,sc=[1,1,1])=>draw(sphere,mat(at,sc),rgb);
  const box=(at,rgb,sc)=>draw(cube,mat(at,sc),rgb);
  const bone=(a,b,r,c,r2=r)=>draw(cylinder,between(a,b,r,r2),c);

  const color={
    hull:[.087,.27,.30],hullDark:[.045,.18,.21],rim:[.61,.37,.18],
    trim:[.86,.59,.29],plank:[.67,.42,.22],plankAlt:[.51,.32,.18],
    skin:[.57,.37,.25],skinLight:[.68,.46,.30],hair:[.067,.062,.057],
    shirt:[.20,.51,.49],shirtShade:[.14,.39,.39],trousers:[.19,.23,.27],
    lungi:[.29,.32,.39],sandals:[.16,.13,.11],eye:[.075,.065,.058],
    white:[.90,.89,.80],metal:[.25,.30,.30],rope:[.65,.48,.24],
    brick:[.43,.33,.29],brick2:[.50,.37,.29],concrete:[.51,.53,.50]
  };

  // --------------------------------------------------------------------
  // VISUAL LAB 02.1 — HAND-CRAFTED GEOMETRY + MECHANICAL ROWING
  // Geometry is generated once. Camera and stroke controls from Lab 02 stay.
  // Local +X is the bow; local +/-Z is port/starboard.
  // --------------------------------------------------------------------
  const wood={edge:[.76,.51,.27], inner:[.67,.43,.23], rib:[.39,.24,.13], seam:[.31,.19,.12]};
  const skinDark=[.51,.31,.19],shirtLight=[.25,.56,.51],shirtShadow=[.13,.35,.35];

  // Makes a mesh by joining successive oval rings. This produces actual
  // curved shoulders/torso geometry rather than a stack of separate spheres.
  function ovalLoft(rings,segments=20) {
    const g=new Geometry();
    const pt=(ring,i)=>{
      const a=i*TAU/segments;
      return [ring.x+Math.cos(a)*ring.rx,ring.y,ring.z+Math.sin(a)*ring.rz];
    };
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      g.quad(pt(rings[j],i),pt(rings[j],i+1),pt(rings[j+1],i+1),pt(rings[j+1],i));
    }
    const first=rings[0],last=rings[rings.length-1];
    for(let i=0;i<segments;i++){
      g.tri([first.x,first.y,first.z],pt(first,i+1),pt(first,i));
      g.tri([last.x,last.y,last.z],pt(last,i),pt(last,i+1));
    }
    return g.upload();
  }

  // Proper boat hull: curved chines, inward upper walls, raised narrow ends.
  // Its lower gunwales no longer resemble the tall sides of a metal bucket.
const BOAT_LENGTH = 1.94;

const hullWidth = x => {
  const u = clamp(Math.abs(x) / BOAT_LENGTH, 0, 1);
  const body = Math.pow(Math.max(0, 1 - Math.pow(u, 2.45)), 0.72);
  const tipFade = Math.pow(Math.max(0, 1 - u), 0.38);
  return 0.82 * body * tipFade;
};

const hullTop = x => .805 + .24 * Math.pow(Math.abs(x) / BOAT_LENGTH, 2.2);
  function makeHull(){
    const outer=new Geometry(),inside=new Geometry(),floor=new Geometry();
    const N=56;
    for(let i=0;i<N;i++){
      const x0=-BOAT_LENGTH+2*BOAT_LENGTH*i/N;
      const x1=-BOAT_LENGTH+2*BOAT_LENGTH*(i+1)/N;
      for(const side of [-1,1]){
        const make=(x)=>{
          const w=hullWidth(x),e=Math.pow(Math.abs(x)/BOAT_LENGTH,2);
          return {
            upper:[x,hullTop(x),side*w],
            shoulder:[x,.51+.08*e,side*w*.96],
            chine:[x,.26+.08*e,side*w*.61],
            keel:[x,.20+.07*e,side*w*.18],
            innerTop:[x,hullTop(x)-.042,side*w*.91],
            innerFloor:[x,.39+.05*e,side*w*.69]
          };
        };
        const a=make(x0),b=make(x1);
        outer.quad(a.upper,b.upper,b.shoulder,a.shoulder);
        outer.quad(a.shoulder,b.shoulder,b.chine,a.chine);
        outer.quad(a.chine,b.chine,b.keel,a.keel);
        inside.quad(a.innerTop,b.innerTop,b.innerFloor,a.innerFloor);
        inside.quad(a.upper,b.upper,b.innerTop,a.innerTop);
        floor.quad([x0,.39,0],[x1,.39,0],b.innerFloor,a.innerFloor);
      }
    }
    return {outer:outer.upload(),inside:inside.upload(),floor:floor.upload()};
  }
  const hull=makeHull();

  // A continuous curved 3D wooden strip, used for the two gunwales.
  function makeRail(){
    const g=new Geometry(),n=56,r=.044,tubes=7;
    for(const side of [-1,1])for(let j=0;j<n;j++){
      const x0=-BOAT_LENGTH+2*BOAT_LENGTH*j/n;
      const x1=-BOAT_LENGTH+2*BOAT_LENGTH*(j+1)/n;
      const section=(x,k)=>{
        const a=k*TAU/tubes;
        return [x,hullTop(x)+r*Math.cos(a),side*hullWidth(x)+r*Math.sin(a)];
      };
      for(let k=0;k<tubes;k++)g.quad(section(x0,k),section(x1,k),section(x1,k+1),section(x0,k+1));
    }
    return g.upload();
  }
  const hullRail=makeRail();

  // Shaped solid wooden oar blade rather than an elongated sphere or rod.
  // The local Y axis runs from -0.5 (neck) to +0.5 (rounded tip).
  function makePaddleBlade(){
    const g=new Geometry(),steps=15;
    const widths=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      widths.push((.13+.87*Math.pow(Math.sin(PI*t),.80))*.5);
    }
    for(let i=0;i<steps;i++){
      const y0=-.5+i/steps,y1=-.5+(i+1)/steps;
      const w0=widths[i],w1=widths[i+1];
      const depth0=.06*(1-(i/steps)*.28),depth1=.06*(1-((i+1)/steps)*.28);
      // Subtle convex front and back faces.
      g.quad([-w0,y0,0],[-w1,y1,0],[0,y1,depth1],[0,y0,depth0]);
      g.quad([0,y0,depth0],[0,y1,depth1],[w1,y1,0],[w0,y0,0]);
      g.quad([w0,y0,0],[w1,y1,0],[0,y1,-depth1],[0,y0,-depth0]);
      g.quad([0,y0,-depth0],[0,y1,-depth1],[-w1,y1,0],[-w0,y0,0]);
    }
    return g.upload();
  }
  const paddleBlade=makePaddleBlade();

  // Smooth torso surface, clothing cuffs, modestly tapered adult head.
  const shirtMesh=ovalLoft([
    {x:0,y:-.32,z:0,rx:.235,rz:.25},
    {x:.005,y:-.24,z:0,rx:.245,rz:.265},
    {x:.02,y:-.03,z:0,rx:.290,rz:.32},
    {x:-.006,y:.185,z:0,rx:.325,rz:.355},
    {x:-.027,y:.255,z:0,rx:.270,rz:.31},
    {x:-.018,y:.29,z:0,rx:.16,rz:.17}
  ],24);
  const headMesh=ovalLoft([
    {x:-.015,y:-.24,z:0,rx:.045,rz:.060},
    {x:0,y:-.205,z:0,rx:.143,rz:.153},
    {x:.013,y:-.11,z:0,rx:.191,rz:.199},
    {x:0,y:.05,z:0,rx:.215,rz:.210},
    {x:-.025,y:.19,z:0,rx:.18,rz:.190},
    {x:-.045,y:.245,z:0,rx:.115,rz:.130},
    {x:-.045,y:.26,z:0,rx:.028,rz:.032}
  ],22);
  const hairMesh=ovalLoft([
    {x:-.043,y:.08,z:0,rx:.19,rz:.20},
    {x:-.065,y:.155,z:0,rx:.219,rz:.213},
    {x:-.065,y:.255,z:0,rx:.17,rz:.189},
    {x:-.075,y:.30,z:0,rx:.09,rz:.110},
    {x:-.076,y:.31,z:0,rx:.018,rz:.02}
  ],22);
  // Knee-length drape with small curved folds, in place of disconnected blobs.
  const lapFabric=ovalLoft([
    {x:0,y:-.11,z:0,rx:.235,rz:.275},
    {x:.04,y:-.04,z:0,rx:.28,rz:.30},
    {x:.06,y:.07,z:0,rx:.275,rz:.28},
    {x:.01,y:.16,z:0,rx:.235,rz:.25}
  ],20);

  function drawBoat(){
    draw(hull.outer,mat(),color.hull);
    draw(hull.inside,mat(),color.hullDark);
    draw(hull.floor,mat(),wood.inner);
    draw(hullRail,mat(),wood.edge);

    // Individually spaced wood floorboards with contrasting joints.
    for(let i=0;i<14;i++){
      const x=-1.63+i*.245,w=hullWidth(x)*1.20;
      box([x,.407,0],i%4===0?wood.inner:color.plank,[.193,.038,w]);
      box([x+.101,.421,0],wood.seam,[.014,.012,w*.99]);
    }
    // A lower, more believable seated rowing bench, supported by two feet.
    for(const side of [-1,1])box([-.48,.51,side*.48],wood.rib,[.115,.23,.13]);
    box([-.48,.638,0],wood.edge,[.45,.078,1.28]);
    box([-.48,.609,0],wood.rib,[.46,.075,1.30]);
    box([-.48,.662,0],color.plank,[.44,.055,1.27]);

    // Longitudinal keel strip and internal strengthening ribs.
    box([.01,.434,0],wood.seam,[3.14,.028,.055]);
    for(const x of [-1.28,-.87,.35,.91,1.29]){
      const w=hullWidth(x);
      box([x,.49,0],wood.rib,[.075,.12,w*1.47]);
      for(const side of [-1,1])bone([x,.49,side*w*.66],[x,hullTop(x)-.13,side*w*.91],.028,wood.rib);
    }
    // Bound bow/stern rim and small prow rail protect curved tips.
// Closed bow / stern rim caps so the boat does not look split open.
for (const end of [-1, 1]) {
  const xMid = end * 1.66;
  const xTip = end * 1.92;
  const yMid = hullTop(xMid);
  const yTip = hullTop(xTip) - 0.01;

  // top rim closure
  bone([xMid, yMid, -0.18], [xTip, yTip, 0], .052, wood.edge);
  bone([xTip, yTip, 0], [xMid, yMid, 0.18], .052, wood.edge);

  // vertical center post to visually seal the opening
  bone([xTip, 0.47, 0], [xTip, yTip, 0], .036, wood.rib);

  // lower inner closure
  bone([xMid, 0.46, -0.05], [xTip, 0.46, 0], .052, wood.rib);
  bone([xTip, 0.46, 0], [xMid, 0.46, 0.05], .052, wood.rib);
}

    // Gunwale-mounted oarlocks are stationary and are distinct from hands.
    for(const side of [-1,1]){
      const p=[-.22,.924,side*.78];
      bone([p[0],.81,p[2]],p,.052,color.metal);
      ball(p,color.metal,[.08,.067,.08]);
      for(const dx of [-.052,.052]){
        bone([p[0]+dx,p[1]-.022,p[2]],[p[0]+dx,p[1]+.08,p[2]],.022,color.metal);
      }
    }
    for(const side of [-1,1])for(const x of [-1.32,-.80,.26,.85,1.36]){
      ball([x,hullTop(x)+.001,side*hullWidth(x)],wood.edge,[.026,.026,.028]);
    }
  }

  function strokeBlend(t){return smooth(clamp(t,0,1));}
  function oarPose(t,side){
    // The blade travels in four continuous phases. The yaw sweep is in the
    // horizontal boat plane; pitch only changes slightly to raise the blade.
    let sweep,lift;
    if(t<.10){
      let u=strokeBlend(t/.10);sweep=mix(.68,.72,u);lift=mix(-.12,-.425,u);
    }else if(t<.53){
      let u=strokeBlend((t-.10)/.43);sweep=mix(.72,-.57,u);lift=-.425;
    }else if(t<.68){
      let u=strokeBlend((t-.53)/.15);sweep=mix(-.57,-.54,u);lift=mix(-.425,-.12,u);
    }else{
      let u=strokeBlend((t-.68)/.32);sweep=mix(-.54,.68,u);lift=-.12;
    }
    const pivot=[-.22,.924,side*.78];
    const horizontal=unit([sweep,0,side*.90]);
    const h=Math.sqrt(Math.max(.01,1-lift*lift));
    const dir=[horizontal[0]*h,lift,horizontal[2]*h];
    // The inner handle is about 25% of shaft length (real leverage), while
    // the broad blade occupies only the distal 0.66 units of the long arm.
    const grip=add(pivot,mul(dir,-.53));
    const shaftEnd=add(pivot,mul(dir,1.59));
    const bladeStart=add(pivot,mul(dir,1.56));
    const bladeEnd=add(pivot,mul(dir,2.22));
    return {pivot,grip,shaftEnd,bladeStart,bladeEnd,dir};
  }

  // Solve an elbow from shoulder + hand using fixed upper/forearm lengths.
  // The pole provides a consistent outward elbow bend on both sides.
  function solveElbow(shoulder,hand,side){
    const delta=sub(hand,shoulder),d=Math.hypot(...delta),axis=unit(delta);
    const upper=.425,lower=.425;
    const cd=clamp(d,.001,upper+lower-.001);
    const along=(upper*upper-lower*lower+cd*cd)/(2*cd);
    const height=Math.sqrt(Math.max(0,upper*upper-along*along));
    const pole=unit([-.22,.28,side*1.0]);
    const perpendicular=unit(sub(pole,mul(axis,dot(pole,axis))));
    return add(add(shoulder,mul(axis,along)),mul(perpendicular,height));
  }

  function drawMajhi(t,showRig){
    const oars=[oarPose(t,-1),oarPose(t,1)];
    const pressure=t>=.10&&t<.53?Math.sin(PI*(t-.10)/.43):0;
    const leanX=.045*Math.sin(TAU*t)-.075*pressure;
    const chest=[-.47+leanX,1.345,0];
    const hip=[-.49,.83,0];
    draw(lapFabric,mat([hip[0]+.045,hip[1]-.085,0]),color.lungi);
    draw(shirtMesh,mat(chest),color.shirt);

    // Collar / placket, shoulder seams and cloth folds.
    ball([chest[0]-.014,chest[1]+.257,0],shirtLight,[.135,.035,.147]);
    box([chest[0]+.244,chest[1]+.058,0],shirtShadow,[.018,.18,.028]);
    for(const side of [-1,1]){
      bone([chest[0]+.06,chest[1]+.09,side*.32],
           [chest[0]-.045,chest[1]-.015,side*.35],.012,shirtShadow);
    }
    // Neck joins the collar and chin, rather than emerging as a tall rod.
    bone([chest[0]+.001,1.59,0],[chest[0]+.018,1.68,0],.102,color.skin);
    const head=[chest[0]+.02,1.825,0];
    draw(headMesh,mat(head),color.skinLight);
    draw(hairMesh,mat(head),color.hair);
    for(const side of [-1,1]){
      ball([head[0]-.04,head[1]-.02,side*.204],color.skin,[.037,.070,.033]);
      // Eye whites, small pupils and heavier brow to read at boat scale.
      ball([head[0]+.175,head[1]-.018,side*.086],color.white,[.027,.026,.033]);
      ball([head[0]+.197,head[1]-.018,side*.086],color.eye,[.012,.015,.015]);
      bone([head[0]+.168,head[1]+.031,side*.060],[head[0]+.170,head[1]+.036,side*.112],.013,color.hair);
      // Sideburn adds shape to hairline.
      ball([head[0]-.045,head[1]+.067,side*.182],color.hair,[.053,.068,.038]);
    }
    ball([head[0]+.189,head[1]-.087,0],color.skin,[.045,.053,.038]);
    for(const side of [-1,1])ball([head[0]+.172,head[1]-.123,side*.044],color.hair,[.031,.014,.047]);
    // Short jawline / stubble, deliberately subtle on the adult face.
    ball([head[0]+.040,head[1]-.195,0],skinDark,[.092,.023,.124]);

    // Feet and knees stay inside the hull instead of going through the floor.
    for(const side of [-1,1]){
      const thigh=[-.47,.70,side*.18],knee=[-.02,.605,side*.235],ankle=[.28,.475,side*.26];
      bone(thigh,knee,.145,color.lungi);
      ball(knee,color.lungi,[.145,.133,.15]);
      bone(knee,ankle,.100,color.skin);
      ball([.37,.475,side*.26],color.sandals,[.157,.043,.095]);
      bone([.295,.51,side*.26],[.385,.51,side*.26],.020,color.rope);
      // Simple understated fabric hem.
      bone([knee[0]-.056,knee[1]+.025,knee[2]],[knee[0]+.076,knee[1]+.006,knee[2]],.013,wood.edge);
    }

    for(const side of [-1,1]){
      const o=oars[side===-1?0:1];
      // One continuous shaft from handle through the oarlock. Distal section
      // thickens slightly into a properly shaped and rounded wooden blade.
      bone(o.grip,o.shaftEnd,.039,wood.edge);
      draw(paddleBlade,between(o.bladeStart,o.bladeEnd,.43,.09),wood.inner);
      // Decorative rope binding exactly where the shaft touches the oarlock.
      ball(o.pivot,color.rope,[.043,.042,.043]);
      // Grip positions drive the rig. Two-bone inverse kinematics determines
      // the elbow rather than arbitrary animated elbow offsets.
      const shoulder=[chest[0]+.040,1.505,side*.290];
      const elbow=solveElbow(shoulder,o.grip,side);
      ball(shoulder,color.shirt,[.142,.144,.150]);
      bone(shoulder,elbow,.112,color.shirt);
      // Shirt sleeve cuff provides transition from fabric to forearm.
      const cuff=add(shoulder,mul(sub(elbow,shoulder),.78));
      bone(add(cuff,mul(unit(sub(shoulder,elbow)),.028)),
           add(cuff,mul(unit(sub(elbow,shoulder)),.028)),.117,shirtLight);
      ball(elbow,color.skin,[.085,.086,.090]);
      bone(elbow,o.grip,.081,color.skinLight);
      ball(o.grip,color.skin,[.085,.087,.081]);
      // Small thumb wrap visually reads as a hand gripping wooden oar.
      ball(add(o.grip,[.027,-.016,side*.035]),color.skinLight,[.034,.042,.042]);
      if(showRig){
        ball(o.pivot,[1,.27,.18],[.065,.065,.065]);
        ball(o.grip,[.20,.92,.43],[.064,.064,.064]);
        ball(elbow,[1,.84,.24],[.052,.052,.052]);
        bone(o.pivot,o.grip,.012,[.20,.92,.43]);
      }
    }
  }
  // Camera and perspective matrices (column-major, native WebGL format).
  function perspective(fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  function lookAt(eye,center){
    const z=unit(sub(eye,center)),x=unit(cross([0,1,0],z)),y=cross(z,x);
    return new Float32Array([
      x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
      -dot(x,eye),-dot(y,eye),-dot(z,eye),1
    ]);
  }
  const presets={
    threequarter:{yaw:.58,pitch:.29,distance:4.5,target:[0,1.10,0]},
    front:{yaw:0,pitch:.19,distance:4.2,target:[0,1.10,0]},
    side:{yaw:PI/2,pitch:.14,distance:4.2,target:[0,1.06,0]},
    rear:{yaw:PI,pitch:.15,distance:4.2,target:[0,1.10,0]},
    top:{yaw:.50,pitch:1.10,distance:5.25,target:[0,.88,0]},
    closeup:{yaw:.36,pitch:.12,distance:2.55,target:[-.45,1.55,0]}
  };
  const cam={...presets.threequarter,target:[...presets.threequarter.target]};
  function selectView(name){
    const p=presets[name]; if(!p)return;
    Object.assign(cam,{...p,target:[...p.target]});
    document.querySelectorAll('.view-btn').forEach(btn=>{
      const on=btn.dataset.view===name;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
  }
  document.querySelectorAll('.view-btn').forEach(btn=>btn.addEventListener('click',()=>selectView(btn.dataset.view)));
  $('resetCamera').addEventListener('click',()=>selectView('threequarter'));
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    cam.yaw-=dx*.007;
    cam.pitch=clamp(cam.pitch+dy*.006,-.12,1.39);
    pointer.x=e.clientX;pointer.y=e.clientY;
    document.querySelectorAll('.view-btn').forEach(btn=>{btn.classList.remove('active');btn.setAttribute('aria-pressed','false');});
  });
  const release=e=>{if(pointer&&e.pointerId===pointer.id)pointer=null;};
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('wheel',e=>{e.preventDefault();cam.distance=clamp(cam.distance*Math.exp(e.deltaY*.001),1.8,14);},{passive:false});

  const state={phase:0,speed:1,running:true,lighting:0,showRig:false,showWater:true};
  const tempo=$('rowingSpeed'),stroke=$('strokePhase');
  function updatePauseButton(){
    $('pauseRowing').textContent=state.running?'Pause Rowing':'Resume Rowing';
    $('pauseRowing').setAttribute('aria-pressed',String(!state.running));
    $('animationStatus').textContent=state.running?'Running':'Paused';
  }
  $('pauseRowing').addEventListener('click',()=>{state.running=!state.running;updatePauseButton();});
  tempo.addEventListener('input',()=>{state.speed=Number(tempo.value);$('speedValue').textContent=state.speed.toFixed(1)+'x';});
  stroke.addEventListener('input',()=>{state.phase=Number(stroke.value)/100;state.running=false;updatePauseButton();updateStrokeInfo();});
  function updateStrokeInfo(){
    const p=state.phase;
    const info=p<.10?['Catch','The blades rotate down to engage the water.']:
      p<.53?['Drive','The oarlocks stay fixed as the blades sweep back.']:
      p<.68?['Release','The blades lift out of the water.']:
      ['Recovery','The handles return for the next stroke.'];
    $('phaseName').textContent=info[0];
    $('phaseDescription').textContent=info[1];
    $('phaseValue').textContent=Math.round(p*100)+'%';
  }
  document.querySelectorAll('.light-btn').forEach(btn=>btn.addEventListener('click',()=>{
    state.lighting=btn.dataset.light==='overcast'?1:0;
    document.querySelectorAll('.light-btn').forEach(b=>{
      const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
  }));
  $('showRig').addEventListener('change',e=>state.showRig=e.target.checked);
  $('showWater').addEventListener('change',e=>state.showWater=e.target.checked);

  // Very low-detail distant silhouettes are intentionally secondary to the model.
  const skyline=[
    {x:-8.5,z:-9.0,h:4.5,w:2.2,d:2.6,c:color.brick2},
    {x:-5.2,z:-10.6,h:6.1,w:2.0,d:2.5,c:color.concrete},
    {x:0,z:-11.7,h:5.2,w:2.6,d:2.2,c:color.brick},
    {x:5.1,z:-11.1,h:6.8,w:2.6,d:3.1,c:color.concrete},
    {x:8.7,z:-8.5,h:4.4,w:2.5,d:2.0,c:color.brick2}
  ];
  function drawSkyline(){
    for(const b of skyline){
      box([b.x,b.h*.5,b.z],b.c,[b.w,b.h,b.d]);
      box([b.x,b.h+.06,b.z],color.plankAlt,[b.w+.15,.12,b.d+.15]);
      // Subtle balconies, not window grids dominating the preview.
      for(let floor=1;floor<Math.floor(b.h);floor++){
        const y=floor+.12;
        for(const dx of [-.48,.48]){
          box([b.x+dx,y,b.z+b.d*.504],[.12,.21,.22],[.31,.46,.038]);
          box([b.x+dx,y-.28,b.z+b.d*.53],[.40,.43,.40],[.38,.06,.18]);
        }
      }
      box([b.x+b.w*.22,b.h+.25,b.z],color.hullDark,[.38,.38,.38]);
    }
  }

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(canvas.clientWidth*dpr));
    const h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
  }
  let previous=0,fpsClock=0,fpsFrames=0,lastFps=0,seconds=0;
  function frame(now){
    try {
      resize();
      const dt=previous?Math.min((now-previous)/1000,.05):0;
      previous=now;seconds+=dt;
      if(state.running){state.phase=(state.phase+dt*state.speed*.34)%1;stroke.value=String(Math.round(state.phase*100));}
      updateStrokeInfo();
      fpsClock+=dt;fpsFrames++;
      if(fpsClock>.65){
        lastFps=Math.round(fpsFrames/fpsClock);$('fpsValue').textContent=lastFps+' FPS';
        fpsClock=0;fpsFrames=0;
      }
      gl.clearColor(...(state.lighting===0?[.63,.76,.73,1]:[.52,.63,.68,1]));
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      const horiz=cam.distance*Math.cos(cam.pitch);
      const eye=[cam.target[0]+horiz*Math.cos(cam.yaw),cam.target[1]+cam.distance*Math.sin(cam.pitch),cam.target[2]+horiz*Math.sin(cam.yaw)];
      gl.uniformMatrix4fv(uni.view,false,lookAt(eye,cam.target));
      gl.uniformMatrix4fv(uni.proj,false,perspective(PI/3,canvas.width/canvas.height,.04,100));
      gl.uniform1f(uni.time,seconds);
      gl.uniform1i(uni.lighting,state.lighting);
      if(state.showWater)draw(water,mat(),[.08,.25,.28],1);
      // Keep the backdrop out of this focused mechanical inspection.
      // Dhaka architecture will have its own separate visual lab.
      drawBoat();
      drawMajhi(state.phase,state.showRig);
      gl.bindVertexArray(null);
      status.textContent='WebGL 2 active · Rowing 02.1 ready';
      requestAnimationFrame(frame);
    } catch(err) {
      console.error('Visual Lab 02:',err);
      fail('Rendering error: '+err.message);
    }
  }
  updatePauseButton();
  updateStrokeInfo();
  requestAnimationFrame(frame);
})();
