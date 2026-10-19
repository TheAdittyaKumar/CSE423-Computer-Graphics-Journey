/* Majhi Jaben?! — independent browser adaptation of the CSE423 PyOpenGL game.
 * WebGL 1, no external packages, no server, no asset downloads.
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
  const VERT=`attribute vec3 aPos; attribute vec3 aColor; attribute float aKind;
  uniform mat4 uView,uProj,uModel;uniform float uTime;
  varying vec3 vColor,vWorld;varying float vKind,vDist;
  void main(){vec4 p=uModel*vec4(aPos,1.);if(aKind>.5){
  p.y+=1.6*sin(p.x*.023+uTime*1.7)*cos(p.z*.019-uTime*1.4)+.8*sin(p.x*.071+p.z*.055+uTime*2.8);
  }vWorld=p.xyz;vColor=aColor;vKind=aKind;vec4 view=uView*p;vDist=length(view.xyz);gl_Position=uProj*view;}`;
  const FRAG=`precision mediump float;varying vec3 vColor,vWorld;varying float vKind,vDist;uniform float uTime;
  void main(){vec3 c=vColor;if(vKind>.5){float a=sin(vWorld.x*.075+uTime*1.7+sin(vWorld.z*.02))*sin(vWorld.z*.11-uTime*1.2);
    float b=pow(max(0.,sin(vWorld.x*.036+vWorld.z*.044+uTime*2.1)),13.);
    c+=vec3(.018,.054,.080)*a+vec3(.10,.17,.18)*b;
  }float f=smoothstep(940.,3300.,vDist);c=mix(c,vec3(.16,.228,.287),f);gl_FragColor=vec4(c,1.);}`;
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
  const trees=[[-1552,335,.86],[-1545,120,.76],[-215,875,.93],[402,890,.82],[-1530,-1330,.72],[1562,-959,.86],[-145,852,.91],[1545,-230,.78],[-1260,-1540,.96],[1541,847,.76],[1545,-365,.87],[-1550,-230,.84],[-1545,-420,.70],[1555,100,.74]];
  const power=[{name:'CENTRAL',x:125,z:-600},{name:'WEST',x:-975,z:500},{name:'EAST',x:1225,z:500}];
  const homeStarts=[[-275,-1375],[275,-1375],[-825,-875],[825,-875],[-275,-325],[275,-325],[-825,225],[825,225],[-825,775],[825,775],[-1375,-875],[1375,-325],[-1375,225],[1375,225],[-275,-875],[275,-875]];
  const sosStarts=[[0,-1150],[-550,-1150],[550,-1150],[-1100,-600],[1100,-600],[-550,-600],[550,-600],[0,-50],[-1100,-50],[1100,-50],[-550,500],[550,500],[-1100,1050],[1100,1050],[-550,1050],[550,1050]];
  const students=['Adittya','Usaeed','Nafisa','Sujail','Kazmi','Safin','Shammo','Fahim','Rafi','Nabil','Sadia','Tanvir','Mushfiq','Jara','Tahmid','Nusrat','Riad','Faria','Zarin','Adnan'];
  const studentColors=[[.95,.38,.21],[.32,.79,.91],[.91,.68,.21],[.66,.46,.91],[.39,.88,.61],[.92,.44,.68]];
  const currents=[{name:'WEST CURRENT',a:-1260,b:-940,c:-450,d:200,dx:39,dz:4},{name:'CENTRAL CURRENT',a:-150,b:150,c:-950,d:-350,dx:-38,dz:0},{name:'EAST CURRENT',a:430,b:680,c:150,d:850,dx:0,dz:-43},{name:'NORTH CURRENT',a:-700,b:-390,c:710,d:1150,dx:34,dz:0}];
  function valid(x,z,margin=0){if(Math.abs(x)>1615||Math.abs(z)>1615)return false;
    for(const b of buildings)if(Math.abs(x-b.x)<b.hw+31+margin&&Math.abs(z-b.z)<b.hd+31+margin)return false;
    // Simplified collision silhouette for the multi-wing BRACU campus.
    if(x>-225-margin&&x<275+margin&&z>1225-margin&&z<1640+margin)return false;
    if(Math.abs(x-825)<156+margin&&z>1255-margin&&z<1432+margin)return false;
    for(const [cx,cz,a] of cars){if(Math.abs(x-cx)<60+margin&&Math.abs(z-cz)<60+margin)return false;}
    for(const [tx,tz,s] of trees){if(distance(x,z,tx,tz)<(8*s+19+margin))return false;}
    return true;
  }
  const homes=[];homeStarts.forEach(([x,z],i)=>{const b=buildings.find(t=>t.x===x&&t.z===z);if(!b)return;
    const road=[-1150,-600,-50,500,1050].reduce((p,v)=>Math.abs(v-z)<Math.abs(p-z)?v:p,-1150);
    const dir=road>z?1:-1, dock=z+dir*(b.hd+110);if(valid(x,dock))homes.push({id:`H${i+1}`,x,z:dock,type:'HOME',name:`Home ${String(i+1).padStart(2,'0')}`});
  });
  const rescues=sosStarts.map(([x,z],i)=>({id:`S${i+1}`,x,z,type:'DROWNING',name:`Flooded Street ${String(i+1).padStart(2,'0')}`})).filter(t=>valid(t.x,t.z));
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
  const waterMesh=new Mesh(), SIZE=1700,STEP=96;
  for(let x=-SIZE;x<SIZE;x+=STEP)for(let z=-SIZE;z<SIZE;z+=STEP){const c=[.061+(.008*Math.sin(x*.01+z*.03)),.187,.252];waterMesh.quad([x,-2,z],[x+STEP,-2,z],[x+STEP,-2,z+STEP],[x,-2,z+STEP],c,1);}waterMesh.upload();
  // Local meshes drawn with per-instance transforms.
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
  const signalRed=new Mesh();signalRed.sphere(145,120,-68,9,[1,.15,.1],4,10);signalRed.upload();
  const signalGreen=new Mesh();signalGreen.sphere(145,120,-68,9,[.17,1,.38],4,10);signalGreen.upload();

  const S={mode:'MENU',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,debris:[],debrisCooldown:0,gameOverReason:'',current:'',movingCars:[],bobTime:0};
  const keys=new Set();
  function notify(msg,sec=3){S.notification=msg;S.notificationTime=sec;}
  const seated=()=>S.rides.filter(r=>r.state==='ONBOARD');
  const formatTime=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  function reset(){keys.clear();Object.assign(S,{mode:'PLAYING',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,debrisCooldown:0,gameOverReason:'',current:'',movingCars:[]});
    const dpos=[[-1120,-220],[-535,-660],[40,-360],[595,-980],[1125,-50],[-1060,720],[-510,880],[0,270],[550,870],[1100,1000]];
    S.debris=dpos.map(([x,z],i)=>({x,z,x0:x,z0:z,phase:i*.67}));
    $('menu').classList.add('hidden');$('modal').classList.add('hidden');$('hud').classList.remove('hidden');
    offerRide();notify('Take students to BRAC University before their timers expire!',5);refreshHUD();}
  function offerRide(){if(S.request||S.rides.length>=5)return;
    const id=S.requestId++,type=id%2===0?'HOME':'DROWNING',places=(type==='HOME'?homes:rescues).filter(p=>!S.rides.some(r=>r.locationId===p.id));if(!places.length)return;
    const place=id<2?places[0]:places[Math.floor(Math.random()*places.length)];
    const dist=Math.abs(S.x-place.x)+Math.abs(S.z-place.z)+Math.abs(place.x)+Math.abs(place.z-1080);
    const deadline=clamp(Math.round(43+dist/130+(type==='HOME'?7:0)+rnd(-4,6)),66,118);
    S.request={id,type,name:students[id%students.length],locationId:place.id,x:place.x,z:place.z,pickup:place.name,timeLeft:deadline,state:'OFFERED',colorId:id%studentColors.length,warning:false};S.requestLeft=22;}
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
    S.photo=true;S.flash=.25;S.score+=70;S.photoTime=8;notify('Shaheed Minar photographed! +70 points',4);}
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
  function action(key){switch(key){case 'y':accept();break;case 'n':reject();break;case ' ':boost();break;case 'c':if(S.mode==='PLAYING'){S.camera3=!S.camera3;notify(S.camera3?'Third-person camera':'First-person camera',1.5);}break;case 'p':photo();break;case 'f':repair();break;case 'v':if(S.mode==='PLAYING'){S.wiperTime=1.6;notify('Rain swept from the windshield.',1.4);}break;case 'Escape':if(S.mode==='MENU'&&!$('modal').classList.contains('hidden')){$('modal').classList.add('hidden');}else togglePause();break;}}
  function moveAllowed(x,z){if(!valid(x,z))return false;for(const d of S.debris)if(distance(x,z,d.x,d.z)<57)return false;
    for(const car of S.movingCars)if(distance(x,z,car.x,car.z)<70)return false;return true;}
  function step(dt){S.time+=dt;S.bobTime+=dt;S.notificationTime=Math.max(0,S.notificationTime-dt);S.flash=Math.max(0,S.flash-dt);S.photoTime=Math.max(0,S.photoTime-dt);S.wiperTime=Math.max(0,S.wiperTime-dt);
    S.boost=clamp(S.boost+(S.boostOn?-30:15)*dt,0,100);if(S.boost<=0)S.boostOn=false;
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
    const turn=(keys.has('a')||keys.has('arrowleft')?1:0)-(keys.has('d')||keys.has('arrowright')?1:0);
    if(turn){S.angle=(S.angle+turn*105*dt+360)%360;S.lastMove=S.time;}
    if(forward){const speed=(forward>0?270:180)*(S.boostOn?1.65:1);const dx=Math.cos(S.angle*RAD)*speed*dt*forward,dz=Math.sin(S.angle*RAD)*speed*dt*forward;
      // Collision increments avoid tunnelling through narrow buildings.
      const n=Math.ceil(Math.hypot(dx,dz)/8)||1;for(let i=0;i<n;i++){
        const x=S.x+dx/n,z=S.z+dz/n;if(moveAllowed(x,z)){S.x=x;S.z=z;}else{const bad=S.debris.some(d=>distance(x,z,d.x,d.z)<57);if(bad&&S.debrisCooldown<=0){S.score=Math.max(0,S.score-25);S.debrisCooldown=1.8;notify('Floating debris! -25 points. Steer around it.',2.7);}break;}}
      S.lastMove=S.time;
    }
    S.debrisCooldown=Math.max(0,S.debrisCooldown-dt);
    S.current='';for(const zone of currents)if(S.x>=zone.a&&S.x<=zone.b&&S.z>=zone.c&&S.z<=zone.d){S.current=zone.name;const x=S.x+zone.dx*dt,z=S.z+zone.dz*dt;if(moveAllowed(x,z)){S.x=x;S.z=z;}break;}
    S.debris.forEach(d=>{const ph=d.phase+S.time*.65,x=d.x0+Math.sin(ph)*26,z=d.z0+Math.cos(ph*.7)*18;if(distance(x,z,S.x,S.z)>57){d.x=x;d.z=z;}});
    S.movingCars=[{x:-470+((S.time*30+65)%680<340?(S.time*30+65)%680:680-(S.time*30+65)%680),z:-555},{x:598,z:-490+((S.time*24+190)%720<360?(S.time*24+190)%720:720-(S.time*24+190)%720)}];
    S.trafficClock+=dt;if(S.trafficClock>=(S.traffic==='GREEN'?5:4)){S.trafficClock=0;S.traffic=S.traffic==='GREEN'?'RED':'GREEN';}
    const inTraffic=S.x>=-115&&S.x<=115&&S.z>=-165&&S.z<=70;
    if(!inTraffic)S.trafficSafe=[S.x,S.z];
    if(inTraffic&&!S.wasTraffic&&S.traffic==='RED'){[S.x,S.z]=S.trafficSafe;S.score=Math.max(0,S.score-35);S.violations++;notify('RED LIGHT! Returned to the stop line. -35 points',3);S.wasTraffic=false;}else S.wasTraffic=inTraffic;
    if(!S.powerOff){S.powerClock+=dt;if(S.powerClock>=15){S.powerOff=true;S.powerClock=0;notify(`${power[S.powerIndex].name} district power outage!`,2.6);}}
    if(S.request){S.requestLeft-=dt;if(S.requestLeft<=0){S.request=null;S.spawnClock=0;}}
    else {S.spawnClock+=dt;if(S.spawnClock>=9.5){S.spawnClock=0;offerRide();}}
    for(const r of S.rides){r.timeLeft-=dt;if(r.timeLeft<=0){r.state='FAILED';S.failed++;S.score=Math.max(0,S.score-75);notify(`${r.name} ran out of time! -75 points`,3.5);}else if(r.state==='ONBOARD'&&r.timeLeft<=25&&!r.warning){r.warning=true;notify(`HURRY! ${r.name} has 25 seconds left!`,3);}}
    S.rides=S.rides.filter(r=>r.state!=='FAILED');
    if(distance(S.x,S.z,0,1080)<=122){const arrived=seated();if(arrived.length){let gained=0;for(const r of arrived){r.state='DELIVERED';const points=200+Math.floor(r.timeLeft*.4);S.score+=points;gained+=points;S.delivered++;}S.rides=S.rides.filter(r=>r.state!=='DELIVERED');notify(`Delivered ${arrived.length} student(s) to BRACU! +${gained} points`,4);}}
    const nearby=S.rides.filter(r=>r.state==='WAITING'&&distance(S.x,S.z,r.x,r.z)<=(r.type==='HOME'?72:56)).sort((a,b)=>distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z))[0];
    if(!nearby||seated().length>=3||S.time-S.lastMove<.38){S.dock=0;S.dockId=-1;}
    else {if(S.dockId!==nearby.id){S.dock=0;S.dockId=nearby.id;}S.dock+=dt;const required=nearby.type==='HOME'?1.3:.65;
      if(S.dock>=required){nearby.state='ONBOARD';S.dock=0;S.dockId=-1;if(nearby.type==='HOME'){S.score+=35;notify(`${nearby.name} boarded! ${seated().length}/3 seats. +35 points`,3);}else{S.score+=90;S.rescued++;notify(`RESCUED ${nearby.name}! Deliver to BRACU. +90 points`,3);}}}
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
    const clearCampus=distance(S.x,S.z,0,1360)<425,quantity=clearCampus?38:rain.length;
    wx.strokeStyle=clearCampus?'#d5e6e83d':'#b9e0ed45';wx.lineWidth=Math.max(1,w/1100);
    wx.beginPath();for(let i=0;i<quantity;i++){const d=rain[i];d.y=(d.y+d.speed*dt)%1;d.x=(d.x+.06*dt)%1;
      const x=d.x*w,y=d.y*h;if(S.wiperTime>0&&x>w*.25&&x<w*.78&&y>h*.1&&y<h*.8)continue;
      wx.moveTo(x,y);wx.lineTo(x-w*.004,y+d.len*h);}wx.stroke();
    if(S.wiperTime>0){wx.strokeStyle='#d1effa65';wx.lineWidth=6;wx.beginPath();wx.arc(w*.5,h*.86,Math.min(w,h)*.62,Math.PI*1.21,Math.PI*1.74);wx.stroke();}
    if(S.flash>0){wx.fillStyle=`rgba(255,252,224,${clamp(S.flash*1.6,0,.6)})`;wx.fillRect(0,0,w,h);}
  }
  function draw(){resize();skyColor();const a=S.angle*RAD,c=Math.cos(a),s=Math.sin(a),boatY=9+Math.sin(S.bobTime*2.8)*1.3;
    const lerp=((S.angle-S.heading+540)%360)-180;S.heading=(S.heading+lerp*.16+360)%360;
    const ca=S.camera3?S.heading*RAD:a;
    let eye,target,fov;
    if(S.mode==='MENU'){
      const t=performance.now()*.00012;eye=[720*Math.cos(t),520,-1100+570*Math.sin(t)];target=[0,60,600];fov=70;
    }else if(S.camera3){const x=S.x-Math.cos(ca)*228,z=S.z-Math.sin(ca)*228;
      eye=[x,139,z];target=[S.x+c*80,36,S.z+s*80];fov=73;
    }else{eye=[S.x-c*24,boatY+41,S.z-s*24];target=[S.x+c*210,boatY+19,S.z+s*210];fov=78;}
    gl.uniformMatrix4fv(uniforms.proj,false,perspective(fov*RAD,canvas.width/canvas.height,1.2,5100));gl.uniformMatrix4fv(uniforms.view,false,lookAt(eye,target));gl.uniform1f(uniforms.time,S.bobTime);
    gl.disable(gl.CULL_FACE);render(waterMesh);gl.enable(gl.CULL_FACE);render(city);
    // Foreground boat, dynamic light state and localized mission markers.
    for(let i=0;i<cars.length;i++){const [x,z,angle]=cars[i];render(carMesh,model(x,-3+(i%3),z,angle,.95));}
    for(const car of S.movingCars)render(carMesh,model(car.x,1,car.z,car.z===-555?0:90,.97));
    S.debris.forEach((d,i)=>render(debrisMesh,model(d.x,0,d.z,(i*57)%360,1)));
    for(let i=0;i<power.length;i++){const p=power[i];render(powerMesh,model(p.x,0,p.z,0,1));}
    for(const r of S.rides)if(r.state==='WAITING'){
      const bounce=Math.sin(S.bobTime*4+r.id)*2;
      render(npcMeshes[r.colorId],model(r.x,3+bounce,r.z,-90,.92));
      render(markerMesh,model(r.x,3+Math.sin(S.bobTime*4+r.id)*1.5,r.z,0,1));
    }
    if(S.request){/* Offered riders appear on the map, not in the city until accepted. */}
    if(!S.photo)render(markerGoal,model(825,1,1080,0,1));
    if(S.powerOff){const p=power[S.powerIndex];render(markerGoal,model(p.x,2,p.z,0,.8));}
    // Traffic lights: emissive-like saturated color, red/green changes with the actual timer.
    render(S.traffic==='RED'?signalRed:signalGreen);
    if(S.mode!=='MENU'){
      if(S.camera3){gl.disable(gl.CULL_FACE);render(boatMesh,model(S.x,boatY,S.z,S.angle,.62));gl.enable(gl.CULL_FACE);}
      // Passengers are visible from either camera as smaller seated silhouettes.
      const seats=[[8,-19],[8,19],[67,0]];
      seated().forEach((r,i)=>{const [bx,bz]=seats[i];const sx=S.x+(bx*c-bz*s)*.62,sz=S.z+(bx*s+bz*c)*.62;render(npcMeshes[r.colorId],model(sx,boatY+8,sz,S.angle,.36));});
      if(S.camera3){for(const sign of [-1,1]){
        const bx=S.x+(8*c-sign*47*s)*.62,bz=S.z+(8*s+sign*47*c)*.62;
        const rocking=(keys.has('w')||keys.has('arrowup'))?Math.sin(S.bobTime*9)*13:4;
        render(paddleMesh,model(bx,boatY+10,bz,S.angle+sign*(23+rocking),.48));
      }}
    }
  }
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
  window.MajhiDiagnostics={getState:()=>({mode:S.mode,x:S.x,z:S.z,angle:S.angle,score:S.score,delivered:S.delivered,failed:S.failed,activeRequests:S.rides.length,request:S.request?.name||null,boatBoost:Math.round(S.boost),renderer:'WebGL1'}),start:reset};
  requestAnimationFrame(loop);
})();
