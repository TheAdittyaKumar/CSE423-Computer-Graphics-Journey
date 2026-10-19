/* Majhi Jaben?! — source-geometry browser port of the CSE423 PyOpenGL game.
 * Static geometry and character meshes exported from ORIGINAL Python rendering functions.
 * WebGL 1, no external packages or servers.
 * Original project: https://github.com/TheAdittyaKumar/CSE423-Computer-Graphics-Journey
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas=$('world'), weather=$('weather'), wx=weather.getContext('2d');
  const options={antialias:true,alpha:true,depth:true,powerPreference:'high-performance'};
  const gl=canvas.getContext('webgl',options)||canvas.getContext('experimental-webgl',options);
  if(!gl){
    window.majhiStartupError?.('WebGL unavailable', 'Enable graphics acceleration or try Chrome, Edge, or Firefox on a computer that supports WebGL.');
    return;
  }
  const TAU=Math.PI*2,RAD=Math.PI/180, BOUNDS=1650, WATER=0;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const distance=(x,z,X,Z)=>Math.hypot(x-X,z-Z);
  const rnd=(min,max)=>min+Math.random()*(max-min);
  // WebGL 1 requires matching precision for uniforms and varyings shared by shaders.
  // Select the best fragment precision available, then declare it on both sides.
  const precisionSupport=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  const sharedPrecision=precisionSupport&&precisionSupport.precision>0?'highp':'mediump';
  const VERT=`attribute vec3 aPos; attribute vec3 aColor; attribute float aKind;
  uniform mat4 uView,uProj,uModel;uniform ${sharedPrecision} float uTime;
  varying ${sharedPrecision} vec3 vColor,vWorld;varying ${sharedPrecision} float vKind,vDist;
  void main(){vec4 p=uModel*vec4(aPos,1.);if(aKind>.5&&aKind<1.5){
  float mainWave=sin(.032*(p.z+.18*p.x)-1.80*uTime);
  float crossWave=sin(.047*p.x-.014*p.z+1.13*uTime);
  float chop=sin(.085*p.z+.029*p.x-2.25*uTime);
  float relative=max(.22,.58+6.9*(.5+.5*mainWave)+1.25*crossWave+.60*chop+1.55*pow(max(0.,mainWave),6.));
  float radius=length(vec2(p.x,p.z-1378.));
  float daylight=clamp((560.-radius)/300.,0.,1.);
  daylight=daylight*daylight*(3.-2.*daylight);
  p.y=8.22+(relative-.22)*(1.-.70*daylight);
  }vWorld=p.xyz;vColor=aColor;vKind=aKind;vec4 view=uView*p;vDist=length(view.xyz);gl_Position=uProj*view;gl_Position.x=-gl_Position.x;}`;
  const FRAG=`precision ${sharedPrecision} float;varying vec3 vColor,vWorld;varying float vKind,vDist;uniform float uTime;
  void main(){vec3 c=vColor;float opacity=1.;if(vKind>.5&&vKind<1.5){opacity=.53;float a=sin(vWorld.x*.075+uTime*1.7+sin(vWorld.z*.02))*sin(vWorld.z*.11-uTime*1.2);
    float b=pow(max(0.,sin(vWorld.x*.036+vWorld.z*.044+uTime*2.1)),13.);
    c+=vec3(.018,.054,.080)*a+vec3(.10,.17,.18)*b;
  }else if(vKind>1.5){
    float radial=length(vec2(vWorld.x,vWorld.z-1378.));
    float radialFade=1.0-smoothstep(260.,540.,radial);
    float heightFade=1.0-smoothstep(480.,1600.,vWorld.y);
    opacity=(.065+.060*(.5+.5*sin(uTime*1.9+vWorld.x*.008)))*radialFade*(.55+.45*heightFade);
  }
  float f=smoothstep(940.,3300.,vDist);c=mix(c,vec3(.16,.228,.287),f);gl_FragColor=vec4(c,opacity);}`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){throw Error(gl.getProgramInfoLog(prog));}
  gl.useProgram(prog);
  const attrs={pos:gl.getAttribLocation(prog,'aPos'),color:gl.getAttribLocation(prog,'aColor'),kind:gl.getAttribLocation(prog,'aKind')};
  const uniforms={view:gl.getUniformLocation(prog,'uView'),proj:gl.getUniformLocation(prog,'uProj'),model:gl.getUniformLocation(prog,'uModel'),time:gl.getUniformLocation(prog,'uTime')};
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy*.5),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function norm(a){const m=Math.hypot(...a)||1;return a.map(x=>x/m);}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function lookAt(eye,target){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([
    x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
    -x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
  function model(x=0,y=0,z=0,angle=0,scale=1){const c=Math.cos(angle*RAD)*scale,s=Math.sin(angle*RAD)*scale;return new Float32Array([c,0,s,0,0,scale,0,0,-s,0,c,0,x,y,z,1]);}
  const ID=model();
  // All geometry is built as interleaved position, vertex color, material kind.
  class Mesh {
    constructor(){this.data=[];this.buffer=null;this.length=0;}
    v(p,c,k=0){this.data.push(p[0],p[1],p[2],c[0],c[1],c[2],k);}
    tri(a,b,c,col,kind=0){this.v(a,col,kind);this.v(b,col,kind);this.v(c,col,kind);}
    quad(a,b,c,d,col,kind=0){this.tri(a,b,c,col,kind);this.tri(a,c,d,col,kind);}
    box(x,y,z,w,h,d,col){const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-d/2,z1=z+d/2;const tint=n=>col.map(v=>clamp(v*n,0,1));
      this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],tint(.93));
      this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],tint(.7));
      this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],tint(.85));
      this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],tint(.78));
      this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],tint(1.15));
      this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],tint(.6));}
    cylinder(x,y,z,r,h,col,steps=10){const y0=y-h/2,y1=y+h/2;for(let i=0;i<steps;i++){const a=i*TAU/steps,b=(i+1)*TAU/steps,ax=Math.cos(a)*r,az=Math.sin(a)*r,bx=Math.cos(b)*r,bz=Math.sin(b)*r;const shade=1-.18*Math.sin(a);const c=col.map(v=>clamp(v*shade,0,1));this.quad([x+bx,y0,z+bz],[x+ax,y0,z+az],[x+ax,y1,z+az],[x+bx,y1,z+bz],c);this.tri([x,y1,z],[x+bx,y1,z+bz],[x+ax,y1,z+az],col);}}
    sphere(x,y,z,r,col,rings=5,segments=9){for(let i=0;i<rings;i++){const a=-Math.PI/2+i*Math.PI/rings,b=-Math.PI/2+(i+1)*Math.PI/rings;for(let k=0;k<segments;k++){const t=k*TAU/segments,u=(k+1)*TAU/segments;const pt=(ang,th)=>[x+r*Math.cos(ang)*Math.cos(th),y+r*Math.sin(ang),z+r*Math.cos(ang)*Math.sin(th)];this.quad(pt(a,t),pt(b,t),pt(b,u),pt(a,u),col.map(c=>c*(.85+.15*Math.sin(b))));}}}
    ring(x,y,z,r,thickness,col,n=32){for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;const p=(R,t)=>[x+Math.cos(t)*R,y,z+Math.sin(t)*R];this.quad(p(r-thickness,a),p(r-thickness,b),p(r,b),p(r,a),col);}}
    disk(x,y,z,r,col,n=25){for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;this.tri([x,y,z],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],col);}}
    upload(){this.length=this.data.length/7;const arr=new Float32Array(this.data);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);this.data=[];return this;}
  }
  function render(mesh,mat=ID){if(!mesh||!mesh.length)return;gl.uniformMatrix4fv(uniforms.model,false,mat);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    gl.vertexAttribPointer(attrs.pos,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(attrs.color,3,gl.FLOAT,false,28,12);gl.vertexAttribPointer(attrs.kind,1,gl.FLOAT,false,28,24);
    gl.drawArrays(gl.TRIANGLES,0,mesh.length);}
  for(const k of Object.values(attrs))gl.enableVertexAttribArray(k);
  const C={water:[.052,.185,.257],stone:[.46,.53,.54],brick:[.55,.38,.33],sand:[.68,.62,.51],concrete:[.65,.67,.62],window:[.08,.22,.32],reflect:[.24,.44,.53],green:[.20,.46,.38],pale:[.91,.90,.82],gold:[.95,.78,.42],warm:[.85,.60,.36],dark:[.13,.23,.28],teal:[.12,.40,.43],red:[.96,.30,.20]};
  const buildingXs=[-1375,-825,-275,275,825,1375], buildingZs=[-1375,-875,-325,225,775];
  const buildings=[];for(let r=0;r<buildingZs.length;r++)for(let c=0;c<buildingXs.length;c++){
    const x=buildingXs[c],z=buildingZs[r];if(z>=775&&Math.abs(x)<500)continue;
    buildings.push({x,z,hw:115+(r+c)%3*12,hd:125+(r*2+c)%3*10,h:160+(r*3+c*2)%5*38,idx:r*6+c});
  }
  const cars=[[-1100,-920,90],[-550,-320,90],[0,-720,90],[550,260,90],[1100,-380,90],[-820,500,0],[760,1050,0],[-260,-1150,0]];
  // The Python game offsets alternating lanes by 0.22 * 210 world units.
  const parkedCars=cars.map(([x,z,heading],i)=>({x:x+(Math.abs(heading-90)<.1?(i%2?1:-1)*46.2:0),z:z+(Math.abs(heading-90)>=.1?(i%2?1:-1)*46.2:0),angle:heading,style:i}));
  const trees=[[-1552,335,.86],[-1545,120,.76],[-215,875,.93],[402,890,.82],[-1530,-1330,.72],[1562,-959,.86],[-145,852,.91],[1545,-230,.78],[-1260,-1540,.96],[1541,847,.76],[1545,-365,.87],[-1550,-230,.84],[-1545,-420,.70],[1555,100,.74]];
  const power=[{name:'CENTRAL',x:125,z:-600},{name:'WEST',x:-975,z:500},{name:'EAST',x:1225,z:500}];
  // Exact campus collision volumes from the original Python, not a single oversized block.
  const campusSolids=[[-132,1370,89,191],[38,1508,259,66],[206,1462,59,112],[-8,1400,58,66],[-56,1240,38,49],[44,1238,34,49]];
  const homeStarts=[[-275,-1375],[275,-1375],[-825,-875],[825,-875],[-275,-325],[275,-325],[-825,225],[825,225],[-825,775],[825,775],[-1375,-875],[1375,-325],[-1375,225],[1375,225],[-275,-875],[275,-875]];
  const sosStarts=[[0,-1150],[-550,-1150],[550,-1150],[-1100,-600],[1100,-600],[-550,-600],[550,-600],[0,-50],[-1100,-50],[1100,-50],[-550,500],[550,500],[-1100,1050],[1100,1050],[-550,1050],[550,1050]];
  const students=['Adittya','Usaeed','Nafisa','Sujail','Kazmi','Safin','Shammo','Fahim','Rafi','Nabil','Sadia','Tanvir','Mushfiq','Jara','Tahmid','Nusrat','Riad','Faria','Zarin','Adnan'];
  const studentColors=[[.95,.38,.21],[.32,.79,.91],[.91,.68,.21],[.66,.46,.91],[.39,.88,.61],[.92,.44,.68]];
  const currents=[{name:'WEST CURRENT',a:-1260,b:-940,c:-450,d:200,dx:39,dz:4},{name:'CENTRAL CURRENT',a:-150,b:150,c:-950,d:-350,dx:-38,dz:0},{name:'EAST CURRENT',a:430,b:680,c:150,d:850,dx:0,dz:-43},{name:'NORTH CURRENT',a:-700,b:-390,c:710,d:1150,dx:34,dz:0}];
  function valid(x,z,margin=0){if(Math.abs(x)>1615||Math.abs(z)>1615)return false;
    for(const b of buildings)if(Math.abs(x-b.x)<b.hw+25+margin&&Math.abs(z-b.z)<b.hd+25+margin)return false;
    for(const [cx,cz,hw,hd] of campusSolids)if(Math.abs(x-cx)<=hw+25+margin&&Math.abs(z-cz)<=hd+25+margin)return false;
    if(Math.abs(x-825)<156+margin&&z>1255-margin&&z<1432+margin)return false;
    return true;
  }
  const homes=[];homeStarts.forEach(([x,z],i)=>{const b=buildings.find(t=>t.x===x&&t.z===z);if(!b)return;
    const road=[-1150,-600,-50,500,1050].reduce((p,v)=>Math.abs(v-z)<Math.abs(p-z)?v:p,-1150);
    const dir=road>z?1:-1, dock=z+dir*(b.hd+110);if(valid(x,dock))homes.push({id:`H${i+1}`,x,z:dock,doorX:x,doorZ:z+dir*(b.hd+30),personX:x,personZ:z+dir*(b.hd+30),facadeZ:z+dir*(b.hd+2),frontDir:dir,type:'HOME',name:`Home ${String(i+1).padStart(2,'0')}`});
  });
  const rescues=sosStarts.map(([x,z],i)=>({id:`S${i+1}`,x,z,type:'DROWNING',personX:x,personZ:z,name:`Flooded Street ${String(i+1).padStart(2,'0')}`})).filter(t=>valid(t.x,t.z));
  // Build environment mesh; source map coordinates and mission markers are preserved.
  const city=new Mesh();
  const cityPalette=[[.45,.53,.56],[.61,.50,.45],[.45,.54,.52],[.55,.49,.56],[.53,.57,.53]];
  function makeBuilding(b){const color=cityPalette[b.idx%5], y=b.h*.5-21;
    city.box(b.x,y,b.z,b.hw*2,b.h,b.hd*2,color);city.box(b.x,b.h-18,b.z,b.hw*2+9,8,b.hd*2+8,C.stone);
    city.box(b.x,b.h-7,b.z,b.hw*1.45,16,b.hd*1.45,C.dark);
    for(const side of [-1,1]){for(let level=0;level<Math.floor(b.h/33)-1;level++)for(let k=-2;k<=2;k++){
      const wx=b.x+(k/2.6)*b.hw, wZ=b.z+side*(b.hd+1.4),wy=27+level*31;
      city.box(wx,wy,wZ,b.hw*.25,19,2,(level+k+b.idx)%5===0?[.29,.37,.38]:C.window);
      city.box(wx,wy+7.1,wZ+side*1,Math.max(8,b.hw*.08),2,1,C.reflect);
    }}
    for(const side of [-1,1])for(let level=0;level<Math.floor(b.h/35)-1;level++)for(let k=-1;k<=1;k++){
      city.box(b.x+side*(b.hw+2),27+level*34,b.z+k*b.hd*.56,2,21,b.hd*.32,C.window);
    }
    const seed=(b.idx*7)%3;city.box(b.x-b.hw*.35,b.h+4,b.z+b.hd*.15,38+seed*12,29,40,C.dark);
    city.cylinder(b.x+b.hw*.43,b.h+20,b.z-b.hd*.2,3,44,C.stone,7);
    city.box(b.x,b.h*.33,b.z+b.hd+4,b.hw*.9,10,5,[.22,.39,.41]);
  }
  for(const b of buildings)makeBuilding(b);
  // BRAC University inspired skyline and its iconic impossible patch of sunshine.
  city.box(-128,155,1380,183,330,360,[.64,.58,.53]);
  city.box(74,148,1490,394,322,132,[.71,.70,.64]);
  city.box(205,135,1415,120,289,197,[.71,.69,.62]);
  city.box(-8,52,1360,104,113,95,[.67,.48,.39]);
  city.box(35,57,1190,245,88,43,[.56,.34,.27]);
  city.box(35,96,1165,284,14,54,[.81,.74,.57]);
  city.box(35,24,1129,239,48,35,[.31,.39,.40]);
  for(let j=0;j<11;j++)for(let i=0;i<6;i++){
    const x=-203+j*16.0;
    city.box(x,118+i*30,1198,10,20,3,[.064,.18,.31]);
  }
  for(let j=0;j<13;j++)for(let i=0;i<7;i++){
    city.box(-95+j*28,90+i*30,1422,18,20,3,[.075,.18,.29]);
  }
  for(let j=0;j<9;j++)city.box(-105+j*32,67,1147,8,68,8,[.75,.72,.62]);
  city.box(35,106,1136,276,33,9,[.14,.31,.35]);
  city.box(35,126,1131,163,24,5,[.88,.73,.43]);
  city.box(-127,325,1380,210,14,379,C.concrete);
  city.box(75,317,1490,417,10,160,[.48,.54,.53]);
  // Flooded roads: pale center lines and hints of submerged asphalt.
  for(const x of [-1100,-550,0,550,1100])for(let z=-1600;z<1650;z+=110)city.box(x,-.3,z,5,.5,43,[.29,.45,.47]);
  for(const z of [-1150,-600,-50,500,1050])for(let x=-1600;x<1650;x+=110)city.box(x,-.3,z,43,.5,5,[.27,.41,.45]);
  // Shaheed Minar: five white memorial structures with red sun disc.
  const sx=825,sz=1350;
  city.box(sx,13,sz,285,24,120,[.57,.56,.50]);
  for(let i=-2;i<=2;i++){
    const x=sx+i*44,h=(i===0?155:i===-1||i===1?130:105);
    city.box(x,h/2+26,sz,15,h,13,C.pale);
    city.box(x,28,sz,27,46,18,C.pale);
  }
  city.box(sx,175,sz,95,13,23,C.pale);
  // Red sun is vertical in the X/Y plane, represented as a thin fan.
  for(let i=0;i<30;i++){
    const a=i*TAU/30,b=(i+1)*TAU/30;
    city.tri([sx,121,sz+5],[sx+42*Math.cos(a),121+42*Math.sin(a),sz+5],[sx+42*Math.cos(b),121+42*Math.sin(b),sz+5],C.red);
  }
  city.ring(sx,1.5,1080,58,6,[1,.61,.23]);
  // Street lamp posts and foliage.
  for(const [tx,tz,s] of trees){city.cylinder(tx,19*s,tz,5.5*s,43*s,[.35,.29,.24],7);city.sphere(tx,48*s,tz,26*s,C.green,4,8);city.sphere(tx+15*s,36*s,tz-6*s,19*s,[.17,.39,.34],4,8);}
  for(const x of [-1100,-550,0,550,1100])for(let z=-1400;z<1200;z+=440){
    const px=x+90;if(Math.abs(px)<160&&Math.abs(z+50)<150)continue;
    city.cylinder(px,43,z,3.4,85,[.39,.44,.46],6);city.box(px+15,83,z,31,3,4,[.4,.45,.47]);
    city.box(px+28,78,z,9,7,12,[.96,.78,.47]);
  }
  // Bazar stalls, small neighborhood storefronts.
  for(const [sx,sz] of [[178,885],[-367,885],[320,715]]){
    city.box(sx,19,sz,118,37,92,[.48,.34,.25]);city.box(sx,41,sz,139,7,108,[.16,.42,.45]);
    for(let k=-2;k<=2;k++)city.box(sx+k*24,46,sz-50,12,5,9,k%2?[.88,.61,.36]:[.81,.29,.23]);
    city.box(sx,25,sz-54,90,27,4,[.75,.63,.44]);
  }
  // Yellow BRACU destination pad, visible when approaching the gate.
  city.ring(0,2,1080,113,8,[.92,.76,.38]);city.disk(0,1.5,1080,20,[.95,.82,.42]);
  // Stop line and city traffic light stand.
  city.box(0,1,-170,205,.8,8,[.96,.80,.39]);
  city.cylinder(145,49,-55,5,102,[.56,.55,.47],8);city.box(145,106,-55,22,52,21,[.23,.29,.28]);
  city.upload();
  const waterMesh=new Mesh(), SIZE=1700,STEP=48;
  for(let x=-SIZE;x<SIZE;x+=STEP)for(let z=-SIZE;z<SIZE;z+=STEP){const c=[.061+(.008*Math.sin(x*.01+z*.03)),.187,.252];waterMesh.quad([x,8,z],[x+STEP,8,z],[x+STEP,8,z+STEP],[x,8,z+STEP],c,1);}waterMesh.upload();
  // Local meshes drawn with per-instance transforms.
  // OFFLINE EXPORTED SOURCE GEOMETRY. The binary comes from the original
  // renderSingleBuildingGeometry, renderBRACUStaticGeometry, drawCityTree,
  // renderCinematicBoatHull and other Python draw functions, not hand-made JS boxes.
  let sourceMeshes=null, sourceLoadError=null;
  async function loadSourceGeometry(){
    const [iResponse,vResponse]=await Promise.all([fetch('./original-geometry.json?v=fidelity6'),fetch('./original-geometry.bin?v=fidelity5')]);
    if(!iResponse.ok||!vResponse.ok)throw new Error('Original source geometry files missing — upload both original-geometry files into docs.');
    const index=await iResponse.json(),bytes=await vResponse.arrayBuffer();
    const source=new Float32Array(bytes),meshes={};
    for(const [name,range] of Object.entries(index)){
      const start=range.start*7,end=(range.start+range.count)*7;
      if(end>source.length)throw Error('Original geometry data truncated: '+name);
      const mesh=new Mesh();mesh.length=range.count;mesh.buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,source.subarray(start,end),gl.STATIC_DRAW);
      meshes[name]=mesh;
    }
    sourceMeshes=meshes;
    window.majhiSourcePort={loaded:true,groups:Object.keys(index),vertexCount:source.length/7};
    console.info('Original Python scene geometry loaded:',window.majhiSourcePort);
    const status=$('engine-status');if(status){status.textContent='✓ Original game geometry loaded';status.style.color='#a7dbc6';}
  }
  loadSourceGeometry().catch(e=>{sourceLoadError=e.message;console.error('Original source geometry:',e);
    window.majhiStartupError?.('Original geometry failed to load',e.message);});
  const boatMesh=new Mesh();
  const stations=[[-100,10],[-92,29],[-66,37],[-24,41],[25,42],[72,35],[100,24],[123,1]];
  for(const side of [-1,1])for(let i=0;i<stations.length-1;i++){
    const [a,w]=stations[i],[b,v]=stations[i+1];
    boatMesh.quad([a,8,side*w],[b,8,side*v],[b,-5,side*(v-4)],[a,-5,side*(w-4)],side===1?[.18,.54,.56]:[.15,.43,.47]);
    boatMesh.quad([a,9,side*(w-1)],[b,9,side*(v-1)],[b,7,side*(v-8)],[a,7,side*(w-8)],[.76,.58,.35]);
  }
  for(let i=1;i<stations.length-2;i++){const [a,w]=stations[i],[b,v]=stations[i+1];boatMesh.quad([a,-2,-w+5],[b,-2,-v+5],[b,-2,v-5],[a,-2,w-5],[.45,.32,.22]);}
  for(const bx of [-50,8,65])boatMesh.box(bx,4,0,12,6,62,[.70,.51,.31]);
  boatMesh.box(-90,8,0,17,10,48,[.52,.38,.24]);
  boatMesh.box(100,8,0,13,11,29,[.28,.49,.48]);
  boatMesh.upload();
  const paddleMesh=new Mesh();paddleMesh.cylinder(0,0,0,2.8,95,[.55,.38,.24],8);paddleMesh.box(0,-43,0,15,22,6,[.73,.49,.27]);paddleMesh.upload();
  const carMesh=new Mesh();carMesh.box(0,6,0,88,25,44,[.36,.43,.47]);carMesh.box(3,21,0,49,19,41,[.22,.30,.34]);carMesh.box(-8,34,0,24,3,38,[.40,.49,.50]);carMesh.box(40,9,0,4,12,33,[.78,.35,.23]);carMesh.box(-40,9,0,4,13,33,[.87,.67,.38]);carMesh.upload();
  const npcMeshes=studentColors.map(color=>{const m=new Mesh();m.cylinder(0,14,0,7,24,color,8);m.sphere(0,32,0,9,[.78,.55,.38],4,8);m.cylinder(-9,16,0,3,22,[.77,.55,.40],6);m.cylinder(9,18,0,3,28,[.77,.55,.40],6);m.cylinder(-4,2,0,2.4,10,[.20,.29,.37],6);m.cylinder(4,2,0,2.4,10,[.20,.29,.37],6);return m.upload();});
  const markerMesh=new Mesh();markerMesh.ring(0,0,0,36,6,[.97,.43,.27]);markerMesh.upload();
  const debrisMesh=new Mesh();debrisMesh.box(0,1,0,56,15,33,[.35,.30,.22]);debrisMesh.box(9,8,0,10,8,29,[.48,.34,.23]);debrisMesh.upload();
  const powerMesh=new Mesh();powerMesh.box(0,27,0,36,48,32,[.29,.32,.32]);powerMesh.box(0,30,-18,23,25,4,[.90,.19,.15]);powerMesh.upload();
  const markerGoal=new Mesh();markerGoal.ring(0,0,0,52,6,[.97,.81,.31]);markerGoal.upload();
  const waterRipple=new Mesh();waterRipple.ring(0,0,0,18,2.4,[.66,.89,.90]);waterRipple.upload();
  // Procedural transparent BRACU sun aura: the Python version draws pulsing
  // golden rings and a sunshine cone only over its safe campus district.
  const sunshineAura=new Mesh();
  for(let layer=0;layer<3;layer++){
    const rad=365-layer*36;
    for(let i=0;i<80;i++){
      const t=i*TAU/80,u=(i+1)*TAU/80;
      const pos=(r,a,y)=>[r*Math.cos(a),y,1378+r*Math.sin(a)];
      sunshineAura.quad(pos(rad-4,t,18.2+layer*.18),pos(rad-4,u,18.2+layer*.18),pos(rad,u,18.2+layer*.18),pos(rad,t,18.2+layer*.18),[1,.87,.39],2);
    }
  }
  for(let i=0;i<64;i++){
    const t=i*TAU/64,u=(i+1)*TAU/64;
    sunshineAura.quad([365*Math.cos(t),18.5,1378+365*Math.sin(t)],
      [365*Math.cos(u),18.5,1378+365*Math.sin(u)],
      [175*Math.cos(u),760,1415+175*Math.sin(u)],
      [175*Math.cos(t),760,1415+175*Math.sin(t)],[.97,.94,.70],2);
  }
  // Light opening in the otherwise storm-dark sky, behind the campus.
  sunshineAura.quad([-530,25,1645],[530,25,1645],[360,1370,1645],[-360,1370,1645],[.68,.84,.87],2);
  sunshineAura.upload();
  const sunshineSun=new Mesh();sunshineSun.sphere(290,700,1525,33,[.98,.91,.65],8,13);sunshineSun.upload();
  const signalRed=new Mesh();signalRed.sphere(145,120,-68,9,[1,.15,.1],4,10);signalRed.upload();
  const signalGreen=new Mesh();signalGreen.sphere(145,120,-68,9,[.17,1,.38],4,10);signalGreen.upload();


  // BRAC UNIVERSITY facade lettering (original GLUT stroke text cannot be baked as triangles).
  // Characters are small actual 3D meshes on the south-facing entrance fascia.
  const campusLettering=new Mesh();
  const font5={A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],I:['11111','00100','00100','00100','00100','00100','11111'],N:['10001','11001','10101','10101','10011','10001','10001'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],Y:['10001','10001','01010','00100','00100','00100','00100']};
  const legend='BRAC UNIVERSITY', unit=1.53, startX=-6-legend.length*6*unit/2;
  for(let i=0;i<legend.length;i++){const bitmap=font5[legend[i]];if(!bitmap)continue;for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(bitmap[row][col]==='1')campusLettering.quad([startX+(i*6+col)*unit,151-row*unit,1134.0],[startX+(i*6+col+1)*unit,151-row*unit,1134.0],[startX+(i*6+col+1)*unit,152-(row+1)*unit,1134.0],[startX+(i*6+col)*unit,152-(row+1)*unit,1134.0],[.96,.92,.72]);}
  campusLettering.upload();
  // The Python shop renderer uses glutStrokeCharacter(), which the offline
  // triangle exporter cannot export. Rebuild these original signs as world-
  // space pixel-stroke meshes, attached to the exact original facade planes.
  const signGlyphs={
    A:['01110','10001','10001','11111','10001','10001','10001'],
    B:['11110','10001','10001','11110','10001','10001','11110'],
    C:['01111','10000','10000','10000','10000','10000','01111'],
    D:['11110','10001','10001','10001','10001','10001','11110'],
    E:['11111','10000','10000','11110','10000','10000','11111'],
    F:['11111','10000','10000','11110','10000','10000','10000'],
    G:['01111','10000','10000','10111','10001','10001','01110'],
    H:['10001','10001','10001','11111','10001','10001','10001'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
    J:['00111','00010','00010','00010','10010','10010','01100'],
    K:['10001','10010','10100','11000','10100','10010','10001'],
    L:['10000','10000','10000','10000','10000','10000','11111'],
    M:['10001','11011','10101','10101','10001','10001','10001'],
    N:['10001','11001','10101','10011','10001','10001','10001'],
    O:['01110','10001','10001','10001','10001','10001','01110'],
    P:['11110','10001','10001','11110','10000','10000','10000'],
    Q:['01110','10001','10001','10001','10101','10010','01101'],
    R:['11110','10001','10001','11110','10100','10010','10001'],
    S:['01111','10000','10000','01110','00001','00001','11110'],
    T:['11111','00100','00100','00100','00100','00100','00100'],
    U:['10001','10001','10001','10001','10001','10001','01110'],
    V:['10001','10001','10001','10001','10001','01010','00100'],
    W:['10001','10001','10001','10101','10101','11011','10001'],
    X:['10001','10001','01010','00100','01010','10001','10001'],
    Y:['10001','10001','01010','00100','00100','00100','00100'],
    Z:['11111','00001','00010','00100','01000','10000','11111']
  };
  const shopSigns=new Mesh();
  function paintShopLabel(x,z,baseY,text,maxWidth,height,color){
    const step=Math.min(maxWidth/Math.max(1,text.length*6),height/7),width=text.length*6*step;
    const x0=x-width/2,top=baseY+height;
    for(let k=0;k<text.length;k++){
      const g=signGlyphs[text[k]];if(!g)continue;
      for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(g[row][col]==='1'){
        const l=x0+(k*6+col)*step,r=l+step*.84,t=top-row*step,b=t-step*.88;
        shopSigns.quad([l,b,z],[r,b,z],[r,t,z],[l,t,z],color);
      }
    }
  }
  const originalShops=[[-367,885,'ICON STATIONERY','BOOKS  PRINT  COPIES'],[320,715,'FOOD VALLEY','SNACKS  AND  MEALS']];
  for(const [x,z,name,subtitle] of originalShops){
    paintShopLabel(x,z-53.55,96,name,116,15.0,[.97,.97,.89]);
    paintShopLabel(x,z-53.7,81.5,subtitle,110,5.5,[.89,.93,.79]);
  }
  shopSigns.upload();
  const S={strokeTime:0,rowing:false,mode:'MENU',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,strokeTime:0,rowing:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,wiperActive:false,wiperAngle:18,wiperDirection:1,screenDrops:[],screenSpawn:0,debris:[],debrisCooldown:0,gameOverReason:'',current:'',movingCars:[],bobTime:0,missedEffects:[],deliveryEffects:[],pickupEffects:[]};
  const keys=new Set();
  function notify(msg,sec=3){S.notification=msg;S.notificationTime=sec;}
  const seated=()=>S.rides.filter(r=>r.state==='ONBOARD');
  const formatTime=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  function reset(){if(!sourceMeshes){const message=sourceLoadError||'Original game geometry is still loading. Please wait.';const status=$('engine-status');if(status){status.textContent=message;status.style.color='#ffbc9c';}return;}keys.clear();Object.assign(S,{mode:'PLAYING',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,wiperActive:false,wiperAngle:18,wiperDirection:1,screenDrops:[],screenSpawn:0,debrisCooldown:0,gameOverReason:'',current:'',movingCars:[],missedEffects:[],deliveryEffects:[],pickupEffects:[]});
    const dpos=[[-1120,-220],[-535,-660],[40,-360],[595,-980],[1125,-50],[-1060,720],[-510,880],[0,270],[550,870],[1100,1000]];
    S.debris=dpos.map(([x,z],i)=>({x,z,x0:x,z0:z,phase:i*.67}));
    $('menu').classList.add('hidden');$('modal').classList.add('hidden');$('photo-info')?.classList.add('hidden');$('hud').classList.remove('hidden');
    resolvePickupMoorings();offerRide();notify('Take students to BRAC University before their timers expire!',5);refreshHUD();}
  function offerRide(){if(S.request||S.rides.length>=5)return;
    const id=S.requestId++,type=id%2===0?'HOME':'DROWNING',places=(type==='HOME'?homes:rescues).filter(p=>!S.rides.some(r=>r.locationId===p.id));if(!places.length)return;
    const place=id<2?places[0]:places[Math.floor(Math.random()*places.length)];
    const dist=Math.abs(S.x-place.x)+Math.abs(S.z-place.z)+Math.abs(place.x)+Math.abs(place.z-1080);
    const deadline=clamp(Math.round(43+dist/130+(type==='HOME'?7:0)+rnd(-4,6)),66,118);
    S.request={id,type,name:students[id%students.length],locationId:place.id,x:place.x,z:place.z,pickup:place.name,personX:place.personX,personZ:place.personZ,doorX:place.doorX,doorZ:place.doorZ,facadeZ:place.facadeZ,frontDir:place.frontDir,timeLeft:deadline,state:'OFFERED',relocated:place.relocated,colorId:id%studentColors.length,warning:false};S.requestLeft=22;}
  function accept(){if(S.mode!=='PLAYING')return;if(!S.request){notify('No incoming ride request.');return;}
    if(S.rides.length>=5){notify('Your rescue queue is full (5 active requests).');return;}
    S.request.state='WAITING';S.rides.push(S.request);notify(`Accepted ${S.request.name} — ${S.request.type==='HOME'?'HOME PICKUP':'SOS / FLOODED STREET'}`,3);S.request=null;S.spawnClock=0;refreshHUD();}
  function reject(){if(S.mode!=='PLAYING')return;if(!S.request){notify('No incoming request to reject.');return;}
    notify(`Ride rejected: ${S.request.name}`,2);S.request=null;S.spawnClock=0;refreshHUD();}
  function boost(){if(S.mode!=='PLAYING')return;if(S.boostOn){S.boostOn=false;notify('Boost stopped. Meter recharging.',2);}else if(S.boost>=25){S.boostOn=true;notify('PADDLE BOOST! Press Space again to turn it off.',2);}else notify('Recharge boost to at least 25%.',2);}
  function photo(){if(S.mode!=='PLAYING')return;if(S.photo){notify('You already photographed Shaheed Minar.');return;}
    if(distance(S.x,S.z,825,1080)>125){notify('Move onto the orange landmark photo ring first.');return;}
    const target=Math.atan2(1350-S.z,825-S.x)/RAD,delta=Math.abs(((S.angle-target+540)%360)-180);
    if(delta>30){notify('Face Shaheed Minar, then press P.');return;}
    S.photo=true;S.flash=.25;S.score+=70;S.photoTime=8;notify('Shaheed Minar photographed! +70 points',4);const info=$('photo-info');if(info){info.classList.remove('hidden');}}
  function repair(){if(S.mode!=='PLAYING')return;if(!S.powerOff){notify('No power outage currently.');return;}
    const p=power[S.powerIndex];if(distance(S.x,S.z,p.x,p.z)>130){notify(`Move closer to the ${p.name} power repair box.`);return;}
    S.score+=100;S.powerOff=false;S.powerClock=0;S.powerIndex=(S.powerIndex+1)%power.length;notify(`${p.name} power restored! +100 points`,3);}
  function nextModal(type){S.mode=type==='HELP'&&S.mode==='MENU'?'MENU':S.mode;
    $('modal').classList.remove('hidden');$('modal-secondary').classList.add('hidden');
    if(type==='HELP'||type==='PAUSED'){
      $('modal-eyebrow').textContent='YOUR MISSION';$('modal-title').textContent=type==='PAUSED'?'PAUSED':'HOW TO PLAY';
      $('modal-content').innerHTML=`<p>Dhaka is flooded and stranded students are trying to reach BRAC University. Deliver <b>6 students</b> in <b>15 minutes</b> before missing 6 rescue deadlines.</p><ul>
        <li><kbd>W</kbd>/<kbd>↑</kbd> forward, <kbd>S</kbd>/<kbd>↓</kbd> reverse, <kbd>A</kbd>/<kbd>←</kbd> & <kbd>D</kbd>/<kbd>→</kbd> steer the boat.</li>
        <li>Press <kbd>Y</kbd> to accept an incoming ride or <kbd>N</kbd> to reject it. Follow the orange minimap markers to the pickup.</li>
        <li><b>Stop your boat</b> at a pickup until the ring fills. Hold still about 1.3 seconds for a home pickup or 0.65 seconds for a rescue.</li>
        <li>Carry up to <b>3 passengers</b> to the golden dock just south of BRAC University.</li>
        <li><kbd>Space</kbd> toggles boat boost; <kbd>C</kbd> changes camera; <kbd>P</kbd> photographs Shaheed Minar from its marked spot; <kbd>F</kbd> repairs an outage box; <kbd>V</kbd> wipes rain.</li>
        <li>Watch the red traffic signal and avoid collisions with cars, buildings and debris. <kbd>Esc</kbd> pauses.</li></ul>`;
      $('modal-main').textContent=type==='PAUSED'?'RESUME GAME':'GOT IT';$('modal-secondary').classList.toggle('hidden',type!=='PAUSED');
    } else {
      const won=type==='WON';$('modal-eyebrow').textContent=won?'MISSION COMPLETE':'MISSION OVER';$('modal-title').textContent=won?'THE CAMPUS IS SAFE!':'THE CITY GOT THE BETTER OF US';
      $('modal-content').innerHTML=`<p>${won?'Beautiful rowing. You delivered six students safely!':S.gameOverReason}</p><p><b>Final score:</b> ${S.score} &nbsp; · &nbsp; <b>Delivered:</b> ${S.delivered} &nbsp; · &nbsp; <b>Missed:</b> ${S.failed}</p><p>You can restart whenever you like. The original PyOpenGL desktop edition is preserved in the GitHub repository.</p>`;
      $('modal-main').textContent='PLAY AGAIN';
    }
  }
  function togglePause(){if(S.mode==='PLAYING'){S.mode='PAUSED';keys.clear();nextModal('PAUSED');}else if(S.mode==='PAUSED'){S.mode='PLAYING';$('modal').classList.add('hidden');}}
  function action(key){switch(key){case 'y':accept();break;case 'n':reject();break;case ' ':boost();break;case 'c':if(S.mode==='PLAYING'){S.camera3=!S.camera3;notify(S.camera3?'Third-person camera':'First-person camera',1.5);}break;case 'p':photo();break;case 'f':repair();break;case 'v':if(S.mode==='PLAYING'&&!S.wiperActive){S.wiperActive=true;S.wiperDirection=1;S.wiperAngle=18;notify('Windshield wiper activated.',1.4);}break;case 'Escape':if(S.mode==='MENU'&&!$('modal').classList.contains('hidden')){$('modal').classList.add('hidden');}else togglePause();break;}}
  function orientedObjectOverlap(x,z,cx,cz,angle,halfLength,halfWidth,margin=2){
    // Separating-axis test shared by cars, shops, and tea stalls.
    const a=S.angle*RAD,b=angle*RAD,dx=cx-x,dz=cz-z;
    const F=[Math.cos(a),Math.sin(a)],L=[-F[1],F[0]];
    const G=[Math.cos(b),Math.sin(b)],H=[-G[1],G[0]];
    if(dx*dx+dz*dz>185*185)return false;
    for(const [ax,az] of [F,L,G,H]){
      const sep=Math.abs(dx*ax+dz*az);
      const boatReach=63*Math.abs(F[0]*ax+F[1]*az)+27*Math.abs(L[0]*ax+L[1]*az);
      const carReach=(halfLength+margin)*Math.abs(G[0]*ax+G[1]*az)+(halfWidth+margin)*Math.abs(H[0]*ax+H[1]*az);
      if(sep>boatReach+carReach)return false;
    }
    return true;
  }
  function carOverlap(x,z,cx,cz,angle,style=0){
    return orientedObjectOverlap(x,z,cx,cz,angle,style%3===1?45:40,20,2);
  }
  // Both boats and cars are extended shapes. A centre that is valid in the
  // original map may be impossible to reach when a car is parked directly at
  // the pickup ring. Find the nearest safe mooring point near the ORIGINAL
  // passenger. The passenger stays at the house/water position, not on the car.
  function pickupMooring(place){
    const ox=place.x,oz=place.z;
    const spots=[[0,0],[0,-32],[0,32],[-32,0],[32,0],[-55,0],[55,0],
      [-45,-35],[45,-35],[-45,35],[45,35],[0,-60],[0,60],[-70,-20],[70,-20],[-70,20],[70,20]];
    const isSafe=(x,z)=>valid(x,z,5)&&!overlapStaticProp(x,z)&&
      !parkedCars.some(car=>[0,90].some(heading=>{
        const save=S.angle;S.angle=heading;
        const touching=carOverlap(x,z,car.x,car.z,car.angle,car.style);
        S.angle=save;return touching;
      }))&&!S.debris.some(d=>distance(x,z,d.x,d.z)<53);
    for(const [dx,dz] of spots)if(isSafe(ox+dx,oz+dz))return [ox+dx,oz+dz];
    return [ox,oz];
  }
  function resolvePickupMoorings(){
    for(const place of [...homes,...rescues]){
      // Do not accumulate offsets each time the player restarts.
      if(place.originalX===undefined){place.originalX=place.x;place.originalZ=place.z;}
      [place.x,place.z]=pickupMooring({x:place.originalX,z:place.originalZ});
      place.relocated=distance(place.originalX,place.originalZ,place.x,place.z)>1;
    }
  }
  function circlePostOverlap(x,z,px,pz,r){
    const a=S.angle*RAD,dx=px-x,dz=pz-z;
    const along=dx*Math.cos(a)+dz*Math.sin(a),across=-dx*Math.sin(a)+dz*Math.cos(a);
    const u=clamp(along,-63,63),v=clamp(across,-27,27);
    return (along-u)**2+(across-v)**2<=r*r;
  }
  function overlapStaticProp(x,z){
    for(const [tx,tz,size] of trees)if(circlePostOverlap(x,z,tx,tz,5*size+3))return true;
    // Street vendors, campus shops, traffic post and repair enclosures match
    // the physical dimensions specified in isBoatCollidingWithStreetProps.
    if(orientedObjectOverlap(x,z,178,885,0,57,61))return true;
    for(const [cx,cz] of [[-367,873],[320,703]]){
      if(orientedObjectOverlap(x,z,cx,cz,0,64,63))return true;
    }
    if(circlePostOverlap(x,z,145,-55,8))return true;
    for(const p of power)if(orientedObjectOverlap(x,z,p.x,p.z,0,19,18))return true;
    return false;
  }
  function moveAllowed(x,z){if(!valid(x,z)||overlapStaticProp(x,z))return false;
    for(const d of S.debris)if(distance(x,z,d.x,d.z)<48)return false;
    for(const car of [...parkedCars,...S.movingCars]){
      if(carOverlap(x,z,car.x,car.z,car.angle||0,car.style||0)){
        // When a moving car happens to overlap the boat, allow moving away;
        // otherwise players can be trapped inside an invisible collision wall.
        if(!carOverlap(S.x,S.z,car.x,car.z,car.angle||0,car.style||0)||
           distance(x,z,car.x,car.z)<=distance(S.x,S.z,car.x,car.z)+.001)return false;
      }
    }
    return true;}
  function recordMissedPassenger(ride){
    const age=S.time,wasOnBoat=ride.state==='ONBOARD';
    if(!wasOnBoat&&ride.type!=='DROWNING')return;
    if(wasOnBoat){
      const people=seated(),seat=Math.max(0,people.indexOf(ride)),seats=[[8,-19],[8,19],[67,0]];
      const [bx,bz]=seats[Math.min(seat,2)],a=S.angle*RAD,c=Math.cos(a),sn=Math.sin(a);
      const x=S.x+(bx*c-bz*sn)*.62,z=S.z+(bx*sn+bz*c)*.62;
      const side=seat===0?-1:seat===1?1:(ride.id%2?1:-1);
      S.missedEffects.push({id:ride.id,colorId:ride.colorId,at:age,fromX:x,fromZ:z,x:x-sn*side*47,z:z+c*side*47,y:28,fromBoat:true});
    }else S.missedEffects.push({id:ride.id,colorId:ride.colorId,at:age-.80,fromX:ride.x,fromZ:ride.z,x:ride.x,z:ride.z,y:10,fromBoat:false});
    if(S.missedEffects.length>6)S.missedEffects.shift();
  }
  // Canvas-space sweep designed to sit against the lower right-hand edge of
  // the cockpit. The same geometry is used to remove water droplets.
  function windshieldBlade(w,h){
    return {x:w*.79,y:h*.965,length:Math.min(w*.39,h*.50)};
  }
  function updateWindshield(dt){
    if(S.camera3)return;
    const rainFree=distance(S.x,S.z,0,1378)<378;
    if(rainFree){S.screenDrops.length=0;S.screenSpawn=0;}
    if(!rainFree&&!S.wiperActive){S.screenSpawn+=dt;while(S.screenSpawn>=.08){S.screenSpawn-=.08;
      for(let i=0;i<4&&S.screenDrops.length<180;i++)S.screenDrops.push({x:rnd(.07,.93),y:rnd(.10,.87)});
    }}
    if(!S.wiperActive)return;
    S.wiperAngle+=S.wiperDirection*155*dt;
    const w=Math.max(1,weather.clientWidth),h=Math.max(1,weather.clientHeight);
    const blade=windshieldBlade(w,h);
    S.screenDrops=S.screenDrops.filter(d=>{
      const dx=d.x*w-blade.x,dy=blade.y-d.y*h,rad=Math.hypot(dx,dy);
      const ang=(Math.atan2(dy,dx)/RAD+360)%360;
      const error=Math.abs(((ang-S.wiperAngle+540)%360)-180);
      return !(rad<=blade.length&&error<=12);
    });
    if(S.wiperDirection>0&&S.wiperAngle>=158){S.wiperAngle=158;S.wiperDirection=-1;}
    else if(S.wiperDirection<0&&S.wiperAngle<=18){S.wiperAngle=18;S.wiperDirection=1;S.wiperActive=false;}
  }
  function step(dt){S.time+=dt;S.bobTime+=dt;S.notificationTime=Math.max(0,S.notificationTime-dt);S.flash=Math.max(0,S.flash-dt);S.photoTime=Math.max(0,S.photoTime-dt);if(S.photoTime<=0){$('photo-info')?.classList.add('hidden');}S.wiperTime=Math.max(0,S.wiperTime-dt);updateWindshield(dt);
    S.boost=clamp(S.boost+(S.boostOn?-30:15)*dt,0,100);if(S.boost<=0)S.boostOn=false;
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
    const turn=(keys.has('a')||keys.has('arrowleft')?1:0)-(keys.has('d')||keys.has('arrowright')?1:0); // left is counterclockwise in the original, projection mirrored to correct handedness
    if(turn){S.angle=(S.angle+turn*105*dt+360)%360;S.lastMove=S.time;}
    S.rowing=!!forward; if(forward) S.strokeTime=(S.strokeTime+dt)%0.65; else S.strokeTime=0;
    if(forward){const speed=(forward>0?270:180)*(S.boostOn?1.65:1);const dx=Math.cos(S.angle*RAD)*speed*dt*forward,dz=Math.sin(S.angle*RAD)*speed*dt*forward;
      // Collision increments avoid tunnelling through narrow buildings.
      const n=Math.ceil(Math.hypot(dx,dz)/8)||1;for(let i=0;i<n;i++){
        const x=S.x+dx/n,z=S.z+dz/n;if(moveAllowed(x,z)){S.x=x;S.z=z;}else{const bad=S.debris.some(d=>distance(x,z,d.x,d.z)<57);if(bad&&S.debrisCooldown<=0){S.score=Math.max(0,S.score-25);S.debrisCooldown=1.8;notify('Floating debris! -25 points. Steer around it.',2.7);}break;}}
      S.lastMove=S.time;
    }
    S.debrisCooldown=Math.max(0,S.debrisCooldown-dt);S.pickupEffects=S.pickupEffects.filter(e=>S.time-e.at<1.15);
    S.current='';for(const zone of currents)if(S.x>=zone.a&&S.x<=zone.b&&S.z>=zone.c&&S.z<=zone.d){S.current=zone.name;const x=S.x+zone.dx*dt,z=S.z+zone.dz*dt;if(moveAllowed(x,z)){S.x=x;S.z=z;}break;}
    S.debris.forEach(d=>{const ph=d.phase+S.time*.65,x=d.x0+Math.sin(ph)*26,z=d.z0+Math.cos(ph*.7)*18;if(distance(x,z,S.x,S.z)>57){d.x=x;d.z=z;}});
    S.movingCars=[{x:-470+((S.time*30+65)%680<340?(S.time*30+65)%680:680-(S.time*30+65)%680),z:-555,angle:0,style:3},{x:598,z:-490+((S.time*24+190)%720<360?(S.time*24+190)%720:720-(S.time*24+190)%720),angle:90,style:4}];
    S.trafficClock+=dt;if(S.trafficClock>=(S.traffic==='GREEN'?5:4)){S.trafficClock=0;S.traffic=S.traffic==='GREEN'?'RED':'GREEN';}
    const inTraffic=S.x>=-115&&S.x<=115&&S.z>=-165&&S.z<=70;
    if(!inTraffic)S.trafficSafe=[S.x,S.z];
    if(inTraffic&&!S.wasTraffic&&S.traffic==='RED'){[S.x,S.z]=S.trafficSafe;S.score=Math.max(0,S.score-35);S.violations++;notify('RED LIGHT! Returned to the stop line. -35 points',3);S.wasTraffic=false;}else S.wasTraffic=inTraffic;
    if(!S.powerOff){S.powerClock+=dt;if(S.powerClock>=15){S.powerOff=true;S.powerClock=0;notify(`${power[S.powerIndex].name} district power outage!`,2.6);}}
    if(S.request){S.requestLeft-=dt;if(S.requestLeft<=0){S.request=null;S.spawnClock=0;}}
    else {S.spawnClock+=dt;if(S.spawnClock>=9.5){S.spawnClock=0;offerRide();}}
    for(const r of S.rides){r.timeLeft-=dt;if(r.timeLeft<=0){recordMissedPassenger(r);r.state='FAILED';S.failed++;S.score=Math.max(0,S.score-75);notify(`${r.name} ran out of time! -75 points`,3.5);}else if(r.state==='ONBOARD'&&r.timeLeft<=25&&!r.warning){r.warning=true;notify(`HURRY! ${r.name} has 25 seconds left!`,3);}}
    S.rides=S.rides.filter(r=>r.state!=='FAILED');S.missedEffects=S.missedEffects.filter(e=>S.time-e.at<4.35);
    S.deliveryEffects=S.deliveryEffects.filter(e=>S.time-e.at<1.65);
    if(distance(S.x,S.z,0,1080)<=122){const arrived=seated();if(arrived.length){let gained=0;for(const [i,r] of arrived.entries()){
      const seats=[[8,-19],[8,19],[67,0]], [bx,bz]=seats[Math.min(i,2)],h=S.angle*RAD;
      const startX=S.x+(bx*Math.cos(h)-bz*Math.sin(h))*.62,startZ=S.z+(bx*Math.sin(h)+bz*Math.cos(h))*.62;
      S.deliveryEffects.push({at:S.time,x0:startX,z0:startZ,y0:35,x1:clamp(startX*.25+(i-1)*24,-78,78),z1:1164+(i-1)*9,colorId:r.colorId});
      r.state='DELIVERED';const points=200+Math.floor(r.timeLeft*.4);S.score+=points;gained+=points;S.delivered++;
    }S.rides=S.rides.filter(r=>r.state!=='DELIVERED');notify(`Delivered ${arrived.length} student(s) to BRACU! +${gained} points`,4);}}
    // Parked/moving cars occasionally block the only approach to a pickup
    // without physically overlapping its marker. In that case the captain may
    // moor along the same roadside up to 120 units from the home marker.
    // Never extend the range for an unobstructed pickup.
    function boardingRadius(ride){
      const ordinary=ride.type==='HOME'?(ride.relocated?83:72):(ride.relocated?65:56);
      const obstructed=[...parkedCars,...S.movingCars].some(car=>
        distance(ride.x,ride.z,car.x,car.z)<ordinary+65);
      return obstructed?Math.max(ordinary,ride.type==='HOME'?122:84):ordinary;
    }
    const nearby=S.rides.filter(r=>r.state==='WAITING'&&distance(S.x,S.z,r.x,r.z)<=boardingRadius(r)).sort((a,b)=>distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z))[0];
    if(!nearby||seated().length>=3||S.time-S.lastMove<.38){S.dock=0;S.dockId=-1;}
    else {if(S.dockId!==nearby.id){S.dock=0;S.dockId=nearby.id;}S.dock+=dt;const required=nearby.type==='HOME'?1.3:.65;
      if(S.dock>=required){nearby.state='ONBOARD';S.pickupEffects.push({x:nearby.personX??nearby.x,z:nearby.personZ??nearby.z,at:S.time,type:nearby.type});nearby.boardedAt=S.time;nearby.boardSide=nearby.id%2?1:-1;S.dock=0;S.dockId=-1;if(nearby.type==='HOME'){S.score+=35;notify(`${nearby.name} boarded! ${seated().length}/3 seats. +35 points`,3);}else{S.score+=90;S.rescued++;notify(`RESCUED ${nearby.name}! Deliver to BRACU. +90 points`,3);}}}
    if(S.delivered>=6){S.mode='WON';keys.clear();nextModal('WON');}else if(S.time>=900||S.failed>=6){S.mode='LOST';S.gameOverReason=S.time>=900?'Fifteen minutes passed before everyone arrived.':'Six passengers missed their ride deadlines.';keys.clear();nextModal('LOST');}
  }
  const map=$('minimap'),ctx=map.getContext('2d');
  function refreshMap(){const w=map.width,h=map.height,px=x=>12+(x+1650)/3300*(w-24),py=z=>h-12-(z+1650)/3300*(h-24);
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b2a37';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#345565';ctx.lineWidth=4;for(const x of [-1100,-550,0,550,1100]){ctx.beginPath();ctx.moveTo(px(x),py(-1650));ctx.lineTo(px(x),py(1650));ctx.stroke();}for(const z of [-1150,-600,-50,500,1050]){ctx.beginPath();ctx.moveTo(px(-1650),py(z));ctx.lineTo(px(1650),py(z));ctx.stroke();}
    ctx.fillStyle='#4c6270';for(const b of buildings)ctx.fillRect(px(b.x-b.hw),py(b.z+b.hd),(2*b.hw)/3300*(w-24),(2*b.hd)/3300*(h-24));
    ctx.fillStyle='#91d89b';ctx.fillRect(px(-220),py(1620),px(270)-px(-220),py(1230)-py(1620));
    function dot(x,z,r,c){ctx.beginPath();ctx.arc(px(x),py(z),r,0,TAU);ctx.fillStyle=c;ctx.fill();}
    dot(0,1080,5,'#a7f2a8');
    for(const r of S.rides)if(r.state==='WAITING'){dot(r.x,r.z,5,'#ff8865');ctx.strokeStyle='#fff0cf';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px(r.x),py(r.z),7,0,TAU);ctx.stroke();}
    if(S.request)dot(S.request.x,S.request.z,3,'#a9afb3');
    if(S.powerOff){const p=power[S.powerIndex];dot(p.x,p.z,4,'#fa6661');}
    if(!S.photo)dot(825,1080,4,'#ffb95f');
    const a=S.angle*RAD;ctx.save();ctx.translate(px(S.x),py(S.z));ctx.rotate(-a+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(-6,7);ctx.lineTo(0,4);ctx.lineTo(6,7);ctx.closePath();ctx.fillStyle='#ffda8b';ctx.fill();ctx.restore();
  }
  function refreshHUD(){if(S.mode==='MENU')return;
    $('score').textContent=String(S.score).padStart(4,'0');$('timer').textContent=formatTime(900-S.time);$('delivered').textContent=`${S.delivered} / 6`;$('failed').textContent=`${S.failed} / 6`;
    const trafficLabel=$('traffic-status'),powerLabel=$('power-status');
    if(trafficLabel){trafficLabel.textContent=`${S.traffic==='GREEN'?'🟢 GREEN':'🔴 RED'} LIGHT`;trafficLabel.className='status-pill '+(S.traffic==='GREEN'?'status-green':'status-red');}
    if(powerLabel){powerLabel.textContent=S.powerOff?`🔴 BLACKOUT: ${power[S.powerIndex].name} · Find repair box (F)`:'🟢 POWER RESTORED · Streetlights and windows are on';powerLabel.className='status-pill '+(S.powerOff?'status-red':'status-green');}
    $('boost-fill').style.width=`${S.boost}%`;$('boost-number').textContent=`${Math.round(S.boost)}%`;$('passengers').innerHTML=`PASSENGERS ONBOARD <b>${seated().length} / 3</b>`;
    $('request-panel').classList.toggle('hidden',!S.request);
    if(S.request){$('request-name').textContent=S.request.name;$('request-location').textContent=`${S.request.type==='HOME'?'🏠 Home pickup':'🛟 SOS rescue'} · ${S.request.pickup}`;$('request-remaining').textContent=`${Math.ceil(S.requestLeft)}s`;}
    const waiting=S.rides.filter(r=>r.state==='WAITING'),onboard=seated();const nearest=waiting.sort((a,b)=>distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z))[0];
    if(onboard.length){$('objective-title').textContent=`${onboard.length} PASSENGER${onboard.length===1?'':'S'} ONBOARD`;$('objective-detail').textContent=`Head to BRAC University · ${Math.round(distance(S.x,S.z,0,1080))} units`;}
    else if(nearest){$('objective-title').textContent=`PICK UP ${nearest.name.toUpperCase()}`;$('objective-detail').textContent=`${nearest.pickup} · ${Math.round(distance(S.x,S.z,nearest.x,nearest.z))} units`;}
    else{$('objective-title').textContent='ACCEPT A RESCUE REQUEST';$('objective-detail').textContent='Pick up students and bring them to BRACU';}
    if(S.current){$('objective-title').textContent+=` · ${S.current}`;}
    const docking=nearest&&S.dockId===nearest.id?S.dock/(nearest.type==='HOME'?1.3:.65):0;$('dock-fill').style.width=`${Math.min(100,docking*100)}%`;
    $('toast').classList.toggle('hidden',S.notificationTime<=0);if(S.notificationTime>0)$('toast').textContent=S.notification;
    refreshMap();
  }
  function skyColor(){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
  function resize(){const ratio=Math.min(devicePixelRatio||1,1.8),w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);weather.width=canvas.width;weather.height=canvas.height;}gl.viewport(0,0,canvas.width,canvas.height);}
  const rain=[];for(let i=0;i<260;i++)rain.push({x:Math.random(),y:Math.random(),speed:rnd(.2,.7),len:rnd(.007,.020)});
  function renderRain(dt){const w=weather.width,h=weather.height;wx.clearRect(0,0,w,h);if(S.mode==='PAUSED'||S.mode==='WON'||S.mode==='LOST')return;
    const campusDistance=distance(S.x,S.z,0,1378);
    const rainFraction=clamp((campusDistance-365)/230,0,1);
    const quantity=Math.round(rain.length*rainFraction);
    wx.strokeStyle=`rgba(185,224,237,${(.07+.18*rainFraction).toFixed(3)})`;wx.lineWidth=Math.max(.7,w/1400);
    wx.beginPath();for(let i=0;i<quantity;i++){const d=rain[i];d.y=(d.y+d.speed*dt)%1;d.x=(d.x+.06*dt)%1;
      const x=d.x*w,y=d.y*h;
      wx.moveTo(x,y);wx.lineTo(x-w*.004,y+d.len*h);}wx.stroke();
    if(S.mode==='PLAYING'&&!S.camera3){
      // Subtle glass droplets rather than opaque screen-space rectangles.
      const pixel=Math.max(.75,Math.min(w/1100,h/750));
      for(const d of S.screenDrops){
        const x=d.x*w,y=d.y*h;
        wx.beginPath();wx.ellipse(x,y,1.35*pixel,3.25*pixel,-.14,0,TAU);
        wx.fillStyle='rgba(144,187,209,.24)';wx.fill();
        wx.beginPath();wx.ellipse(x-.55*pixel,y-1.1*pixel,.48*pixel,1.3*pixel,-.14,0,TAU);
        wx.fillStyle='rgba(221,244,255,.36)';wx.fill();
      }
      const blade=windshieldBlade(w,h),a=S.wiperAngle*RAD;
      const reach=(f)=>[blade.x+Math.cos(a)*blade.length*f,blade.y-Math.sin(a)*blade.length*f];
      const tip=reach(1),mid=reach(.29);
      wx.lineCap='round';
      // Slim driving arm; the rubber blade only occupies its distal portion.
      wx.strokeStyle='rgba(16,23,27,.76)';wx.lineWidth=3.4*pixel;
      wx.beginPath();wx.moveTo(blade.x,blade.y);wx.lineTo(...tip);wx.stroke();
      wx.strokeStyle='rgba(18,23,27,.87)';wx.lineWidth=5.5*pixel;
      wx.beginPath();wx.moveTo(...mid);wx.lineTo(...tip);wx.stroke();
      wx.strokeStyle='rgba(132,151,157,.65)';wx.lineWidth=.9*pixel;
      wx.beginPath();wx.moveTo(...mid);wx.lineTo(...tip);wx.stroke();
      wx.fillStyle='#252e32';wx.beginPath();wx.arc(blade.x,blade.y,5.2*pixel,0,TAU);wx.fill();
    }
    if(S.flash>0){wx.fillStyle=`rgba(255,252,224,${clamp(S.flash*1.6,0,.6)})`;wx.fillRect(0,0,w,h);}
  }
  function draw(){resize();skyColor();const a=S.angle*RAD,c=Math.cos(a),s=Math.sin(a),boatY=12+Math.sin(S.bobTime*2.8)*1.3;
    const lerp=((S.angle-S.heading+540)%360)-180;S.heading=(S.heading+lerp*.16+360)%360;
    const ca=S.camera3?S.heading*RAD:a;
    let eye,target,fov;
    if(S.mode==='MENU'){
      const t=performance.now()*.00012;eye=[720*Math.cos(t),520,-1100+570*Math.sin(t)];target=[0,60,600];fov=70;
    }else if(S.camera3){const x=S.x-Math.cos(ca)*228,z=S.z-Math.sin(ca)*228;
      // Colliding the chase-camera arm against building silhouettes prevents
      // the camera from passing inside a facade (present in the original Python).
      let minFraction=1;
      const cameraObstacles=[...buildings,...campusSolids.map(([x,z,hw,hd])=>({x,z,hw,hd}))];
      for(const b of cameraObstacles){
        const minX=b.x-b.hw-16,maxX=b.x+b.hw+16,minZ=b.z-b.hd-16,maxZ=b.z+b.hd+16;
        let tMin=0,tMax=1;const vx=x-S.x,vz=z-S.z;
        for(const [p,v,min,max] of [[S.x,vx,minX,maxX],[S.z,vz,minZ,maxZ]]){
          if(Math.abs(v)<1e-6){if(p<min||p>max){tMin=2;break;}}
          else {let a=(min-p)/v,b=(max-p)/v;if(a>b)[a,b]=[b,a];tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);}
        }
        if(tMin<=tMax&&tMin<=1&&tMax>=0&&tMin<minFraction)minFraction=Math.max(.06,tMin-.04);
      }
      const nearWall=clamp((.55-minFraction)/.55,0,1);
      eye=[S.x+(x-S.x)*minFraction,39+100*minFraction+67*nearWall,S.z+(z-S.z)*minFraction];
      target=[S.x+c*80,36+10*nearWall,S.z+s*80];
      fov=73+12*nearWall;
    }else{eye=[S.x-c*24,boatY+41,S.z-s*24];target=[S.x+c*210,boatY+19,S.z+s*210];fov=78;}
    gl.uniformMatrix4fv(uniforms.proj,false,perspective(fov*RAD,canvas.width/canvas.height,1.2,5100));gl.uniformMatrix4fv(uniforms.view,false,lookAt(eye,target));gl.uniform1f(uniforms.time,S.bobTime*.85);
    gl.disable(gl.CULL_FACE);
    if(sourceMeshes){
      for(const group of ['sky','clouds'])render(sourceMeshes[group]); // do not render the source's opaque rectangular sky wall in front of the browser scene
    }
    if(sourceMeshes){
      const powerState=S.powerOff?['central','west','east'][S.powerIndex]:'lit';
      render(sourceMeshes.streets);
      render(sourceMeshes['buildings-'+powerState]);
      render(sourceMeshes.campus);render(sourceMeshes.props);
      render(sourceMeshes['lamps-'+powerState]);render(sourceMeshes['powerboxes-'+powerState]);
      render(sourceMeshes.landmarks);render(sourceMeshes.cars);render(sourceMeshes.dock);
      render(sourceMeshes['traffic-'+S.traffic.toLowerCase()]);
      render(campusLettering);render(shopSigns);
    } else if(!sourceLoadError){
      // While original geometry downloads, render no incorrect placeholder city.
    }
    // Semi-transparent animated water is drawn AFTER the original flooded
    // road textures, so lane markings remain visible underneath the surface.
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    render(waterMesh);
    render(sunshineAura);render(sunshineSun);
    gl.depthMask(true);gl.disable(gl.BLEND);
    // Keep culling disabled for original double-sided OpenGL line/quad geometry.
    // Foreground boat, dynamic light state and localized mission markers.
    for(const car of S.movingCars)render(carMesh,model(car.x,1,car.z,car.z===-555?0:90,.97));
    S.debris.forEach((d,i)=>render(sourceMeshes?.['debris-'+(i%3)]||debrisMesh,model(d.x,0,d.z,(i*57)%360,1)));
    if(!sourceMeshes)for(let i=0;i<power.length;i++){const p=power[i];render(powerMesh,model(p.x,0,p.z,0,1));}
    for(const r of S.rides)if(r.state==='WAITING'){
      const bounce=Math.sin(S.bobTime*4+r.id)*2;
      const home=r.type==='HOME';
      const px=r.personX??r.x,pz=r.personZ??r.z;
      if(home){render(sourceMeshes?.['student-'+r.colorId]||npcMeshes[r.colorId],model(px,19+.6*Math.sin(S.bobTime*3+r.id),pz,-90+Math.sin(S.bobTime*2+r.id)*5,.63));}
      else {const frame=Math.floor((S.time*3.25)%24);const anim=sourceMeshes?.['struggling-'+frame];if(anim)render(anim,model(px,0,pz,0,1));else render(npcMeshes[r.colorId],model(px,8+bounce,pz,-90,.70));}
      render(markerMesh,model(r.x,3+Math.sin(S.bobTime*4+r.id)*1.5,r.z,0,1));
    }
    if(S.request){/* Offered riders appear on the map, not in the city until accepted. */}
    for(const splash of S.pickupEffects){const age=S.time-splash.at;
      render(waterRipple,model(splash.x,10,splash.z,0,.6+age*1.8));
      render(waterRipple,model(splash.x,10.3,splash.z,0,.35+age*1.15));
    }
    if(!S.photo)render(markerGoal,model(825,1,1080,0,1));
    if(S.powerOff){const p=power[S.powerIndex];render(markerGoal,model(p.x,2,p.z,0,.8));}
    if(sourceMeshes){render(markerGoal,model(0,10,1100,0,1.85));}
    // Traffic lights: emissive-like saturated color, red/green changes with the actual timer.
    if(!sourceMeshes)render(S.traffic==='RED'?signalRed:signalGreen);
    if(S.mode!=='MENU'){
      if(S.camera3){
        render(sourceMeshes?.boat||boatMesh,model(S.x,boatY,S.z,S.angle,.62));
        if(sourceMeshes?.captain)render(sourceMeshes.captain,model(S.x,boatY-12,S.z,S.angle,1));
        if(sourceMeshes){const f=S.rowing?Math.floor((S.strokeTime/0.65)*24)%24:0;render(sourceMeshes['rowing-'+f]||sourceMeshes.paddles,model(S.x,boatY-12,S.z,S.angle,1));}
      }else{
        // Like the desktop edition, the actual boat is drawn in first person.
        render(sourceMeshes?.boat||boatMesh,model(S.x,boatY,S.z,S.angle,.62));
        if(sourceMeshes){const f=S.rowing?Math.floor((S.strokeTime/0.65)*24)%24:0;render(sourceMeshes['first-rowing-'+f]||sourceMeshes['firstperson-hands'],model(S.x,boatY-12,S.z,S.angle,1));}
      }
      if(S.rowing){
        // Paddle-tip splashes and a short wake behind the moving sampan.
        const fx=Math.cos(a),fz=Math.sin(a),lx=-fz,lz=fx;
        for(const side of [-1,1]){
          render(waterRipple,model(S.x+side*lx*39+fx*18,9.4,S.z+side*lz*39+fz*18,0,.20+.10*Math.abs(Math.sin(S.strokeTime*TAU/.65))));
        }
        const shift=32+((S.time*32)%95);
        render(waterRipple,model(S.x-fx*shift,9.25,S.z-fz*shift,0,.36+.24*Math.sin(S.time*2)));
      }
      // First-person seats are directly in front of the eye: keep passenger
      // silhouettes visible but lower than the sightline (and below the wiper).
      const seats=[[8,-19],[8,19],[67,0]];
      seated().forEach((r,i)=>{
        const [bx,bz]=seats[i],settle=clamp((S.time-(r.boardedAt??S.time))/1.25,0,1);
        const eased=settle*settle*(3-2*settle),localZ=(r.boardSide??1)*48*(1-eased)+bz*eased;
        const sx=S.x+(bx*c-localZ*s)*.62,sz=S.z+(bx*s+localZ*c)*.62;
        const scale=S.camera3?.62:.36,seatY=S.camera3?boatY+15:boatY+1;
        render(sourceMeshes?.['student-'+r.colorId]||npcMeshes[r.colorId],
          model(sx,seatY+3*Math.sin(Math.PI*eased),sz,S.angle+(1-settle)*12*(r.boardSide||1),scale));
      });
      // Original BRACU drop-off: students leave their seats and walk to the dock.
      for(const e of S.deliveryEffects){
        const progress=clamp((S.time-e.at)/1.65,0,1),walk=progress*progress*(3-2*progress);
        const x=e.x0+(e.x1-e.x0)*walk,z=e.z0+(e.z1-e.z0)*walk,y=e.y0+(30-e.y0)*walk+8*Math.sin(Math.PI*progress);
        render(sourceMeshes?.['student-'+e.colorId]||npcMeshes[e.colorId],model(x,y,z,-12*(1-walk),.50));
      }
      for(const effect of S.missedEffects){
        const age=S.time-effect.at;
        if(age<.80&&effect.fromBoat){
          const f=Math.min(1,age/.80),p=f*f*(3-2*f),elevation=effect.y*(1-p)+7*p+5*Math.sin(Math.PI*p);
          const x=effect.fromX+(effect.x-effect.fromX)*p,z=effect.fromZ+(effect.z-effect.fromZ)*p;
          if(S.camera3||distance(eye[0],eye[2],x,z)>52)
            render(sourceMeshes?.['student-'+effect.colorId]||npcMeshes[effect.colorId],model(x,elevation,z,S.angle+35*p,.55));
        }else if(age<3.85){
          const sink=age>2.85?36*clamp((age-2.85)/1,0,1):0;
          const frame=Math.floor(((age*7.2)%TAU)/TAU*24)%24;
          if(S.camera3||distance(eye[0],eye[2],effect.x,effect.z)>52)
            render(sourceMeshes?.['struggling-'+frame]||npcMeshes[effect.colorId],model(effect.x,-sink,effect.z,0,.85));
          render(waterRipple,model(effect.x,9.5,effect.z,0,.9+age*.12));
        }else if(age<4.35){
          render(waterRipple,model(effect.x,9.5,effect.z,0,1+age*.22));
        }
      }
      if(S.camera3&&!sourceMeshes?.paddles){for(const sign of [-1,1]){
        const bx=S.x+(8*c-sign*47*s)*.62,bz=S.z+(8*s+sign*47*c)*.62;
        const rocking=(keys.has('w')||keys.has('arrowup'))?Math.sin(S.bobTime*9)*13:4;
        render(paddleMesh,model(bx,boatY+10,bz,S.angle+sign*(23+rocking),.48));
      }}
    }
  }
  if(location.hostname==='localhost'||location.hostname===''){window.majhiTesting={S,step,repair,moveAllowed,carOverlap,recordMissedPassenger};}
  window.majhiVersion='fidelity7';
  window.majhiDiagnostics=()=>({x:S.x,z:S.z,angle:S.angle,shopSignVertices:shopSigns.length,wiperAngle:S.wiperAngle,wiperActive:S.wiperActive,screenDrops:S.screenDrops.length,pickupSplashes:S.pickupEffects.length,homeMoorings:homes.map(p=>({name:p.name,x:p.x,z:p.z,relocated:!!p.relocated})),traffic:S.traffic,powerOff:S.powerOff,powerIndex:S.powerIndex,missedEffects:S.missedEffects.map(e=>({...e})),loaded:!!sourceMeshes,geometryNames:Object.keys(sourceMeshes||{}),camera:S.camera3?'third':'first',onboard:seated().length,sunlightBlend:1-clamp((distance(S.x,S.z,0,1378)-365)/230,0,1),wiperGeometry:windshieldBlade(Math.max(1,weather.clientWidth),Math.max(1,weather.clientHeight))});
  let last=0,hudClock=0;
  function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(0,(now-last)/1000||0));last=now;
    if(S.mode==='PLAYING'){let t=dt;while(t>0){const d=Math.min(t,.025);step(d);t-=d;}}else S.bobTime+=dt*.5;
    try{draw();renderRain(dt);}catch(e){console.error('Render error:',e);$('error').classList.remove('hidden');S.mode='PAUSED';return;}
    hudClock+=dt;if(hudClock>.11){hudClock=0;if(S.mode!=='MENU')refreshHUD();}
  }
  $('play-button').onclick=reset;
  $('help-button').onclick=()=>nextModal('HELP');
  $('camera-button').onclick=()=>action('c');$('pause-button').onclick=togglePause;
  $('accept-button').onclick=accept;$('reject-button').onclick=reject;
  $('modal-main').onclick=()=>{if(S.mode==='WON'||S.mode==='LOST')reset();else $('modal').classList.add('hidden');if(S.mode==='PAUSED')S.mode='PLAYING';};
  $('modal-secondary').onclick=reset;
  document.addEventListener('keydown',e=>{
    const k=e.key===' '?' ':e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','escape'].includes(k))e.preventDefault();
    if(e.repeat&&[' ','y','n','f','p','c','v'].includes(k))return;
    if(S.mode==='PLAYING'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))keys.add(k);
    if(k==='escape')action('Escape');else if(S.mode==='PLAYING')action(k);
    else if(S.mode==='MENU'&&$('modal').classList.contains('hidden')&&(k==='enter'||k===' '))reset();
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-hold]').forEach(btn=>{
    const key=btn.dataset.hold;btn.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);btn.setPointerCapture(e.pointerId);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>keys.delete(key));
  });
  document.querySelectorAll('[data-key]').forEach(btn=>btn.addEventListener('click',()=>action(btn.dataset.key)));
  // Read-only diagnostics to make browser smoke tests deterministic.
  window.MajhiDiagnostics={getState:()=>({mode:S.mode,x:S.x,z:S.z,angle:S.angle,score:S.score,delivered:S.delivered,failed:S.failed,activeRequests:S.rides.length,request:S.request?.name||null,boatBoost:Math.round(S.boost),rowing:S.rowing,strokeFrame:Math.floor((S.strokeTime/0.65)*24)%24,renderer:'WebGL1 / Python source geometry',sourceGeometryLoaded:!!sourceMeshes,sourceLoadError}),start:reset};
  requestAnimationFrame(loop);
})();
