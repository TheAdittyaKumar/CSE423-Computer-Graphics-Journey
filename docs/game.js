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
  // Only the four existing current zones get larger, faster wave crests.
   // Fade in at their boundaries instead of forming sudden water ridges.
   float west=smoothstep(-1280.,-1210.,p.x)*(1.-smoothstep(-990.,-920.,p.x))*smoothstep(-470.,-405.,p.z)*(1.-smoothstep(155.,220.,p.z));
   float center=smoothstep(-170.,-105.,p.x)*(1.-smoothstep(105.,170.,p.x))*smoothstep(-970.,-905.,p.z)*(1.-smoothstep(-395.,-330.,p.z));
   float east=smoothstep(410.,475.,p.x)*(1.-smoothstep(635.,700.,p.x))*smoothstep(130.,195.,p.z)*(1.-smoothstep(805.,870.,p.z));
   float north=smoothstep(-720.,-655.,p.x)*(1.-smoothstep(-435.,-370.,p.x))*smoothstep(690.,755.,p.z)*(1.-smoothstep(1105.,1170.,p.z));
   float rough=clamp(west+center+east+north,0.,1.);
   p.y+=rough*(4.5*sin(.037*p.x+.023*p.z-uTime*3.8)+2.7*sin(.028*p.z-.032*p.x+uTime*4.5));
  }vWorld=p.xyz;vColor=aColor;vKind=aKind;vec4 view=uView*p;vDist=length(view.xyz);gl_Position=uProj*view;gl_Position.x=-gl_Position.x;}`;
  const FRAG=`precision ${sharedPrecision} float;varying vec3 vColor,vWorld;varying float vKind,vDist;uniform float uTime;
  void main(){vec3 c=vColor;float opacity=1.;if(vKind>.5&&vKind<1.5){float daylight=clamp((560.-length(vec2(vWorld.x,vWorld.z-1378.)))/300.,0.,1.);daylight=daylight*daylight*(3.-2.*daylight);
    opacity=mix(.53,.12,daylight);c=mix(c,vec3(.24,.31,.30),.55*daylight);float a=sin(vWorld.x*.075+uTime*1.7+sin(vWorld.z*.02))*sin(vWorld.z*.11-uTime*1.2);
    float b=pow(max(0.,sin(vWorld.x*.036+vWorld.z*.044+uTime*2.1)),13.);
    c+=vec3(.018,.054,.080)*a+vec3(.10,.17,.18)*b;
  }else if(vKind>3.5&&vKind<4.5){
    // Warm streetlight halo: its shell is translucent, while its bulb is the
    // original static source geometry and never has to be re-drawn.
    opacity=.085;
  }else if(vKind>2.5&&vKind<3.5){
    // Real 3D rain streaks retain translucency rather than opaque HUD marks.
    opacity=.64;
  }else if(vKind>6.5){
    // Soft additive-looking warning glow, without the campus-ground mask.
    opacity=.16;c=min(c*1.16,vec3(1.));
  }else if(vKind>5.5){
    // BRACU alone is genuinely dry: a soft, raised grassy courtyard blends
    // into the flood instead of ending at a rectangular map boundary.
    float radial=length(vec2(vWorld.x,vWorld.z-1378.));
    opacity=1.0-smoothstep(230.,365.,radial);
    c=mix(c,vec3(.33,.43,.30),.26);
  }else if(vKind>4.5){
    opacity=.38;
  }else if(vKind>1.5){
    float radial=length(vec2(vWorld.x,vWorld.z-1378.));
    float radialFade=1.0-smoothstep(260.,540.,radial);
    float heightFade=1.0-smoothstep(480.,1600.,vWorld.y);
    opacity=(.13+.085*(.5+.5*sin(uTime*1.9+vWorld.x*.008)))*radialFade*(.62+.38*heightFade);
    c=mix(c,vec3(1.,.96,.78),.19);
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
  function lookAt(eye,target,up=[0,1,0]){const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([
    x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
    -x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
  function model(x=0,y=0,z=0,angle=0,scale=1){const c=Math.cos(angle*RAD)*scale,s=Math.sin(angle*RAD)*scale;return new Float32Array([c,0,s,0,0,scale,0,0,-s,0,c,0,x,y,z,1]);}
  // The original model matrix handles yaw. For the boat only, allow genuine
  // local pitch/roll so the hull, captain and paddles react together.
  function rockingBoatModel(x,y,z,angle,scale,pitch=0,roll=0){
    if(Math.abs(pitch)+Math.abs(roll)<.001)return model(x,y,z,angle,scale);
    const cy=Math.cos(angle*RAD),sy=Math.sin(angle*RAD);
    const cp=Math.cos(pitch*RAD),sp=Math.sin(pitch*RAD);
    const cr=Math.cos(roll*RAD),sr=Math.sin(roll*RAD),k=scale;
    return new Float32Array([
      cy*cp*k,sp*k,sy*cp*k,0,
      (-cy*sp*cr-sy*sr)*k,cp*cr*k,(-sy*sp*cr+cy*sr)*k,0,
      (cy*sp*sr-sy*cr)*k,-cp*sr*k,(sy*sp*sr+cy*cr)*k,0,
      x,y,z,1
    ]);
  }
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
  // The two slow cars use the original Python's own route ranges and progress.
  const slowCars=[{axis:'x',fixed:-555,min:-470,max:-130,speed:30,phase:65,style:3},
                  {axis:'z',fixed:598,min:-490,max:-130,speed:24,phase:190,style:4}];
  function carAtProgress(car,progress){
    const travel=car.max-car.min,offset=((progress%(2*travel))+(2*travel))%(2*travel);
    const forward=offset<=travel,along=car.min+(forward?offset:2*travel-offset);
    return car.axis==='x'?{x:along,z:car.fixed,angle:forward?0:180,style:car.style}:
      {x:car.fixed,z:along,angle:forward?90:270,style:car.style};
  }
  function updateSlowCars(dt){
    S.movingCars=slowCars.map((car,i)=>{
      const current=S.carProgress[i],future=current+car.speed*dt;
      let blocked=false;
      const steps=Math.max(1,Math.ceil(car.speed*dt/5));
      for(let part=1;part<=steps;part++){
        const point=carAtProgress(car,current+(future-current)*(part/steps));
        if(orientedObjectOverlap(S.x,S.z,point.x,point.z,point.angle,
                                 point.style%3===1?45:40,20,12)){blocked=true;break;}
      }
      const wasStopped=S.carStopped[i];
      S.carStopped[i]=blocked;
      if(blocked&&!wasStopped){
        const carPos=carAtProgress(car,current);
        triggerBoatImpact(carPos.x-S.x,carPos.z-S.z,.85);
      }
      if(!blocked)S.carProgress[i]=future;
      return {...carAtProgress(car,S.carProgress[i]),stopped:blocked};
    });
  }
  const trees=[[-1552,335,.86],[-1545,120,.76],[-215,875,.93],[402,890,.82],[-1530,-1330,.72],[1562,-959,.86],[-145,852,.91],[1545,-230,.78],[-1260,-1540,.96],[1541,847,.76],[1545,-365,.87],[-1550,-230,.84],[-1545,-420,.70],[1555,100,.74]];
  const power=[{name:'CENTRAL',x:125,z:-600},{name:'WEST',x:-975,z:500},{name:'EAST',x:1225,z:500}];
  // Exact campus collision volumes from the original Python, not a single oversized block.
  const campusSolids=[[-132,1370,89,191],[38,1508,259,66],[206,1462,59,112],[-8,1400,58,66],[-56,1240,38,49],[44,1238,34,49]];
  const homeStarts=[[-275,-1375],[275,-1375],[-825,-875],[825,-875],[-275,-325],[275,-325],[-825,225],[825,225],[-825,775],[825,775],[-1375,-875],[1375,-325],[-1375,225],[1375,225],[-275,-875],[275,-875]];
  const sosStarts=[[0,-1150],[-550,-1150],[550,-1150],[-1100,-600],[1100,-600],[-550,-600],[550,-600],[0,-50],[-1100,-50],[1100,-50],[-550,500],[550,500],[-1100,1050],[1100,1050],[-550,1050],[550,1050]];
  const students=['Adittya','Usaeed','Nafisa','Sujail','Kazmi','Safin','Shammo','Fahim','Rafi','Nabil','Sadia','Tanvir','Mushfiq','Jara','Tahmid','Nusrat','Riad','Faria','Zarin','Adnan'];
  const studentColors=[[.95,.38,.21],[.32,.79,.91],[.91,.68,.21],[.66,.46,.91],[.39,.88,.61],[.92,.44,.68]];
  // Stronger, but still paddle-against-able, currents. Original speeds were
  // ~34-43 units/sec; these now push at ~100-120 units/sec plus wave surges.
  const currents=[{name:'WEST CURRENT',a:-1260,b:-940,c:-450,d:200,dx:114,dz:12},
                  {name:'CENTRAL CURRENT',a:-150,b:150,c:-950,d:-350,dx:-120,dz:0},
                  {name:'EAST CURRENT',a:430,b:680,c:150,d:850,dx:0,dz:-120},
                  {name:'NORTH CURRENT',a:-700,b:-390,c:710,d:1150,dx:104,dz:0}];
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
    const [iResponse,vResponse]=await Promise.all([fetch('./original-geometry.json?v=fidelity9'),fetch('./original-geometry.bin?v=fidelity9')]);
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
  // Reactive citizens are lightweight procedural meshes, baked once into GPU
  // buffers instead of regenerated on every frame. They use the original
  // student's shirt palette, and animate without extra assets or packages.
  const REACTION_FRAMES=12;
  const reactionAnimations=['HOME','HOME_URGENT','SOS','SOS_URGENT','CELEBRATE'];
  const citizenSkin=[.76,.53,.38],citizenHair=[.115,.125,.16];
  function citizenLimb(mesh,from,to,radius,color){
    const axis=norm(to.map((v,i)=>v-from[i]));
    const guide=Math.abs(axis[1])<.88?[0,1,0]:[1,0,0];
    const right=norm(cross(axis,guide)),side=cross(axis,right);
    const ring=(p,t)=>p.map((v,i)=>v+radius*(Math.cos(t)*right[i]+Math.sin(t)*side[i]));
    for(let j=0;j<7;j++){
      const a=j*TAU/7,b=(j+1)*TAU/7;
      mesh.quad(ring(from,a),ring(from,b),ring(to,b),ring(to,a),color);
    }
  }
  function makeCitizenPose(color,kind,index){
    const m=new Mesh(),phase=index*TAU/REACTION_FRAMES;
    const isSOS=kind.startsWith('SOS'),urgent=kind.endsWith('URGENT'),celebrating=kind==='CELEBRATE';
    const aliveY=isSOS?-9:0; // Keep the SOS student visibly immersed in water.
    const chestY=aliveY+22,headY=aliveY+37;
    const skin=citizenSkin,shirt=color;
    const pace=Math.sin(phase),counter=Math.cos(phase);
    // Compact character proportions match the size of the existing students.
    m.box(0,chestY,0,15,23,17,shirt);
    m.box(0,chestY+10,0,15,3,17,shirt.map(v=>Math.min(1,v*1.15)));
    m.cylinder(0,aliveY+13,0,4.4,5,skin,8);
    if(!isSOS){
      for(const side of [-1,1]){
        const stride=celebrating?Math.sin(phase)*3.2:Math.sin(phase+side)*1.2;
        citizenLimb(m,[-1,aliveY+12,side*5],[-1+stride,aliveY+1,side*5.5],3.1,[.17,.24,.30]);
        m.box(3+stride,aliveY+2,side*6,9,4,5,[.11,.16,.19]);
      }
    }
    // Head, hair, face and eyes point down local +X, toward the player.
    m.sphere(1,headY,0,9,skin,5,9);
    m.sphere(-1.5,headY+5,0,8.8,citizenHair,4,9);
    m.sphere(8.9,headY+1,-3.2,1.25,[.95,.96,.87],3,6);
    m.sphere(8.9,headY+1,3.2,1.25,[.95,.96,.87],3,6);
    m.sphere(9.9,headY+1,-3.2,.65,[.10,.14,.17],3,5);
    m.sphere(9.9,headY+1,3.2,.65,[.10,.14,.17],3,5);
    if(urgent||isSOS)m.box(10,headY-5,0,1,3.8,3.5,[.25,.18,.17]);
    else m.box(9.7,headY-5,0,1,1.1,5.5,[.28,.16,.15]);
    // Arms are actual jointed geometry, not textures or stationary overlays.
    // Different frame meshes produce overhead waving, water-treading, or cheers.
    for(const side of [-1,1]){
      const shoulder=[0,chestY+7,side*10.5];
      let elbow,hand;
      if(celebrating){
        elbow=[4,chestY+17+Math.sin(phase+side)*2,side*13];
        hand=[5+Math.sin(phase+side)*5,chestY+30+6*Math.sin(phase*1.0+side),side*15];
      }else if(isSOS){
        const raised=urgent?12:5;
        const splashWave= Math.sin(phase+(side===-1?0:Math.PI));
        elbow=[5,chestY+5+raised*.65+5*splashWave,side*14];
        hand=[7+3*Math.cos(phase),chestY+13+raised+7*splashWave,side*18];
      }else if(urgent){
        elbow=[6,chestY+16+3*Math.sin(phase+side),side*13];
        hand=[4+Math.cos(phase+side)*5,chestY+31+7*Math.sin(phase+side),side*17];
      }else if(side===1){
        elbow=[5,chestY+16+3*pace,side*13];
        hand=[5+Math.cos(phase)*5,chestY+29+5*pace,side*16];
      }else{
        elbow=[0,chestY-5+2*pace,side*12];
        hand=[3,chestY-12+2*counter,side*11];
      }
      citizenLimb(m,shoulder,elbow,3.7,shirt);
      citizenLimb(m,elbow,hand,2.7,skin);
      m.sphere(hand[0],hand[1],hand[2],3.1,skin,3,6);
    }
    // Stranded home students visibly retain a small school bag.
    if(!isSOS&&!celebrating){
      m.box(-9,chestY-2,0,5,16,13,[.24,.34,.36]);
      m.box(-12,chestY+3,0,1.5,4,7,[.85,.67,.36]);
    }
    return m.upload();
  }
  const citizenFrames={};
  for(const kind of reactionAnimations){
    citizenFrames[kind]=studentColors.map(color=>
      Array.from({length:REACTION_FRAMES},(_,frame)=>makeCitizenPose(color,kind,frame)));
  }
  const urgencyMarker=new Mesh();
  urgencyMarker.box(0,6,0,3.4,13,3.4,[1,.31,.22]);
  urgencyMarker.box(0,-5,0,4.3,4.5,4.3,[1,.67,.34]);
  urgencyMarker.upload();
  const happySparkle=new Mesh();
  for(const x of [-1,1])for(const z of [-1,1]){
    happySparkle.tri([0,12,0],[x*3,0,z*2],[0,-4,0],[.99,.85,.30]);
    happySparkle.tri([0,-4,0],[x*3,0,z*2],[0,12,0],[.99,.76,.24]);
  }
  happySparkle.upload();
  // Background population has no mission markers or rescue-state changes.
  // Animation uses the already GPU-cached student pose meshes.
  const CITY_PEOPLE=[
    {x:-1090,z:235,role:'SWIM',colorId:1,phase:.3},
    {x:-75,z:-1050,role:'SWIM',colorId:3,phase:1.3},
    {x:-1105,z:-700,role:'SWIM',colorId:2,phase:2.4},
    {x:-530,z:-1015,role:'SWIM',colorId:4,phase:3.7},
    {x:555,z:-470,role:'SWIM',colorId:0,phase:1.1},
    {x:1095,z:170,role:'SWIM',colorId:5,phase:4.2},
    {x:-1130,z:710,role:'SWIM',colorId:2,phase:5.0},
    {x:530,z:950,role:'SWIM',colorId:3,phase:3.0},
    {x:1100,z:-600,role:'WADE',colorId:5,phase:2.8},
    {x:110,z:-885,role:'WADE',colorId:0,phase:1.5},
    {x:-690,z:-580,role:'WADE',colorId:2,phase:4.1},
    {x:685,z:-45,role:'WADE',colorId:4,phase:2.6},
    {x:-1060,z:1070,role:'WADE',colorId:1,phase:5.2},
    {x:-90,z:810,role:'WATCH',colorId:0,phase:.7},
    {x:1095,z:850,role:'WATCH',colorId:1,phase:3.4},
    {x:-365,z:-685,role:'WATCH',colorId:3,phase:2.0},
    {x:695,z:865,role:'WATCH',colorId:5,phase:4.4},
    ...[3,8,14,21].map((i,k)=>{
      const b=buildings[i];
      return {x:b.x+b.hw*.2,z:b.z-b.hd*.20,y:b.h-17,role:'ROOF',colorId:(k+1)%studentColors.length,phase:k*1.7};
    })
  ];


  // A few unique background characters (not extra missions) enrich the city
  // without crowding the player start. They respond to neighborhood electricity.
  const dhakaExtraCitizens=[
    {role:'BALCONY',building:7,colorId:4,phase:.8,personality:'STUDENT'},
    {role:'BALCONY',building:16,colorId:1,phase:2.7,personality:'UNCLE'},
    {role:'BALCONY',building:22,colorId:3,phase:4.2,personality:'PARENT'},
    {role:'SHOP',x:-350,z:822,colorId:0,phase:.5,personality:'SHOPKEEPER'},
    {role:'SHOP',x:319,z:650,colorId:5,phase:1.8,personality:'SHOPKEEPER'},
    {role:'ROPE',building:10,colorId:2,phase:2.1,personality:'HELPER'},
  ].map(p=>{
    if(p.building===undefined)return p;
    const b=buildings[p.building];
    return {...p,x:b.x+15,z:b.z-b.hd-10,y:p.role==='ROPE'?b.h-4:Math.min(b.h-48,110)};
  });
  const PERSONALITY_NAMES=['STUDENT','WORRIER','JOKER','NEIGHBOR','HELPER','UNCLE'];
  function dhakaPerson(p){return p.personality||PERSONALITY_NAMES[(p.uid*5+p.colorId)%PERSONALITY_NAMES.length];}
  CITY_PEOPLE.push(...dhakaExtraCitizens);
  // Reusable balconies, supply boxes, and rope: all static lightweight mesh.
  const balconyTrim=new Mesh(),marketSupplies=new Mesh(),rescueRope=new Mesh();
  balconyTrim.box(0,-11,0,39,3,22,[.54,.58,.56]);
  balconyTrim.box(0,-1,-11,40,2.3,2.1,[.33,.39,.39]);
  balconyTrim.box(0,-1,11,40,2.3,2.1,[.33,.39,.39]);
  for(let k=-1;k<=1;k++)balconyTrim.box(k*16,-5,-11,2.3,14,2.1,[.36,.42,.42]);
  balconyTrim.upload();
  marketSupplies.box(0,0,0,22,15,16,[.62,.39,.19]);
  marketSupplies.box(0,8.5,0,23,3,17,[.77,.56,.29]);
  marketSupplies.box(-5,9.7,-3,5,1,4,[.83,.19,.15]);
  marketSupplies.box(5,9.7,3,6,1,4,[.24,.69,.36]);
  marketSupplies.upload();
  citizenLimb(rescueRope,[0,0,0],[-7,-70,-14],.87,[.82,.69,.43]);
  rescueRope.upload();
  function residentCelebrating(p){
    const age=S.time-powerVisual.repairedAt;
    return age>=0&&age<5&&powerVisual.repairedIndex>=0&&
      districtForX(p.x)===powerVisual.repairedIndex;
  }

  // SECONDARY RESCUE FLEET — these majhis collect background bystanders, NOT
  // player-assigned ride requests. New citizens spawn in other safe road areas.
  const FLEET_ROADS_X=[-1100,-550,0,550,1100];
  const FLEET_ROADS_Z=[-1150,-600,-50,500,1050];
  const FLEET_SPAWNS=[
    [-1100,-1150],[-550,-1150],[550,-1150],[1100,-1150],
    [-1100,-600],[-550,-600],[550,-600],[1100,-600],
    [-1100,-50],[-550,-50],[550,-50],[1100,-50],
    [-1100,500],[-550,500],[550,500],[1100,500],
    [-1100,1050],[-550,1050],[550,1050],[1100,1050],
    [0,-1150],[0,-600],[0,-50],[0,500],[0,1050]
  ];
  function createRescueFleet(){return [
    {id:0,name:'Majhi Rafiq',x:-550,z:-600,angle:90,colorId:2,speed:158,waypoints:[],targetId:null,pause:0,rescuedAt:-99,rescuedColor:0,deliveries:0},
    {id:1,name:'Majhi Karim',x:550,z:500,angle:270,colorId:4,speed:148,waypoints:[],targetId:null,pause:0,rescuedAt:-99,rescuedColor:0,deliveries:0}
  ];}
  const nearestLane=(v,lanes)=>lanes.reduce((best,a)=>Math.abs(a-v)<Math.abs(best-v)?a:best,lanes[0]);
  function fleetPath(boat,person){
    const sx=nearestLane(boat.x,FLEET_ROADS_X),sz=nearestLane(boat.z,FLEET_ROADS_Z);
    const tx=nearestLane(person.x,FLEET_ROADS_X),tz=nearestLane(person.z,FLEET_ROADS_Z);
    const path=[{x:sx,z:sz},{x:tx,z:sz},{x:tx,z:tz}];
    // Finish along an EXISTING road; never drive diagonally through buildings.
    if(Math.abs(person.x-tx)<=Math.abs(person.z-tz)){
      path.push({x:tx,z:person.z});
      // A brief turn within the road width reaches people near its edge.
      if(Math.abs(person.x-tx)>75)path.push({x:tx+clamp(person.x-tx,-70,70),z:person.z});
    }else{
      path.push({x:person.x,z:tz});
      if(Math.abs(person.z-tz)>75)path.push({x:person.x,z:tz+clamp(person.z-tz,-70,70)});
    }
    return path.filter((p,i)=>i===0||distance(p.x,p.z,path[i-1].x,path[i-1].z)>2);
  }
  function chooseFleetTarget(boat){
    const alreadyAssigned=new Set([
      ...S.aiBoats.filter(b=>b!==boat).map(b=>b.targetId),
      ...S.aiRickshaws.map(r=>r.targetId)
    ]);
    const pool=S.cityPeople.filter(p=>(p.role==='SWIM'||p.role==='WADE')&&!alreadyAssigned.has(p.uid));
    if(!pool.length)return;
    // A small route variation avoids always choosing the nearest person.
    pool.sort((a,b)=>distance(boat.x,boat.z,a.x,a.z)-distance(boat.x,boat.z,b.x,b.z));
    const candidate=pool[Math.min(pool.length-1,boat.deliveries%3)];
    boat.targetId=candidate.uid;boat.waypoints=fleetPath(boat,candidate);
  }
  function respawnFleetCitizen(previous){
    const choices=FLEET_SPAWNS.filter(([x,z])=>valid(x,z,42)
      &&distance(S.x,S.z,x,z)>450
      &&S.cityPeople.every(p=>distance(p.x,p.z,x,z)>140)
      &&(!previous||distance(previous.x,previous.z,x,z)>390)
      &&S.aiBoats.every(b=>distance(b.x,b.z,x,z)>170)
      &&S.aiRickshaws.every(r=>distance(r.x,r.z,x,z)>135));
    const pool=choices.length?choices:FLEET_SPAWNS.filter(([x,z])=>valid(x,z,28));
    if(!pool.length)return false;
    // Deterministic distribution across neighborhoods, not a spawn pile-up.
    const index=(S.aiRescueCount*7+Math.floor(S.time/19))%pool.length;
    const [x,z]=pool[index],id=S.cityPersonId++;
    S.cityPeople.push({uid:id,x,z,role:id%4===0?'WADE':'SWIM',colorId:id%studentColors.length,
      personality:PERSONALITY_NAMES[(id*3)%PERSONALITY_NAMES.length],phase:id*.83});
    return true;
  }
  function updateRescueFleet(dt){
    for(let i=S.aiRespawnQueue.length-1;i>=0;i--){
      if(S.time>=S.aiRespawnQueue[i].at){if(respawnFleetCitizen(S.aiRespawnQueue[i]))S.aiRespawnQueue.splice(i,1);}
    }
    for(const boat of S.aiBoats){
      if(boat.pause>0){boat.pause=Math.max(0,boat.pause-dt);continue;}
      let target=S.cityPeople.find(p=>p.uid===boat.targetId);
      if(!target){boat.targetId=null;boat.waypoints=[];chooseFleetTarget(boat);target=S.cityPeople.find(p=>p.uid===boat.targetId);}
      if(!target)continue;
      const d=distance(boat.x,boat.z,target.x,target.z);
      if(d<88){
        S.cityPeople=S.cityPeople.filter(p=>p.uid!==target.uid);
        S.aiRespawnQueue.push({at:S.time+2.2,x:target.x,z:target.z});
        S.aiRescueCount++;
        boat.rescuedAt=S.time;boat.rescuedColor=target.colorId;
        boat.deliveries++;boat.pause=2.1;boat.targetId=null;boat.waypoints=[];
        S.pickupEffects.push({x:target.x,z:target.z,at:S.time,type:'AI_RESCUE'});
        continue;
      }
      if(!boat.waypoints.length)boat.waypoints=fleetPath(boat,target);
      while(boat.waypoints.length&&distance(boat.x,boat.z,boat.waypoints[0].x,boat.waypoints[0].z)<9)boat.waypoints.shift();
      if(!boat.waypoints.length){
        // All road waypoints reached: the civilian is at most one short swim away.
        // This picks up a person standing beside the lane without clipping walls.
        if(d<=100){boat.waypoints=[{x:boat.x,z:boat.z}];continue;}
        boat.waypoints=fleetPath(boat,target);
      }
      const next=boat.waypoints[0],dx=next.x-boat.x,dz=next.z-boat.z;
      const wanted=Math.atan2(dz,dx)/RAD;
      const delta=((wanted-boat.angle+540)%360)-180;
      boat.angle=(boat.angle+clamp(delta,-220*dt,220*dt)+360)%360;
      // Give the PLAYER priority if they approach the fleet. The NPC boats
      // have independent movement and never block the player's controls.
      const ahead=Math.min(Math.hypot(dx,dz),boat.speed*dt);
      const nx=boat.x+dx/(Math.hypot(dx,dz)||1)*ahead;
      const nz=boat.z+dz/(Math.hypot(dx,dz)||1)*ahead;
      const blocked=distance(nx,nz,S.x,S.z)<92;
      if(!blocked&&valid(nx,nz,18)){
        boat.x=nx;boat.z=nz;
      }
    }
  }
  // FLOODED-RICKSHAW RESCUE FLEET. Three visibly different traditional
  // Dhaka rickshaws collect only background civilians, as the boat fleet does.
  // Occasional low-speed encounters with parked cars create short, harmless
  // driver quarrels; the vehicles never steal the player's rescue missions.
  function createRickshawFleet(){return [
    {id:0,name:'Rickshaw Salam',x:-1100,z:500,angle:0,speed:81,colorId:1,waypoints:[],targetId:null,pause:0,rescuedAt:-99,rescuedColor:0,deliveries:0,incidentCar:null,quarrelUntil:0,nextCrashAt:31,wheelSpin:0},
    {id:1,name:'Rickshaw Masud',x:1100,z:-50,angle:180,speed:90,colorId:4,waypoints:[],targetId:null,pause:0,rescuedAt:-99,rescuedColor:0,deliveries:0,incidentCar:null,quarrelUntil:0,nextCrashAt:56,wheelSpin:1.8},
    {id:2,name:'Rickshaw Liton',x:550,z:1050,angle:270,speed:85,colorId:2,waypoints:[],targetId:null,pause:0,rescuedAt:-99,rescuedColor:0,deliveries:0,incidentCar:null,quarrelUntil:0,nextCrashAt:79,wheelSpin:3.3}
  ];}
  function chooseRickshawTarget(r){
    const reserved=new Set([
      ...S.aiBoats.map(b=>b.targetId),
      ...S.aiRickshaws.filter(b=>b!==r).map(b=>b.targetId)
    ]);
    const people=S.cityPeople.filter(p=>(p.role==='SWIM'||p.role==='WADE')&&!reserved.has(p.uid));
    if(!people.length)return;
    people.sort((a,b)=>distance(r.x,r.z,a.x,a.z)-distance(r.x,r.z,b.x,b.z));
    const selected=people[Math.min(people.length-1,(r.deliveries+r.id)%3)];
    r.targetId=selected.uid;r.waypoints=fleetPath(r,selected);
  }
  function startRickshawIncident(r){
    const ordered=parkedCars.map((car,i)=>({car,i,d:distance(r.x,r.z,car.x,car.z)}))
      .filter(t=>t.d<1080&&dhakaVehicleType(t.i)!=='rickshaw'&&
        !S.aiRickshaws.some(other=>other!==r&&other.incidentCar===t.i))
      .sort((a,b)=>a.d-b.d);
    if(!ordered.length){r.nextCrashAt=S.time+18;return false;}
    // Approach near the parked vehicle, not through it; the map's existing
    // road waypoints prevent steering directly across building footprints.
    const {car,i}=ordered[0];
    r.incidentCar=i;r.targetId=null;r.waypoints=fleetPath(r,car);
    return true;
  }
  function beginRickshawQuarrel(r){
    const car=parkedCars[r.incidentCar];
    if(!car)return;
    r.quarrelUntil=S.time+15.0;r.pause=0;r.waypoints=[];
    S.rickshawQuarrels.push({id:r.id,carIndex:r.incidentCar,at:S.time,until:r.quarrelUntil});
    S.rickshawCrashCount++;
    S.pickupEffects.push({x:(car.x+r.x)*.5,z:(car.z+r.z)*.5,at:S.time,type:'RICKSHAW_BUMP'});
  }
  function updateRickshawFleet(dt){
    S.rickshawQuarrels=S.rickshawQuarrels.filter(e=>S.time<e.until);
    for(const r of S.aiRickshaws){
      if(r.quarrelUntil>S.time)continue;
      if(r.incidentCar!==null&&r.quarrelUntil>0){
        // Depart only after the full quarrel, not while approaching a car.
        r.incidentCar=null;r.quarrelUntil=0;r.waypoints=[];r.targetId=null;
        r.nextCrashAt=S.time+56+r.id*11;
      }
      if(r.pause>0){r.pause=Math.max(0,r.pause-dt);continue;}
      if(r.incidentCar===null&&S.time>=r.nextCrashAt){startRickshawIncident(r);}
      let target=null;
      if(r.incidentCar!==null)target=parkedCars[r.incidentCar];
      else{
        target=S.cityPeople.find(p=>p.uid===r.targetId);
        if(!target){r.targetId=null;r.waypoints=[];chooseRickshawTarget(r);
          target=S.cityPeople.find(p=>p.uid===r.targetId);}
      }
      if(!target)continue;
      const dist=distance(r.x,r.z,target.x,target.z);
      if(r.incidentCar!==null&&dist<90){beginRickshawQuarrel(r);continue;}
      if(r.incidentCar===null&&dist<70){
        S.cityPeople=S.cityPeople.filter(p=>p.uid!==target.uid);
        S.aiRespawnQueue.push({at:S.time+3.0,x:target.x,z:target.z});
        S.aiRescueCount++;S.rickshawRescueCount++;
        r.rescuedAt=S.time;r.rescuedColor=target.colorId;
        r.deliveries++;r.pause=2.2;r.targetId=null;r.waypoints=[];
        S.pickupEffects.push({x:target.x,z:target.z,at:S.time,type:'RICKSHAW_PICKUP'});
        continue;
      }
      if(!r.waypoints.length)r.waypoints=fleetPath(r,target);
      while(r.waypoints.length&&distance(r.x,r.z,r.waypoints[0].x,r.waypoints[0].z)<11)r.waypoints.shift();
      if(!r.waypoints.length){
        if(r.incidentCar!==null&&dist<110){beginRickshawQuarrel(r);continue;}
        if(r.incidentCar===null&&dist<105){r.waypoints=[{x:target.x,z:target.z}];}
        else r.waypoints=fleetPath(r,target);
      }
      const p=r.waypoints[0];if(!p)continue;
      const dx=p.x-r.x,dz=p.z-r.z,len=Math.hypot(dx,dz)||1;
      const wanted=Math.atan2(dz,dx)/RAD;
      r.angle=(r.angle+clamp(((wanted-r.angle+540)%360)-180,-180*dt,180*dt)+360)%360;
      const stride=Math.min(len,r.speed*dt),nx=r.x+dx/len*stride,nz=r.z+dz/len*stride;
      // Rickshaws yield to the player and other rickshaws. A small obstacle
      // margin keeps the vehicles out of buildings and campus walls.
      const playerNear=distance(nx,nz,S.x,S.z)<96;
      const fleetNear=S.aiRickshaws.some(other=>other!==r&&distance(nx,nz,other.x,other.z)<66);
      if(!playerNear&&!fleetNear&&valid(nx,nz,16)){
        r.x=nx;r.z=nz;
        r.wheelSpin=(r.wheelSpin||0)+stride/10.8;
      }else if(r.incidentCar!==null&&dist<125&&!playerNear){
        // Small bump with a car at the road edge, not a game-ending accident.
        beginRickshawQuarrel(r);
      }
    }
  }
  function drawRickshawFleet(){
    if(S.mode==='MENU')return;
    for(const r of S.aiRickshaws){
      if(distance(S.x,S.z,r.x,r.z)>1050)continue;
      const stopped=r.quarrelUntil>S.time;
      const bumpAge=stopped?r.quarrelUntil-S.time:0;
      const bob=.5*Math.sin(S.time*4+r.id*2)+(stopped&&bumpAge>5.5?2.1*Math.sin(S.time*22):0);
      render(parkedDhakaModels.rescueRickshaws[r.id],
        model(r.x,1.1+bob,r.z,r.angle,.82));
      const a=r.angle*RAD,fx=Math.cos(a),fz=Math.sin(a),sx=-fz,sz=fx;
      const wheelFrame=rickshawWheelFrames[Math.floor((((r.wheelSpin||0)%TAU)+TAU)/TAU*rickshawWheelFrames.length)%rickshawWheelFrames.length];
      for(const [lx,ly,lz] of [[39,14,0],[-29,14,-21],[-29,14,21]]){
        const wx=r.x+(lx*Math.cos(a)-lz*Math.sin(a))*.82;
        const wz=r.z+(lx*Math.sin(a)+lz*Math.cos(a))*.82;
        render(wheelFrame,model(wx,1.1+bob+ly*.82,wz,r.angle,.82));
      }
      // Small back-seat figure makes a recently completed rescue visible.
      if(S.time-r.rescuedAt<7&&!stopped){
        render(citizenFrame('HOME',r.rescuedColor,S.time*1.2),
          model(r.x-fx*30,35+bob,r.z-fz*30,r.angle,.34));
      }
      if(stopped){
        const car=parkedCars[r.incidentCar];
        if(car){
          // Car owner gestures from the safe roadside while the driver argues.
          const ox=car.x+Math.sin(car.angle*RAD)*48;
          const oz=car.z-Math.cos(car.angle*RAD)*48;
          render(citizenFrame('HOME_URGENT',r.colorId,S.time*3.9+r.id),
            model(ox,23,oz,Math.atan2(r.z-oz,r.x-ox)/RAD,.59));
        }
        render(waterRipple,model(r.x,9.6,r.z,0,.62+.10*Math.sin(S.time*5)));
      }else if(S.quality==='HIGH'){
        render(waterRipple,model(r.x-fx*44,9.6,r.z-fz*44,0,.34));
        render(waterRipple,model(r.x-fx*62+sx*12,9.6,r.z-fz*62+sz*12,0,.23));
      }
    }
  }

  function drawRescueFleet(){
    if(S.mode==='MENU')return;
    for(const boat of S.aiBoats){
      if(distance(S.x,S.z,boat.x,boat.z)>1050)continue;
      const a=boat.angle*RAD,fx=Math.cos(a),fz=Math.sin(a),lx=-fz,lz=fx;
      const bob=.9*Math.sin(S.time*4+boat.id);
      // Small distinct sampans carrying a visible majhi, with paddles and wakes.
      render(sourceMeshes?.boat||boatMesh,model(boat.x,11.5+bob,boat.z,boat.angle,.47));
      render(citizenFrame('HOME',boat.colorId,S.time*2.7+boat.id),
        model(boat.x-fx*12,27+bob,boat.z-fz*12,boat.angle,.42));
      const stroke=Math.sin(S.time*10+boat.id*2);
      render(paddleMesh,model(boat.x+fx*9+lx*34,22+bob,boat.z+fz*9+lz*34,boat.angle+22+stroke*17,.30));
      render(paddleMesh,model(boat.x+fx*9-lx*34,22+bob,boat.z+fz*9-lz*34,boat.angle-22-stroke*17,.30));
      // The rescued citizen is briefly visible aboard, rather than vanishing
      // immediately after the pickup animation.
      if(S.time-boat.rescuedAt<7.2)
        render(citizenFrame('CELEBRATE',boat.rescuedColor,S.time*1.9),
          model(boat.x+fx*33,25+bob,boat.z+fz*33,boat.angle,.34));
      for(let k=0;k<2;k++)render(waterRipple,
        model(boat.x-fx*(44+k*26),9.55,boat.z-fz*(44+k*26),0,.36+k*.13));
    }
  }

  function ambientCitizenPosition(c,time){
    if(c.role!=='SWIM')return {x:c.x,z:c.z};
    // Swimmers stay in their road segment rather than crossing solid walls.
    const x=c.x+18*Math.sin(time*.36+c.phase);
    const z=c.z+24*Math.cos(time*.27+c.phase);
    return valid(x,z)?{x,z}:{x:c.x,z:c.z};
  }
  function drawCityPeople(){
    const clock=S.mode==='MENU'?S.bobTime:S.time;
    for(let i=0;i<S.cityPeople.length;i++){
      const person=S.cityPeople[i];
      if(S.quality==='BALANCED' && person.uid%3===1)continue;
      const {x,z}=ambientCitizenPosition(person,clock);
      const dist=distance(S.x,S.z,x,z);
      if(dist>(S.mode==='MENU'?1400:790))continue;
      const near=dist<260;
      const facing=near?Math.atan2(S.z-z,S.x-x)/RAD:-90;
      const bob=Math.sin(clock*(person.role==='SWIM'?5.1:2.5)+person.phase);
      if(person.role==='SWIM'){
        render(citizenFrame('SOS',person.colorId,clock*3.5+person.phase),
          model(x,9.2+bob*1.5,z,facing,.83));
        render(waterRipple,model(x,9.7,z,0,.52+.16*Math.sin(clock*5+person.phase)));
      }else if(person.role==='WADE'){
        render(citizenFrame(near?'HOME_URGENT':'HOME',person.colorId,clock*(near?2.1:.9)+person.phase),
          model(x,6.8+bob*.5,z,facing,.68));
        // A student shields their laptop above floodwater rather than leaving it underwater.
        if(dhakaPerson(person)==='STUDENT')render(dhakaLaptop,model(x,57+1.7*bob,z,facing,.72));
        if(near)render(waterRipple,model(x,9.5,z,0,.34+.08*Math.sin(clock*3+person.phase)));
      }else if(person.role==='ROOF'){
        render(citizenFrame(near?'HOME_URGENT':'HOME',person.colorId,clock*1.4+person.phase),
          model(x,person.y+.5*bob,z,facing,.68));
      }else if(person.role==='BALCONY'||person.role==='ROPE'){
        const cheer=residentCelebrating(person);
        render(balconyTrim,model(x,person.y-6,z+6,0,1));
        render(citizenFrame(cheer?'CELEBRATE':'HOME_URGENT',person.colorId,
          clock*(cheer?3.4:1.5)+person.phase),model(x,person.y,z-1,-90,.62));
        if(person.role==='ROPE'){
          render(rescueRope,model(x+6,person.y-2,z-18,0,.87));
          if(S.quality==='HIGH')render(waterRipple,model(x,9.7,z-30,0,.42));
        }
      }else if(person.role==='SHOP'){
        const cheer=residentCelebrating(person),lift=(1+Math.sin(clock*1.4+person.phase))*.5;
        render(marketSupplies,model(x+16,17+lift*15,z+12));
        render(marketSupplies,model(x-14,21+lift*6,z+12,0,.65));
        render(citizenFrame(cheer?'CELEBRATE':'HOME',person.colorId,
          clock*(cheer?3.2:1.2)+person.phase),model(x,18,z,-90,.67));
      }else{
        render(citizenFrame(near?'HOME_URGENT':'HOME',person.colorId,clock*(near?2.1:.8)+person.phase),
          model(x,16+bob*.6,z,facing,.66));
      }
    }
  }
  // These two bystanders stand beside, not on top of, the original animated
  // shopkeepers. They respond when the rescue boat passes their storefronts.
  const reactiveBystanders=[{x:-452,z:776,colorId:3},{x:407,z:606,colorId:4}];
  function citizenFrame(kind,colorId,clock){
    const frame=((Math.floor(clock*REACTION_FRAMES/TAU)%REACTION_FRAMES)+REACTION_FRAMES)%REACTION_FRAMES;
    return citizenFrames[kind][colorId%studentColors.length][frame];
  }
  function passengerReaction(ride){
    const px=ride.personX??ride.x,pz=ride.personZ??ride.z;
    const d=distance(S.x,S.z,px,pz);
    const urgent=ride.timeLeft<=25 || (ride.type==='DROWNING'&&ride.timeLeft<=40);
    const responding=d<300;
    const energetic=urgent||d<155;
    const speed=energetic?3.4:responding?2.3:1.15;
    const facing=Math.atan2(S.z-pz,S.x-px)/RAD;
    return {px,pz,d,urgent,responding,energetic,speed,facing};
  }

  // Dhaka's characteristic vehicles, modeled as light WebGL meshes: two
  // three-wheeled CNG auto-rickshaws and one decorated pedal rickshaw.
  // The original 'cars' baked mesh is not drawn, because it contains all the
  // parked vehicles together. We reconstruct its remaining cars individually.
  function dhakaWheel(m,x,y,z,r=11){
    const tire=[.055,.075,.085],rim=[.74,.76,.67],hub=[.25,.31,.32],spokes=12;
    // A true vertical wheel (the regular Mesh.cylinder has a vertical axle).
    for(let side of [-1,1]){
      const zz=z+side*2.5;
      for(let k=0;k<spokes;k++){
        const a=TAU*k/spokes,b=TAU*(k+1)/spokes;
        const pt=(rad,t)=>[x+Math.cos(t)*rad,y+Math.sin(t)*rad,zz];
        m.quad(pt(r-2.3,a),pt(r-2.3,b),pt(r,b),pt(r,a),tire);
        m.tri([x,y,zz],pt(r-3,a),pt(r-3,b),rim);
        if(k%2===0)citizenLimb(m,[x,y,zz+side*.45],pt(r-2.6,a),.45,hub);
      }
      m.sphere(x,y,zz+side*.85,2.8,hub,3,7);
    }
    for(let k=0;k<spokes;k++){
      const a=TAU*k/spokes,b=TAU*(k+1)/spokes;
      m.quad([x+r*Math.cos(a),y+r*Math.sin(a),z-2.5],
             [x+r*Math.cos(b),y+r*Math.sin(b),z-2.5],
             [x+r*Math.cos(b),y+r*Math.sin(b),z+2.5],
             [x+r*Math.cos(a),y+r*Math.sin(a),z+2.5],tire);
    }
  }
  // Bangladesh CNG: slender three-wheeler with a softly curved nose, single
  // steering wheel, black canvas canopy, narrow lattice passenger windows and
  // accessible side doorway. All details are baked into one draw-call mesh.
  function makeDhakaCNG(style=0){
    const m=new Mesh(),green=style?[.055,.42,.26]:[.035,.48,.255],
      darkGreen=style?[.035,.29,.18]:[.025,.32,.18],
      paleGreen=[.21,.58,.35],shade=[.035,.085,.096],
      roof=[.058,.072,.080],tire=[.07,.083,.087],
      metal=[.57,.65,.62],glass=[.095,.235,.255],
      orange=[.95,.48,.13],cream=[.84,.84,.71];
    // Rear passenger tub: low rounded-looking side steps, NOT a solid tall cube.
    m.box(-25,23,0,55,20,39,darkGreen);
    m.box(-25,13,0,62,9,41,green);
    for(const side of [-1,1]){
      const z=side*20.8;
      m.box(-31,30,z,40,7,2,paleGreen);
      m.box(-24,12,z+side*2.6,56,3.5,4,[.26,.30,.24]);
      m.box(-30,18,z+side*1.6,34,2,2,[.68,.74,.62]);
    }
    // Raised rear bench and central floor so the sides read as a cabin.
    m.box(-35,24,0,19,6,30,[.31,.25,.19]);
    m.box(-44,36,0,7,22,34,[.15,.19,.18]);
    m.box(-7,16,0,42,4,31,[.15,.22,.20]);
    m.box(8,29,0,13,9,26,[.19,.24,.22]);
    // A curved green front apron narrows toward a blunt rounded three-wheeler
    // nose, rather than resembling a boxy jeep or a four-wheel car.
    const profiles=[
      {x:9,cy:28,ry:21,rz:22},
      {x:27,cy:29,ry:22,rz:21},
      {x:41,cy:28,ry:19,rz:18.7},
      {x:50,cy:27,ry:15,rz:15},
      {x:54,cy:27,ry:12,rz:11}
    ];
    const nosePoint=(q,t)=>[q.x,q.cy+q.ry*Math.sin(t),q.rz*Math.cos(t)];
    for(let i=0;i<profiles.length-1;i++)for(let j=0;j<16;j++){
      const a=j*TAU/16,b=(j+1)*TAU/16;
      const p=profiles[i],q=profiles[i+1];
      m.quad(nosePoint(p,a),nosePoint(q,a),nosePoint(q,b),nosePoint(p,b),
        j<5?green:j<11?darkGreen:green);
    }
    // Windscreen slopes BACK into the canopy, with black rubber borders.
    // It faces +X, the same direction as the original parking coordinates.
    m.quad([38,43,-18.3],[38,43,18.3],[24.2,65,20],[24.2,65,-20],roof);
    m.quad([38.8,45,-15.9],[38.8,45,15.9],[26,62.8,17.2],[26,62.8,-17.2],glass);
    citizenLimb(m,[40,43.5,-18.4],[26,65,-20],1.45,roof);
    citizenLimb(m,[40,43.5,18.4],[26,65,20],1.45,roof);
    citizenLimb(m,[39,44,-18],[39,44,18],1.3,roof);
    // One diagonal windscreen wiper with a tiny pivot.
    citizenLimb(m,[40,45,-12],[29,58,9],.83,[.08,.10,.11]);
    m.sphere(40,45,-12,1.6,[.13,.16,.16],3,6);
    // Short driver's side glass, then the iconic REAR mesh passenger windows.
    for(const side of [-1,1]){
      const z=side*22.1;
      m.quad([9,42,z],[24,43,z],[22,61,z],[8,61,z],glass);
      citizenLimb(m,[8,38,z],[8,65,z],1.6,green);
      citizenLimb(m,[23,40,z],[23,65,z],1.65,darkGreen);
      // Passenger upper cabin: dark window apertures enclosed in green steel.
      m.quad([-49,35,z],[-12,35,z],[-12,61,z],[-49,61,z],shade);
      for(let j=0;j<=7;j++){
        const x=-47+j*4.8;
        citizenLimb(m,[x,35,z+side*.28],[x,61,z+side*.28],.44,metal);
      }
      for(let j=0;j<=5;j++){
        const y=36+j*4.8;
        citizenLimb(m,[-49,y,z+side*.27],[-12,y,z+side*.27],.44,metal);
      }
      // A proper passenger entrance exists BETWEEN mesh and driver, with an
      // open window and only a low hinged painted door.
      m.box(-2,21,z,18,17,2.8,green);
      m.box(-2,14,z+side*.9,18,3,3.2,darkGreen);
      citizenLimb(m,[-11,27,z],[-11,63,z],1.9,green);
      citizenLimb(m,[7,28,z],[7,63,z],1.8,green);
      m.box(2,27,z+side*2.4,2.5,7,2,metal); // door handle
      m.box(-29,64,z,42,4,2,green);
      // Narrow canvas side skirt, not yellow horizontal arcade-game stripes.
      m.box(-34,60,z+side*.6,22,6,1.8,roof);
      // Rear-wheel splash guards wrap the two rear wheels.
      for(let j=0;j<7;j++){
        const a=j*Math.PI/7,b=(j+1)*Math.PI/7;
        const curve=t=>[-35+15*Math.cos(t),12.5+15*Math.sin(t),side*20];
        citizenLimb(m,curve(a),curve(b),1.75,darkGreen);
      }
    }
    // Fabric roof: convex, long and black, with edge piping and a rounded lip.
    const roofY=(x,z)=>66.8+3.5*(1-(z/24.5)**2)+1.6*(1-(x/56)**2);
    for(let i=0;i<13;i++)for(let j=0;j<9;j++){
      const x0=-53+i*6.3,x1=x0+6.3,z0=-24.5+j*5.45,z1=z0+5.45;
      m.quad([x0,roofY(x0,z0),z0],[x1,roofY(x1,z0),z0],
        [x1,roofY(x1,z1),z1],[x0,roofY(x0,z1),z1],roof);
    }
    for(const side of [-1,1]){
      const z=side*24;
      citizenLimb(m,[-54,65,z],[27,65,z],1.7,[.24,.26,.24]);
      m.box(-53,54,side*21.2,3.2,18,3,roof);
    }
    // Canvas rear windscreen and a modest rear luggage rack.
    m.box(-53,52,0,3.2,23,39,roof);
    m.box(-55,49,0,1.7,15,25,[.13,.19,.18]);
    m.box(-56,20,0,2,12,31,green);
    for(const side of [-1,1]){
      m.box(-55,22,side*15,2,7,6,[.79,.18,.13]);
      citizenLimb(m,[-57,13,side*18],[-57,13,side*8],1.7,metal);
    }
    citizenLimb(m,[-58,12,-20],[-58,12,20],2.0,metal);
    citizenLimb(m,[-59,20,-18],[-59,20,18],1.2,metal);
    m.box(-57,22,0,2,6,13,cream);
    // Narrow front mudguard and the single steerable-looking front wheel.
    dhakaWheel(m,40,11.6,0,11.2);
    for(let j=0;j<9;j++){
      const a=.12+j*(Math.PI-.24)/9,b=.12+(j+1)*(Math.PI-.24)/9;
      citizenLimb(m,[40+14.3*Math.cos(a),11.6+14.3*Math.sin(a),0],
        [40+14.3*Math.cos(b),11.6+14.3*Math.sin(b),0],3,green);
    }
    dhakaWheel(m,-35,11.6,-20.5,11.1);
    dhakaWheel(m,-35,11.6,20.5,11.1);
    // Classic black nose mask, horizontal grille, lamps and indicators.
    m.box(53.5,30,0,2.1,13,24,[.055,.087,.087]);
    for(const y of [25,29,33])m.box(55, y, 0,1.5,1.2,21,metal);
    for(const z of [-14.8,14.8]){
      m.sphere(50,30,z,6.3,[.080,.10,.10],5,9);
      m.sphere(53,30,z,4.8,[.91,.90,.73],5,9);
      m.sphere(49,39,z,2.7,orange,4,8);
    }
    citizenLimb(m,[56,19,-18],[56,19,18],1.4,metal);
    for(const z of [-16,16]){
      citizenLimb(m,[55,13,z],[58,19,z],1.3,metal);
    }
    return m.upload();
  }
  function makeDhakaRickshaw(style=0){
    const accents=[[[.82,.17,.31],[.20,.61,.80]],[[.19,.48,.82],[.95,.39,.25]],[[.21,.68,.44],[.83,.32,.62]]];
    const m=new Mesh(),frame=[.12,.31,.28],gold=[1,.75,.20],red=accents[style%3][0],blue=accents[style%3][1],black=[.08,.12,.15];
    // Long bicycle frame and single front wheel, plus two rear wheels.
    dhakaWheel(m,39,14,0,13);
    dhakaWheel(m,-29,14,-21,13);
    dhakaWheel(m,-29,14,21,13);
    citizenLimb(m,[39,14,0],[21,36,0],1.5,frame);
    citizenLimb(m,[21,36,0],[4,13,0],1.6,frame);
    citizenLimb(m,[4,13,0],[39,14,0],1.5,frame);
    citizenLimb(m,[4,13,0],[-19,23,0],2.3,frame);
    citizenLimb(m,[21,36,0],[26,40,0],1.6,frame);
    citizenLimb(m,[24,40,-9],[24,40,9],1.3,black);
    m.box(-26,23,0,43,7,44,[.73,.46,.17]);
    m.box(-32,33,0,22,12,38,red); // passenger bench
    m.box(-46,37,0,6,24,37,[.13,.44,.36]);
    m.box(-48,39,0,2.5,23,32,blue);
    for(const side of [-1,1]){
      const z=side*23;
      citizenLimb(m,[-48,30,z],[-47,65,z],1.5,gold);
      citizenLimb(m,[-4,24,z],[-6,65,z],1.5,gold);
      // Flared hand-painted rear side panels.
      m.box(-30,27,side*22,35,16,2,side>0?red:blue);
      for(let k=0;k<4;k++)m.box(-42+k*9,27,side*23.3,3.4,9,1.2,k%2?gold:[.30,.91,.57]);
    }
    // The distinctive covered, arching passenger canopy with bright trim.
    m.box(-28,68,0,51,5,52,[.11,.30,.28]);
    m.box(-28,72,0,53,3,55,red);
    m.box(-28,73.6,0,49,1.8,47,[.95,.61,.17]);
    for(let k=0;k<6;k++)m.box(-49+k*8.4,75,0,3,1.2,49,k%2?gold:blue);
    for(const side of [-1,1]){
      m.box(-28,66,side*26,50,8,2,red);
      for(let k=0;k<5;k++)m.box(-47+k*9.5,67,side*27.3,3,5,1.1,k%2?gold:[.19,.78,.58]);
    }
    // Painted rear folk-art-inspired rosettes, visible above floodwater.
    for(let k=0;k<5;k++)m.sphere(-50,34+(k%2)*7,-16+k*8,3.2,k%2?gold:blue,3,5);
    // Tiny pedaling puller remains visible even when the water covers the wheels.
    m.box(10,42,0,13,20,13,[.48,.71,.69]);
    m.sphere(14,57,0,7,[.70,.50,.34],4,8);
    m.sphere(12,62,0,6,[.13,.16,.19],4,7);
    citizenLimb(m,[16,48,-6],[23,42,-9],2.3,[.69,.50,.35]);
    citizenLimb(m,[16,48,6],[23,42,9],2.3,[.69,.50,.35]);
    return m.upload();
  }
  function makeParkedCar(style){
    const m=new Mesh(),body=[[.36,.43,.47],[.47,.30,.31],[.26,.44,.54],[.40,.44,.32]][style%4];
    m.box(0,14,0,86,20,43,body);
    m.box(-3,29,0,45,20,36,[.17,.24,.28]);
    m.box(-4,39.5,0,49,3,38,body);
    for(const side of [-1,1]){
      m.box(-2,28,side*18.5,43,11,1.5,[.20,.30,.33]);
      m.box(18,15,side*23,20,2,2,[.79,.79,.75]);
      m.box(0,20,side*22,4,2,2,[.78,.83,.77]);
      dhakaWheel(m,-27,10.5,side*20,10);
      dhakaWheel(m,27,10.5,side*20,10);
    }
    m.box(43,16,0,3,7,35,[.17,.20,.22]);
    m.box(44,21,-13,2,6,9,[.93,.85,.63]);m.box(44,21,13,2,6,9,[.93,.85,.63]);
    m.box(-44,20,-13,2,6,9,[.80,.17,.16]);m.box(-44,20,13,2,6,9,[.80,.17,.16]);
    return m.upload();
  }
  const parkedDhakaModels={
    car:[0,1,2,3].map(makeParkedCar),
    cng:makeDhakaCNG(),cngAlt:makeDhakaCNG(1),
    rickshaw:makeDhakaRickshaw(),
    rescueRickshaws:[0,1,2].map(makeDhakaRickshaw)
  };
  function makeRickshawWheelFrame(phase=0){
    const m=new Mesh(),rim=[.88,.90,.82],hub=[.20,.25,.27],tire=[.07,.10,.12],r=12.8;
    for(const side of [-1,1]){
      const z=side*1.8;
      m.sphere(0,0,z,2.1,hub,3,6);
      for(let k=0;k<6;k++){
        const a=phase+TAU*k/6;
        citizenLimb(m,[0,0,z],[Math.cos(a)*(r-1.3),Math.sin(a)*(r-1.3),z],1.12,rim);
      }
    }
    for(let k=0;k<18;k++){
      const a=TAU*k/18,b=TAU*(k+1)/18;
      m.quad([Math.cos(a)*(r-1.0),Math.sin(a)*(r-1.0),-1.8],[Math.cos(b)*(r-1.0),Math.sin(b)*(r-1.0),-1.8],[Math.cos(b)*r,Math.sin(b)*r,1.8],[Math.cos(a)*r,Math.sin(a)*r,1.8],tire);
    }
    return m.upload();
  }
  const rickshawWheelFrames=Array.from({length:12},(_,i)=>makeRickshawWheelFrame(i*TAU/12));
  // Two small visual storytelling props: a cat awaiting rescue above a flooded
  // tea stall, and a student holding a laptop above the water.
  const dhakaCat=new Mesh(),dhakaLaptop=new Mesh();
  dhakaCat.box(-5,9,0,15,12,9,[.71,.48,.26]);
  dhakaCat.sphere(6,13,0,6.7,[.78,.54,.29],4,9);
  dhakaCat.tri([4,20,-4],[7,26,-3],[10,20,-3],[.68,.43,.26]);
  dhakaCat.tri([4,20,4],[7,26,3],[10,20,3],[.68,.43,.26]);
  dhakaCat.sphere(12,15,-2,1.0,[.11,.17,.14],3,5);
  dhakaCat.sphere(12,15,2,1.0,[.11,.17,.14],3,5);
  citizenLimb(dhakaCat,[-13,13,1],[-20,24,2],2.0,[.70,.47,.27]);
  dhakaCat.upload();
  dhakaLaptop.box(0,0,0,20,2,15,[.13,.19,.22]);
  dhakaLaptop.box(0,9,7,20,17,2,[.19,.27,.33]);
  dhakaLaptop.box(0,10,8.4,16,12,.7,[.31,.58,.67]);
  dhakaLaptop.upload();
  const dhakaVehicleType=index=>index===2||index===5?'cng':index===6?'rickshaw':'car';

  const markerMesh=new Mesh();markerMesh.ring(0,0,0,36,6,[.97,.43,.27]);markerMesh.upload();
  const debrisMesh=new Mesh();debrisMesh.box(0,1,0,56,15,33,[.35,.30,.22]);debrisMesh.box(9,8,0,10,8,29,[.48,.34,.23]);debrisMesh.upload();
  // Python's distinct water-current direction clues: repeated arrows move
  // with each zone's current, but never affect collision geometry.
  const currentArrows=new Mesh();
  for(const zone of currents){
    const forwardX=zone.dx/(Math.hypot(zone.dx,zone.dz)||1),forwardZ=zone.dz/(Math.hypot(zone.dx,zone.dz)||1);
    const acrossX=-forwardZ,acrossZ=forwardX;
    for(let xi=zone.a+65;xi<zone.b-30;xi+=94)for(let zi=zone.c+65;zi<zone.d-30;zi+=97){
      const x=xi,z=zi,y=10.25;
      currentArrows.tri([x+forwardX*17,y,z+forwardZ*17],
        [x-forwardX*12+acrossX*10,y,z-forwardZ*12+acrossZ*10],
        [x-forwardX*12-acrossX*10,y,z-forwardZ*12-acrossZ*10],[.26,.72,.75]);
    }
  }
  currentArrows.upload();
  const markerGoal=new Mesh();markerGoal.ring(0,0,0,52,6,[.97,.81,.31]);markerGoal.upload();
  const waterRipple=new Mesh();waterRipple.ring(0,0,0,18,2.4,[.66,.89,.90]);waterRipple.upload();
  // Cheap reusable translucent 3D water shards for collisions (one mesh,
  // transformed at each hit rather than allocating new WebGL buffers).
  const impactSprayMesh=new Mesh();
  for(let i=0;i<18;i++){
    const a=i*TAU/18,spread=10+(i%4)*3,side=a+.15;
    const x=Math.cos(a),z=Math.sin(a),h=10+(i%5)*3.4;
    impactSprayMesh.tri([x*spread*.30,0,z*spread*.30],
      [x*(spread+14),h,z*(spread+14)],
      [Math.cos(side)*(spread+5),.8,Math.sin(side)*(spread+5)],
      i%3===0?[.90,.98,.99]:[.66,.89,.95],3);
  }
  impactSprayMesh.upload();
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
  // A sunlit, dry campus island, with a gradual edge into flooded streets.
  // The delivery dock remains in the water at z=1080 and is never covered.
  const campusGround=new Mesh();campusGround.disk(0,17.1,1378,365,[.31,.40,.30],112);
  campusGround.data.forEach((_,i)=>{if(i%7===6)campusGround.data[i]=6;});
  campusGround.upload();
  const sunshineSun=new Mesh();sunshineSun.sphere(290,700,1525,33,[.98,.91,.65],8,13);sunshineSun.upload();
  const signalRed=new Mesh();signalRed.sphere(145,120,-68,9,[1,.15,.1],4,10);signalRed.upload();
  const signalGreen=new Mesh();signalGreen.sphere(145,120,-68,9,[.17,1,.38],4,10);signalGreen.upload();


  // Physical 3D rain inspired by drawRainAndSplashEffects(): 330 falling
  // world droplets and 108 replenishing droplets near the boat, plus impact
  // rings on the moving water. The canvas layer remains for a very subtle
  // near-camera rain mist and windshield condensation only.
  const stormDrops=Array.from({length:330},()=>({x:rnd(-1650,1650),z:rnd(-1650,1650),y:rnd(100,950)}));
  const nearDrops=Array.from({length:108},(_,i)=>({x:0,z:0,y:rnd(60,540),index:i}));
  const stormGeometry=new Mesh(),stormSplash=new Mesh();
  stormSplash.ring(0,0,0,1,0.10,[.80,.96,.97],24);
  // Its translucent material is handled by kind 5 in the fragment shader.
  stormSplash.data.forEach((_,i)=>{if(i%7===6)stormSplash.data[i]=5;});
  stormSplash.upload();
  stormGeometry.buffer=gl.createBuffer();
  function campusRainWeight(x,z){const d=distance(x,z,0,1378);return clamp((d-350)/230,0,1);}
  function updateWorldRain(dt){
    for(const [index,d] of stormDrops.entries()){
      d.y-=540*dt;
      if(d.y<=10){
        if(campusRainWeight(d.x,d.z)>.5&&S.rainSplashes.length<75&&Math.random()<.29)
          S.rainSplashes.push({x:d.x,z:d.z,age:0});
        d.x=rnd(-1650,1650);d.z=rnd(-1650,1650);d.y=rnd(560,980);
      }
    }
    for(const d of nearDrops){
      d.y-=540*dt;
      if(d.y<=10){
        if(campusRainWeight(d.x,d.z)>.3&&S.rainSplashes.length<75&&Math.random()<.20)
          S.rainSplashes.push({x:d.x,z:d.z,age:0});
        d.y+=480+rnd(0,250);
      }
      d.x=S.x+((d.index*151)%930)-465;
      d.z=S.z+((d.index*269+37)%1050)-525;
    }
    for(const e of S.rainSplashes)e.age+=dt;
    S.rainSplashes=S.rainSplashes.filter(e=>e.age<.55);
  }
  function uploadStormRain(){
    // Each streak is a hair-thin 3D ribbon, angled by the prevailing wind.
    const data=[];
    function v(x,y,z,color){data.push(x,y,z,...color,3);}
    for(const [i,d] of [...stormDrops,...nearDrops].entries()){
      const wet=campusRainWeight(d.x,d.z);
      if(wet<.10||i>=330&&i%3===0&&wet<.90)continue;
      const bright=(.57+.06*(i%4))*wet;
      const color=[bright*.76,bright*.91,bright];
      const length=17+(i%5)*4;
      // two thin triangles produce a readable line from multiple viewpoints
      const x=d.x,y=d.y,z=d.z;
      v(x,y,z,color);v(x+2.6,y-length,z-1.2,color);v(x+1.45,y-length*.38,z+.34,color);
    }
    const arr=new Float32Array(data);stormGeometry.length=arr.length/7;
    gl.bindBuffer(gl.ARRAY_BUFFER,stormGeometry.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
  }
  // Translucent world-space halos are only drawn when their district has power.
  const streetlights=[];
  const VROADS=[-1100,-550,0,550,1100],HROADS=[-1150,-600,-50,500,1050];
  const vz=[-1650,...HROADS,1650],vx=[-1650,...VROADS,1650];
  for(const x of VROADS)for(let i=0;i<vz.length-1;i++)streetlights.push([x+(x<=0?133:-133),(vz[i]+vz[i+1])/2]);
  for(const z of HROADS)for(let i=0;i<vx.length-1;i++)streetlights.push([(vx[i]+vx[i+1])/2,z+(z>=0?-133:133)]);
  const litHalo=new Mesh();litHalo.sphere(0,0,0,24,[1,.80,.48],7,12);
  litHalo.data.forEach((_,i)=>{if(i%7===6)litHalo.data[i]=4;});litHalo.upload();
  const lampReflection=new Mesh();lampReflection.ring(0,0,0,19,7,[.91,.71,.38],24);
  lampReflection.data.forEach((_,i)=>{if(i%7===6)lampReflection.data[i]=4;});lampReflection.upload();
  // Redesigned roadside lighting: narrow metal poles, curved support arms,
  // shaded luminaire, bright diffuser and a deliberate light pool (not orbs).
  // These replace the original baked lamp geometry so models do not overlap.
  const cityLampPole=new Mesh(),cityLampOn=new Mesh(),cityLampOff=new Mesh();
  const lampSteel=[.18,.25,.28],lampTrim=[.09,.13,.16];
  cityLampPole.cylinder(0,60,0,3.1,116,lampSteel,9);
  cityLampPole.cylinder(0,8,0,6.3,13,[.20,.27,.30],9);
  cityLampPole.box(0,13,0,15,3,15,[.24,.28,.29]);
  cityLampPole.cylinder(0,117,0,5.4,5,lampTrim,8);
  citizenLimb(cityLampPole,[0,114,0],[0,124,-14],3.5,lampSteel);
  citizenLimb(cityLampPole,[0,124,-14],[0,123,-32],3.2,lampSteel);
  cityLampPole.box(0,119,-33,39,8,23,lampTrim);
  cityLampPole.box(0,124,-33,41,2.5,24,[.26,.31,.33]);
  cityLampPole.box(0,117,-33,37,2,20,[.38,.43,.43]);
  cityLampPole.box(0,116,-33,41,1.5,22,[.14,.19,.20]);
  cityLampPole.upload();
  cityLampOn.box(0,114.7,-33,30,2.8,16,[1.0,.89,.66]);
  cityLampOn.sphere(0,113.6,-33,4.3,[1,.95,.79],4,7);
  cityLampOn.upload();
  cityLampOff.box(0,114.7,-33,30,2.8,16,[.30,.34,.35]);
  cityLampOff.upload();
  // A smaller lamp glow looks natural under the actual fixture.
  const lampGroundGlow=new Mesh();
  lampGroundGlow.disk(0,0,0,68,[.98,.79,.47],28);
  lampGroundGlow.data.forEach((_,i)=>{if(i%7===6)lampGroundGlow.data[i]=4;});
  lampGroundGlow.upload();
  const lampAirGlow=new Mesh();
  lampAirGlow.sphere(0,0,0,22,[1,.88,.60],6,10);
  lampAirGlow.data.forEach((_,i)=>{if(i%7===6)lampAirGlow.data[i]=4;});
  lampAirGlow.upload();
  function drawStreetLamps(viewX,viewZ){
    for(const [x,z] of streetlights){
      if(distance(viewX,viewZ,x,z)>1100)continue;
      render(cityLampPole,model(x,0,z));
      const on=!lightOffAt(x,z)&&distance(x,z,0,1378)>=378;
      render(on?cityLampOn:cityLampOff,model(x,0,z));
    }
  }

  // A real traffic-signal housing with three recessed lenses and visors,
  // instead of the exported oversized glowing red/green sphere.
  const modernTrafficBody=new Mesh(),modernTrafficRed=new Mesh(),modernTrafficGreen=new Mesh();
  modernTrafficBody.cylinder(145,66,-55,4.3,132,[.19,.23,.25],10);
  modernTrafficBody.cylinder(145,9,-55,7.0,16,[.25,.31,.33],10);
  modernTrafficBody.box(145,132,-55,25,78,23,[.075,.11,.13]);
  modernTrafficBody.box(145,172,-55,29,4,27,[.24,.29,.30]);
  for(const y of [156,134,112]){
    for(const side of [-1,1]){
      modernTrafficBody.cylinder(145,y,-55+side*12,9,2.5,[.015,.025,.034],16);
      modernTrafficBody.box(145,y+10,-55+side*12,22,3,10,[.04,.06,.08]);
    }
  }
  for(const side of [-1,1]){
    modernTrafficBody.sphere(145,156,-55+side*14,6,[.32,.09,.075],5,11);
    modernTrafficBody.sphere(145,134,-55+side*14,6,[.32,.23,.10],5,11);
    modernTrafficBody.sphere(145,112,-55+side*14,6,[.08,.29,.14],5,11);
    modernTrafficRed.sphere(145,156,-55+side*15.3,6.6,[1,.17,.12],6,12);
    modernTrafficGreen.sphere(145,112,-55+side*15.3,6.6,[.12,.98,.35],6,12);
  }
  modernTrafficBody.upload();modernTrafficRed.upload();modernTrafficGreen.upload();
  function drawModernTrafficSignal(){
    render(modernTrafficBody);
    render(S.traffic==='RED'?modernTrafficRed:modernTrafficGreen);
  }
  function districtForX(x){return Math.abs(x)<=500?0:x< -500?1:2;}
  function lightOffAt(x,z=0){
    const district=districtForX(x);
    if(S.powerOff&&S.powerIndex===district)return true;
    // Every repaired district comes back online in a visible street-by-street
    // cascade, rather than switching every streetlamp on in the same frame.
    const age=S.time-powerVisual.repairedAt;
    if(powerVisual.repairedIndex===district&&age>=0&&age<3.6){
      const p=power[district];
      const delay=Math.min(2.9,distance(x,z,p.x,p.z)/530);
      return age<delay;
    }
    return false;
  }

  // The desktop edition only gives frustrated motorists to two broken cars.
  // Capture its waving arm shape in 24 time-varying frames.
  const driverFrames=Array.from({length:24},(_,frame)=>{
    const m=new Mesh(),wave=Math.sin(frame/24*TAU);
    m.box(0,10,0,13,22,10,[.91,.66,.19]);
    m.box(0,26,0,12,6,11,[.18,.26,.31]);
    m.sphere(0,36,0,7,[.65,.47,.31],5,9);
    const a=(15+27*wave)*RAD;
    const x=6+Math.sin(a)*12,y=24+Math.cos(a)*12;
    // Arm and hand move with the source's 3-Hz frustration animation.
    m.box(x, y,0,4,24,4,[.9,.65,.42]);m.sphere(6+Math.sin(a)*24,24+Math.cos(a)*24,0,3.5,[.9,.65,.42],4,7);
    return m.upload();
  });
  // More detailed source-exported vehicle geometry is used for moving cars.
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
  const cityFacadeDetails=new Mesh(),cityFacadeLights=new Mesh(),storeCanopies=new Mesh();
  for(const b of buildings){
    const faceZ=b.z-b.hd-2.8,accent=[[.77,.43,.27],[.26,.56,.76],[.41,.63,.36],[.80,.60,.22]][b.idx%4],metal=[.22,.28,.30];
    cityFacadeDetails.box(b.x,14,faceZ,30,24,3,[.18,.22,.25]);
    if(b.idx%2===0){
      cityFacadeDetails.box(b.x,33,faceZ-7,74,4,12,accent);
      for(let k=-1;k<=1;k++)cityFacadeDetails.box(b.x+k*23,31.5,faceZ-1.8,10,2,2,[.95,.89,.71]);
    }
    if(b.idx%3===0){
      for(const y of [66,104]){
        cityFacadeDetails.box(b.x,y,faceZ-7,70,3.2,12,metal);
        cityFacadeDetails.box(b.x,y-8,faceZ-10,63,14,2,[.18,.23,.25]);
        for(let k=-2;k<=2;k++)cityFacadeDetails.box(b.x+k*13.5,y-8,faceZ-10.9,1.5,14,1.2,[.70,.72,.76]);
      }
    }
    if(b.idx%4===1){
      cityFacadeDetails.cylinder(b.x+b.hw*.28,b.h+14,b.z-b.hd*.16,10,22,[.18,.23,.28],8);
      cityFacadeDetails.box(b.x+b.hw*.28,b.h+31,b.z-b.hd*.16,24,3,24,[.30,.36,.39]);
    }
    const litOn=b.idx%2===0||b.idx%5===0;
    if(litOn){
      for(let k=-1;k<=1;k++)cityFacadeLights.box(b.x+k*24,57,faceZ-.7,12,18,1.2,[.96,.80,.52]);
      if(b.idx%3===0)for(let k=-2;k<=2;k++)cityFacadeLights.box(b.x+k*13.5,95,faceZ-.7,8,12,1.1,[.99,.86,.62]);
    }
  }
  for(const [x,z,,] of originalShops){
    storeCanopies.box(x,63,z-55.5,114,5,18,[.17,.53,.70]);
    storeCanopies.box(x,58,z-61.5,110,6,2,[.93,.78,.31]);
    for(let k=-4;k<=4;k++)storeCanopies.box(x+k*11,53,z-61.4,7,9,1.2,k%2?[.96,.58,.21]:[.98,.89,.64]);
  }
  cityFacadeDetails.upload();cityFacadeLights.upload();storeCanopies.upload();
  // Detailed, source-independent flood-damaged electrical cabinets. The legacy
  // baked powerboxes mesh is intentionally not drawn, to avoid overlapping models.
  // Every part is generated once; only light state and tiny spark meshes animate.
  const POWER_FRONT=-24.25;
  const powerPalette={steel:[.29,.36,.39],edge:[.12,.17,.20],plate:[.46,.53,.53],
    wet:[.16,.22,.25],rust:[.48,.27,.18],warning:[1,.78,.24],bolt:[.12,.11,.08],
    dark:[.065,.12,.16],silver:[.68,.72,.68],screen:[.09,.19,.22]};
  function powerPipe(mesh,start,end,r,color,segments=7){
    const dx=end[0]-start[0],dy=end[1]-start[1],dz=end[2]-start[2],length=Math.hypot(dx,dy,dz)||1;
    const along=[dx/length,dy/length,dz/length];
    const basis=Math.abs(along[1])<.9?[0,1,0]:[1,0,0];
    const right=norm(cross(along,basis)),side=cross(along,right);
    const point=(at,theta)=>{
      const c=Math.cos(theta)*r,s=Math.sin(theta)*r;
      return [at[0]+right[0]*c+side[0]*s,at[1]+right[1]*c+side[1]*s,at[2]+right[2]*c+side[2]*s];
    };
    for(let j=0;j<segments;j++){
      const a=j*TAU/segments,b=(j+1)*TAU/segments;
      mesh.quad(point(start,a),point(start,b),point(end,b),point(end,a),color);
    }
  }
  function powerText(mesh,value,cx,top,z,step,color){
    const width=value.length*6*step,x0=cx-width*.5;
    for(let i=0;i<value.length;i++){
      const glyph=signGlyphs[value[i]];
      if(!glyph)continue;
      for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1'){
        const x=x0+(i*6+col)*step,y=top-row*step;
        mesh.quad([x,y-step*.86,z],[x+step*.86,y-step*.86,z],
                  [x+step*.86,y,z],[x,y,z],color);
      }
    }
  }
  function makePowerCabinet(name,number){
    const m=new Mesh(),P=powerPalette;
    // Raised concrete footing stays visible above the moving flood surface.
    m.box(0,11,0,69,11,60,[.40,.44,.42]);
    m.box(0,16.8,0,63,2,54,[.23,.27,.28]);
    for(const x of [-26,26])for(const z of [-22,22]){
      m.box(x,19,z,7,7,7,P.edge);
      m.cylinder(x,23,z,2.3,2,P.silver,8);
    }
    m.box(0,23,0,54,12,44,P.wet);
    // Panel shell and stepped weather lip. Two separate door leaves feel real.
    m.box(0,62,0,52,78,43,P.steel);
    m.box(0,103,0,58,5,49,P.edge);
    m.box(0,106,0,62,3,53,P.plate);
    m.box(0,68,21.8,46,62,2,P.edge);
    m.box(0,62,-22.15,47,75,2,P.edge);
    m.box(-11.5,59,-23.35,22,58,1.7,[.33,.40,.43]);
    m.box(11.5,59,-23.35,22,58,1.7,[.31,.38,.40]);
    m.box(0,59,-24.55,1.6,57,1.2,P.dark);
    // Shoulder / headline label, district-specific identification and station id.
    m.box(0,94,-23.35,46,14,2,P.dark);
    powerText(m,name+' GRID',0,98.4,-24.62,name==='CENTRAL'?1.00:1.20,[.90,.95,.90]);
    m.box(-18,30,-24.9,7,4,2,P.warning);
    powerText(m,''+(number+1),-18,31.2,-26.02,.43,P.bolt);
    // Two warning-banded metal edges: bright even in the flooded night.
    for(let i=0;i<5;i++){
      const y=37+i*9;
      m.box(-25,y,-24.6,3.4,4.2,1.2,i%2?P.warning:P.edge);
      m.box(25,y,-24.6,3.4,4.2,1.2,i%2?P.warning:P.edge);
    }
    // Hazard symbol: yellow plate, dark lightning bolt and readable danger tag.
    m.tri([-13,73,-25.0],[13,73,-25.0],[0,91,-25.0],P.warning);
    m.tri([-8,74.2,-25.08],[8,74.2,-25.08],[0,87,-25.08],P.bolt);
    m.tri([-1,85.7,-25.17],[4,85.7,-25.17],[-3,78,-25.17],P.warning);
    m.tri([-3,78,-25.18],[2.3,79.4,-25.18],[-2,75,-25.18],P.warning);
    m.box(0,66,-25.15,22,8,1.2,[.76,.36,.22]);
    powerText(m,'DANGER',0,68.5,-25.87,.52,[1,.92,.70]);
    // Mechanical door furniture, hinges, latch and rust streaks.
    m.box(17.8,51,-25.0,3.6,14,3.6,P.edge);
    m.box(17.8,51,-27.1,2.2,11,1.2,P.silver);
    m.box(17.8,50.7,-27.9,5.5,2,1.3,P.silver);
    for(const y of [40,77])for(const x of [-22,22]){
      m.box(x,y,-24.4,3,5,2,P.edge);
      m.cylinder(x,y,-25.6,1.2,1,P.silver,6);
    }
    for(let i=0;i<8;i++)m.box(12,35+i*1.85,-24.45,12,.7,.8,P.dark);
    for(let i=0;i<4;i++)m.box(-15+i*9,31,-24.3,4,1,1,P.rust);
    m.box(-16,57,-24.42,6,17,.85,[.35,.28,.22]);
    m.box(20,66,-24.45,3,23,.85,[.33,.24,.19]);
    // Instrument bank: a recessed diagnostic screen + indicator aperture.
    m.box(-12.5,47,-25.0,14,12,1.6,P.dark);
    m.box(-12.5,47,-25.85,11,8,.6,P.screen);
    for(let i=0;i<3;i++)m.box(-16.5+i*3.6,44.4+i*.55,-26.25,2.4,1.05,.35,[.36,.67,.59]);
    m.cylinder(15.0,85.4,-25.2,3.8,1.0,P.edge,12);
    m.cylinder(15.0,85.4,-26.0,2.6,1.0,P.silver,12);
    // Weathered conduits follow an elbow from roof to protected side wall.
    for(const [i,z] of [[0,7],[1,17]]){
      const color=i?[.12,.18,.19]:[.38,.42,.40];
      const segments=[[20-i*3,108,z],[20-i*3,118,z],[31-i*3,118,z],
        [34-i*2,113,z],[34-i*2,71,z]];
      for(let k=0;k<segments.length-1;k++)powerPipe(m,segments[k],segments[k+1],2.0-i*.35,color);
      m.box(34-i*2,68,z,8,6,6,P.edge);
    }
    // Cable harness at the near side, strapped down rather than floating.
    for(const y of [39,53,67])m.box(27.0,y,7,4,3,17,P.edge);
    powerPipe(m,[28,95,-4],[32,69,-8],1.25,[.15,.19,.18]);
    powerPipe(m,[32,69,-8],[31,41,-9],1.25,[.15,.19,.18]);
    // Back vents and rain protection ribs.
    for(let i=0;i<10;i++)m.box(-10+i*2.2,57,23.1,1.0,18,1.0,P.dark);
    for(const x of [-16,16])m.box(x,98,0,3,4,46,[.18,.25,.28]);
    return m.upload();
  }
  const powerCabinets=power.map((p,i)=>makePowerCabinet(p.name,i));
  // Fixed shared meshes; the active district determines which color is drawn.
  function makePowerIndicator(color){
    const m=new Mesh();m.sphere(15.0,85.4,-27.3,2.6,color,6,12);
    m.box(-12.5,47,-26.24,9,5,.5,color.map(c=>c*.32));
    return m.upload();
  }
  const powerLedRed=makePowerIndicator([1,.20,.13]);
  const powerLedGreen=makePowerIndicator([.12,1,.43]);
  const powerStateRed=new Mesh(),powerStateGreen=new Mesh();
  powerText(powerStateRed,'OFFLINE',0,41,-25.0,.56,[1,.39,.25]);
  powerText(powerStateGreen,'ONLINE',0,41,-25.0,.56,[.45,1,.59]);
  powerStateRed.upload();powerStateGreen.upload();
  // Roof beacon, floodlight halo and brief electrical crackles at broken wiring.
  const powerBeaconRed=new Mesh(),powerBeaconGreen=new Mesh(),powerBeaconBase=new Mesh();
  powerBeaconBase.cylinder(0,109,0,7,5,[.11,.17,.20],12);
  powerBeaconBase.cylinder(0,112.5,0,5,2,[.67,.71,.64],12);
  powerBeaconBase.upload();
  powerBeaconRed.sphere(0,117,0,6.7,[1,.17,.12],6,12);powerBeaconRed.upload();
  powerBeaconGreen.sphere(0,117,0,6.7,[.16,1,.42],6,12);powerBeaconGreen.upload();
  function makePowerGlow(color){
    const m=new Mesh();m.sphere(0,117,0,15,color,6,12);
    m.sphere(15,85,-28,8,color,5,10);
    m.data.forEach((_,i)=>{if(i%7===6)m.data[i]=7;});
    return m.upload();
  }
  const powerGlowRed=makePowerGlow([1,.23,.16]);
  const powerGlowGreen=makePowerGlow([.21,1,.43]);
  const powerSparks=new Mesh();
  for(const [i,j] of [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5]]){
    const x=29+(i%3)*2.1,y=84+(i%2)*3;
    const tone=i%2?[.70,.95,1]:[.34,.81,1];
    powerSparks.tri([x,y,-26],[x-5+j*.6,y+9+i,-27],
      [x+2,y+2,-27.2],tone);
  }
  powerSparks.upload();
  const powerRepairPulse=new Mesh();
  powerRepairPulse.ring(0,0,0,29,4,[.32,1,.57],32);powerRepairPulse.upload();
  const powerVisual={repairedIndex:-1,repairedAt:-999};

  // OPEN STOREFRONTS: In the earlier version the metal shutter was translated
  // up by only 27 units. Its lower slats remained directly in the window, and
  // an opaque amber "light" panel hid the interior as well. Keep the shutter
  // fully rolled up above the opening, and use small fixtures for lighting.
  // Power failure now changes the shop lighting, not whether we can see inside.
  const dhakaShopFronts=[[-367,885],[178,885],[320,715]];
  const dhakaStoreLight=new Mesh(),dhakaShutter=new Mesh();
  // Narrow rolled-up corrugated shutter housing, entirely above display space.
  dhakaShutter.box(0,69,0,94,7,5,[.20,.26,.28]);
  for(let k=0;k<3;k++)dhakaShutter.box(0,64.5+k*2, -2.9,88,1.3,2,
    [.42-k*.025,.47-k*.025,.48-k*.025]);
  // Thin storefront guides, not a full-height metal door.
  for(const side of [-1,1])dhakaShutter.box(side*48,36,-1,2.3,48,3,[.30,.37,.38]);
  dhakaShutter.upload();
  for(const x of [-28,0,28]){
    dhakaStoreLight.box(x,59,-3,13,2,4,[1,.87,.58]);
    dhakaStoreLight.box(x,57.7,-3,7,1.5,4,[1,.96,.73]);
  }
  dhakaStoreLight.upload();

  // Readable shop displays behind the existing counters and shopkeepers.
  // This is decorative geometry only; it has no collision or mission effects.
  function makeVisibleShopInterior(kind){
    const m=new Mesh(),wood=[.37,.25,.18],steel=[.24,.31,.34];
    // Recessed shelves sit behind the original street-facing counter.
    for(const h of [25,36,47])m.box(0,h,8,87,2.4,10,wood);
    for(const side of [-1,1])m.box(side*43,37,8,3,38,10,steel);
    m.box(0,56,8,89,3.5,9,[.24,.30,.31]);
    const palettes=kind==='stationery'
      ? [[.88,.32,.26],[.22,.49,.78],[.90,.72,.29],[.26,.68,.52],[.70,.45,.75]]
      : kind==='food'
        ? [[.92,.52,.17],[.73,.19,.16],[.97,.76,.31],[.25,.60,.35],[.79,.38,.18]]
        : [[.36,.65,.70],[.85,.52,.26],[.41,.69,.39],[.86,.42,.46],[.93,.75,.38]];
    for(let row=0;row<3;row++)for(let col=0;col<9;col++){
      const x=-36+col*9, y=28+row*11;
      const color=palettes[(row*2+col)%palettes.length];
      if(kind==='stationery'){
        // Upright exercise books, print paper, and notebooks.
        m.box(x-2,y+2.8,2.1,3.1,8.2,3.3,color);
        m.box(x+2,y+2.3,2.6,3.3,7.1,3.0,palettes[(row+col+2)%palettes.length]);
        m.box(x,y-2.2,0.8,7.4,1.0,4,[.85,.86,.75]);
      }else if(kind==='food'){
        // Snack bags and small boxed food cartons.
        m.box(x,y+2.6,2,6.8,7.2,4.5,color);
        m.box(x,y+5.6,-.6,5.3,1.3,1.1,[.94,.86,.62]);
        m.box(x,y+.5,-.6,4.5,1.0,1.1,[.23,.29,.25]);
      }else{
        m.box(x,y+2.1,2,6,7,4.5,color);
        m.box(x,y+4.8,-.7,4,1.4,1.1,[.89,.87,.74]);
      }
    }
    return m.upload();
  }
  const dhakaShopInteriors=[
    makeVisibleShopInterior('stationery'),
    makeVisibleShopInterior('general'),
    makeVisibleShopInterior('food')
  ];
  const powerWindowPairs=buildings.map(b=>{
    const m=new Mesh();
    for(let k=0;k<3;k++){
      const x=b.x+(k-1)*b.hw*.52;
      // Sits just proud of source building face, not inside the geometry.
      m.box(x,34+k%2*32,b.z-b.hd-6,20,15,1,[.88,.70,.40]);
    }
    return {x:b.x,z:b.z,mesh:m.upload()};
  });
  function drawDhakaPowerNeighborhood(){
    for(const w of powerWindowPairs){
      if(distance(S.x,S.z,w.x,w.z)>980||lightOffAt(w.x,w.z))continue;
      render(w.mesh);
    }
    for(let i=0;i<dhakaShopFronts.length;i++){
      const [x,z]=dhakaShopFronts[i];
      if(distance(S.x,S.z,x,z)>800)continue;
      const front=model(x,0,z-55);
      render(dhakaShopInteriors[i],front);
      render(dhakaShutter,front); // Always retracted: no obstruction.
      if(!lightOffAt(x,z))render(dhakaStoreLight,front);
    }
  }

  function drawPowerCabinets(){
    for(let i=0;i<power.length;i++){
      const p=power[i],mat=model(p.x,0,p.z),d=distance(S.x,S.z,p.x,p.z);
      if(S.mode!=='MENU'&&d>1250)continue;
      const offline=S.powerOff&&S.powerIndex===i;
      const justRepaired=powerVisual.repairedIndex===i&&S.time-powerVisual.repairedAt<2.5;
      const blink=Math.sin(S.bobTime*7.1+i*1.7)>.05;
      render(powerCabinets[i],mat);
      render(powerBeaconBase,mat);
      render(offline?powerStateRed:powerStateGreen,mat);
      if(offline){
        if(blink){render(powerLedRed,mat);render(powerBeaconRed,mat);}
      }else{
        render(powerLedGreen,mat); // Steady green means the station is energized.
        if(justRepaired)render(powerBeaconGreen,mat);
      }
      // Tiny, intermittent flashes from the active fault (no permanent sparks).
      const sparkPhase=(S.bobTime+i*.7)%4.7;
      if(S.mode==='PLAYING'&&offline&&sparkPhase<.17&&d<720)render(powerSparks,mat);
    }
  }
  function drawPowerCabinetGlow(){
    for(let i=0;i<power.length;i++){
      const p=power[i],d=distance(S.x,S.z,p.x,p.z);
      if(d>750)continue;
      const offline=S.powerOff&&S.powerIndex===i;
      const age=S.time-powerVisual.repairedAt;
      const justRepaired=powerVisual.repairedIndex===i&&age>=0&&age<2.5;
      const flashing=offline&&Math.sin(S.bobTime*7.1+i*1.7)>.05;
      if(flashing)render(powerGlowRed,model(p.x,0,p.z));
      if(justRepaired){
        render(powerGlowGreen,model(p.x,0,p.z));
        const scale=.8+age*.8;
        render(powerRepairPulse,model(p.x,10,p.z,0,scale));
      }
    }
  }
  const S={cityPeople:CITY_PEOPLE.map((p,i)=>({...p,uid:i})),cityPersonId:CITY_PEOPLE.length,aiBoats:createRescueFleet(),aiRespawnQueue:[],aiRescueCount:0,waveStrength:0,waveSplashClock:0,waveSplashes:[],impactSplashes:[],strokeTime:0,rowing:false,mode:'MENU',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,strokeTime:0,rowing:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,wiperActive:false,wiperAngle:18,wiperDirection:1,screenDrops:[],screenSpawn:0,debris:[],debrisCooldown:0,gameOverReason:'',current:'',movingCars:[],bobTime:0,missedEffects:[],deliveryEffects:[],pickupEffects:[],rainSplashes:[],carProgress:[65,190],carStopped:[false,false],deliveryBanner:null,quality:'HIGH',frameProfile:false,frameMS:0,frameWorst:0,campusQueue:[],campusGateScene:null,campusDropCursor:0,campusEntryCounter:0,gateRewardGroups:[],gateGroupCounter:0,rewardUntil:0,gatePausedTime:0};

  // Each named student owns one voice identity from request -> boarding -> boat -> campus gate.
  // Never put "chat_*" in random chatter: chat clips are only used as fully
  // paired, sequential exchanges with their actual partner aboard.
  const PASSENGER_VOICE_CAST=Object.freeze({
    Adittya:Object.freeze({
      waiting:['student_adittya_01','student_adittya_03'],
      boarding:['student_adittya_solo_02','student_adittya_03'],
      onboard:['student_adittya_solo_01','student_adittya_solo_02','student_adittya_01','student_adittya_03'],
      chatterWeight:1
    }),
    Usaeed:Object.freeze({
      waiting:['student_usaeed_solo_01','student_usaeed_solo_02'],
      boarding:['student_usaeed_solo_01'],
      onboard:['student_usaeed_solo_02','student_usaeed_solo_01'],
      chatterWeight:.95
    }),
    Nafisa:Object.freeze({
      waiting:['student_nafisa_01'],boarding:['student_nafisa_02'],
      onboard:['student_nafisa_01','student_nafisa_02'],
      chatterWeight:.32
    }),
    Sujail:Object.freeze({
      waiting:[],boarding:['student_sujail_solo_01'],
      onboard:['student_sujail_solo_02','student_sujail_solo_01'],
      chatterWeight:.78
    }),
    Kazmi:Object.freeze({
      waiting:[],boarding:['student_kazmi_solo_01'],
      onboard:['student_kazmi_solo_02','student_kazmi_solo_01'],
      chatterWeight:1
    }),
    Safin:Object.freeze({
      waiting:['student_safin_solo_02'],boarding:['student_safin_solo_01'],
      onboard:['student_safin_solo_02','student_safin_solo_01'],
      chatterWeight:.9
    }),
    Shamim:Object.freeze({waiting:['civilian_shamim_01'],boarding:['civilian_shamim_03'],
      onboard:[],urgent:['civilian_shamim_02'],chatterWeight:.9}),
    Mitu:Object.freeze({waiting:['civilian_mitu_01'],boarding:['civilian_mitu_03'],
      onboard:[],urgent:['civilian_mitu_02'],chatterWeight:.9})
  });
  // Questions have a corresponding recorded answer. These clips must be kept
  // together, played in order, and used only when both people are ONBOARD.
  const PASSENGER_CONVERSATIONS=Object.freeze([
    {id:'connect',speakers:['Adittya','Nafisa'],clips:['student_adittya_chat_01','student_nafisa_chat_01']},
    {id:'assignment',speakers:['Adittya','Nafisa'],clips:['student_adittya_chat_02','student_nafisa_chat_02']},
    {id:'deadline',speakers:['Usaeed','Sujail'],clips:['student_usaeed_chat_01','student_sujail_chat_01']},
    {id:'wake-up',speakers:['Sujail','Kazmi'],clips:['student_sujail_chat_02','student_kazmi_chat_01']},
    {id:'travel-math',speakers:['Usaeed','Safin'],clips:['student_usaeed_chat_02','student_safin_chat_01']},
    {id:'quiz-math',speakers:['Kazmi','Safin'],clips:['student_kazmi_chat_02','student_safin_chat_02']}
  ]);
  const passengerCast=name=>Object.prototype.hasOwnProperty.call(PASSENGER_VOICE_CAST,name)?name:null;
  function passengerDialogueCandidates(person,event){
    const profile=PASSENGER_VOICE_CAST[person?.voiceCharacter];
    if(!profile)return [];
    if(event==='waiting')return person.timeLeft<22&&profile.urgent?
      [...profile.urgent,...(profile.waiting||[])]:[...(profile.waiting||[])];
    if(event==='boarding')return [...(profile.boarding||[])];
    if(event==='onboard')return [...(profile.onboard||[])];
    return [];
  }
  function passengerClip(person,event,party=0,available=()=>true){
    if(!person)return null;
    const candidates=[...new Set(passengerDialogueCandidates(person,event))]
      .filter(clip=>!person.voicePlayed?.[clip]&&available(clip));
    // Variety without repetition: a line can only be used once for a passenger.
    return candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:null;
  }
  const markPassengerClip=(person,clip)=>{
    if(!person||!clip)return;
    if(!person.voicePlayed)person.voicePlayed={};
    person.voicePlayed[clip]=true;
    person.voiceLastSpokenAt=S.time;
  };
  // DHAKA AUDIO V2 — natural user-recorded voices, seven selected memes,
  // menu song and flashlight scare, backed by the existing nonverbal SFX.
  // All paths below exist in the supplied docs/audio/ package.
  const gameAudio=(()=>{
    const voiceText={
      rickshaw_salam_01:['SALAM','মামা, রাস্তা ছাড়েন! আমি এক্সপার্ট ড্রাইভার, বুঝছেন?'],
      rickshaw_salam_02:['SALAM','এই মামা! সামনে দেখেন না? গাড়ি চালান নাকি ঘুমান?'],
      rickshaw_salam_03:['SALAM','উঠেন মামা, উঠেন! আমার রিকশায় উঠলে কোনো টেনশন নাই!'],
      rickshaw_masud_01:['MASUD','এই মামা, সাইড দেন! মাসুদ ভাই আসতেছে! এই রাস্তায় আমারে আটকায় কে?'],
      rickshaw_masud_02:['MASUD','দোষ আমার? আমার রিকশার সামনে গাড়ি রাখছেন কেন? চোখে দেখেন না?'],
      rickshaw_masud_03:['MASUD','পুরা ঢাকা ডুইবা গেলেও মাসুদ ভাইয়ের রিকশা থামবে না!'],
      rickshaw_liton_01:['LITON','মামা, হর্ন দিয়া লাভ নাই! এই পানিতে আমার রিকশাই স্পিডবোট!'],
      rickshaw_liton_02:['LITON','আরে ভাই, একটু ঘষা লাগছে! এত নাটক করার কী আছে?'],
      rickshaw_liton_03:['LITON','উঠেন, উঠেন! লিটন থাকতে কাউরে পানিতে থাকতে হবে না!'],
      guard_rahman_01:['UNCLE RAHMAN','আইডি কার্ড ঠিক আছে। যান, তাড়াতাড়ি ক্লাসে ঢোকেন।'],
      guard_rahman_02:['UNCLE RAHMAN','এই যে! আইডি কার্ড কোথায়? আইডি ছাড়া ক্যাম্পাসে ঢোকা যাবে না!'],
      guard_rahman_03:['UNCLE RAHMAN','পুরা ঢাকা পানির নিচে থাকলেও নিয়ম তো নিয়ম! আগে আইডি আনেন!'],
      student_id_missing_01:['BRACU STUDENT','আঙ্কেল! আইডি কার্ডটা বাসায় রয়ে গেছে! আজকে একটু ঢুকতে দেন!'],
      student_id_missing_02:['BRACU STUDENT','আঙ্কেল প্লিজ! আজকে অ্যাটেনডেন্স মিস করলে শেষ!'],
      student_id_missing_03:['BRACU STUDENT','আঙ্কেল, পুরা ঢাকা ডুইবা গেছে! আর আপনি আইডি কার্ড নিয়া বসে আছেন?!'],
      student_adittya_01:['ADITTYA','রেজিস্ট্রার অফিসে তিনবার মেইল দিছি। এখনো একটা রিপ্লাই নাই!'],
      student_adittya_02:['ADITTYA','তোর সিজিপিএ কত? থাক ভাই, আমারটা জিজ্ঞেস করিস না!'],
      student_adittya_03:['ADITTYA','পুরা ঢাকা ডুইবা গেছে, আর আমাদের কালকে সকাল আটটায় কুইজ!'],
      student_nafisa_01:['NAFISA','আজকে প্রেজেন্টেশন! পুরা রাস্তা পানির নিচে, কিন্তু ক্লাস ক্যানসেল না!'],
      student_nafisa_02:['NAFISA','আর একটা সেমিস্টার বাকি! তার আগেই ঢাকা পুরা নদী হয়ে গেছে!'],
      student_nafisa_03:['NAFISA','তোর আইডি কার্ড ব্যাগে আছে তো? আঙ্কেল গেটে আটকাবে কিন্তু!'],
      civilian_shamim_01:['SHAMIM','এই যে ভাই! এদিকে! আমি পানিতে আটকা পড়ছি!'],
      civilian_shamim_02:['SHAMIM','তাড়াতাড়ি করেন! স্রোত অনেক বেশি! আমি আর ধরে রাখতে পারতেছি না!'],
      civilian_shamim_03:['SHAMIM','ভাই, আপনি না আসলে আজকে কী যে হইতো! অনেক ধন্যবাদ!'],
      civilian_mitu_01:['MITU','নৌকাটা এদিকে আনেন! রাস্তা খুঁজতে আইসা দেখি নদী!'],
      civilian_mitu_02:['MITU','স্রোত আমারে টানতেছে! ঢাকার রাস্তা চলে না, কিন্তু পানির স্পিড দেখছেন?!'],
      civilian_mitu_03:['MITU','অবশেষে বাঁচলাম! এখন নৌকার জন্যও অপেক্ষা করতে হয়! ধন্যবাদ ভাই!'],
      cng_jashim_01:['JASHIM','মামা, সিএনজি লাগবে? এই পানিতে ভাড়া একটু বেশি!'],
      cng_jashim_02:['JASHIM','এই রিকশাওয়ালা মামা! পুরা রাস্তা আপনার বাপের নাকি?'],
      cng_jashim_03:['JASHIM','সিএনজি আর চলে না! এখন আমাকেই নৌকা ভাড়া করতে হবে!'],
      shopkeeper_kuddus_01:['KUDDUS CHACHA','চা খাবেন? দোকান ডুইবা গেছে, কিন্তু কেটলি এখনো গরম!'],
      shopkeeper_kuddus_02:['KUDDUS CHACHA','রাস্তা নদী হইয়া গেছে, কিন্তু বাকির খাতা শুকনা আছে!'],
      shopkeeper_kuddus_03:['KUDDUS CHACHA','ওই রিকশাওয়ালা! আমার দোকানের সামনে রেস লাগাইছেন কেন?'],
      // Transcripts for all 46 additional user-recorded student lines.
      student_adittya_solo_01:["ADITTYA","ল্যাপটপটা ঠিকঠাক আছে তো? এই পানিতে নষ্ট হইলে আমার পুরা সেমিস্টার শেষ!"],
      student_adittya_solo_02:["ADITTYA","আজকে রিকশার বদলে নৌকা! কালকে কি ক্যাম্পাসে যাইতে সাবমেরিন লাগবে?"],
      student_adittya_chat_01:["ADITTYA","তোর আজকে কোন সেকশনে ক্লাস? কানেক্টে রুটিন দেখলাম, কিন্তু নৌকা কোন রুটে যাবে সেটা তো লেখা নাই!"],
      student_adittya_chat_02:["ADITTYA","তুই অ্যাসাইনমেন্ট সাবমিট করছিস তো? এই বন্যার মধ্যেও ডেডলাইন কিন্তু ঠিকই আছে!"],
      student_adittya_id_01:["ADITTYA","আঙ্কেল, এক মিনিট... আইডি কার্ডটা তো ব্যাগে নাই! বাসায় রেখে আসছি!"],
      student_adittya_id_02:["ADITTYA","আঙ্কেল, ফোনে আমার আইডি কার্ডের ছবি আছে! একবার দেখেন না, প্লিজ! আজকের ক্লাসটা মিস হয়ে যাবে!"],
      student_adittya_id_03:["ADITTYA","আঙ্কেল, পুরা ঢাকা ডুইবা গেছে! আমি নৌকায় কইরা আসছি! আর একটা কার্ডের জন্য ক্লাসে ঢুকতে পারব না? এটা কেমন কথা!"],
      student_adittya_gate_pass:["ADITTYA","থ্যাংক ইউ, আঙ্কেল! এত পানি পার হয়ে আইডিটা শেষ পর্যন্ত কাজে লাগল!"],
      student_nafisa_chat_01:["NAFISA","সেকশন থ্রি। আর নৌকার রুট মাঝি ভাই জানে!"],
      student_nafisa_chat_02:["NAFISA","হ্যাঁ, কাল রাতেই সাবমিট করছি। বন্যাও ডেডলাইন থামাইতে পারল না!"],
      student_nafisa_id_01:["NAFISA","আঙ্কেল, আইডি কার্ডটা নাই! মনে হয় নৌকায় ওঠার সময় পানিতে পড়ে গেছে!"],
      student_nafisa_id_02:["NAFISA","আঙ্কেল, ফোনে আইডির ছবি আছে! আসল আইডিটা হয়তো এখন মাছের কাছে!"],
      student_nafisa_id_03:["NAFISA","আঙ্কেল, পুরা ঢাকা ডুবছে, আমার আইডিও ডুবছে! আমি তো ঠিকই হাজির! এখনো ঢুকতে দিবেন না?"],
      student_nafisa_gate_pass:["NAFISA","থ্যাংক ইউ, আঙ্কেল! এবার ক্লাসে যাই!"],
      student_usaeed_id_01:["USAEED","আঙ্কেল, চার্জার, পাওয়ার ব্যাংক, ল্যাপটপ—সব চেক করছি! আইডি কার্ডটাই চেকলিস্টে লিখতে ভুলে গেছি!"],
      student_usaeed_id_02:["USAEED","আঙ্কেল, কানেক্টে আমার স্টুডেন্ট প্রোফাইল আছে! ওখানে দেখে একবার ঢুকতে দেন না?"],
      student_usaeed_id_03:["USAEED","পুরা ঢাকা নদী হইয়া গেছে! এত প্ল্যান করলাম, আর শেষমেশ একটা কার্ডের জন্য সব শেষ?!"],
      student_usaeed_solo_01:["USAEED","ল্যাপটপ আছে, অ্যাসাইনমেন্ট আছে, রুটিনও চেক করছি। এখন শুধু নৌকাটা টাইমমতো পৌঁছালেই হয়!"],
      student_usaeed_solo_02:["USAEED","কানেক্টে ক্লাসের রুম নম্বর আছে, কিন্তু এই বন্যায় কোন রাস্তা দিয়ে ক্যাম্পাসে ঢুকব?"],
      student_usaeed_chat_01:["USAEED","সুজাইল, অ্যাসাইনমেন্টটা সাবমিট করছিস? বন্যা হইলেও ডেডলাইন তো নড়ে নাই!"],
      student_usaeed_chat_02:["USAEED","সাফিন, তুই হিসাব করে বল তো, এই স্রোতে ক্যাম্পাসে পৌঁছাতে আর কতক্ষণ লাগবে?"],
      student_usaeed_gate_pass:["USAEED","থ্যাংক ইউ, আঙ্কেল! এইবার অন্তত আমার প্ল্যানটা ঠিকমতো কাজ করল!"],
      student_sujail_id_01:["SUJAIL","আঙ্কেল... এইটা তো মেট্রো কার্ড! ঘুমের ঘোরে আইডির বদলে এইটা নিয়া আসছি!"],
      student_sujail_id_02:["SUJAIL","আঙ্কেল প্লিজ, কালকেও তো আসছিলাম! আজকে একটু ঢুকতে দেন, কুইজ আছে!"],
      student_sujail_id_03:["SUJAIL","আঙ্কেল, বন্যার মধ্যে নৌকায় কইরা আসলাম! এখন আবার ঘুমাইতে বাসায় পাঠাবেন?"],
      student_sujail_solo_01:["SUJAIL","রাত তিনটায় অ্যাসাইনমেন্ট শেষ করছি... এখন নৌকার দোলায় আবার ঘুম আসতেছে!"],
      student_sujail_solo_02:["SUJAIL","এত ঘুম পাইতেছে যে পানির ঢেউও লোরি মনে হইতেছে!"],
      student_sujail_chat_01:["SUJAIL","করছি ভাই, রাত তিনটায়! এইজন্য এখন চোখই খুলতে পারতেছি না!"],
      student_sujail_chat_02:["SUJAIL","কাজমি, ক্লাসে পৌঁছাইলে একটু জাগায় দিস। নৌকার দোলায় ঘুমায়া গেলে শেষ!"],
      student_sujail_gate_pass:["SUJAIL","থ্যাংক ইউ, আঙ্কেল! এবার ক্লাসে ঢুকি... তার আগে এক কাপ কফি লাগবে!"],
      student_kazmi_id_01:["KAZMI","আঙ্কেল, আইডি আনিনি! ভাবছিলাম এতদিনে আমার মুখটাই আইডি কার্ড হয়ে গেছে!"],
      student_kazmi_id_02:["KAZMI","আঙ্কেল, এতবার আসছি! আপনি আমারে চিনেন না? ছবির চাইতেও আমি বেশি ক্লিয়ার!"],
      student_kazmi_id_03:["KAZMI","পুরা ঢাকা ডুইবা গেছে, তাও আমি ক্লাসে হাজির! আর আমার মুখের ভ্যালু একটা প্লাস্টিক কার্ডের চেয়েও কম?"],
      student_kazmi_solo_01:["KAZMI","পুরা শহর পানির নিচে! কিন্তু আমি বলি, আজকের দিনটা অ্যাডভেঞ্চার! ক্লাসের আগে ফ্রি বোট রাইড!"],
      student_kazmi_solo_02:["KAZMI","এত নৌকা চলতেছে! মনে হয় ব্র্যাকুর সামনে শিগগিরই বোট পার্কিং লাগবে!"],
      student_kazmi_chat_01:["KAZMI","চিন্তা করিস না, তোকে জাগামু! বন্যা পার হইছি, এখন কুইজও পার করব!"],
      student_kazmi_chat_02:["KAZMI","সাফিন, তোর হিসাব মতে আজকের কুইজে আমার পাস করার চান্স কত? আমি কিন্তু ফুল কনফিডেন্ট!"],
      student_kazmi_gate_pass:["KAZMI","দেখছেন আঙ্কেল! আমি বলছিলাম আজকে সব ঠিকই হবে! থ্যাংক ইউ!"],
      student_safin_id_01:["SAFIN","আঙ্কেল! আইডিটা পানির হাত থেকে বাঁচাইতে জিপলক ব্যাগে রাখছিলাম... ব্যাগটাই ভেসে গেছে!"],
      student_safin_id_02:["SAFIN","আঙ্কেল, আমার স্টুডেন্ট আইডি নম্বর মুখস্থ! কানেক্টে মিলায়া দেখেন, ডেটা তো ভুল বলবে না!"],
      student_safin_id_03:["SAFIN","এত হিসাব করলাম, শেষে একটা প্লাস্টিক কার্ডের কাছে হার মানলাম! আঙ্কেল, এইটা কোন লজিক?"],
      student_safin_solo_01:["SAFIN","মাঝি ভাই বামে ঘুরলে পাঁচ মিনিট বাঁচত। কিন্তু আমার মনে হয় উনি রাস্তা না, অ্যাডভেঞ্চার খুঁজতেছেন!"],
      student_safin_solo_02:["SAFIN","গুগল ম্যাপ বলতেছে দশ মিনিট। এই পানিতে গুগল নিজে নৌকা চালাইছে কখন?"],
      student_safin_chat_01:["SAFIN","হিসাব মতে বিশ মিনিট... যদি মাঝি ভাই আবার ভুল দিকে না ঘুরেন!"],
      student_safin_chat_02:["SAFIN","তোর কনফিডেন্স একশ পার্সেন্ট। কিন্তু কতটুকু পড়ছিস সেই ডেটাই নাই! পাসের চান্স কেমনে বলি?"],
      student_safin_gate_pass:["SAFIN","থ্যাংক ইউ, আঙ্কেল! অবশেষে হিসাব মিলল—আইডি আছে, এন্ট্রি আছে, এখন শুধু ক্লাসে লেট!"],
      menu_majhi_call:['SALAM','মামা! ব্র্যাকু যাবেন? ক্লাস কিন্তু বন্ধ নাই!']
    };
    const voicesByPerson={rickshaw_salam:['rickshaw_salam_01','rickshaw_salam_02','rickshaw_salam_03'],
      rickshaw_masud:['rickshaw_masud_01','rickshaw_masud_02','rickshaw_masud_03'],
      rickshaw_liton:['rickshaw_liton_01','rickshaw_liton_02','rickshaw_liton_03']};
    const ambientNames=['rain','rain_heavy','water','current','city','cng_engine','rickshaw_chain','market_crowd'];
    const legacySfx=['bell_1','bell_2','car_horn','cng_horn_1','cng_horn_2','delivery','electric','impact_1','impact_2',
      'paddle_1','paddle_2','paddle_3','pickup','power_restore','thunder','warning'];
    const memes=['meme_error','meme_heavenly_choir','meme_metal_pipe','meme_mission_passed',
      'meme_record_scratch','meme_sad_trombone','meme_vine_boom'];
    const exitNames=['exit_horror_riser','exit_flashlight_click','exit_impact'];
    const paths={};
    // These files are in the submitted ZIP. Missing requests should be visible
    // in the browser console and audio status rather than silently ignored.
    const optionalVoiceFiles=new Set();
    for(const n of Object.keys(voiceText))paths[n]=`./audio/voices/${n}.wav`;
    for(const n of [...ambientNames,...legacySfx])paths[n]=`./audio/${n}.mp3`;
    for(const n of memes)paths[n]=`./audio/meme/${n}.mp3`;
    for(const n of exitNames)paths[n]=`./audio/sfx/${n}.mp3`;
    paths.menu_music='./audio/ambience/menu_music.mp3';
    const alias={
      swimmer_help_1:'civilian_shamim_01',swimmer_help_2:'civilian_mitu_01',swimmer_help_3:'civilian_shamim_01',
      swimmer_current:'civilian_shamim_02',current_warn:'civilian_shamim_02',swimmer_rescued:'civilian_shamim_03',
      swimmer_rain:'civilian_mitu_01',passenger_help:'civilian_shamim_01',
      student_registrar_1:'student_adittya_01',student_registrar_2:'student_adittya_01',
      student_cgpa_1:'student_adittya_02',student_cgpa_2:'student_adittya_02',
      student_semester_1:'student_nafisa_02',student_semester_2:'student_nafisa_02',
      student_attendance_1:'student_nafisa_01',student_attendance_2:'student_adittya_03',
      student_assignment:'student_nafisa_01',student_rescued_1:'student_nafisa_01',
      student_rescued_2:'student_adittya_02',passenger_board:'student_nafisa_01',
      passenger_laptop:'student_nafisa_01',passenger_thanks:'student_nafisa_02',
      student_id_forgot:'student_id_missing_01',student_no_id:'student_id_missing_01',
      student_angry_2:'student_id_missing_02',student_angry_3:'student_id_missing_03',
      guard_pass:'guard_rahman_01',guard_denied:'guard_rahman_02',guard_rule:'guard_rahman_03',
      guard_id_1:'guard_rahman_01',guard_id_2:'guard_rahman_01',guard_id_3:'guard_rahman_02',guard_id_4:'guard_rahman_03',
      cng_driver:'cng_jashim_01',cng_driver_2:'cng_jashim_02',cng_driver_3:'cng_jashim_03',
      shopkeeper:'shopkeeper_kuddus_01',shop_tea_1:'shopkeeper_kuddus_01',shop_tea_2:'shopkeeper_kuddus_02',
      rickshaw_boss_1:'rickshaw_masud_01',rickshaw_boss_2:'rickshaw_salam_01',
      rickshaw_boss_3:'rickshaw_liton_01',rickshaw_boss_4:'rickshaw_masud_01',
      rickshaw_pickup:'rickshaw_salam_03',rickshaw_pickup_new:'rickshaw_masud_03',
      rickshaw_quarrel_1:'rickshaw_salam_02',rickshaw_quarrel_2:'rickshaw_masud_02',
      rickshaw_quarrel_3:'rickshaw_liton_02',rickshaw_quarrel_4:'rickshaw_masud_02',
      rickshaw_redlight:'rickshaw_masud_01',rickshaw_bell_1:'rickshaw_liton_01',
      rickshaw_sassy_1:'rickshaw_masud_01',rickshaw_sassy_2:'rickshaw_liton_01',
      rickshaw_0:'rickshaw_salam_02',rickshaw_1:'rickshaw_masud_02',
      rickshaw_2:'rickshaw_liton_02',rickshaw_3:'rickshaw_masud_02',
      power_cheer:'student_nafisa_02',neighbor_window:'student_nafisa_01',neighbor_light:'student_nafisa_02'
    };
    const buffers={},loops={},cooldowns=new Map(),quarrelsSeen=new Set();
    let ctx=null,master=null,ambient=null,effects=null,voices=null,limiter=null;
    let loading=null,ready=false,started=false,on=true,speech=true,captionsOn=true;
    let volume=.78,voiceUserVolume=1,activeVoice=null,activeVoicePriority=-1,voiceBusyUntil=0;
    let sequenceBusy=false,sequenceEpoch=0,lastConversationAt=-999,conversationCursor=0;
    let menuCalled=false,exitBusyUntil=0,lastZone='',lastAiRescues=0;
    let clock=0,peopleAt=10,bellAt=8,hornAt=9,thunderAt=25,paddleAt=0;
    let subtitle=null,ui=null,subtitleUntil=0;
    let lastCampusHeaven=false,rewardShownUntil=0,lastHtmlExit=0;
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const sayMeta=n=>voiceText[alias[n]||n];
    const speakerLine=(clip,person)=>clip?voiceText[clip]?.[1]:null;
    const status=message=>{const item=ui?.querySelector('[data-audio-status]');if(item)item.textContent=message;};
    function init(){
      // Set loading before awaiting anything: a menu pointerdown immediately
      // followed by Start Rescue must not create two AudioContexts.
      if(loading)return loading;
      loading=(async()=>{
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(!AudioContext){status('Audio unavailable');return false;}
        try{
          ctx=new AudioContext();master=ctx.createGain();ambient=ctx.createGain();effects=ctx.createGain();voices=ctx.createGain();
          limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=14;
          limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.18;
          ambient.connect(master);effects.connect(master);voices.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
          await ctx.resume();
        }catch(error){console.warn('Majhi audio unavailable:',error);status('Audio unavailable');return false;}
        status('Loading Dhaka audio…');
        const jobs=Object.entries(paths).map(async([name,path])=>{
          try{const response=await fetch(path);if(!response.ok)throw Error(response.status);
            buffers[name]=await ctx.decodeAudioData(await response.arrayBuffer());
          }catch(error){if(!optionalVoiceFiles.has(name))console.warn('Audio missing:',path,error.message);}
        });
        await Promise.all(jobs);
        ready=Object.keys(buffers).length>0;
        if(ready){for(const n of [...ambientNames,'menu_music'])startLoop(n);updateMix();}
        status(`${Object.keys(buffers).filter(n=>!optionalVoiceFiles.has(n)).length}/${Object.keys(paths).filter(n=>!optionalVoiceFiles.has(n)).length} audio clips ready`);
        return ready;
      })();
      return loading;
    }
    function startLoop(name){
      if(!ctx||!buffers[name]||loops[name])return;
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffers[name];src.loop=true;
      gain.gain.value=0;src.connect(gain);gain.connect(ambient);
      src.start();loops[name]={src,gain};
    }
    function updateMix(){
      if(!ctx||!master)return;
      const playing=S.mode==='PLAYING',menu=S.mode==='MENU',active=on&&(playing||menu);
      const nearCampus=playing?1-campusRainWeight(S.x,S.z):0;
      const voiceActive=ctx.currentTime<voiceBusyUntil;
      const nearestCng=parkedCars.filter((_,i)=>dhakaVehicleType(i)==='cng')
        .reduce((d,c)=>Math.min(d,distance(S.x,S.z,c.x,c.z)),99999);
      const nearestRick=(S.aiRickshaws||[]).reduce((d,r)=>Math.min(d,distance(S.x,S.z,r.x,r.z)),99999);
      const bazaar=Math.min(...dhakaShopFronts.map(([x,z])=>distance(S.x,S.z,x,z)));
      const levels={rain:active?(playing?.34*campusRainWeight(S.x,S.z):.16):0,
        rain_heavy:active?(playing?.09*campusRainWeight(S.x,S.z):.045):0,
        water:active?(playing?.22:.13):0,current:playing?.35*S.waveStrength:0,
        city:active?(playing?.31*campusRainWeight(S.x,S.z):.19):0,
        cng_engine:playing?.19*clamp(1-nearestCng/580,0,1):0,
        rickshaw_chain:playing?.16*clamp(1-nearestRick/350,0,1):0,
        market_crowd:playing?.14*clamp(1-bazaar/430,0,1):0,
        menu_music:menu?.36:0};
      for(const [name,level] of Object.entries(levels))if(loops[name])loops[name].gain.gain.setTargetAtTime(level,ctx.currentTime,.33);
      ambient.gain.setTargetAtTime(voiceActive?.45:.79,ctx.currentTime,.14);
      effects.gain.setTargetAtTime(voiceActive?.55:.92,ctx.currentTime,.15);
      voices.gain.setTargetAtTime(speech?Math.min(1.38,1.11*voiceUserVolume):0,ctx.currentTime,.14);
      master.gain.setTargetAtTime(on?volume:0,ctx.currentTime,.1);
    }
    function showSubtitle(name,duration){
      const meta=sayMeta(name);if(!subtitle||!captionsOn||!meta||S.campusGateScene)return;
      subtitle.querySelector('[data-voice-who]').textContent=meta[0];
      subtitle.querySelector('[data-voice-line]').textContent=meta[1];
      subtitle.classList.add('mj-voice-show');subtitleUntil=ctx.currentTime+duration+.25;
    }
    function emit(id,options={}){
      const name=alias[id]||id;if(!ctx||!on||!buffers[name]||ctx.state!=='running')return null;
      const isVoice=!!voiceText[name];if(isVoice&&!speech)return null;
      const now=ctx.currentTime,lock=name+':'+(options.key||'general');
      if(now<(cooldowns.get(lock)||0))return null;
      const x=options.x??S.x,z=options.z??S.z,dist=distance(S.x,S.z,x,z);
      const max=options.range??(isVoice?660:780);
      if(!options.ignoreDistance&&dist>max)return null;
      const close=options.ignoreDistance?1:Math.max(0,1-dist/max);
      const proximity=options.ignoreDistance?1:(isVoice ? .30+.70*Math.pow(close,.65) : Math.pow(close,1.12));
      const amount=clamp((options.volume??1)*proximity,0,1.3);
      if(amount<.02)return null;
      cooldowns.set(lock,now+(options.cooldown??.7));if(cooldowns.size>160)cooldowns.clear();
      const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffers[name];
      src.playbackRate.value=options.rate??1;
      const duration=src.buffer.duration/src.playbackRate.value;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(amount,now+.022);
      gain.gain.setValueAtTime(amount,now+Math.max(.03,duration-.09));
      gain.gain.linearRampToValueAtTime(0,now+duration);
      src.connect(gain);
      const bus=isVoice?voices:effects;
      if(ctx.createStereoPanner&&!options.ignoreDistance){
        const pan=ctx.createStereoPanner(),dir=Math.atan2(z-S.z,x-S.x)-S.angle*RAD;
        pan.pan.value=clamp(Math.sin(dir)*.65,-.72,.72);gain.connect(pan);pan.connect(bus);
      }else gain.connect(bus);
      src.start();src.stop(now+duration+.012);
      return {src,duration};
    }
    function play(name,options={}){return !!emit(name,options);}
    function voice(name,x,z,level=1,options={}){
      const actual=alias[name]||name;
      if(!voiceText[actual]||!speech||!on||!ctx||ctx.state!=='running')return false;
      if(S.campusGateScene||sequenceBusy)return false;
      const priority=options.priority??0;
      if(ctx.currentTime<voiceBusyUntil){
        if(!options.force||priority<activeVoicePriority)return false;
        try{activeVoice?.stop();}catch(_e){}
      }
      const node=emit(actual,{x,z,volume:level,ignoreDistance:options.ignoreDistance,
        key:options.key||'voice',cooldown:options.cooldown??.7,range:options.range});
      if(!node)return false;
      activeVoice=node.src;activeVoicePriority=priority;
      voiceBusyUntil=ctx.currentTime+node.duration+.08;
      showSubtitle(actual,node.duration);updateMix();return true;
    }
    // Atomic conversational audio: one spoken turn at a time, with no NPC
    // interruption, and no orphaned follow-up when a scene is cancelled.
    function talkSequence(entries,options={}){
      if(!ctx||ctx.state!=='running'||!on||!speech||sequenceBusy){return false;}
      sequenceBusy=true;
      const epoch=++sequenceEpoch;
      const playNext=(index)=>{
        if(epoch!==sequenceEpoch)return;
        if(options.cancel?.()){
          sequenceBusy=false;voiceBusyUntil=ctx.currentTime;
          return;
        }
        if(index>=entries.length){
          sequenceBusy=false;voiceBusyUntil=ctx.currentTime;
          options.done?.();return;
        }
        const entry=typeof entries[index]==='string'?{clip:entries[index]}:entries[index];
        options.turn?.(index,entry);
        const id=entry.clip;
        const next=()=>{if(epoch===sequenceEpoch)playNext(index+1);};
        if(!id||!buffers[id]){
          const duration=Math.max(.8,Math.min(5.6,entry.duration||2.6));
          const silent=ctx.createBufferSource();
          silent.buffer=ctx.createBuffer(1,Math.max(1,Math.round(duration*ctx.sampleRate)),ctx.sampleRate);
          silent.onended=next;silent.start();return;
        }
        const node=emit(id,{x:options.x??S.x,z:options.z??S.z,
          ignoreDistance:options.ignoreDistance??true,volume:1.0,key:`seq-${options.key}-${index}`,cooldown:0});
        if(!node){
          // Avoid looping forever if a file cannot play.
          const silent=ctx.createBufferSource();
          silent.buffer=ctx.createBuffer(1,Math.round(1.2*ctx.sampleRate),ctx.sampleRate);
          silent.onended=next;silent.start();return;
        }
        activeVoice=node.src;activeVoicePriority=5;voiceBusyUntil=ctx.currentTime+node.duration+.08;
        showSubtitle(id,node.duration);
        node.src.onended=next;
      };
      playNext(0);
      return true;
    }
    function cancelSequence(){
      sequenceEpoch++;sequenceBusy=false;
      try{activeVoice?.stop();}catch(_e){}
      activeVoice=null;voiceBusyUntil=ctx?.currentTime||0;
    }
    function maybeConversation(){
      if(!ready||!speech||!on||S.mode!=='PLAYING'||S.campusQueue.length||S.campusGateScene||
         sequenceBusy||ctx.currentTime<voiceBusyUntil+.3||S.time-lastConversationAt<15)return false;
      const onboard=seated();
      if(onboard.length<2)return false;
      const eligible=[];
      for(const conversation of PASSENGER_CONVERSATIONS){
        const people=conversation.speakers.map(name=>onboard.find(r=>r.voiceCharacter===name));
        if(people.some(p=>!p)||people[0]===people[1]||
           people.some(p=>S.time-(p.boardedAt??S.time)<2.5))continue;
        if(conversation.clips.some((clip,i)=>people[i].voicePlayed?.[clip]||!buffers[clip]))continue;
        eligible.push({conversation,people});
      }
      if(!eligible.length)return false;
      // Nafisa talks less, but participates naturally when Adittya addresses her.
      // Give her pairs a smaller opportunity to start, never a clipped reply.
      const chosen=eligible[conversationCursor++%eligible.length];
      if(chosen.conversation.speakers.includes('Nafisa')&&Math.random()>.48)return false;
      const ok=talkSequence(chosen.conversation.clips,{
        key:`boat-${chosen.conversation.id}-${chosen.people.map(p=>p.id).join('-')}`,
        ignoreDistance:true,
        cancel:()=>S.mode!=='PLAYING'||!!S.campusGateScene||
          chosen.people.some(p=>p.state!=='ONBOARD'),
        done:()=>{lastConversationAt=S.time;}
      });
      if(!ok)return false;
      // Both recordings are consumed together; never play the answer alone.
      chosen.conversation.clips.forEach((clip,i)=>markPassengerClip(chosen.people[i],clip));
      lastConversationAt=S.time;
      return true;
    }
    function makeGateScript(scene){
      const character=scene.voiceCharacter;
      const t=(clip,fallback)=>voiceText[clip]?.[1]||fallback;
      const studentClip=tag=>character?`student_${character.toLowerCase()}_${tag}`:null;
      const studentTurn=(tag,fallback,duration=3.5)=>{
        const clip=studentClip(tag);
        const valid=clip&&buffers[clip]&&voiceText[clip];
        return {clip:valid?clip:null,speaker:'student',
          text:valid?t(clip,fallback):fallback,duration};
      };
      if(!scene.forgotId)return [
        {clip:'guard_rahman_01',speaker:'guard',text:t('guard_rahman_01','আইডি ঠিক আছে। ক্লাসে যান!')},
        studentTurn('gate_pass','থ্যাংক ইউ আঙ্কেল! ক্লাসে যাই!',2.6)
      ];
      return [
        {clip:'guard_rahman_02',speaker:'guard',text:t('guard_rahman_02','আইডি কার্ড কোথায়?')},
        studentTurn('id_01','আঙ্কেল, আইডি কার্ডটা খুঁজে পাচ্ছি না!',3.6),
        studentTurn('id_02','আঙ্কেল, একবার ঢুকতে দেন না, প্লিজ!',4.0),
        {clip:'guard_rahman_03',speaker:'guard',text:t('guard_rahman_03','নিয়ম তো নিয়ম! আগে আইডি আনেন!')},
        studentTurn('id_03','পুরা ঢাকা পানির নিচে! তাও ঢুকতে দিবেন না?',3.8)
      ];
    }
    function startGate(scene){
      if(scene.audioStarted)return;
      scene.audioStarted=true;scene.audioComplete=false;scene.dialogueTurn=0;
      scene.dialogue=makeGateScript(scene);
      if(!on||!speech){scene.audioComplete=true;scene.finishedAt=S.time;return;}
      init().then(ok=>{
        if(!ok||S.campusGateScene!==scene||!on){scene.audioComplete=true;scene.finishedAt=S.time;return;}
        cancelSequence();
        // Rebuild now that all recorded clips have been decoded.
        scene.dialogue=makeGateScript(scene);
        if(scene.forgotId)play('meme_vine_boom',{ignoreDistance:true,volume:.67,key:`id-${scene.index}`,cooldown:0});
        const gateStarted=talkSequence(scene.dialogue,{key:`gate-${scene.index}`,ignoreDistance:true,cancel:()=>S.campusGateScene!==scene,
          turn:i=>{scene.dialogueTurn=i;},
          done:()=>{
            scene.audioComplete=true;scene.finishedAt=S.time;
            if(scene.forgotId&&S.campusGateScene===scene)play('meme_error',{ignoreDistance:true,volume:.52,key:`rejected-${scene.index}`,cooldown:0});
          }});
        if(!gateStarted){scene.audioComplete=true;scene.finishedAt=S.time;}
      });
    }
    function speakPassenger(person,event,options={}){
      if(!person)return false;
      const clip=passengerClip(person,event,options.party??seated().length,name=>!!buffers[name]);
      if(!clip)return false;
      const ok=voice(clip,options.x??S.x,options.z??S.z,options.level??1,
        {priority:options.priority??1,force:options.force??false,
         ignoreDistance:options.ignoreDistance??false,range:options.range,key:options.key});
      if(ok)markPassengerClip(person,clip);
      return ok;
    }
    function beginQuarrel(r,incident){
      const key=`${incident.id}:${incident.at}`;if(quarrelsSeen.has(key))return;
      quarrelsSeen.add(key);
      // Sometimes Masud's overconfident crash gets an abrupt record scratch.
      const crashMeme=r.id===1&&Math.random()<.5?'meme_record_scratch':'meme_metal_pipe';
      play(crashMeme,{x:r.x,z:r.z,volume:.55,cooldown:0,key});
      play('car_horn',{x:r.x,z:r.z,volume:.52,key});
      const driver=['rickshaw_salam_02','rickshaw_masud_02','rickshaw_liton_02'][r.id];
      const car=parkedCars[incident.carIndex],withCng=car&&dhakaVehicleType(incident.carIndex)==='cng';
      if(distance(S.x,S.z,r.x,r.z)>660)return;
      talkSequence(withCng?[driver,'cng_jashim_02']:[driver],
        {key:`quarrel-${key}`,x:r.x,z:r.z,ignoreDistance:false,
         cancel:()=>S.mode!=='PLAYING'||!!S.campusGateScene,
         done:()=>play('meme_sad_trombone',{x:r.x,z:r.z,volume:.52,cooldown:0,key:`trombone-${key}`})});
      if(quarrelsSeen.size>50)quarrelsSeen.clear();
    }
    function showReward(points){
      play('meme_mission_passed',{ignoreDistance:true,volume:.84,key:`mission-${S.time}`,cooldown:0});
      const id='majhi-group-reward';let el=document.getElementById(id);
      if(!el){el=document.createElement('div');el.id=id;el.style.cssText='position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:2147481000;pointer-events:none;text-align:center;opacity:0;transition:opacity .22s;color:#fce9ab;font:900 clamp(18px,4vw,46px) system-ui;text-shadow:0 3px 12px #081b20,0 5px 20px #000';document.body.appendChild(el);}
      el.innerHTML=`MISSION PASSED!<div style="font-size:.62em;color:#99e4b5">RESPECT +</div><div style="font-size:.45em;color:#faf4e6">SCORE +${Math.round(points)}</div>`;
      el.style.opacity='1';rewardShownUntil=performance.now()+3200;
      return buffers.meme_mission_passed?.duration||3.2;
    }
    function exitScare(){
      if(!on)return;
      // On the very first menu click, the full audio pack may still be loading.
      // Play the three tiny exit files directly instead of missing the scare.
      if(!ctx||!ready){
        if(performance.now()-lastHtmlExit<2900)return;
        lastHtmlExit=performance.now();exitBusyUntil=(ctx?.currentTime||0)+3.2;
        const raw=(name,amount)=>{const a=new Audio(paths[name]);a.volume=amount*volume;
          a.play().catch(()=>{});};
        raw('exit_horror_riser',.55);
        window.setTimeout(()=>raw('exit_flashlight_click',.77),450);
        window.setTimeout(()=>raw('exit_impact',.80),970);
        return;
      }
      const now=ctx.currentTime;if(now<exitBusyUntil)return;exitBusyUntil=now+3;
      play('exit_horror_riser',{ignoreDistance:true,volume:.65,cooldown:0,key:'exit-'+now});
      if(loops.menu_music)loops.menu_music.gain.gain.setTargetAtTime(0,now,.025);
      window.setTimeout(()=>play('exit_flashlight_click',{ignoreDistance:true,volume:.83,cooldown:0,key:'exit-click-'+now}),450);
      window.setTimeout(()=>play('exit_impact',{ignoreDistance:true,volume:.93,cooldown:0,key:'exit-impact-'+now}),970);
    }
    function initUI(){
      if(ui)return;
      ui=document.createElement('div');ui.id='majhi-dhaka-audio';
      ui.innerHTML=`<button data-audio-toggle type="button">🔊 DHAKA AUDIO</button>
        <button data-audio-voices type="button">🎤 VOICES ON</button>
        <label>MASTER <input data-audio-volume type="range" min="0" max="100" value="78"></label>
        <label>VOICE <input data-voice-volume type="range" min="0" max="100" value="100"></label>
        <button data-audio-caption type="button">CC ON</button><span data-audio-status>Click to enable sound</span>`;
      ui.style.cssText='position:fixed;top:7px;left:50%;transform:translateX(-50%);z-index:12500;display:flex;align-items:center;gap:6px;max-width:96vw;padding:7px 10px;border:1px solid #607e8b;border-radius:12px;background:rgba(7,25,34,.92);color:#d2e8df;font:700 10px system-ui;pointer-events:auto';
      const style=document.createElement('style');style.textContent=`#majhi-dhaka-audio button{border:1px solid #567680;border-radius:8px;background:#143443;color:#f5e7b6;padding:6px 8px;font:800 10px system-ui;cursor:pointer}#majhi-dhaka-audio label{display:flex;align-items:center;gap:5px}#majhi-dhaka-audio input{width:66px;accent-color:#e9c476}#majhi-dhaka-audio [data-audio-status]{max-width:130px;overflow:hidden;white-space:nowrap;color:#b2d9ce}#majhi-dhaka-subtitle{position:fixed;z-index:12495;bottom:8%;left:50%;transform:translateX(-50%);width:min(620px,78vw);pointer-events:none;background:rgba(5,21,29,.89);border:1px solid #e9c476;border-radius:13px;padding:8px 16px;text-align:center;font:700 15px 'Nirmala UI',system-ui,sans-serif;color:#f8f3da;opacity:0;transition:opacity .18s}#majhi-dhaka-subtitle.mj-voice-show{opacity:1}#majhi-dhaka-subtitle [data-voice-who]{font:800 10px system-ui;color:#efce79;letter-spacing:.09em;margin-bottom:4px}@media(max-width:950px){#majhi-dhaka-audio{top:auto!important;bottom:8px;padding:5px 6px;font-size:8px}#majhi-dhaka-audio button{font-size:9px;padding:5px}#majhi-dhaka-audio input{width:43px}#majhi-dhaka-audio [data-audio-status]{display:none}#majhi-dhaka-subtitle{bottom:16%;font-size:12px}}`;
      document.head.appendChild(style);document.body.appendChild(ui);
      subtitle=document.createElement('div');subtitle.id='majhi-dhaka-subtitle';subtitle.innerHTML='<div data-voice-who></div><div data-voice-line></div>';document.body.appendChild(subtitle);
      ui.querySelector('[data-audio-toggle]').onclick=()=>{on=!on;ui.querySelector('[data-audio-toggle]').textContent=on?'🔊 DHAKA AUDIO':'🔇 MUTED';if(on)ctx?.resume();else{cancelSequence();if(S.campusGateScene){S.campusGateScene.audioComplete=true;S.campusGateScene.finishedAt=S.time;}}updateMix();};
      ui.querySelector('[data-audio-voices]').onclick=()=>{speech=!speech;ui.querySelector('[data-audio-voices]').textContent=speech?'🎤 VOICES ON':'🎤 VOICES OFF';if(!speech){cancelSequence();if(S.campusGateScene){S.campusGateScene.audioComplete=true;S.campusGateScene.finishedAt=S.time;}}updateMix();};
      ui.querySelector('[data-audio-caption]').onclick=()=>{captionsOn=!captionsOn;ui.querySelector('[data-audio-caption]').textContent=captionsOn?'CC ON':'CC OFF';if(!captionsOn)subtitle.classList.remove('mj-voice-show');};
      ui.querySelector('[data-audio-volume]').oninput=e=>{volume=Number(e.target.value)/100;updateMix();};
      ui.querySelector('[data-voice-volume]').oninput=e=>{voiceUserVolume=Number(e.target.value)/100;updateMix();};
    }
    function menuBegin(){
      if(S.mode!=='MENU'||started)return;
      started=true;init().then(ok=>{
        if(!ok||S.mode!=='MENU')return;
        updateMix();
        if(!menuCalled){menuCalled=true;window.setTimeout(()=>{if(S.mode==='MENU')voice('menu_majhi_call',S.x,S.z,.82,{ignoreDistance:true,priority:2,force:true});},5200);}
      });
    }
    function begin(){started=true;initUI();init().then(()=>ctx?.resume());
      clock=0;peopleAt=8;bellAt=7;hornAt=6;thunderAt=26;paddleAt=0;
      lastZone='';lastAiRescues=0;lastCampusHeaven=false;quarrelsSeen.clear();
      cancelSequence();lastConversationAt=-999;conversationCursor=0;
      subtitle?.classList.remove('mj-voice-show');activeVoicePriority=-1;voiceBusyUntil=0;
      updateMix();}
    function update(dt){
      if(!ctx||!ready)return;
      if(S.mode==='PAUSED'&&ctx.state==='running')ctx.suspend();
      else if(S.mode!=='PAUSED'&&ctx.state==='suspended'&&started&&on)ctx.resume();
      if(subtitle&&subtitle.classList.contains('mj-voice-show')&&ctx.currentTime>=subtitleUntil)subtitle.classList.remove('mj-voice-show');
      const rewardEl=document.getElementById('majhi-group-reward');
      if(rewardEl&&performance.now()>rewardShownUntil)rewardEl.style.opacity='0';
      if(S.mode==='MENU'&&ctx.currentTime<exitBusyUntil){
        // Keep the song muted until the exit gag has finished.
        if(loops.menu_music)loops.menu_music.gain.gain.setTargetAtTime(0,ctx.currentTime,.03);
        return;
      }
      clock+=dt;if(clock<.12)return;dt=clock;clock=0;updateMix();
      if(S.mode!=='PLAYING'||!on)return;
      const heaven=campusRainWeight(S.x,S.z)<.27;
      if(heaven&&!lastCampusHeaven)play('meme_heavenly_choir',{ignoreDistance:true,volume:.45,cooldown:8});
      lastCampusHeaven=heaven;
      if(S.rowing&&S.time-paddleAt>(S.boostOn?.42:.57)){
        paddleAt=S.time;play('paddle_'+(1+Math.floor(S.time*3)%3),{ignoreDistance:true,volume:S.boostOn?.8:.6,cooldown:0});}
      if(S.current&&!lastZone){play('warning',{ignoreDistance:true,volume:.32});}
      lastZone=S.current;
      if(S.aiRescueCount>lastAiRescues){
        const r=S.aiRickshaws.find(x=>S.time-x.rescuedAt<.28&&distance(x.x,x.z,S.x,S.z)<520);
        if(r){play('bell_1',{x:r.x,z:r.z,volume:.72});voice(voicesByPerson[['rickshaw_salam','rickshaw_masud','rickshaw_liton'][r.id]][2],r.x,r.z,1,{priority:1});}
        else {const b=S.aiBoats.find(x=>S.time-x.rescuedAt<.28&&distance(x.x,x.z,S.x,S.z)<500);
          if(b)voice('civilian_shamim_03',b.x,b.z,.92,{priority:2});}
        lastAiRescues=S.aiRescueCount;
      }
      if(S.time>bellAt){const r=S.aiRickshaws.filter(x=>distance(x.x,x.z,S.x,S.z)<570)[0];
        if(r)play('bell_'+(1+r.id%2),{x:r.x,z:r.z,volume:.84});bellAt=S.time+7+Math.random()*7;}
      if(S.time>hornAt){const p=parkedCars.filter((_,i)=>dhakaVehicleType(i)==='cng').find(x=>distance(x.x,x.z,S.x,S.z)<620);
        if(p){play('cng_horn_1',{x:p.x,z:p.z,volume:.8});if(Math.random()<.3)voice(pick(['cng_jashim_01','cng_jashim_03']),p.x,p.z,.91,{priority:0});}
        hornAt=S.time+9+Math.random()*11;
      }
      for(const incident of S.rickshawQuarrels){const r=S.aiRickshaws.find(x=>x.id===incident.id);if(r)beginQuarrel(r,incident);}
      if(S.time>peopleAt&&!S.campusGateScene&&!sequenceBusy&&ctx.currentTime>voiceBusyUntil+.2){
        const conversationStarted=maybeConversation();
        if(!conversationStarted){
        const choices=[],party=seated().length;
        for(const r of S.rides){
          const x=r.personX??r.x,z=r.personZ??r.z;
          if(r.state==='WAITING'&&distance(x,z,S.x,S.z)<510){
            const clip=passengerClip(r,'waiting',party,name=>!!buffers[name]);
            const chance=PASSENGER_VOICE_CAST[r.voiceCharacter]?.chatterWeight??.9;
            if(clip&&Math.random()<chance&&S.time-(r.voiceLastSpokenAt??-999)>14)
              choices.push({x,z,clip,ride:r,priority:r.type==='DROWNING'?3:2});
          }else if(r.state==='ONBOARD'){
            const clip=passengerClip(r,'onboard',party,name=>!!buffers[name]);
            const chance=PASSENGER_VOICE_CAST[r.voiceCharacter]?.chatterWeight??.9;
            if(clip&&Math.random()<chance&&S.time-(r.voiceLastSpokenAt??-999)>14)
              choices.push({x:S.x,z:S.z,clip,ride:r,priority:2});
          }
        }
        for(const p of S.cityPeople){if(distance(p.x,p.z,S.x,S.z)>410)continue;
          const clip=p.role==='SWIM'||p.role==='WADE'?
            ((p.uid%2===0)?'civilian_shamim_01':'civilian_mitu_01'):
            p.role==='SHOP'?'shopkeeper_kuddus_01':null;
          if(clip)choices.push({x:p.x,z:p.z,clip,priority:p.role==='SWIM'?1:0});
        }
        for(const r of S.aiRickshaws){if(distance(r.x,r.z,S.x,S.z)<430&&r.incidentCar===null)
          choices.push({x:r.x,z:r.z,clip:voicesByPerson[['rickshaw_salam','rickshaw_masud','rickshaw_liton'][r.id]][0],priority:0});}
        choices.sort((a,b)=>b.priority-a.priority||distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z));
        // A passenger should usually take priority over background chatter.
        const preferred=choices.filter(c=>c.priority===choices[0]?.priority).slice(0,3);
        if(preferred.length){
          const c=preferred[Math.floor(Math.random()*preferred.length)];
          if(voice(c.clip,c.x,c.z,1,{priority:c.priority})&&c.ride)markPassengerClip(c.ride,c.clip);
        }
        }
        peopleAt=S.time+(conversationStarted?18:6+Math.random()*5);
      }
      if(S.time>thunderAt){if(campusRainWeight(S.x,S.z)>.3)play('thunder',{ignoreDistance:true,volume:.65});thunderAt=S.time+31+Math.random()*23;}
    }
    return {initUI,menuBegin,begin,update,play,voice,speakPassenger,startGate,showReward,exitScare,
      repair(){play('power_restore',{ignoreDistance:true,volume:.8});},
      impact(power){play('impact_'+(1+(Math.floor(S.time*3)%2)),{ignoreDistance:true,volume:.75*power});},
      getState(){return {started,ready,on,voices:speech,captions:captionsOn,
        loaded:Object.keys(buffers).length,expected:Object.keys(paths).length,
        masterVolume:volume,voiceVolume:voiceUserVolume,activeVoicePriority,sequenceBusy,
        conversations:PASSENGER_CONVERSATIONS.map(({id,speakers,clips})=>({id,speakers,ready:clips.every(c=>!!buffers[c])}))};}};
  })();
  // Collision impact: a strong jolt that quickly settles, in both camera modes.
  const IMPACT_SHAKE_DURATION = 0.58;
  const impactShake = {time: IMPACT_SHAKE_DURATION, power: 0, blocked: false, cooldown: 0, anchorX:0, anchorZ:0};
  const boatImpact={pitch:0,pitchV:0,roll:0,rollV:0,heave:0,heaveV:0,
    recoilX:0,recoilZ:0,cooldown:0};
  const reducedMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function triggerBoatImpact(dirX,dirZ,strength=1){
    if(boatImpact.cooldown>0)return;
    const length=Math.hypot(dirX,dirZ)||1;
    dirX/=length;dirZ/=length;
    strength=clamp(strength,.45,1.5);
    triggerImpactShake(strength);
    gameAudio.impact(strength);
    boatImpact.cooldown=.30;
    const a=S.angle*RAD,front=dirX*Math.cos(a)+dirZ*Math.sin(a);
    const side=dirX*(-Math.sin(a))+dirZ*Math.cos(a);
    const motion=reducedMotion()?.50:1;
    boatImpact.pitch=clamp(boatImpact.pitch-4.9*front*strength*motion,-15,15);
    boatImpact.pitchV-=46*front*strength*motion;
    boatImpact.roll=clamp(boatImpact.roll+4.3*(side||.25)*strength*motion,-16,16);
    boatImpact.rollV+=47*(side||.25)*strength*motion;
    boatImpact.heaveV+=23*strength*motion;
    // Short backwards shove; normal collision tests still guard every step.
    boatImpact.recoilX=clamp(boatImpact.recoilX-dirX*150*strength,-235,235);
    boatImpact.recoilZ=clamp(boatImpact.recoilZ-dirZ*150*strength,-235,235);
    impactShake.anchorX=S.x;impactShake.anchorZ=S.z;
    const nearX=S.x+dirX*55,nearZ=S.z+dirZ*55;
    S.impactSplashes.push({x:nearX,z:nearZ,age:0,power:strength});
    if(S.impactSplashes.length>12)S.impactSplashes.shift();
  }
  function updateBoatImpact(dt){
    boatImpact.cooldown=Math.max(0,boatImpact.cooldown-dt);
    // Spring-damper: a fast hit, short oscillation, then a stable hull.
    for(const [pos,velocity,k,damp] of [['pitch','pitchV',115,17],['roll','rollV',103,16],['heave','heaveV',115,19]]){
      boatImpact[velocity]+=(-k*boatImpact[pos]-damp*boatImpact[velocity])*dt;
      boatImpact[pos]+=boatImpact[velocity]*dt;
    }
    const nx=S.x+boatImpact.recoilX*dt,nz=S.z+boatImpact.recoilZ*dt;
    if(moveAllowed(nx,nz)){S.x=nx;S.z=nz;}
    else{
      // Use individual axes for sliding beside walls; never tunnel through.
      if(moveAllowed(nx,S.z))S.x=nx;else boatImpact.recoilX=0;
      if(moveAllowed(S.x,nz))S.z=nz;else boatImpact.recoilZ=0;
    }
    const decay=Math.exp(-12*dt);
    boatImpact.recoilX*=decay;boatImpact.recoilZ*=decay;
    for(const p of S.impactSplashes)p.age+=dt;
    S.impactSplashes=S.impactSplashes.filter(p=>p.age<.78);
    for(const p of S.waveSplashes)p.age+=dt;
    S.waveSplashes=S.waveSplashes.filter(p=>p.age<.75);
  }
  function triggerImpactShake(power = 1) {
    if (impactShake.cooldown > 0) return;
    impactShake.time = 0;
    impactShake.power = power;
    impactShake.cooldown = 0.18;
  }
  function updateImpactShake(dt) {
    impactShake.time = Math.min(IMPACT_SHAKE_DURATION, impactShake.time + dt);
    impactShake.cooldown = Math.max(0, impactShake.cooldown - dt);
  }
  function applyImpactShake(eye, target) {
    if (impactShake.time >= IMPACT_SHAKE_DURATION) return;
    // Don't force camera motion on players who requested reduced motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = impactShake.time;
    const fade = Math.pow(1 - t / IMPACT_SHAKE_DURATION, 1.6) * impactShake.power;
    const lateral = (Math.sin(t * 104 + 1.1) + 0.34 * Math.sin(t * 187 + 0.2)) * 21 * fade;
    const vertical = (Math.sin(t * 136 + 0.8) + 0.27 * Math.sin(t * 211)) * 12 * fade;
    const dx = target[0] - eye[0], dz = target[2] - eye[2];
    const length = Math.hypot(dx, dz) || 1;
    const rightX = -dz / length, rightZ = dx / length;
    eye[0] += rightX * lateral;
    eye[1] += vertical;
    eye[2] += rightZ * lateral;
    target[0] += rightX * lateral * 1.30;
    target[1] += vertical * 1.12;
    target[2] += rightZ * lateral * 1.30;
  }
  const keys=new Set();
  function notify(msg,sec=3){S.notification=msg;S.notificationTime=sec;}
  const seated=()=>S.rides.filter(r=>r.state==='ONBOARD');
  const formatTime=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  function reset(){if(!sourceMeshes){const message=sourceLoadError||'Original game geometry is still loading. Please wait.';const status=$('engine-status');if(status){status.textContent=message;status.style.color='#ffbc9c';}return;}keys.clear();Object.assign(S,{mode:'PLAYING',time:0,x:0,z:-1450,angle:90,camera3:true,heading:90,score:0,delivered:0,failed:0,rescued:0,boost:100,boostOn:false,lastMove:-99,request:null,requestLeft:0,spawnClock:0,requestId:0,rides:[],dock:0,dockId:-1,notification:'',notificationTime:0,traffic:'GREEN',trafficClock:0,wasTraffic:false,trafficSafe:[0,-1450],violations:0,powerIndex:0,powerOff:true,powerClock:0,photo:false,photoTime:0,flash:0,wiperTime:0,wiperActive:false,wiperAngle:18,wiperDirection:1,screenDrops:[],screenSpawn:0,debrisCooldown:0,gameOverReason:'',current:'',movingCars:[],missedEffects:[],deliveryEffects:[],pickupEffects:[],rainSplashes:[],carProgress:[65,190],carStopped:[false,false],deliveryBanner:null,frameMS:0,frameWorst:0,campusQueue:[],campusGateScene:null,campusDropCursor:0,campusEntryCounter:0,gateRewardGroups:[],gateGroupCounter:0,rewardUntil:0,gatePausedTime:0});
    S.cityPeople=CITY_PEOPLE.map((p,i)=>({...p,uid:i}));S.cityPersonId=CITY_PEOPLE.length;
    S.aiRickshaws=createRickshawFleet();S.rickshawRescueCount=0;S.rickshawCrashCount=0;S.rickshawQuarrels=[];
    S.aiBoats=createRescueFleet();S.aiRespawnQueue=[];S.aiRescueCount=0;
    powerVisual.repairedIndex=-1;powerVisual.repairedAt=-999;
    Object.assign(impactShake, {time: IMPACT_SHAKE_DURATION, power: 0, blocked: false, cooldown: 0, anchorX:0, anchorZ:0});
    Object.assign(boatImpact, {pitch:0,pitchV:0,roll:0,rollV:0,heave:0,heaveV:0,recoilX:0,recoilZ:0,cooldown:0});
    S.waveStrength=0;S.waveSplashClock=0;S.waveSplashes=[];S.impactSplashes=[];S.postWinClock=0;
    const dpos=[[-1120,-220],[-535,-660],[40,-360],[595,-980],[1125,-50],[-1060,720],[-510,880],[0,270],[550,870],[1100,1000]];
    S.debris=dpos.map(([x,z],i)=>({x,z,x0:x,z0:z,phase:i*.67}));
    $('menu').classList.add('hidden');$('modal').classList.add('hidden');$('photo-info')?.classList.add('hidden');$('hud').classList.remove('hidden');
    resolvePickupMoorings();offerRide();gameAudio.begin();notify('Take students to BRAC University before their timers expire!',5);refreshHUD();}
  function offerRide(){if(S.request||S.rides.length>=5)return;
    const id=S.requestId++,type=id%2===0?'HOME':'DROWNING',places=(type==='HOME'?homes:rescues).filter(p=>!S.rides.some(r=>r.locationId===p.id));if(!places.length)return;
    const place=id<2?places[0]:places[Math.floor(Math.random()*places.length)];
    const dist=Math.abs(S.x-place.x)+Math.abs(S.z-place.z)+Math.abs(place.x)+Math.abs(place.z-1080);
    const deadline=clamp(Math.round(43+dist/130+(type==='HOME'?7:0)+rnd(-4,6)),66,118);
    S.request={id,type,name:students[id%students.length],voiceCharacter:passengerCast(students[id%students.length]),locationId:place.id,x:place.x,z:place.z,pickup:place.name,personX:place.personX,personZ:place.personZ,doorX:place.doorX,doorZ:place.doorZ,facadeZ:place.facadeZ,frontDir:place.frontDir,timeLeft:deadline,state:'OFFERED',relocated:place.relocated,colorId:id%studentColors.length,warning:false};S.requestLeft=22;gameAudio.play('warning',{ignoreDistance:true,volume:.32,cooldown:3});}
  function accept(){if(S.mode!=='PLAYING')return;if(!S.request){notify('No incoming ride request.');return;}
    if(S.rides.length>=5){notify('Your rescue queue is full (5 active requests).');return;}
    S.request.state='WAITING';S.rides.push(S.request);notify(`Accepted ${S.request.name} — ${S.request.type==='HOME'?'HOME PICKUP':'SOS / FLOODED STREET'}`,3);S.request=null;S.spawnClock=0;gameAudio.play('pickup',{ignoreDistance:true,volume:.35});refreshHUD();}
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
    S.score+=100;S.powerOff=false;S.powerClock=0;gameAudio.repair();
    powerVisual.repairedIndex=S.powerIndex;powerVisual.repairedAt=S.time;
    S.powerIndex=(S.powerIndex+1)%power.length;notify(`${p.name} power restored! Lights coming back street by street! +100`,4);}
  function nextModal(type){S.mode=type==='HELP'&&S.mode==='MENU'?'MENU':S.mode;
    $('modal').classList.remove('hidden');$('modal-secondary').classList.add('hidden');
    if(type==='HELP'||type==='PAUSED'){
      $('modal-eyebrow').textContent='YOUR MISSION';$('modal-title').textContent=type==='PAUSED'?'PAUSED':'HOW TO PLAY';
      $('modal-content').innerHTML=`<p>Dhaka is flooded and stranded students are trying to reach BRAC University. Deliver <b>6 students</b> in <b>15 minutes</b> before missing 6 rescue deadlines.</p><ul>
        <li><kbd>W</kbd>/<kbd>↑</kbd> forward, <kbd>S</kbd>/<kbd>↓</kbd> reverse, <kbd>A</kbd>/<kbd>←</kbd> & <kbd>D</kbd>/<kbd>→</kbd> steer the boat.</li>
        <li>Press <kbd>Y</kbd> to accept an incoming ride or <kbd>N</kbd> to reject it. Follow the orange minimap markers to the pickup.</li>
        <li><b>Stop your boat</b> at a pickup until the ring fills. Hold still about 1.3 seconds for a home pickup or 0.65 seconds for a rescue.</li>
        <li>Carry up to <b>3 passengers</b> to BRAC University. <b>After boarding, a shorter delivery countdown begins</b> (about 34–62 seconds depending on distance).</li>
        <li><kbd>Space</kbd> toggles boat boost; <kbd>C</kbd> changes camera; <kbd>P</kbd> photographs Shaheed Minar from its marked spot; <kbd>F</kbd> repairs an outage box; <kbd>V</kbd> wipes rain.</li>
        <li>Rough-current zones push the boat sideways and rock the hull. Steer or boost against the flow; hard collisions now jolt and splash.</li>
        <li>Watch the red traffic signal and avoid collisions with cars, buildings and debris. <kbd>F3</kbd> adjusts quality; <kbd>F4</kbd> toggles frame statistics; <kbd>Esc</kbd> pauses.</li></ul>`;
      $('modal-main').textContent=type==='PAUSED'?'RESUME GAME':'GOT IT';$('modal-secondary').classList.toggle('hidden',type!=='PAUSED');
    } else {
      const won=type==='WON';$('modal-eyebrow').textContent=won?'MISSION COMPLETE':'MISSION OVER';$('modal-title').textContent=won?'THE CAMPUS IS SAFE!':'THE CITY GOT THE BETTER OF US';
      $('modal-content').innerHTML=`<p>${won?'Beautiful rowing. You delivered six students safely!':S.gameOverReason}</p><p><b>Final score:</b> ${S.score} &nbsp; · &nbsp; <b>Delivered:</b> ${S.delivered} &nbsp; · &nbsp; <b>Missed:</b> ${S.failed}</p><p><b>Water rescues:</b> ${S.rescued} &nbsp; · &nbsp; <b>Traffic violations:</b> ${S.violations} &nbsp; · &nbsp; <b>Time:</b> ${formatTime(S.time-S.gatePausedTime)}</p><p>You can restart whenever you like. The original PyOpenGL desktop edition is preserved in the GitHub repository.</p>`;
      $('modal-main').textContent='PLAY AGAIN';
    }
  }
  function togglePause(){if(S.mode==='PLAYING'){S.mode='PAUSED';keys.clear();nextModal('PAUSED');}else if(S.mode==='PAUSED'){S.mode='PLAYING';$('modal').classList.add('hidden');}}
  function action(key){switch(key){case 'y':accept();break;case 'n':reject();break;case ' ':boost();break;case 'c':if(S.mode==='PLAYING'){S.camera3=!S.camera3;notify(S.camera3?'Third-person camera':'First-person camera',1.5);}break;case 'p':photo();break;case 'f':repair();break;case 'v':if(S.mode==='PLAYING'&&!S.wiperActive){S.wiperActive=true;S.wiperDirection=1;S.wiperAngle=18;notify('Windshield wiper activated.',1.4);}break;case 'f3':S.quality=S.quality==='HIGH'?'BALANCED':'HIGH';notify(`Graphics quality: ${S.quality}`,2);break;case 'f4':S.frameProfile=!S.frameProfile;notify(`Frame profiler ${S.frameProfile?'enabled':'disabled'}`,2);break;case 'Escape':if(S.mode==='MENU'&&!$('modal').classList.contains('hidden')){$('modal').classList.add('hidden');}else togglePause();break;}}
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
    for(const p of power)if(orientedObjectOverlap(x,z,p.x,p.z,0,30,29))return true;
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
  // Original Python windshield: pivot (505,55) in its 1000x800 virtual
  // frame and a 430-unit blade. Adapt via uniform letterbox scaling so the
  // wiper covers the *center* of ultrawide screens, not the right-hand side.
  function windshieldBlade(w,h){
    const factor=Math.min(w/1000,h/800);
    return {x:w*.505,y:h-55*factor,length:430*factor};
  }
  function updateWindshield(dt){
    if(S.camera3)return;
    const rainFree=distance(S.x,S.z,0,1378)<378;
    if(rainFree){S.screenDrops.length=0;S.screenSpawn=0;}
    if(!rainFree&&!S.wiperActive){S.screenSpawn+=dt;while(S.screenSpawn>=.08){S.screenSpawn-=.08;
      for(let i=0;i<4&&S.screenDrops.length<180;i++)S.screenDrops.push({x:rnd(.07,.93),y:rnd(.10,.87)});
    }}
    if(!S.wiperActive)return;
    const previousAngle=S.wiperAngle;
    S.wiperAngle+=S.wiperDirection*155*dt;
    const w=Math.max(1,weather.clientWidth),h=Math.max(1,weather.clientHeight);
    const blade=windshieldBlade(w,h);
    // Remove every droplet crossed between the old and new blade angles.
    // This matters at low FPS, when the blade jumps several degrees per tick.
    const low=Math.min(previousAngle,S.wiperAngle)-11;
    const high=Math.max(previousAngle,S.wiperAngle)+11;
    S.screenDrops=S.screenDrops.filter(d=>{
      const dx=d.x*w-blade.x,dy=blade.y-d.y*h,rad=Math.hypot(dx,dy);
      const angle=(Math.atan2(dy,dx)/RAD+360)%360;
      return !(rad<=blade.length+5&&angle>=low&&angle<=high);
    });
    if(S.wiperDirection>0&&S.wiperAngle>=158){S.wiperAngle=158;S.wiperDirection=-1;}
    else if(S.wiperDirection<0&&S.wiperAngle<=18){S.wiperAngle=18;S.wiperDirection=1;S.wiperActive=false;}
  }
  function step(dt){if(S.campusQueue.length)S.gatePausedTime+=dt;S.time+=dt;S.bobTime+=dt;updateWorldRain(dt);S.notificationTime=Math.max(0,S.notificationTime-dt);S.flash=Math.max(0,S.flash-dt);S.photoTime=Math.max(0,S.photoTime-dt);if(S.photoTime<=0){$('photo-info')?.classList.add('hidden');}S.wiperTime=Math.max(0,S.wiperTime-dt);updateWindshield(dt);
    S.boost=clamp(S.boost+(S.boostOn?-30:15)*dt,0,100);if(S.boost<=0)S.boostOn=false;
    updateImpactShake(dt);
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);
    const turn=(keys.has('a')||keys.has('arrowleft')?1:0)-(keys.has('d')||keys.has('arrowright')?1:0); // left is counterclockwise in the original, projection mirrored to correct handedness
    if(turn){S.angle=(S.angle+turn*105*dt+360)%360;S.lastMove=S.time;}
    S.rowing=!!forward; if(forward) S.strokeTime=(S.strokeTime+dt)%0.65; else S.strokeTime=0;
    let collidedThisStep = false;
    if(forward){const speed=(forward>0?270:180)*(S.boostOn?1.65:1);const dx=Math.cos(S.angle*RAD)*speed*dt*forward,dz=Math.sin(S.angle*RAD)*speed*dt*forward;
      // Collision increments avoid tunnelling through narrow buildings.
      const n=Math.ceil(Math.hypot(dx,dz)/8)||1;
      for(let i=0;i<n;i++){
        const x=S.x+dx/n,z=S.z+dz/n;
        if(moveAllowed(x,z)){S.x=x;S.z=z;}
        else{
          collidedThisStep = true;
          // Fire only on a NEW impact, not continuously while W/S is held.
          if(!impactShake.blocked)triggerBoatImpact(dx,dz,S.boostOn ? 1.35 : (forward>0 ? 1 : 0.85));
          const bad=S.debris.some(d=>distance(x,z,d.x,d.z)<57);
          if(bad&&S.debrisCooldown<=0){S.score=Math.max(0,S.score-25);S.debrisCooldown=1.8;notify('Floating debris! -25 points. Steer around it.',2.7);}
          break;
        }
      }
      S.lastMove=S.time;
    }
    // Latch a held-against-wall collision until the player backs away or
    // releases thrust, even after the recoil moves the boat slightly back.
    if(collidedThisStep)impactShake.blocked=true;
    else if(!forward||distance(S.x,S.z,impactShake.anchorX,impactShake.anchorZ)>40)impactShake.blocked=false;
    updateBoatImpact(dt);
    S.debrisCooldown=Math.max(0,S.debrisCooldown-dt);S.pickupEffects=S.pickupEffects.filter(e=>S.time-e.at<1.15);
    let activeZone=null;
    for(const zone of currents)if(S.x>=zone.a&&S.x<=zone.b&&S.z>=zone.c&&S.z<=zone.d){activeZone=zone;break;}
    S.current=activeZone?.name||'';
    const waveTarget=activeZone?1:0;
    S.waveStrength+=(waveTarget-S.waveStrength)*(1-Math.exp(-(activeZone?3.4:2.3)*dt));
    if(activeZone){
      const surge=1+.18*Math.sin(S.time*2.4+S.x*.007-S.z*.009);
      const length=Math.hypot(activeZone.dx,activeZone.dz)||1;
      // Cross-chop changes the trajectory and makes the zone feel turbulent.
      const sideways=21*Math.sin(S.time*3.2+S.x*.013+S.z*.011);
      const driftX=(activeZone.dx*surge-activeZone.dz/length*sideways)*dt;
      const driftZ=(activeZone.dz*surge+activeZone.dx/length*sideways)*dt;
      const pieces=Math.max(1,Math.ceil(Math.hypot(driftX,driftZ)/6));
      for(let n=0;n<pieces;n++){
        const nextX=S.x+driftX/pieces,nextZ=S.z+driftZ/pieces;
        if(moveAllowed(nextX,nextZ)){S.x=nextX;S.z=nextZ;}
        else{
          // Currents are force, not teleportation: slide along solid edges.
          if(moveAllowed(nextX,S.z))S.x=nextX;
          if(moveAllowed(S.x,nextZ))S.z=nextZ;
        }
      }
    }
    S.waveSplashClock+=dt*S.waveStrength;
    if(S.waveSplashClock>.24&&S.waveStrength>.28){
      S.waveSplashClock=0;
      const h=S.angle*RAD,side=Math.sin(S.time*5)>0?1:-1;
      S.waveSplashes.push({x:S.x-Math.sin(h)*side*39,z:S.z+Math.cos(h)*side*39,age:0});
      if(S.waveSplashes.length>10)S.waveSplashes.shift();
    }
    S.debris.forEach(d=>{const ph=d.phase+S.time*.65,x=d.x0+Math.sin(ph)*26,z=d.z0+Math.cos(ph*.7)*18;if(distance(x,z,S.x,S.z)>57){d.x=x;d.z=z;}});
    updateSlowCars(dt);
    updateRescueFleet(dt);
    updateRickshawFleet(dt);
    S.trafficClock+=dt;if(S.trafficClock>=(S.traffic==='GREEN'?5:4)){S.trafficClock=0;S.traffic=S.traffic==='GREEN'?'RED':'GREEN';}
    const inTraffic=S.x>=-115&&S.x<=115&&S.z>=-165&&S.z<=70;
    if(!inTraffic)S.trafficSafe=[S.x,S.z];
    if(inTraffic&&!S.wasTraffic&&S.traffic==='RED'){[S.x,S.z]=S.trafficSafe;S.score=Math.max(0,S.score-35);S.violations++;notify('RED LIGHT! Returned to the stop line. -35 points',3);S.wasTraffic=false;}else S.wasTraffic=inTraffic;
    if(!S.powerOff){S.powerClock+=dt;if(S.powerClock>=15){S.powerOff=true;S.powerClock=0;notify(`${power[S.powerIndex].name} district power outage!`,2.6);gameAudio.play('electric',{ignoreDistance:true,volume:.48});}}
    if(!S.campusQueue.length){if(S.request){S.requestLeft-=dt;if(S.requestLeft<=0){S.request=null;S.spawnClock=0;}}
    else {S.spawnClock+=dt;if(S.spawnClock>=9.5){S.spawnClock=0;offerRide();}}}
    for(const r of S.rides){if(S.campusQueue.length)continue;r.timeLeft=Math.max(0,r.timeLeft-dt);if(r.timeLeft<=0){recordMissedPassenger(r);const wasOnboard=r.state==='ONBOARD';r.state='FAILED';S.failed++;S.score=Math.max(0,S.score-75);notify(wasOnboard?`${r.name} ran out of time — left the boat! -75 points`:(r.type==='DROWNING'?`${r.name} could not be rescued! -75 points`:`${r.name} missed the class deadline! -75 points`),3.5);}else if(r.state==='ONBOARD'&&r.timeLeft<=25&&!r.warning){r.warning=true;notify(`HURRY! ${r.name} has 25 seconds left!`,3);gameAudio.play('warning',{ignoreDistance:true,volume:.40});}}
    S.rides=S.rides.filter(r=>r.state!=='FAILED');S.missedEffects=S.missedEffects.filter(e=>S.time-e.at<4.35);
    updateCampusGateSequence();
    if(distance(S.x,S.z,0,1080)<=122){const arrived=seated();if(arrived.length){let gained=0;
      for(const r of arrived){r.state='DELIVERED';const points=200+Math.floor(r.timeLeft*.4);S.score+=points;gained+=points;S.delivered++;}
      queueCampusArrivals(arrived,S.x,S.z,S.angle,gained);gameAudio.play('delivery',{ignoreDistance:true,volume:.88});
      S.rides=S.rides.filter(r=>r.state!=='DELIVERED');
      S.deliveryBanner={at:S.time,count:arrived.length,points:gained};
      notify(`Delivered ${arrived.length} student(s) to BRACU! Gate check চলছে! +${gained} points`,4.4);
    }}
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
      if(S.dock>=required){nearby.state='ONBOARD';
        // Tighter delivery challenge after pickup. Far docks get a fairer window.
        const returnDistance=distance(S.x,S.z,0,1080);
        nearby.timeLeft=Math.min(nearby.timeLeft,Math.round(clamp(28+returnDistance/105,34,62)));
        nearby.warning=false;
        S.pickupEffects.push({x:nearby.personX??nearby.x,z:nearby.personZ??nearby.z,at:S.time,type:nearby.type});nearby.boardedAt=S.time;nearby.boardSide=nearby.id%2?1:-1;gameAudio.play('pickup',{ignoreDistance:true,volume:.73});if(gameAudio.speakPassenger(nearby,'boarding',{x:S.x,z:S.z,level:1.07,priority:2,force:false,ignoreDistance:true,party:seated().length}))nearby.voiceLastSpokenAt=S.time;S.dock=0;S.dockId=-1;if(nearby.type==='HOME'){S.score+=35;notify(`${nearby.name} boarded! ${seated().length}/3 seats. +35 points`,3);}else{S.score+=90;S.rescued++;notify(`RESCUED ${nearby.name}! Deliver to BRACU. +90 points`,3);}}}
    if(S.delivered>=6){if(S.campusQueue.length===0&&!S.campusGateScene&&!S.deliveryEffects.length&&S.time>=(S.rewardUntil||0)){S.mode='WON';keys.clear();nextModal('WON');}}else if(S.time-S.gatePausedTime>=900||(S.failed>=6&&S.missedEffects.length===0)){S.mode='LOST';S.gameOverReason=S.time-S.gatePausedTime>=900?'Fifteen minutes passed before everyone arrived.':'Six passengers missed their ride deadlines.';keys.clear();nextModal('LOST');}
  }
  const map=$('minimap'),ctx=map.getContext('2d');
  function refreshMap(){
    const w=map.width,h=map.height,px=x=>19+(x+1650)/3300*(w-38),py=z=>h-19-(z+1650)/3300*(h-38);
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b2a37';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#345565';ctx.lineWidth=5;
    for(const x of [-1100,-550,0,550,1100]){ctx.beginPath();ctx.moveTo(px(x),py(-1650));ctx.lineTo(px(x),py(1650));ctx.stroke();}
    for(const z of [-1150,-600,-50,500,1050]){ctx.beginPath();ctx.moveTo(px(-1650),py(z));ctx.lineTo(px(1650),py(z));ctx.stroke();}
    ctx.fillStyle='#4c6270';for(const b of buildings)ctx.fillRect(px(b.x-b.hw),py(b.z+b.hd),(2*b.hw)/3300*(w-38),(2*b.hd)/3300*(h-38));
    ctx.fillStyle='#91d89b';ctx.fillRect(px(-220),py(1620),px(270)-px(-220),py(1230)-py(1620));
    // Each mission uses a separate shape + color, matching the desktop
    // HOME / SOS / BRACU / DOCK / REPAIR / LANDMARK symbol legend.
    function marker(x,z,kind,small=false){
      const X=px(x),Y=py(z);ctx.save();ctx.translate(X,Y);
      ctx.lineWidth=2.1;ctx.strokeStyle='#0a202b';
      if(kind==='HOME'){ctx.fillStyle='#f4b56d';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(9,0);ctx.lineTo(0,9);ctx.lineTo(-9,0);ctx.closePath();ctx.fill();ctx.stroke();}
      else if(kind==='SOS'){ctx.fillStyle='#ff7162';ctx.beginPath();ctx.arc(0,0,9,0,TAU);ctx.fill();ctx.stroke();ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#152831';ctx.fillText('!',0,.5);}
      else if(kind==='CAMPUS'){ctx.fillStyle='#9ae4a3';ctx.fillRect(-8,-8,16,16);}
      else if(kind==='DOCK'){ctx.fillStyle='#65cfea';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(-9,-7);ctx.lineTo(9,-7);ctx.closePath();ctx.fill();ctx.stroke();}
      else if(kind==='REPAIR'){ctx.fillStyle='#ffd17c';ctx.fillRect(-3,-10,6,20);ctx.fillRect(-10,-3,20,6);ctx.strokeRect(-10,-3,20,6);}
      else if(kind==='PHOTO'){ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#d8b7f4';ctx.fillText('★',0,0);}
      else if(kind==='PENDING'){ctx.strokeStyle='#a9b7c3';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(0,0,small?6:9,0,TAU);ctx.stroke();}
      ctx.restore();
    }
    marker(0,1360,'CAMPUS');marker(0,1080,'DOCK');
    for(const r of S.rides)if(r.state==='WAITING')marker(r.x,r.z,r.type==='HOME'?'HOME':'SOS');
    if(S.request){marker(S.request.x,S.request.z,'PENDING',true);ctx.beginPath();ctx.arc(px(S.request.x),py(S.request.z),12+3*Math.sin(S.time*6),0,TAU);ctx.strokeStyle='#d9c48d';ctx.lineWidth=2.1;ctx.stroke();}
    if(S.powerOff){const station=power[S.powerIndex];marker(station.x,station.z,'REPAIR');}
    if(!S.photo)marker(825,1080,'PHOTO');
    const a=S.angle*RAD;ctx.save();ctx.translate(px(S.x),py(S.z));ctx.rotate(-a+Math.PI/2);
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-10,11);ctx.lineTo(0,6);ctx.lineTo(10,11);ctx.closePath();ctx.fillStyle='#ffda8b';ctx.fill();ctx.strokeStyle='#10212d';ctx.stroke();ctx.restore();
  }
  function refreshHUD(){if(S.mode==='MENU')return;
    $('score').textContent=String(S.score).padStart(4,'0');$('timer').textContent=formatTime(900-(S.time-S.gatePausedTime));$('delivered').textContent=`${S.delivered} / 6`;$('failed').textContent=`${S.failed} / 6`;
    const trafficLabel=$('traffic-status'),powerLabel=$('power-status');
    const perf=$('performance-status');if(perf){perf.classList.toggle('hidden',!S.frameProfile);if(S.frameProfile)perf.textContent=`${S.frameMS.toFixed(1)}ms frame · worst ${S.frameWorst.toFixed(1)}ms · ${S.quality}`;}
    if(trafficLabel){trafficLabel.textContent=`${S.traffic==='GREEN'?'🟢 GREEN':'🔴 RED'} LIGHT`;trafficLabel.className='status-pill '+(S.traffic==='GREEN'?'status-green':'status-red');}
    if(powerLabel){powerLabel.textContent=S.powerOff?`🔴 BLACKOUT: ${power[S.powerIndex].name} · Find repair box (F)`:'🟢 POWER RESTORED · Streetlights and windows are on';powerLabel.className='status-pill '+(S.powerOff?'status-red':'status-green');}
    const onboardForTimer=seated().slice().sort((a,b)=>a.timeLeft-b.timeLeft);
    const deadlineBox=$('delivery-deadlines');deadlineBox.classList.toggle('hidden',!onboardForTimer.length);
    if(onboardForTimer.length){
      const short=onboardForTimer[0].timeLeft;
      $('shortest-deadline').textContent=formatTime(short);
      deadlineBox.classList.toggle('urgent',short<=25);
      $('passenger-deadlines').replaceChildren(...onboardForTimer.map(r=>{
        const el=document.createElement('div');el.className='deadline-person'+(r.timeLeft<=25?' urgent':'');
        const label=document.createElement('span');label.textContent=r.name;
        const remaining=document.createElement('b');remaining.textContent=formatTime(r.timeLeft);
        el.append(label,remaining);return el;
      }));
    }
    const ridesSorted=S.rides.slice().sort((a,b)=>a.timeLeft-b.timeLeft);
    $('active-rides').classList.toggle('hidden',!ridesSorted.length);
    $('queue-count').textContent=`${ridesSorted.length}/5`;
    $('ride-queue').replaceChildren(...ridesSorted.map(r=>{
      const row=document.createElement('div');row.className='queue-ride'+(r.timeLeft<=25?' urgent':'');
      const type=r.state==='ONBOARD'?'⛵ ONBOARD':r.type==='DROWNING'?'🛟 SOS':'⌂ HOME';
      const name=document.createElement('span');name.textContent=`${type} · ${r.name}`;
      const t=document.createElement('strong');t.textContent=formatTime(r.timeLeft);row.append(name,t);return row;
    }));
    const banner=$('delivery-celebration'),bannerActive=S.deliveryBanner&&S.time-S.deliveryBanner.at<2.65;
    banner.classList.toggle('hidden',!bannerActive);
    if(bannerActive)banner.textContent=`★ ${S.deliveryBanner.count} STUDENT${S.deliveryBanner.count===1?'':'S'} ARRIVED AT BRACU · +${S.deliveryBanner.points} POINTS ★`;
    $('boost-fill').style.width=`${S.boost}%`;$('boost-number').textContent=`${Math.round(S.boost)}%`;$('passengers').innerHTML=`PASSENGERS ONBOARD <b>${seated().length} / 3</b>`;
    $('request-panel').classList.toggle('hidden',!S.request);
    if(S.request){$('request-name').textContent=S.request.name;$('request-location').textContent=`${S.request.type==='HOME'?'🏠 Home pickup':'🛟 SOS rescue'} · ${S.request.pickup}`;$('request-remaining').textContent=`${Math.ceil(S.requestLeft)}s`;}
    const waiting=S.rides.filter(r=>r.state==='WAITING'),onboard=seated();const nearest=waiting.sort((a,b)=>distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z))[0];
    if(onboard.length){const soonest=Math.min(...onboard.map(r=>r.timeLeft));$('objective-title').textContent=`${onboard.length} PASSENGER${onboard.length===1?'':'S'} ONBOARD · ${formatTime(soonest)} LEFT`;$('objective-detail').textContent=`Deliver to BRACU · ${Math.round(distance(S.x,S.z,0,1080))} units · Nearest deadline ${formatTime(soonest)}`;}
    else if(nearest){$('objective-title').textContent=`PICK UP ${nearest.name.toUpperCase()} · ${formatTime(nearest.timeLeft)} LEFT`;$('objective-detail').textContent=`${nearest.pickup} · ${Math.round(distance(S.x,S.z,nearest.x,nearest.z))} units`;}
    else{$('objective-title').textContent='ACCEPT A RESCUE REQUEST';$('objective-detail').textContent='Pick up students and bring them to BRACU';}
    if(S.current){$('objective-title').textContent+=` · ${S.current}`;}
    const docking=nearest&&S.dockId===nearest.id?S.dock/(nearest.type==='HOME'?1.3:.65):0;$('dock-fill').style.width=`${Math.min(100,docking*100)}%`;
    $('toast').classList.toggle('hidden',S.notificationTime<=0);if(S.notificationTime>0)$('toast').textContent=S.notification;
    refreshMap();
  }
  function skyColor(){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}
  function resize(){const ratio=Math.min(devicePixelRatio||1,1.8),w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);weather.width=canvas.width;weather.height=canvas.height;}gl.viewport(0,0,canvas.width,canvas.height);}
  const rain=[];for(let i=0;i<100;i++)rain.push({x:Math.random(),y:Math.random(),speed:rnd(.2,.7),len:rnd(.008,.023)});

  // Small camera-projected comic bubbles. Only 1–3 show at a time, for a
  // couple of seconds each, so dialogue does not overwhelm the HUD.
  function comicProject(x,y,z){
    if(!comicView||!comicProj)return null;
    const m=comicView,p=comicProj;
    const vx=m[0]*x+m[4]*y+m[8]*z+m[12];
    const vy=m[1]*x+m[5]*y+m[9]*z+m[13];
    const vz=m[2]*x+m[6]*y+m[10]*z+m[14];
    const ww=-vz;
    if(ww<1)return null;
    const cx=-(p[0]*vx+p[4]*vy+p[8]*vz+p[12]);
    const cy=p[1]*vx+p[5]*vy+p[9]*vz+p[13];
    const sx=(.5+.5*cx/ww)*weather.width,sy=(.5-.5*cy/ww)*weather.height;
    if(sx<48||sx>weather.width-48||sy<weather.height*.20||sy>weather.height*.90)return null;
    // Keep comics away from the score, minimap and mission request HUD.
    if(sx<weather.width*.30 && (sy<weather.height*.19||sy>weather.height*.48))return null;
    if(sx>weather.width*.80 && sy<weather.height*.20)return null;
    // Simple building-line occlusion: speech should not show THROUGH walls.
    if(comicEye){
      const dx=x-comicEye[0],dz=z-comicEye[2];
      for(const b of buildings){
        if(y>b.h+25)continue;
        // A rooftop person may be standing on top of their own building.
        if(y>b.h-18&&Math.abs(x-b.x)<b.hw+5&&Math.abs(z-b.z)<b.hd+5)continue;
        let lo=0,hi=1,ok=true;
        for(const [pos,delta,min,max] of [[comicEye[0],dx,b.x-b.hw,b.x+b.hw],[comicEye[2],dz,b.z-b.hd,b.z+b.hd]]){
          if(Math.abs(delta)<1e-6){if(pos<min||pos>max){ok=false;break;}}
          else{let a=(min-pos)/delta,c=(max-pos)/delta;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);}
        }
        if(ok&&lo<=hi&&lo>.002&&lo<.88 && comicEye[1]+(y-comicEye[1])*lo<b.h+10)return null;
      }
    }
    return {x:sx,y:sy};
  }
  function comicDraw(text,x,y,style='normal'){
    const scale=clamp(weather.width/1400,.76,1.35);
    const fontSize=12.5*scale;
    wx.save();wx.font=`900 ${fontSize}px 'Noto Sans Bengali', 'Hind Siliguri', 'SolaimanLipi', 'Nirmala UI', 'Vrinda', system-ui, sans-serif`;
    const width=Math.min(weather.width*.34,wx.measureText(text).width+24*scale);
    const height=31*scale,px=clamp(x,10+width/2,weather.width-10-width/2),py=y-11*scale;
    wx.globalAlpha=.93;
    wx.shadowColor='rgba(0,0,0,.48)';wx.shadowBlur=9*scale;wx.shadowOffsetY=3*scale;
    wx.fillStyle=style==='urgent'?'#ffe1b2':style==='hero'?'#c2f6db':'#fff8e5';
    wx.strokeStyle='#253b46';wx.lineWidth=2.6*scale;
    wx.beginPath();wx.roundRect(px-width/2,py-height,width,height,10*scale);wx.fill();wx.stroke();
    wx.shadowColor='transparent';
    wx.beginPath();wx.moveTo(px-6*scale,py);wx.lineTo(px+2*scale,py+10*scale);wx.lineTo(px+10*scale,py);wx.closePath();wx.fill();wx.stroke();
    wx.textAlign='center';wx.textBaseline='middle';wx.fillStyle='#19333d';
    wx.fillText(text,px,py-height/2,width-16*scale);wx.restore();
  }
  function renderComicBubbles(){
    if(S.mode!=='PLAYING')return;
    const candidates=[];
    for(const r of S.rides){if(r.state!=='WAITING')continue;
      const x=r.personX??r.x,z=r.personZ??r.z,d=distance(S.x,S.z,x,z);
      if(d>430)continue;
      const urgent=r.timeLeft<25;
      const phrases=urgent?['HURRY, PLEASE!','TIME IS RUNNING OUT!','HELP ME!']:
        r.type==='DROWNING'?['HELP! OVER HERE!','I CAN SWIM!','THIS WAY, MAJHI!']:
        ['MAJHI, HERE!','ভাই, BRACU যাবেন?','LAPTOP TA BACHAN!','CLASS STARTS SOON!'];
      candidates.push({priority:urgent?0:1,x,y:r.type==='HOME'?87:57,z,
        message:phrases[Math.floor((S.time/5+r.id)%phrases.length)],style:urgent?'urgent':'normal',id:r.id});
    }
    // Rescued passengers thank the player; near deadlines they instead warn
    // about the clock. Render in world space only in the chase view.
    if(S.camera3){
      for(const r of seated()){
        if(S.time-(r.boardedAt??0)>13)continue;
        const urgent=r.timeLeft<22;
        const lines=urgent?['MAJHI, TARATARI!','TIME IS RUNNING OUT!']:
          ['ভাই, পাঁচ তারা রেটিং দিলাম!','LAPTOP TA SAFE TO?','THANK YOU, MAJHI!'];
        candidates.push({priority:urgent?0:2,x:S.x,y:90,z:S.z,
          message:lines[Math.floor(S.time/4.5+r.id)%lines.length],
          style:urgent?'urgent':'hero',id:900+r.id});
      }
    }
    for(const e of S.deliveryEffects){
      const age=S.time-e.at;
      if(age<1.7||age>4.1)continue;
      candidates.push({priority:0,x:e.x1,y:88,z:e.z1,
        message:e.colorId%2?'BRACU REACHED!':'THANK YOU, MAJHI!',style:'hero',id:800+e.colorId});
    }
    for(const b of S.aiBoats){
      if(distance(S.x,S.z,b.x,b.z)>390)continue;
      if(S.time-b.rescuedAt<2.2)candidates.push({priority:0,x:b.x,y:83,z:b.z,message:'SAFE NOW!',style:'hero',id:300+b.id});
      else if(b.targetId!==null)candidates.push({priority:4,x:b.x,y:83,z:b.z,
        message:['মাঝি আসছে!','ওই দিকে স্রোত বেশি!'][b.id],style:'hero',id:300+b.id});
    }
    // The arguing drivers take precedence briefly, but only when close enough
    // to be heard. Humor stays harmless: a short spat, then they carry on.
    for(const incident of S.rickshawQuarrels){
      const r=S.aiRickshaws.find(v=>v.id===incident.id);
      const car=parkedCars[incident.carIndex];
      if(!r||!car||distance(S.x,S.z,r.x,r.z)>440)continue;
      const turn=Math.floor((S.time-incident.at)/1.25)%4;
      const lines=['মামা, সামনে দেখেন না?', 'আপনিও তো রাস্তার মাঝে!',
        'গাড়িটা দেখেন কী অবস্থা!', 'রাস্তা তো নদী, ভাই!'];
      const driverTurn=turn%2===0;
      candidates.push({priority:-2,x:driverTurn?r.x:car.x,
        y:driverTurn?102:90,z:driverTurn?r.z:car.z,
        message:lines[turn],style:'urgent',id:1500+incident.id,force:true});
    }
    for(const r of S.aiRickshaws){
      if(distance(S.x,S.z,r.x,r.z)>350||r.incidentCar!==null)continue;
      if(S.time-r.rescuedAt<2.8)candidates.push({priority:1,x:r.x,y:100,z:r.z,
        message:'উঠেন, নিরাপদে পৌঁছে দিই!',style:'hero',id:1200+r.id});
      else if(r.targetId!==null)candidates.push({priority:5,x:r.x,y:100,z:r.z,
        message:['রিকশা যাবে, মামা!','আসতেছি ভাই!','সাবধানে উঠেন!'][r.id],style:'normal',id:1200+r.id});
    }
    for(const p of S.cityPeople){
      const dist=distance(S.x,S.z,p.x,p.z);if(dist>320)continue;
      const pos=ambientCitizenPosition(p,S.time);
      const who=dhakaPerson(p),cheer=residentCelebrating(p);
      const library={
        STUDENT:['ভাই, BRACU যাবেন?','CLASS MISS HOYE JABE!','ASSIGNMENT TA BACHAN!'],
        WORRIER:['এই পানি আর কত!','রাস্তা তো নদী!', 'BASA JABO KEMON KORE?'],
        JOKER:['MAMA, NAUKA BHARA KOTO?','5 STAR RATING DIBO!','EXAM TA CANCEL HOBE?'],
        NEIGHBOR:['সবাই সাবধানে!','ওই দিকে স্রোত বেশি!','DRY SIDE DIYE JAN!'],
        HELPER:['HOLD THIS ROPE!','AMRA ACHI, BHOY NAI!','HELP IS COMING!'],
        UNCLE:['চা দোকান খোলা আছে?','এ কী অবস্থা বাবা!','রিকশা যাবে না নৌকা?'],
        SHOPKEEPER:['MAL UPORE TULUN!','বৃষ্টি আর থামে না!','LIGHT ASHBE KOBE?']
      };
      const defaultLines=p.role==='SWIM'?['HELP! OVER HERE!','THE WATER IS FAST!']:
        p.role==='ROPE'?['HOLD THE ROPE!']:
        p.role==='SHOP'?library.SHOPKEEPER:
        library[who]||library.NEIGHBOR;
      const lines=cheer?['আলো এসেছে!','CURRENT ASHCHE!','LIGHTS ARE BACK!']:
        (p.role==='SWIM'&&S.current?['THE CURRENT IS STRONG!','MAJHI, THIS WAY!']:defaultLines);
      candidates.push({priority:cheer?1:p.role==='ROPE'?2:3,x:pos.x,z:pos.z,
        y:['ROOF','BALCONY','ROPE'].includes(p.role)?p.y+50:p.role==='SHOP'?85:65,
        message:lines[Math.floor(S.time/5.5+p.uid)%lines.length],style:cheer?'hero':'normal',id:100+p.uid});
    }
    for(let i=0;i<parkedCars.length;i++){
      const car=parkedCars[i],type=dhakaVehicleType(i);
      if(distance(S.x,S.z,car.x,car.z)>250||type==='car')continue;
      candidates.push({priority:4,x:car.x,z:car.z,y:type==='rickshaw'?114:91,
        message:type==='rickshaw'?'মামা, রাস্তা তো নদী!':'CNG JABE NA, BHAI!',
        style:'normal',id:600+i});
    }
    // Alternating speaking windows and a nearest-speaker preference prevent
    // overlap and avoid drowning out the player's actual rescue mission.
    candidates.sort((a,b)=>a.priority-b.priority||distance(S.x,S.z,a.x,a.z)-distance(S.x,S.z,b.x,b.z));
    let displayed=0;const spots=[];
    for(const c of candidates){
      if(!c.force&&((S.time+c.id*1.71)%8.5)>3.1)continue;
      const at=comicProject(c.x,c.y,c.z);if(!at)continue;
      if(spots.some(p=>Math.abs(p.x-at.x)<190&&Math.abs(p.y-at.y)<75))continue;
      comicDraw(c.message,at.x,at.y,c.style);spots.push(at);
      if(++displayed>=3)break;
    }
  }

  function renderRain(dt){const w=weather.width,h=weather.height;wx.clearRect(0,0,w,h);if(S.mode==='PAUSED'||S.mode==='WON'||S.mode==='LOST')return;
    const campusDistance=distance(S.x,S.z,0,1378);
    const rainFraction=clamp((campusDistance-365)/230,0,1);
    const quantity=Math.round(rain.length*rainFraction);
    wx.strokeStyle=`rgba(185,224,237,${(.065+.115*rainFraction).toFixed(3)})`;wx.lineWidth=Math.max(.7,w/1400);
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
    // Accessible interaction prompt drawn into the existing overlay, no HTML edits.
    if(S.mode==='PLAYING'&&S.powerOff){
      const p=power[S.powerIndex],dist=distance(S.x,S.z,p.x,p.z);
      if(dist<190){
        const ready=dist<=130,unit=Math.max(.72,Math.min(w/1150,h/725));
        const boxW=Math.min(w-18*unit,ready?340*unit:380*unit),boxH=54*unit;
        const x=w*.5-boxW*.5,y=h*.71-boxH*.5;
        wx.fillStyle='rgba(6,21,28,.86)';wx.fillRect(x,y,boxW,boxH);
        wx.strokeStyle=ready?'rgba(100,241,163,.9)':'rgba(241,184,92,.78)';
        wx.lineWidth=2*unit;wx.strokeRect(x,y,boxW,boxH);
        wx.font=`bold ${16*unit}px system-ui, sans-serif`;wx.textAlign='center';
        wx.textBaseline='middle';wx.fillStyle='#f3faf1';
        wx.fillText(ready?`[ F ]  RESTORE ${p.name} GRID`:`${p.name} GRID · APPROACH TO REPAIR`,w*.5,y+boxH*.37);
        wx.font=`${11*unit}px system-ui, sans-serif`;
        wx.fillStyle=ready?'#a4efbe':'#ffd29b';
        wx.fillText(ready?'ELECTRICAL CONTROL · +100 POINTS':`${Math.ceil(dist-130)} UNITS TO REPAIR RANGE`,w*.5,y+boxH*.74);
      }
    }
    renderComicBubbles();
  }
  function fauxBracMeta(entry,index=0){
    const bloods=['A+','B+','O+','AB+'];
    const dept=['CSE','BBA','EEE','CS'][entry.colorId%4];
    const initials=(entry.name||'Student').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()||'ST';
    return {id:`223${String(1500+(index*37+entry.colorId*19)%7000).padStart(4,'0')}`,
      validity:'Jun 2027',blood:bloods[(entry.colorId+index)%bloods.length],dept,
      gameCode:`GAME-${String(index+1).padStart(3,'0')}`,
      initials};
  }
  function queueCampusArrivals(arrived,startX,startZ,heading,points){
    const group=++S.gateGroupCounter;S.gateRewardGroups.push({group,points,played:false});
    let base=Math.max(S.time,S.campusDropCursor||S.time);
    for(const [i,r] of arrived.entries()){
      const seats=[[8,-19],[8,19],[67,0]], [bx,bz]=seats[Math.min(i,2)],h=heading*RAD;
      const sx=startX+(bx*Math.cos(h)-bz*Math.sin(h))*.62,sz=startZ+(bx*Math.sin(h)+bz*Math.cos(h))*.62;
      S.campusEntryCounter=(S.campusEntryCounter||0)+1;
      const forgot=S.campusEntryCounter%3===0;
      S.campusQueue.push({name:r.name,voiceCharacter:r.voiceCharacter||null,colorId:r.colorId,startX:sx,startZ:sz,dropAt:base,
        forgotId:forgot,group,walkStarted:false,sceneDone:false,walkTime:2.15,gateDelay:2.45,index:S.campusEntryCounter-1});
      base+=forgot?39:10.4;
    }
    S.campusDropCursor=base;
  }
  function updateCampusGateSequence(){
    if(S.mode!=='PLAYING')return;
    S.deliveryEffects=S.deliveryEffects.filter(e=>{
      const guest=S.campusQueue.find(q=>q.index===e.entryIndex);
      return guest?!guest.sceneDone:S.time-e.at<8.5;
    });
    for(const entry of S.campusQueue){
      if(!entry.walkStarted&&S.time>=entry.dropAt){
        entry.walkStarted=true;
        const i=S.campusQueue.indexOf(entry)%3;
        S.deliveryEffects.push({at:entry.dropAt,x0:entry.startX,z0:entry.startZ,y0:35,
          x1:clamp(entry.startX*.23+(i-1)*28,-86,86),z1:1164+(i-1)*16,colorId:entry.colorId,
          walkTime:entry.walkTime,holdTime:entry.forgotId?2.5:1.6,name:entry.name,entryIndex:entry.index});
      }
      if(entry.walkStarted&&!entry.sceneDone&&!entry.sceneAt&&S.time>=entry.dropAt+entry.gateDelay){
        entry.sceneAt=S.time;
        if(!S.campusGateScene){S.campusGateScene={...entry,start:S.time};gameAudio.startGate(S.campusGateScene);}
      }
    }
    if(!S.campusGateScene){
      const pending=S.campusQueue.find(e=>e.sceneAt&&!e.sceneDone);
      if(pending){S.campusGateScene={...pending,start:S.time};gameAudio.startGate(S.campusGateScene);}
    }else{
      const scene=S.campusGateScene;
      const age=S.time-scene.start;
      // Gate animations wait for the actual recorded voice sequence to end.
      // A generous safety cutoff prevents a stalled asset from locking play; the full recorded gate conversation can last over 30 seconds.
      const completed=scene.audioComplete&&age>=1.7&&S.time-(scene.finishedAt||S.time)>=.42;
      if(completed||age>72){
        const match=S.campusQueue.find(e=>e.index===scene.index);
        if(match)match.sceneDone=true;
        S.campusGateScene=null;
      }
    }
    S.campusQueue=S.campusQueue.filter(e=>!(e.sceneDone&&S.time>(e.sceneAt||0)+.3));
    for(const reward of S.gateRewardGroups){
      if(reward.played)continue;
      if(S.campusQueue.some(e=>e.group===reward.group))continue;
      if(S.campusGateScene)continue;
      reward.played=true;const songLength=gameAudio.showReward(reward.points);
      S.rewardUntil=Math.max(S.rewardUntil||0,S.time+Math.max(3.2,songLength+.2));
    }
    S.gateRewardGroups=S.gateRewardGroups.filter(r=>!r.played);
  }
  function drawSpeechBox(text,x,y,maxWidth=250,fill='#fff8e5',stroke='#253b46',textColor='#19333d'){
    const scale=clamp(weather.width/1400,.78,1.25),pad=12*scale,lineH=16*scale;
    wx.save();wx.font=`900 ${12.5*scale}px 'Noto Sans Bengali', 'Hind Siliguri', 'SolaimanLipi', system-ui, sans-serif`;
    const words=text.split(' '),lines=[];let line='';
    for(const w of words){const test=line?line+' '+w:w;if(wx.measureText(test).width>maxWidth-2*pad&&line){lines.push(line);line=w;}else line=test;}
    if(line)lines.push(line);
    const width=Math.min(maxWidth,Math.max(...lines.map(l=>wx.measureText(l).width),90)+2*pad),height=lines.length*lineH+2*pad;
    wx.fillStyle=fill;wx.strokeStyle=stroke;wx.lineWidth=2.2*scale;wx.globalAlpha=.95;
    wx.beginPath();wx.roundRect(x,y,width,height,12*scale);wx.fill();wx.stroke();
    wx.fillStyle=textColor;wx.textBaseline='top';wx.textAlign='left';
    lines.forEach((ln,i)=>wx.fillText(ln,x+pad,y+pad+i*lineH));
    wx.restore();
    return {width,height};
  }
  // This is a standalone foreground UI, not a weather-canvas drawing.
  // A canvas is behind the HTML HUD and control widgets; that is why the
  // earlier ID card and guard bubbles were obscured even after moving them.
  // Everything lives in the same game.js, with no HTML/CSS files to replace.
  let campusGateOverlay=null, campusGateShownKey='';
  function campusGateUI(){
    if(campusGateOverlay)return campusGateOverlay;
    const style=document.createElement('style');
    style.id='majhi-campus-gate-css';
    style.textContent=`
      #majhi-campus-gate{position:fixed;inset:0;z-index:2147482000;display:flex;
        justify-content:center;align-items:center;box-sizing:border-box;pointer-events:none;
        background:rgba(2,12,19,.62);backdrop-filter:blur(2px);
        opacity:0;visibility:hidden;transition:opacity .24s ease,visibility .24s ease;
        color:#f7f4e9;font-family:system-ui,'Noto Sans Bengali','Nirmala UI',sans-serif;}
      #majhi-campus-gate.mj-show{opacity:1;visibility:visible;}
      #majhi-campus-gate *{box-sizing:border-box;}
      .mj-gate-stage{width:min(780px,96vw);max-height:94vh;display:flex;flex-direction:column;
        align-items:center;gap:12px;justify-content:center;}
      .mj-gate-head{padding:8px 16px;border-radius:99px;background:rgba(7,27,40,.94);
        border:1px solid rgba(245,199,103,.64);color:#ffe3a1;font-weight:900;
        font-size:clamp(12px,1.25vw,17px);letter-spacing:.055em;text-align:center;
        box-shadow:0 4px 20px #0007;max-width:92vw;}
      .mj-gate-head.mj-fail{border-color:#f4a19a;color:#ffdbd5;}
      .mj-gate-row{display:flex;align-items:center;justify-content:center;gap:18px;max-width:100%;}
      .mj-gate-card-wrap{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;}
      .mj-gate-card{width:min(300px,calc(62vh * .635));aspect-ratio:0.635;min-width:190px;
        position:relative;overflow:hidden;border-radius:17px;color:#243448;
        background:linear-gradient(125deg,#fafcfc 0%,#f6f9fa 58%,#f0f5f6 100%);
        border:2px solid rgba(212,226,232,.96);
        box-shadow:0 14px 42px #000a,0 0 0 5px #ffffff17;
        font-family:Arial,system-ui,sans-serif;flex-shrink:0;}
      .mj-card-logo{position:absolute;left:6%;top:10%;width:38%;height:30%;text-align:center;}
      .mj-card-logo svg{display:block;width:82%;height:73%;margin:auto;}
      .mj-card-motto{font-family:Georgia,serif;font-size:clamp(6px,.66vw,8px);
        letter-spacing:.08em;color:#4d6680;white-space:nowrap;}
      .mj-card-photo{position:absolute;right:5%;top:7%;width:40%;height:34%;
        overflow:hidden;background:linear-gradient(150deg,#edf3f5,#b9d3d9 95%);
        border:1px solid #d3dce0;}
      .mj-photo-head{position:absolute;left:30%;top:18%;width:40%;height:34%;border-radius:50%;
        background:var(--skin,#c58d69);box-shadow:0 -9px 0 -2px #162b32;}
      .mj-photo-shirt{position:absolute;left:14%;bottom:-7%;width:72%;height:47%;border-radius:46% 46% 0 0;
        background:var(--shirt,#7a3841);}
      .mj-card-wave{position:absolute;left:0;top:39%;width:100%;height:18%;}
      .mj-card-name{position:absolute;right:7%;top:56%;max-width:85%;font-size:clamp(12px,1.13vw,16px);
        line-height:1.13;text-align:right;font-weight:650;text-transform:uppercase;
        color:#273542;overflow-wrap:anywhere;}
      .mj-card-role{position:absolute;right:7%;top:69%;font-weight:650;
        font-size:clamp(10px,1vw,13px);display:flex;flex-direction:column;align-items:flex-end;
        gap:1px;color:#273645;}
      .mj-card-details{position:absolute;right:6%;left:31%;bottom:6%;display:grid;
        grid-template-columns:minmax(0,1.1fr) 8px minmax(0,1fr);column-gap:4px;
        align-items:center;row-gap:4px;font-size:clamp(10px,.89vw,12px);line-height:1.15;}
      .mj-card-details span:nth-child(3n+3){text-align:right;white-space:nowrap;}
      .mj-card-stripes{position:absolute;left:-2%;bottom:0%;width:24%;height:13%;pointer-events:none;}
      .mj-card-stripes path{fill:none;stroke-width:6;stroke-linecap:round;}
      .mj-card-fail-mark{display:none;position:absolute;inset:35% 7% auto 7%;z-index:3;
        transform:rotate(-11deg);border:4px solid #cb333c;color:#a82734;background:#fff8;
        font-weight:1000;font-size:clamp(15px,2vw,23px);letter-spacing:.09em;text-align:center;
        padding:9px 3px;border-radius:5px;box-shadow:0 3px 16px #0002;}
      .mj-gate-card.mj-fail .mj-card-fail-mark{display:block;}
      .mj-gate-card.mj-fail .mj-card-photo{filter:saturate(.65);}
      .mj-gate-card.mj-fail .mj-card-details{color:#a53d42;}
      .mj-gate-illustrative{font-size:10px;color:#e8f0f4;background:#102c3bc9;
        padding:3px 9px;border-radius:999px;letter-spacing:.035em;}
      .mj-gate-dialogue{width:318px;max-width:min(318px,92vw);padding:15px 14px;
        border-radius:16px;border:1px solid #83a6b285;background:#0a2431ed;
        box-shadow:0 12px 35px #0009;display:flex;flex-direction:column;gap:10px;}
      .mj-gate-dialogue-title{font-size:13px;font-weight:900;letter-spacing:.08em;
        color:#f1d393;text-align:center;}
      .mj-gate-line{border-radius:13px;padding:11px 12px;line-height:1.45;
        border:2px solid transparent;transition:opacity .15s;}
      .mj-gate-line.mj-guard{background:#d9e9ef;color:#153644;border-color:#547e8b;}
      .mj-gate-line.mj-student{background:#ffe4dc;color:#622c2a;border-color:#c07769;}
      .mj-gate-line.mj-dim{opacity:.42;}
      .mj-gate-speaker{font-size:10px;font-weight:950;letter-spacing:.11em;margin-bottom:4px;}
      .mj-gate-message{font-size:clamp(12px,1.05vw,15px);font-weight:750;overflow-wrap:anywhere;}
      .mj-gate-foot{display:flex;justify-content:center;align-items:center;gap:7px;
        color:#d9e8ed;text-align:center;font-size:11px;font-weight:650;}
      .mj-gate-dot{height:8px;width:8px;background:#f1c778;border-radius:50%;}
      @media(max-width:660px){
        .mj-gate-stage{gap:6px;}
        .mj-gate-row{flex-direction:column;gap:8px;}
        .mj-gate-card{width:min(260px,calc(54vh * .635));min-width:180px;}
        .mj-gate-dialogue{width:min(430px,90vw);padding:9px;gap:5px;}
        .mj-gate-line{padding:6px 9px;}
        .mj-gate-line.mj-dim{display:none;}
        .mj-gate-head{font-size:12px;padding:5px 10px;}
        .mj-gate-message{font-size:12px;}
        .mj-gate-illustrative,.mj-gate-foot{font-size:9px;}
      }
      @media(max-height:600px){
        .mj-gate-stage{gap:5px;}
        .mj-gate-row{gap:9px;}
        .mj-gate-card{width:min(225px,calc(57vh * .635));min-width:145px;}
        .mj-gate-dialogue{padding:9px;gap:7px;}
        .mj-gate-line{padding:7px 9px;}
      }
      @media(prefers-reduced-motion:reduce){#majhi-campus-gate,.mj-gate-line{transition:none;}}
    `;
    document.head.appendChild(style);
    const root=document.createElement('section');
    root.id='majhi-campus-gate';root.setAttribute('aria-label','BRAC University student ID gate check');
    root.innerHTML=`
      <div class="mj-gate-stage">
        <div class="mj-gate-head" id="mj-gate-heading">BRACU CAMPUS SECURITY</div>
        <div class="mj-gate-row">
          <div class="mj-gate-card-wrap">
            <div class="mj-gate-card" id="mj-gate-card">
              <div class="mj-card-logo">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <path d="M16 65 A39 39 0 1 1 84 65" fill="none" stroke="#24527e" stroke-width="2.8"/>
                  <text x="50" y="39" font-family="Georgia,serif" font-size="19" fill="#2e4456" text-anchor="middle">BRAC</text>
                  <text x="50" y="52" font-family="Georgia,serif" font-size="9.5" fill="#2e4456" text-anchor="middle">UNIVERSITY</text>
                  <path d="M28 63 L50 78 L72 63 M33 70 L50 83 L67 70 M39 78 L50 87 L61 78" stroke="#355e83" stroke-width="2.6" fill="none"/>
                </svg>
                <div class="mj-card-motto">Inspiring Excellence</div>
              </div>
              <div class="mj-card-photo"><div class="mj-photo-head"></div><div class="mj-photo-shirt"></div></div>
              <svg class="mj-card-wave" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 76 C98 16 213 -13 309 7 C349 15 377 22 400 8 L400 48 C308 53 239 25 159 49 C90 70 46 88 0 103 Z" fill="#244887"/>
              </svg>
              <div class="mj-card-name" id="mj-gate-name">STUDENT</div>
              <div class="mj-card-role"><span>STUDENT</span><span id="mj-gate-dept">CSE</span></div>
              <div class="mj-card-details">
                <span>ID No.</span><span>:</span><span id="mj-gate-id">DEMO-0001</span>
                <span>Validity</span><span>:</span><span id="mj-gate-validity">Jun 2027</span>
                <span>Blood Group</span><span>:</span><span id="mj-gate-blood">A+</span>
              </div>
              <svg class="mj-card-stripes" viewBox="0 0 105 85" preserveAspectRatio="none" aria-hidden="true">
                <path d="M-30 97 Q 5 37 100 22" stroke="#244888"/>
                <path d="M-19 111 Q 18 57 105 37" stroke="#213446"/>
                <path d="M-13 128 Q 29 77 104 53" stroke="#8d9a9e"/>
              </svg>
              <div class="mj-card-fail-mark">NO ID!</div>
            </div>
            <div class="mj-gate-illustrative">FICTIONAL STUDENT CARD · GAME PROP</div>
          </div>
          <div class="mj-gate-dialogue">
            <div class="mj-gate-dialogue-title" id="mj-gate-dialogue-title">ID VERIFICATION</div>
            <div class="mj-gate-line mj-student" id="mj-gate-student-row">
              <div class="mj-gate-speaker" id="mj-gate-student-speaker">STUDENT</div>
              <div class="mj-gate-message" id="mj-gate-student-msg"></div>
            </div>
            <div class="mj-gate-line mj-guard" id="mj-gate-guard-row">
              <div class="mj-gate-speaker">SECURITY GUARD</div>
              <div class="mj-gate-message" id="mj-gate-guard-msg"></div>
            </div>
            <div class="mj-gate-foot"><span class="mj-gate-dot"></span><span id="mj-gate-foot">Only BRACU has sunshine. Classes still on!</span></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    campusGateOverlay=root;
    return root;
  }
  function updateCampusGateOverlay(){
    const root=campusGateUI(),scene=S.campusGateScene;
    if(S.mode!=='PLAYING'||!scene){
      root.classList.remove('mj-show');campusGateShownKey='';return;
    }
    root.classList.add('mj-show');
    const age=S.time-scene.start;
    const turn=scene.forgotId?Math.min(4,scene.dialogueTurn||0):0;
    const sceneKey=`${scene.index}:${scene.start}:${scene.forgotId}:${turn}`;
    if(sceneKey===campusGateShownKey)return;
    campusGateShownKey=sceneKey;
    const get=id=>root.querySelector('#'+id),meta=fauxBracMeta(scene,scene.index),failed=scene.forgotId;
    const name=String(scene.name||'STUDENT');
    get('mj-gate-heading').textContent=failed?'BRACU SECURITY · ID MISSING':'BRACU SECURITY · ID VERIFIED';
    get('mj-gate-heading').classList.toggle('mj-fail',failed);
    get('mj-gate-card').classList.toggle('mj-fail',failed);
    get('mj-gate-name').textContent=name.toUpperCase();
    get('mj-gate-dept').textContent=meta.dept;
    get('mj-gate-id').textContent=failed?'NOT PROVIDED':meta.gameCode;
    get('mj-gate-validity').textContent=failed?'—':meta.validity;
    get('mj-gate-blood').textContent=failed?'—':meta.blood;
    get('mj-gate-card').style.setProperty('--shirt',[
      '#b84d43','#437f99','#5c9468','#8f67ad','#538d75','#cf837e'
    ][scene.colorId%6]);
    get('mj-gate-card').style.setProperty('--skin',[
      '#c98969','#be8267','#d59a73','#b97c63'
    ][scene.colorId%4]);
    get('mj-gate-student-speaker').textContent=name.toUpperCase();
    const student=get('mj-gate-student-row'),guard=get('mj-gate-guard-row');
    const dialogue=Array.isArray(scene.dialogue)?scene.dialogue:[];
    const current=dialogue[Math.min(scene.dialogueTurn||0,Math.max(0,dialogue.length-1))];
    const isGuard=current?.speaker==='guard';
    get('mj-gate-dialogue-title').textContent=failed?'NO ID, NO ENTRY! 😡':'ID CHECK PASSED';
    // Display only the current line: never claim the student said a different
    // recorded line, and never show a second actor's dialogue in their panel.
    get('mj-gate-student-msg').textContent=isGuard?'…':(current?.text||'…');
    get('mj-gate-guard-msg').textContent=isGuard?(current?.text||'…'):'…';
    student.classList.toggle('mj-dim',isGuard);
    guard.classList.toggle('mj-dim',!isGuard);
    get('mj-gate-foot').textContent=failed?
      'Flood: maximum · University rules: undefeated':
      'Welcome to BRAC University · No flood holidays!';
  }
  let comicView=null,comicProj=null,comicEye=null;
  function draw(){resize();skyColor();const a=S.angle*RAD,c=Math.cos(a),s=Math.sin(a);
    const currentPitch=S.waveStrength*Math.sin(S.bobTime*4.4+S.z*.012)*5.0;
    const currentRoll=S.waveStrength*Math.sin(S.bobTime*3.7+S.x*.014)*7.2;
    const boatPitch=clamp(boatImpact.pitch+currentPitch,-17,17);
    const boatRoll=clamp(boatImpact.roll+currentRoll,-19,19);
    const boatY=12+Math.sin(S.bobTime*2.8)*1.3+
      S.waveStrength*Math.sin(S.bobTime*4.1+S.x*.01)*3.1+boatImpact.heave;
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
    let cameraUp=[0,1,0];
    if(S.mode==='PLAYING'){
      if(!reducedMotion()){
        // Small chase-camera sway, stronger viewpoint tilt from inside hull.
        const pitchFactor=S.camera3?.55:2.2;
        target[1]-=boatPitch*pitchFactor;
        eye[1]+=boatImpact.heave*(S.camera3?.3:.7);
        const cameraRoll=boatRoll*(S.camera3?.12:.55)*RAD;
        cameraUp=[Math.sin(a)*Math.sin(cameraRoll),Math.cos(cameraRoll),-Math.cos(a)*Math.sin(cameraRoll)];
      }
      applyImpactShake(eye,target);
    }
    comicEye=eye.slice();
    comicProj=perspective(fov*RAD,canvas.width/canvas.height,1.2,5100);
    comicView=lookAt(eye,target,cameraUp);
    gl.uniformMatrix4fv(uniforms.proj,false,comicProj);gl.uniformMatrix4fv(uniforms.view,false,comicView);gl.uniform1f(uniforms.time,S.bobTime*.85);
    gl.disable(gl.CULL_FACE);
    if(sourceMeshes){
      for(const group of ['sky','clouds'])render(sourceMeshes[group]); // do not render the source's opaque rectangular sky wall in front of the browser scene
    }
    if(sourceMeshes){
      const powerState=S.powerOff?['central','west','east'][S.powerIndex]:'lit';
      render(sourceMeshes.streets);
      render(sourceMeshes['buildings-'+powerState]);
      render(sourceMeshes.campus);render(sourceMeshes.props);
      // Reconstructed source-derived animated shopkeeper/customer poses.
      for(const style of [0,2]){
        const frame=Math.floor((S.bobTime/2.513)*12)%12;
        render(sourceMeshes[`shoppeople-${style}-${frame}`]);
      }
      // Omit baked streetlamps: the modern geometry below replaces them.
      render(sourceMeshes.landmarks);render(sourceMeshes.dock);
      // Rebuilt parked vehicles are drawn separately below, allowing CNGs and
      // the colorful rickshaw to REPLACE, not overlap, the baked source cars.
      // Omit the old solid-color traffic beacon; draw a realistic signal below.
      render(campusLettering);render(shopSigns);render(cityFacadeDetails);if(!S.powerOff||S.time-powerVisual.repairedAt<3.8)render(cityFacadeLights);
    } else if(!sourceLoadError){
      // While original geometry downloads, render no incorrect placeholder city.
    }
    // Both fixtures use stateful geometry, preserving blackout and signal timing.
    drawStreetLamps(eye[0],eye[2]);
    drawDhakaPowerNeighborhood();
    drawModernTrafficSignal();
    // All stations are live 3D cabinets instead of the old baked source blocks.
    drawPowerCabinets();
    // Semi-transparent animated water is drawn AFTER the original flooded
    // road textures, so lane markings remain visible underneath the surface.
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    render(waterMesh);
    render(currentArrows);
    render(campusGround);
    render(sunshineAura);render(sunshineSun);
    gl.depthMask(true);gl.disable(gl.BLEND);
    // World-space rain is composited over city and water. Small ripples spawn
    // only when a descending world droplet strikes water outside BRACU.
    if(S.mode==='PLAYING'){
      uploadStormRain();gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      render(stormGeometry);
      for(const [splashIndex,splash] of S.rainSplashes.entries()){if(S.quality==='BALANCED'&&splashIndex%2)continue;
        if(distance(S.x,S.z,splash.x,splash.z)>510)continue;
        render(stormSplash,model(splash.x,9.65,splash.z,0,1.8+splash.age*26));
      }
      // Large collision sprays and expanding wake rings; bounded for FPS.
      for(const splash of S.impactSplashes){
        if(distance(S.x,S.z,splash.x,splash.z)>530)continue;
        const age=splash.age,life=1-age/.78;
        const swell=clamp((.54+age*2.2)*splash.power*life,.05,2.4);
        render(impactSprayMesh,model(splash.x,9.8+Math.sin(Math.PI*age/.78)*5,splash.z,age*70,swell));
        render(waterRipple,model(splash.x,9.7,splash.z,0,splash.power*(.65+age*3.1)));
        render(waterRipple,model(splash.x,9.9,splash.z,0,splash.power*(.3+age*2.0)));
      }
      for(const splash of S.waveSplashes){
        if(distance(S.x,S.z,splash.x,splash.z)>490)continue;
        render(waterRipple,model(splash.x,9.6,splash.z,0,.45+splash.age*1.6));
      }
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // Warm light scattering below real lamp fixtures; skip blackout districts.
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    for(const [x,z] of streetlights){if(lightOffAt(x,z)||distance(S.x,S.z,x,z)>680||distance(x,z,0,1378)<378)continue;
      render(litHalo,model(x,113.6,z-33,0,1.08));
      render(lampAirGlow,model(x,95,z-33,0,1.5));
      render(lampGroundGlow,model(x,9.45,z-33,0,1.45));
      render(lampReflection,model(x,9.25,z-33,0,1.18));
    }
    drawPowerCabinetGlow();
    gl.depthMask(true);gl.disable(gl.BLEND);
    // Keep culling disabled for original double-sided OpenGL line/quad geometry.
    // Foreground boat, dynamic light state and localized mission markers.
    // Keep original parked-car collision boxes while changing their visual type.
    for(let i=0;i<parkedCars.length;i++){
      const car=parkedCars[i];
      if(distance(S.x,S.z,car.x,car.z)>1200&&S.mode!=='MENU')continue;
      const type=dhakaVehicleType(i);
      const mesh=type==='cng'?(i===5?parkedDhakaModels.cngAlt:parkedDhakaModels.cng):
        type==='rickshaw'?parkedDhakaModels.rickshaw:parkedDhakaModels.car[i%4];
      render(mesh,model(car.x,0,car.z,car.angle,.97));
    }
    for(const car of S.movingCars){const mesh=sourceMeshes?.['moving-car-'+(car.style%5)]||carMesh;
      render(mesh,model(car.x,0,car.z,car.angle,.98));
      if(!car.stopped){
        const fx=Math.cos(car.angle*RAD),fz=Math.sin(car.angle*RAD);
        for(let n=0;n<3;n++)render(waterRipple,model(car.x-(30+n*20)*fx,9.4,car.z-(30+n*20)*fz,0,.47+n*.27));
      }
    }
    for(const i of [1,4]){const car=parkedCars[i],a=car.angle*RAD;
      const dx=car.x+Math.sin(a)*47,dz=car.z-Math.cos(a)*47;
      const f=Math.floor((S.bobTime*3+i*1.8)/TAU*24)%24;
      render(driverFrames[(f+24)%24],model(dx,9,dz,car.angle,1));
    }
    S.debris.forEach((d,i)=>render(sourceMeshes?.['debris-'+(i%3)]||debrisMesh,model(d.x,0,d.z,(i*57)%360,1)));
    // Waiting students react to both the incoming boat and their remaining time.
    // Their arms are animated mesh poses, with distinct home/SOS movements.
    for(const r of S.rides)if(r.state==='WAITING'){
      const mood=passengerReaction(r),home=r.type==='HOME';
      const kind=(home?'HOME':'SOS')+(mood.energetic?'_URGENT':'');
      const clock=S.time*mood.speed+r.id*.65;
      const bob=(home?.6:1.5)*Math.sin(S.time*(mood.energetic?6.1:3.0)+r.id);
      const y=home?19+bob:10+bob;
      const scale=home?.74:.90;
      render(citizenFrame(kind,r.colorId,clock),model(mood.px,y,mood.pz,mood.facing,scale));
      if(mood.urgent){
        const blink=.8+.22*Math.sin(S.time*9+r.id);
        render(urgencyMarker,model(mood.px,y+(home?47:31)+3*Math.sin(S.time*4+r.id),mood.pz,0,blink));
      }
      if(!home&&mood.responding){
        // Water agitation grows near rescuers or near the deadline.
        const pulse=.55+.18*Math.sin(S.time*(mood.urgent?9:5)+r.id);
        render(waterRipple,model(mood.px,9.75,mood.pz,0,mood.urgent?1.1+pulse:pulse));
      }
      render(markerMesh,model(r.x,3+Math.sin(S.bobTime*4+r.id)*1.5,r.z,0,1));
    }
    // Two independent AI majhis rescue background citizens and leave wakes.
    drawRescueFleet();
    drawRickshawFleet();
    // Independent swimmers, waders, neighbors and rooftop residents.
    drawCityPeople();
    // A stranded tea-stall cat is a small environmental story, not a mission target.
    if(distance(S.x,S.z,-327,832)<760)
      render(dhakaCat,model(-327,49+Math.sin(S.bobTime*1.4)*.3,832,180,.70));
    for(const c of reactiveBystanders){
      const d=distance(S.x,S.z,c.x,c.z);
      if(d>850)continue;
      const alert=d<300;
      const kind=alert?'HOME_URGENT':'HOME';
      const facing=alert?Math.atan2(S.z-c.z,S.x-c.x)/RAD:-90;
      render(citizenFrame(kind,c.colorId,S.time*(alert?2.6:.7)+c.colorId),
        model(c.x,22+.7*Math.sin(S.bobTime*2+c.colorId),c.z,facing,.70));
    }
    if(S.request){/* Offered riders appear on the map, not in the city until accepted. */}
    for(const splash of S.pickupEffects){const age=S.time-splash.at;
      render(waterRipple,model(splash.x,10,splash.z,0,.6+age*1.8));
      render(waterRipple,model(splash.x,10.3,splash.z,0,.35+age*1.15));
    }
    if(!S.photo)render(markerGoal,model(825,1,1080,0,1));
    if(S.powerOff){const p=power[S.powerIndex];render(markerGoal,model(p.x,2,p.z,0,.8));}
    if(sourceMeshes){render(markerGoal,model(0,10,1100,0,1.85));}
    if(S.deliveryBanner&&S.time-S.deliveryBanner.at<2.65){
      const age=S.time-S.deliveryBanner.at;
      for(let k=0;k<3;k++){
        const radius=.8+age*.8+k*.36;
        render(markerGoal,model(0,10.1+k*.1,1100,0,radius));
      }
    }
    // Traffic lights: emissive-like saturated color, red/green changes with the actual timer.
    // Modern three-lens signal is drawn for both source and fallback geometry.
    if(S.mode!=='MENU'){
      if(S.camera3){
        render(sourceMeshes?.boat||boatMesh,rockingBoatModel(S.x,boatY,S.z,S.angle,.62,boatPitch,boatRoll));
        if(sourceMeshes?.captain)render(sourceMeshes.captain,rockingBoatModel(S.x,boatY-12,S.z,S.angle,1,boatPitch,boatRoll));
        if(sourceMeshes){const f=S.rowing?Math.floor((S.strokeTime/0.65)*24)%24:0;render(sourceMeshes['rowing-'+f]||sourceMeshes.paddles,rockingBoatModel(S.x,boatY-12,S.z,S.angle,1,boatPitch,boatRoll));}
      }else{
        // Like the desktop edition, the actual boat is drawn in first person.
        render(sourceMeshes?.boat||boatMesh,rockingBoatModel(S.x,boatY,S.z,S.angle,.62,boatPitch,boatRoll));
        if(sourceMeshes){const f=S.rowing?Math.floor((S.strokeTime/0.65)*24)%24:0;render(sourceMeshes['first-rowing-'+f]||sourceMeshes['firstperson-hands'],rockingBoatModel(S.x,boatY-12,S.z,S.angle,1,boatPitch,boatRoll));}
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
        const scale=S.camera3?.62:.51,seatY=S.camera3?boatY+15:boatY+15;
        render(sourceMeshes?.['student-'+r.colorId]||npcMeshes[r.colorId],
          model(sx,seatY+3*Math.sin(Math.PI*eased),sz,S.angle+(1-settle)*12*(r.boardSide||1),scale));
      });
      // Original BRACU drop-off: students leave their seats and walk to the dock.
      for(const e of S.deliveryEffects){
        const age=S.time+(S.mode==='WON'?S.postWinClock:0)-e.at;
        const walkTime=e.walkTime||1.65,holdTime=e.holdTime||1.15;
        if(age<0||age>walkTime+holdTime+2.0)continue;
        const progress=clamp(age/walkTime,0,1),walk=progress*progress*(3-2*progress);
        const x=e.x0+(e.x1-e.x0)*walk,z=e.z0+(e.z1-e.z0)*walk;
        const celebrating=age>=walkTime;
        const holdAge=Math.max(0,age-walkTime);
        const jump=celebrating?Math.abs(Math.sin(holdAge*4.8))*3.6:8*Math.sin(Math.PI*progress);
        const y=e.y0+(30-e.y0)*walk+jump;
        if(celebrating){
          const pose=(S.campusGateScene&&S.campusGateScene.index===e.entryIndex&&S.campusGateScene.forgotId)?'HOME_URGENT':'CELEBRATE';
          render(citizenFrame(pose,e.colorId,age*3.1+e.colorId),model(x,y,z,-90,.62));
          if(holdAge<holdTime+1.1)for(let k=0;k<3;k++){
            const angle=S.time*2.1+k*TAU/3+e.colorId;
            render(happySparkle,model(x+22*Math.cos(angle),y+26+5*Math.sin(S.time*4+k),z+22*Math.sin(angle),angle/RAD,.45));
          }
        }else render(sourceMeshes?.['student-'+e.colorId]||npcMeshes[e.colorId],model(x,y,z,-12*(1-walk),.50));
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
  if(location.hostname==='localhost'||location.hostname===''){window.majhiTesting={S,step,repair,moveAllowed,carOverlap,recordMissedPassenger,stormDrops,nearDrops,campusRainWeight,driverFrames,streetlights,updateRescueFleet,updateRickshawFleet,respawnFleetCitizen,comicProject,renderComicBubbles,dhakaVehicleType,lightOffAt,districtForX,drawDhakaPowerNeighborhood};}
  window.majhiVersion='fidelity17-80-voices-paired-dialogue';
  window.majhiAudioDiagnostics=()=>gameAudio.getState();
  window.majhiDiagnostics=()=>({x:S.x,z:S.z,angle:S.angle,shopSignVertices:shopSigns.length,wiperAngle:S.wiperAngle,wiperActive:S.wiperActive,screenDrops:S.screenDrops.length,pickupSplashes:S.pickupEffects.length,homeMoorings:homes.map(p=>({name:p.name,x:p.x,z:p.z,relocated:!!p.relocated})),traffic:S.traffic,powerOff:S.powerOff,powerIndex:S.powerIndex,missedEffects:S.missedEffects.map(e=>({...e})),loaded:!!sourceMeshes,geometryNames:Object.keys(sourceMeshes||{}),camera:S.camera3?'third':'first',onboard:seated().length,sunlightBlend:1-clamp((distance(S.x,S.z,0,1378)-365)/230,0,1),wiperGeometry:windshieldBlade(Math.max(1,weather.clientWidth),Math.max(1,weather.clientHeight)),rainSplashes:S.rainSplashes.length,driverAnimations:driverFrames.length,stormDrops:stormDrops.length,litStreetlamps:streetlights.filter(([x,z])=>!lightOffAt(x,z)).length,carStopped:[...S.carStopped],carProgress:[...S.carProgress],waveStrength:S.waveStrength,powerCabinetVertices:powerCabinets.map(m=>m.length),citizenAnimationFrames:REACTION_FRAMES,citizenAnimationStyles:reactionAnimations.length,citizenAnimationVertices:citizenFrames.HOME[0][0].length,waitingEmotions:S.rides.filter(r=>r.state==='WAITING').map(r=>({name:r.name,...passengerReaction(r)})),celebratingPassengers:S.deliveryEffects.filter(e=>S.time-e.at>=1.65).length,powerRepairFX:powerVisual.repairedIndex,backgroundCitizens:S.cityPeople.length,dhakaVehicleTypes:parkedCars.map((_,i)=>dhakaVehicleType(i)),
    movingRickshaws:(S.aiRickshaws||[]).map(r=>({name:r.name,x:r.x,z:r.z,targetId:r.targetId,deliveries:r.deliveries,quarrelling:r.quarrelUntil>S.time})),
    rickshawRescues:S.rickshawRescueCount,rickshawCrashes:S.rickshawCrashCount,
    rickshawQuarrels:(S.rickshawQuarrels||[]).length,
    dhakaCatVertices:dhakaCat.length,dhakaLaptopVertices:dhakaLaptop.length,dhakaRickshawVertices:parkedDhakaModels.rickshaw.length,dhakaCNGVertices:parkedDhakaModels.cng.length,
    balconyCitizens:S.cityPeople.filter(p=>p.role==='BALCONY').length,
    shopCitizens:S.cityPeople.filter(p=>p.role==='SHOP').length,
    ropeCitizens:S.cityPeople.filter(p=>p.role==='ROPE').length,
    poweredWindowGroups:powerWindowPairs.length,swimmers:S.cityPeople.filter(p=>p.role==='SWIM').length,aiRescueBoats:S.aiBoats.map(b=>({name:b.name,x:b.x,z:b.z,targetId:b.targetId,deliveries:b.deliveries})),aiRescued:S.aiRescueCount,respawnPending:S.aiRespawnQueue.length,updatedStreetLamps:streetlights.length,trafficSignalHousingVertices:modernTrafficBody.length,exitGlareInstalled:!!document.getElementById('majhi-exit-flashlight-glare'),impactSplashCount:S.impactSplashes.length,waveSplashCount:S.waveSplashes.length,impactPitch:boatImpact.pitch,impactRoll:boatImpact.roll,passengerTimes:seated().map(r=>({name:r.name,timeLeft:r.timeLeft})),quality:S.quality});
  let last=0,hudClock=0;
  function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(0,(now-last)/1000||0));last=now;
    if(S.mode==='PLAYING'){let t=dt;while(t>0){const d=Math.min(t,.025);step(d);t-=d;}}else {S.bobTime+=dt*.5;if(S.mode==='WON')S.postWinClock=(S.postWinClock||0)+dt;}
    gameAudio.update(dt);
    const frameStart=performance.now();try{draw();renderRain(dt);updateCampusGateOverlay();}catch(e){console.error('Render error:',e);$('error').classList.remove('hidden');S.mode='PAUSED';return;}
    S.frameMS=performance.now()-frameStart;S.frameWorst=Math.max(S.frameWorst*.999,S.frameMS);hudClock+=dt;if(hudClock>.11){hudClock=0;if(S.mode!=='MENU')refreshHUD();}
  }
  // Intensified menu EXIT GAME flashlight gag. Injected here so the existing
  // GitHub Pages HTML/CSS does not need replacing. A single bright bloom is
  // used instead of a strobe; reduced-motion users get a short fade.
  function installExitFlashlightGlare(){
    const overlay=document.createElement('div');
    overlay.id='majhi-exit-flashlight-glare';
    overlay.setAttribute('aria-hidden','true');
    overlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;opacity:0;'+
      'background:radial-gradient(ellipse at var(--glare-x,72%) var(--glare-y,52%),'+
      'rgba(255,255,255,1) 0%,rgba(255,255,255,.99) 17%,'+
      'rgba(255,251,226,.97) 38%,rgba(255,245,200,.82) 58%,'+
      'rgba(255,244,210,.38) 77%,rgba(255,244,218,.10) 100%);'+
      'backdrop-filter:brightness(2.4) saturate(1.35);'+
      'transition:opacity .9s ease-out;';
    document.body.appendChild(overlay);
    let clearHandle=0,removeHandle=0;
    document.addEventListener('click',event=>{
      const el=event.target?.closest?.('button,a,[role="button"]');
      if(!el || S.mode!=='MENU')return;
      const label=[el.id,el.textContent,el.getAttribute('aria-label'),el.dataset?.action].filter(Boolean).join(' ');
      if(!/exit\s*(?:game)?|quit\s*(?:game)?|leave\s*(?:game)?/i.test(label))return;
      gameAudio.exitScare();
      const area=el.getBoundingClientRect();
      const x=area.left+area.width*.5,y=area.top+area.height*.5;
      overlay.style.setProperty('--glare-x',(x/window.innerWidth*100).toFixed(1)+'%');
      overlay.style.setProperty('--glare-y',(y/window.innerHeight*100).toFixed(1)+'%');
      window.clearTimeout(clearHandle);window.clearTimeout(removeHandle);
      overlay.style.transition='none';overlay.style.opacity='1';
      // CSS transition reset prevents a half-visible second activation.
      void overlay.offsetWidth;
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      clearHandle=window.setTimeout(()=>{
        overlay.style.transition=reduced?'opacity .25s ease-out':'opacity 1.55s ease-out';
        overlay.style.opacity='0';
      },reduced?230:1050);
    },true);
  }
  installExitFlashlightGlare();
  gameAudio.initUI();
  // Browser audio is unlocked by a real gesture; no autoplay bypass.
  const enableMenuAudio=()=>{if(S.mode==='MENU')gameAudio.menuBegin();};
  document.addEventListener('pointerdown',enableMenuAudio,{passive:true});
  document.addEventListener('keydown',enableMenuAudio);
  $('play-button').onclick=reset;
  $('help-button').onclick=()=>nextModal('HELP');
  $('camera-button').onclick=()=>action('c');$('pause-button').onclick=togglePause;
  $('accept-button').onclick=accept;$('reject-button').onclick=reject;
  $('modal-main').onclick=()=>{if(S.mode==='WON'||S.mode==='LOST')reset();else $('modal').classList.add('hidden');if(S.mode==='PAUSED')S.mode='PLAYING';};
  $('modal-secondary').onclick=reset;
  document.addEventListener('keydown',e=>{
    const k=e.key===' '?' ':e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','escape','f3','f4'].includes(k))e.preventDefault();
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
