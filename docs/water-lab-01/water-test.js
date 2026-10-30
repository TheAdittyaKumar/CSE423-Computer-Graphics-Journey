/*
 * MAJHI JABEN?! / VISUAL LAB 02
 * Water Lab 01.2: motion-linked wakes, paddle entry ripples, calibrated optics.
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

  // Existing boat/rower geometry is preserved. This version changes only
  // water simulation, optical shading, and controlled horizontal travel.
  const SIM_SIZE = 256;
  const SIM_SPAN = 24.0; // physical area in world units, centered on the boat
  const waterVertex = `#version 300 es
  precision highp float;
  precision highp int;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  uniform mat4 uModel, uView, uProjection;
  uniform float uTime, uWaveScale, uWind;
  uniform highp int uType, uWaterMode;
  uniform sampler2D uRippleTex;
  out vec3 vNormal,vWorld;
  out float vDistance,vWave;
  float heightAt(vec2 uv){
    vec4 c=texture(uRippleTex,clamp(uv,vec2(0.0),vec2(1.0)));
    return (dot(c.rg,vec2(65280.0,255.0))/65535.0)*2.0-1.0;
  }
  void main(){
    vec4 p=uModel*vec4(aPosition,1.0);
    vWave=0.0;
    vec3 normal=normalize(transpose(inverse(mat3(uModel)))*aNormal);
    if(uType==1){
      vec2 uv=p.xz/24.0+0.5;
      float outside=max(abs(uv.x-.5),abs(uv.y-.5))*2.0;
      float fade=1.0-smoothstep(.70,.98,outside);
      float longWave=sin(p.x*.42+p.z*.22-uTime*.65)*.006
        +sin(-p.x*.24+p.z*.39+uTime*.43)*.004;
      if(uWaterMode==1){
        float h=heightAt(uv)*fade;
        vWave=h;
        p.y+=uWaveScale*h+longWave*uWind;
        vec2 off=vec2(1.0/256.0,0.0);
        float dx=(heightAt(uv+off.xy)-heightAt(uv-off.xy))*fade;
        float dz=(heightAt(uv+off.yx)-heightAt(uv-off.yx))*fade;
        normal=normalize(vec3(-dx*uWaveScale*256.0/(2.0*24.0),1.0,
                               -dz*uWaveScale*256.0/(2.0*24.0)));
      }else{
        p.y+=longWave*uWind;
        normal=vec3(0.0,1.0,0.0);
      }
    }
    vNormal=normal;
    vWorld=p.xyz;
    vec4 view=uView*p;
    vDistance=length(view.xyz);
    gl_Position=uProjection*view;
  }`;

  // The GPU simulation writes a *separate*, linearly-filterable normal/height
  // field. A single texture lookup per water pixel preserves fine ripples that
  // are lost when normals are interpolated from low-density water vertices.
  const waterFragment = `#version 300 es
  precision highp float;
  precision highp int;
  in vec3 vNormal,vWorld;
  in float vDistance,vWave;
  uniform vec3 uTint,uCamera;
  uniform float uTime,uReflect,uWind,uWaveScale;
  uniform highp int uType,uWaterMode;
  uniform int uLighting,uDebug;
  uniform sampler2D uSurfaceNormalTex;
  uniform vec4 uFoam[8];  // x,z,visibility,radius in world units
  uniform int uFoamCount;
  out vec4 fragColor;

  float hash21(vec2 p){
    p=fract(p*vec2(123.34,345.45));
    p+=dot(p,p+34.345);
    return fract(p.x*p.y);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
               mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
  }
  vec3 skyColor(vec3 dir){
    float y=clamp(dir.y,-1.0,1.0);
    vec3 horizon=uLighting==0?vec3(.53,.70,.69):vec3(.38,.52,.58);
    vec3 zenith=uLighting==0?vec3(.21,.38,.47):vec3(.25,.35,.43);
    vec3 sky=mix(horizon,zenith,smoothstep(-.02,.88,y));
    // Broad, soft cloudy reflections: no planar repeating diamond pattern.
    vec2 coord=dir.xz/max(.25,dir.y+.65);
    float cloud=noise(coord*1.85+vec2(uTime*.006,-uTime*.004));
    cloud=.65*cloud+.35*noise(coord*4.0+vec2(13.7,8.9));
    float cloudAmount=smoothstep(.50,.78,cloud)*smoothstep(-.06,.32,y);
    sky=mix(sky,vec3(.82,.84,.78),cloudAmount*(uLighting==0?.38:.21));
    vec3 sunDir=normalize(vec3(-.6,1.0,.9));
    float sunGlow=pow(max(0.,dot(dir,sunDir)),70.0);
    sky+=vec3(.65,.50,.25)*sunGlow*(uLighting==0?.29:.07);
    return sky;
  }
  void main(){
    vec3 sun=normalize(uLighting==0?vec3(-.6,1.0,.9):vec3(-.35,1.0,.2));
    vec3 color=uTint;
    if(uType==1){
      vec2 p=vWorld.xz;
      vec2 flow=p*.78+vec2(uTime*.035,-uTime*.051)*uWind;
      float n1=noise(flow*1.29);
      float n2=noise(flow*3.17+vec2(23.1,7.2));
      float n3=noise(flow*7.63+vec2(8.6,34.7));
      if(uWaterMode==1){
        vec2 uv=p/24.0+.5;
        float outside=max(abs(uv.x-.5),abs(uv.y-.5))*2.0;
        float fade=1.0-smoothstep(.74,.98,outside);
        vec4 info=texture(uSurfaceNormalTex,clamp(uv,vec2(.002),vec2(.998)));
        vec2 slope=(info.rg*2.0-1.0)*3.0*fade;
        float height=(info.b*2.0-1.0)*fade;
        // Two drifting wind wave trains, with analytical derivatives.
        float w1=dot(p,vec2(.58,.34))-uTime*.71;
        float w2=dot(p,vec2(-.37,.83))+uTime*.48;
        vec2 windSlope=(vec2(.58,.34)*cos(w1)*.15+
                        vec2(-.37,.83)*cos(w2)*.12)*uWind;
        vec2 noiseSlope=vec2(n1-n2,n3-n1)*.092*uWind;
        vec3 N=normalize(vec3(-(slope.x*(.10+uWaveScale*1.8)+windSlope.x+noiseSlope.x),
                               1.0,
                               -(slope.y*(.10+uWaveScale*1.8)+windSlope.y+noiseSlope.y)));
        if(uDebug==1){
          // Warm red = crest, deep blue = trough, neutral grey = flat.
          float h=clamp(height*13.0,-1.,1.);
          vec3 neutral=vec3(.22,.26,.27);
          vec3 crest=vec3(.91,.42,.20);
          vec3 trough=vec3(.16,.39,.84);
          color=mix(neutral,h>=0.0?crest:trough,abs(h));
        }else if(uDebug==2){
          // RGB normal visualization: surface detail remains readable.
          // Diagnostic contrast is deliberately amplified, not physical normal magnitude.
          vec3 diagnosticN=normalize(vec3(N.x*5.0,max(.15,N.y),N.z*5.0));
          color=diagnosticN*.5+.5;
        }else{
          vec3 V=normalize(uCamera-vWorld);
          float nv=clamp(dot(N,V),0.,1.);
          float fresnel=.025+.975*pow(1.0-nv,5.0);
          vec3 R=reflect(-V,N);
          vec3 reflected=skyColor(R);
          float tiny=(n1-.5)*.055+(n2-.5)*.030+(n3-.5)*.012;
          vec3 deep=vec3(.040,.176,.185);
          vec3 bright=vec3(.085,.295,.289);
          color=mix(deep,bright,clamp(.48+tiny*5.0+height*.09,0.,1.));
          // Schlick Fresnel with some base reflection so it remains legible
          // even when viewed from above (unlike the first lab).
          // Keep glancing reflections but prevent a broad blown-out horizon.
          float reflectAmount=clamp((.055+.51*fresnel)*uReflect,0.,.48);
          color=mix(color,reflected,reflectAmount);
          float shine=pow(max(dot(reflect(-sun,N),V),0.),75.0);
          color+=vec3(.73,.76,.64)*shine*(uLighting==0?.42:.16);
          float rippleGradient=length(slope)*(.10+uWaveScale);
          color+=vec3(.075,.11,.10)*smoothstep(.14,.65,rippleGradient)*.18;
          // Brief, subdued foam/sheen where an actual oar blade contacts water
          // or a moving hull displaces it. No tiled circular white decals.
          float foam=0.0;
          for(int i=0;i<8;i++){
            if(i>=uFoamCount)break;
            vec4 f=uFoam[i];
            float r=length((p-f.xy)/max(f.w,.01));
            float randomEdge=noise(p*8.3+float(i)*13.1);
            foam+=f.z*exp(-2.4*r*r)*(.55+.45*randomEdge);
          }
          color=mix(color,vec3(.59,.75,.69),clamp(foam*.34,0.,.23));
        }
      }else{
        // A/B baseline from Water Lab 01 (do not alter its texture pattern).
        float raw=noise(p*2.7+vec2(uTime*.16,-uTime*.10));
        float small=noise(p*6.8+vec2(-uTime*.18,uTime*.12));
        color=mix(vec3(.036,.18,.22),vec3(.075,.31,.34),
                  clamp(.50+(raw-.5)*.34+(small-.5)*.17,0.,1.));
        if(uLighting==1)color*=.77;
      }
    }else{
      vec3 n=normalize(vNormal);
      float diffuse=max(0.,dot(n,sun));
      float wrapped=clamp(diffuse*.75+.25,0.,1.);
      color*=uLighting==0?(.50+.57*wrapped):(.49+.42*wrapped);
    }
    if(!(uType==1&&uWaterMode==1&&uDebug!=0)){
      vec3 fog=uLighting==0?vec3(.65,.77,.74):vec3(.57,.66,.69);
      color=mix(color,fog,smoothstep(28.,72.,vDistance));
    }
    fragColor=vec4(color,1.);
  }`;

  // GPU wave equation inspired by the uploaded WebGPU pool example's
  // update/drop passes. Two 16-bit signed values are packed into an ordinary
  // RGBA8 texture: RG=height, BA=vertical velocity. That avoids requiring
  // floating-point render-target extensions on GitHub Pages browsers.
  const simVertex = `#version 300 es
    precision highp float;
    out vec2 vUv;
    void main(){
      vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
      vUv=p;
      gl_Position=vec4(p*2.0-1.0,0.0,1.0);
    }`;
  const simCommon = `
    precision highp float;
    precision highp int;
    in vec2 vUv;
    uniform sampler2D uPrevious;
    out vec4 fragColor;
    vec2 packed(float value){
      float v=floor((clamp(value,-1.0,1.0)*.5+.5)*65535.0+.5);
      return vec2(floor(v/256.0),mod(v,256.0))/255.0;
    }
    float unpacked(vec2 bytes){
      return 2.0*(dot(bytes,vec2(65280.0,255.0))/65535.0)-1.0;
    }
    vec2 info(ivec2 at){
      vec4 c=texelFetch(uPrevious,clamp(at,ivec2(0),ivec2(255)),0);
      return vec2(unpacked(c.rg),unpacked(c.ba));
    }
    void outputInfo(float h,float v){fragColor=vec4(packed(h),packed(v));}
  `;
  const simUpdateFragment = `#version 300 es\n${simCommon}
    void main(){
      ivec2 p=ivec2(gl_FragCoord.xy);
      vec2 h=info(p);
      float average=.25*(info(p+ivec2(1,0)).x+info(p-ivec2(1,0)).x+
                         info(p+ivec2(0,1)).x+info(p-ivec2(0,1)).x);
      // Slightly stronger damping: a few small strokes shouldn't create
      // ripples that travel across several boat lengths indefinitely.
      float v=(h.y+(average-h.x)*.34)*.981;
      float newH=(h.x+v)*.992;
      vec2 edge=min(vUv,1.0-vUv);
      float edgeFade=smoothstep(0.0,.055,min(edge.x,edge.y));
      outputInfo(newH*edgeFade,v*edgeFade);
    }`;
  const simDropFragment = `#version 300 es\n${simCommon}
    uniform vec2 uCenter;
    uniform float uRadius,uStrength;
    void main(){
      ivec2 p=ivec2(gl_FragCoord.xy);
      vec2 h=info(p);
      float d=distance(vUv,uCenter);
      float f=clamp(1.0-d/max(.0001,uRadius),0.,1.);
      f=f*f*(3.0-2.0*f);
      outputInfo(h.x+uStrength*f,h.y);
    }`;

  // Original WebGL Water computes a normal field after each wave update.
  // Here we use a separate RGBA8 normal texture with LINEAR filtering:
  //   R/G = encoded height gradient in world units, B = height for debug.
  // This avoids bilinear interpolation on the packed height/velocity bytes.
  const simNormalFragment = `#version 300 es\n${simCommon}
    void main(){
      ivec2 p=ivec2(gl_FragCoord.xy);
      float h=info(p).x;
      float hx=(info(p+ivec2(1,0)).x-info(p-ivec2(1,0)).x)*256.0/(2.0*24.0);
      float hz=(info(p+ivec2(0,1)).x-info(p-ivec2(0,1)).x)*256.0/(2.0*24.0);
      fragColor=vec4(clamp(vec2(hx,hz)/3.0*.5+.5,0.,1.),
                     clamp(h*.5+.5,0.,1.),1.0);
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
    gl.attachShader(program,shader(gl.VERTEX_SHADER,waterVertex));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,waterFragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  } catch(err) { fail('Graphics shader error: '+err.message); return; }
  gl.useProgram(program);
  const uni={
    model:gl.getUniformLocation(program,'uModel'),view:gl.getUniformLocation(program,'uView'),
    proj:gl.getUniformLocation(program,'uProjection'),tint:gl.getUniformLocation(program,'uTint'),
    type:gl.getUniformLocation(program,'uType'),time:gl.getUniformLocation(program,'uTime'),
    lighting:gl.getUniformLocation(program,'uLighting'),
    ripple:gl.getUniformLocation(program,'uRippleTex'),
    waterMode:gl.getUniformLocation(program,'uWaterMode'),
    waveScale:gl.getUniformLocation(program,'uWaveScale'),
    wind:gl.getUniformLocation(program,'uWind'),
    reflections:gl.getUniformLocation(program,'uReflect'),
    camera:gl.getUniformLocation(program,'uCamera'),
    normal:gl.getUniformLocation(program,'uSurfaceNormalTex'),
    debug:gl.getUniformLocation(program,'uDebug'),
    foam:gl.getUniformLocation(program,'uFoam[0]'),
    foamCount:gl.getUniformLocation(program,'uFoamCount')
  };
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // Hand-built curved meshes are deliberately rendered double-sided.
  gl.disable(gl.CULL_FACE);

  // WebGL 2 fullscreen passes: one framebuffer per ping/pong texture.
  function createSimulationProgram(fragmentSource){
    const p=gl.createProgram();
    gl.attachShader(p,shader(gl.VERTEX_SHADER,simVertex));
    gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragmentSource));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    return {program:p,previous:gl.getUniformLocation(p,'uPrevious'),
      center:gl.getUniformLocation(p,'uCenter'),radius:gl.getUniformLocation(p,'uRadius'),
      strength:gl.getUniformLocation(p,'uStrength')};
  }
  let sim;
  try{
    const buffers=[];
    const blank=new Uint8Array(SIM_SIZE*SIM_SIZE*4);
    for(let i=0;i<blank.length;i+=4){blank[i]=128;blank[i+2]=128;}
    for(let i=0;i<2;i++){
      const tex=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,SIM_SIZE,SIM_SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,blank);
      const fb=gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
        throw Error('WebGL 2 ripple framebuffer is incomplete');
      buffers.push({tex,fb});
    }
    sim={buffers,read:0,blank,quad:gl.createVertexArray(),
      update:createSimulationProgram(simUpdateFragment),
      drop:createSimulationProgram(simDropFragment),
      normals:createSimulationProgram(simNormalFragment)};
    const normalTex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,normalTex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,SIM_SIZE,SIM_SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const normalFB=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,normalFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,normalTex,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
      throw Error('Surface-normal framebuffer is incomplete');
    sim.normalTex=normalTex;
    sim.normalFB=normalFB;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.bindVertexArray(null);
    gl.useProgram(program);
  }catch(err){fail('Water simulation setup failed: '+err.message);return;}

  function clearRipples(){
    for(const b of sim.buffers){
      gl.bindTexture(gl.TEXTURE_2D,b.tex);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,SIM_SIZE,SIM_SIZE,gl.RGBA,gl.UNSIGNED_BYTE,sim.blank);
    }
    sim.read=0;
    pendingDrops.length=0;
    foamSpots.length=0;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function simulationPass(effect,center,radius,strength){
    gl.disable(gl.DEPTH_TEST);
    const next=1-sim.read;
    gl.bindFramebuffer(gl.FRAMEBUFFER,sim.buffers[next].fb);
    gl.viewport(0,0,SIM_SIZE,SIM_SIZE);
    gl.useProgram(effect.program);
    gl.bindVertexArray(sim.quad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,sim.buffers[sim.read].tex);
    gl.uniform1i(effect.previous,0);
    if(effect.center){
      gl.uniform2fv(effect.center,center);
      gl.uniform1f(effect.radius,radius);
      gl.uniform1f(effect.strength,strength);
    }
    gl.drawArrays(gl.TRIANGLES,0,3);
    sim.read=next;
  }
  function updateNormalField(){
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,sim.normalFB);
    gl.viewport(0,0,SIM_SIZE,SIM_SIZE);
    gl.useProgram(sim.normals.program);
    gl.bindVertexArray(sim.quad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,sim.buffers[sim.read].tex);
    gl.uniform1i(sim.normals.previous,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }

  const pendingDrops=[];
  const foamSpots=[];
  function addFoam(x,z,amount=.20,radius=.25){
    foamSpots.push({x,z,amount,radius,age:0,lifetime:.55});
    if(foamSpots.length>24)foamSpots.shift();
  }
  function splashAt(x,z,strength=.16,radius=.010){
    const uv=[x/SIM_SPAN+.5,z/SIM_SPAN+.5];
    if(uv[0]>.02&&uv[0]<.98&&uv[1]>.02&&uv[1]<.98)
      pendingDrops.push({uv,strength,radius});
    if(pendingDrops.length>30)pendingDrops.shift();
  }

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
    const m=new Geometry();
    // Dense geometry ONLY within the 24-unit interactive area. Outside that
    // square a coarse outer ring reaches the horizon. No overlapping planes.
    function tile(x0,x1,z0,z1,nx,nz){
      for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
        const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz;
        const dx=(x1-x0)/nx,dz=(z1-z0)/nz;
        m.quad([x,.035,z],[x+dx,.035,z],[x+dx,.035,z+dz],[x,.035,z+dz]);
      }
    }
    tile(-12,12,-12,12,160,160);
    tile(-50,-12,-50,50,16,40);
    tile(12,50,-50,50,16,40);
    tile(-12,12,-50,-12,24,16);
    tile(-12,12,12,50,24,16);
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
  let boatOffsetX=0;
  function draw(mesh,matrix,color,type=0) {
    // Translate the complete boat/rower as one scene object.
    // The water mesh (type 1) always stays fixed in world space.
    if(type!==1 && boatOffsetX!==0){
      matrix=new Float32Array(matrix);
      matrix[12]+=boatOffsetX;
    }
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
  // VISUAL LAB 02.2 — CLOSED HULL + MECHANICAL ROWING
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

  // Visual Lab 02.3 — Closed sampan hull with fitted interior planks.
  // The hull is modeled as a continuous surface, NOT sealed with vertical posts.
  // The two ends meet at a single point in 3D; the bottom, sides and inner
  // floor all rise together so there is no bow/stern slot or upright wall.
  const BOAT_LENGTH=1.94;
  const hullFraction=x=>clamp(Math.abs(x)/BOAT_LENGTH,0,1);
  const hullWidth=x=>{
    const u=hullFraction(x);
    return .82*Math.pow(Math.max(0,1-Math.pow(u,2.65)),.72);
  };
  const hullTop=x=>.805+.24*Math.pow(hullFraction(x),2.2);
  // Bottom rises gently in midship, faster approaching the raised tips.
  const hullRise=x=>Math.pow(hullFraction(x),3.25);
  function hullSection(x,side){
    const u=hullFraction(x),lift=hullRise(x),top=hullTop(x),w=hullWidth(x);
    const rising=y=>mix(y,top,lift);
    const keelY=rising(.185),chineY=rising(.285),shoulderY=rising(.545);
    const floorY=rising(.415);
    return {
      upper:[x,top,side*w],
      shoulder:[x,shoulderY,side*w*.95],
      chine:[x,chineY,side*w*.63],
      keel:[x,keelY,side*w*.18],
      bottomCenter:[x,keelY-.027*(1-lift),0],
      innerTop:[x,top-.050*(1-lift),side*w*.90],
      innerFloor:[x,floorY,side*w*.69],
      floorCenter:[x,floorY+.006*(1-lift),0]
    };
  }
  function makeHull(){
    const outer=new Geometry(),inside=new Geometry(),floor=new Geometry();
    const N=80;
    for(let i=0;i<N;i++){
      const x0=-BOAT_LENGTH+2*BOAT_LENGTH*i/N;
      const x1=-BOAT_LENGTH+2*BOAT_LENGTH*(i+1)/N;
      for(const side of [-1,1]){
        const a=hullSection(x0,side),b=hullSection(x1,side);
        // Smooth multi-chine exterior, including a continuous underside.
        outer.quad(a.upper,b.upper,b.shoulder,a.shoulder);
        outer.quad(a.shoulder,b.shoulder,b.chine,a.chine);
        outer.quad(a.chine,b.chine,b.keel,a.keel);
        outer.quad(a.keel,b.keel,b.bottomCenter,a.bottomCenter);
        // Continuous hollow interior with an inward-wrapped rim.
        inside.quad(a.innerTop,b.innerTop,b.innerFloor,a.innerFloor);
        inside.quad(a.upper,b.upper,b.innerTop,a.innerTop);
        floor.quad(a.floorCenter,b.floorCenter,b.innerFloor,a.innerFloor);
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

  // LAB 02.3: Every interior board must follow the upward-curving inner hull.
  // The old straight rectangular boards sat at y=.407 even when the bow and
  // stern floor rose above them, so they appeared BELOW the hull in side views.
  function interiorY(x){
    return hullSection(x,1).floorCenter[1];
  }
  function makeFollowHullBoards(){
    const pieces=[];
    const seams=new Geometry();
    const count=16,limit=BOAT_LENGTH-.065;
    const start=-limit,step=2*limit/count;
    const segments=5;
    const surface=(x,zsign,offset)=>[
      x,interiorY(x)+offset,zsign*hullWidth(x)*.61
    ];
    for(let i=0;i<count;i++){
      const g=new Geometry();
      const x0=start+i*step;
      for(let j=0;j<segments;j++){
        const a=x0+step*j/segments;
        const b=x0+step*(j+1)/segments;
        const A=surface(a,-1,.019),B=surface(b,-1,.019);
        const C=surface(b,1,.019),D=surface(a,1,.019);
        g.quad(A,B,C,D);
        // Thin visible board edges, following the interior contour.
        const A0=surface(a,-1,.002),B0=surface(b,-1,.002);
        const C0=surface(b,1,.002),D0=surface(a,1,.002);
        g.quad(A,A0,B0,B);
        g.quad(C,D,D0,C0);
      }
      pieces.push(g.upload());
      if(i>0){
        const a=x0-.008,b=x0+.008;
        seams.quad(surface(a,-1,.025),surface(b,-1,.025),
                   surface(b,1,.025),surface(a,1,.025));
      }
    }
    return {pieces,seams:seams.upload()};
  }
  const fittedBoards=makeFollowHullBoards();

  // The center reinforcement also bends upward and terminates inside the tips.
  function makeFittedSpine(){
    const g=new Geometry(),n=60,limit=BOAT_LENGTH-.16;
    for(let i=0;i<n;i++){
      const a=-limit+2*limit*i/n,b=-limit+2*limit*(i+1)/n;
      const at=(x,z,y)=>[x,interiorY(x)+y,z];
      g.quad(at(a,-.031,.040),at(b,-.031,.040),
             at(b,.031,.040),at(a,.031,.040));
    }
    return g.upload();
  }
  const fittedSpine=makeFittedSpine();

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

    // Fitted planks follow the hull's actual inner floor in all six views.
    fittedBoards.pieces.forEach((mesh,i)=>draw(mesh,mat(),
      i%4===0?wood.inner:color.plank));
    draw(fittedBoards.seams,mat(),wood.seam);
    // A lower, more believable seated rowing bench, supported by two feet.
    for(const side of [-1,1])box([-.48,.51,side*.48],wood.rib,[.115,.23,.13]);
    box([-.48,.638,0],wood.edge,[.45,.078,1.28]);
    box([-.48,.609,0],wood.rib,[.46,.075,1.30]);
    box([-.48,.662,0],color.plank,[.44,.055,1.27]);

    // Center strip and ribs follow the same rising interior surface.
    draw(fittedSpine,mat(),wood.seam);
    for(const x of [-1.28,-.87,.35,.91,1.29]){
      const w=hullWidth(x),base=interiorY(x)+.045;
      box([x,base,0],wood.rib,[.075,.07,w*1.30]);
      for(const side of [-1,1]){
        bone([x,base,side*w*.64],
             [x,hullTop(x)-.13,side*w*.90],.028,wood.rib);
      }
    }
    // Small rounded tip caps where the existing gunwale rails converge.
    // These are NOT hull-closure posts: the 3D hull itself is watertight.
    for(const end of [-1,1]){
      ball([end*BOAT_LENGTH,hullTop(end*BOAT_LENGTH),0],wood.edge,[.042,.043,.046]);
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
    closeup:{yaw:.36,pitch:.12,distance:2.55,target:[-.45,1.55,0]},
    surface:{yaw:.60,pitch:.82,distance:7.8,target:[1.35,.035,1.4]}
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
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>7)pointer.moved=true;
    cam.yaw-=dx*.007;
    cam.pitch=clamp(cam.pitch+dy*.006,-.12,1.39);
    pointer.x=e.clientX;pointer.y=e.clientY;
    document.querySelectorAll('.view-btn').forEach(btn=>{btn.classList.remove('active');btn.setAttribute('aria-pressed','false');});
  });
  const release=e=>{
    if(!pointer||e.pointerId!==pointer.id)return;
    const wasClick=!pointer.moved;
    pointer=null;
    if(wasClick){
      const bounds=canvas.getBoundingClientRect();
      const nx=((e.clientX-bounds.left)/bounds.width)*2-1;
      const ny=1-((e.clientY-bounds.top)/bounds.height)*2;
      const horiz=cam.distance*Math.cos(cam.pitch);
      const eye=[cam.target[0]+horiz*Math.cos(cam.yaw),
        cam.target[1]+cam.distance*Math.sin(cam.pitch),
        cam.target[2]+horiz*Math.sin(cam.yaw)];
      const forward=unit(sub(cam.target,eye));
      const right=unit(cross(forward,[0,1,0]));
      const up=unit(cross(right,forward));
      const tangent=Math.tan(PI/6);
      const ray=unit(add(forward,add(mul(right,nx*tangent*canvas.width/canvas.height),
                                      mul(up,ny*tangent))));
      if(ray[1]<-.001){
        const distance=(.045-eye[1])/ray[1];
        if(distance>0){
          const hit=add(eye,mul(ray,distance));
          splashAt(hit[0],hit[2],.26,.014);
          addFoam(hit[0],hit[2],.13,.18);
        }
      }
    }
  };
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('wheel',e=>{e.preventDefault();cam.distance=clamp(cam.distance*Math.exp(e.deltaY*.001),1.8,14);},{passive:false});

  const state={phase:0,speed:1,running:true,lighting:0,showRig:false,showWater:true,mode:1,debug:0,rain:.22,wake:.72,wave:.38,wind:.52,reflections:.85,travel:0};
  // Boat motion is an explicit experiment, rather than a perpetual fake wake.
  // This slider is inserted beside the existing wake slider: no HTML/CSS edits.
  const travelLabel=document.createElement('div');
  travelLabel.className='slider-label';
  const travelTitle=document.createElement('label');
  travelTitle.htmlFor='travelSlider';
  travelTitle.textContent='Boat movement';
  const travelValue=document.createElement('output');
  travelValue.id='travelSliderValue';
  travelValue.textContent='0% (still)';
  travelLabel.append(travelTitle,travelValue);
  const travelSlider=document.createElement('input');
  travelSlider.type='range';
  travelSlider.id='travelSlider';
  travelSlider.min='0';travelSlider.max='100';travelSlider.value='0';
  $('wakeSlider').after(travelLabel,travelSlider);
  travelSlider.addEventListener('input',()=>{
    state.travel=Number(travelSlider.value)/100;
    travelValue.textContent=state.travel===0?'0% (still)':travelSlider.value+'%';
  });
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
  for(const [id,key,max] of [
    ['rainSlider','rain',100],['wakeSlider','wake',100],
    ['waveSlider','wave',100],['windSlider','wind',100],
    ['reflectionSlider','reflections',100]
  ]){
    const input=$(id),output=$(id+'Value');
    input.addEventListener('input',()=>{
      state[key]=Number(input.value)/max;
      output.textContent=input.value+'%';
    });
  }
  function setDebug(mode){
    state.debug=mode;
    document.querySelectorAll('.debug-btn').forEach(btn=>{
      const on=Number(btn.dataset.debug)===mode;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    $('debugExplanation').textContent=mode===0
      ? 'Shaded water: height changes become lighting and reflective highlights.'
      :mode===1
      ? 'Crest = warm orange, trough = blue, flat water = grey. Click to inject waves.'
      : 'RGB surface normals: tilted water changes the surface color. This is computed on the GPU.';
  }
  document.querySelectorAll('.debug-btn').forEach(btn=>
    btn.addEventListener('click',()=>setDebug(Number(btn.dataset.debug))));

  function updateMode(){
    if(state.mode===0 && state.debug!==0)setDebug(0);
    document.querySelectorAll('.debug-btn').forEach(btn=>{
      btn.disabled=state.mode===0 && Number(btn.dataset.debug)!==0;
    });
    $('modeSim').classList.toggle('active',state.mode===1);
    $('modeClassic').classList.toggle('active',state.mode===0);
    $('modeSim').setAttribute('aria-pressed',String(state.mode===1));
    $('modeClassic').setAttribute('aria-pressed',String(state.mode===0));
    $('modeDescription').textContent=state.mode===1
      ? 'GPU height and velocity ripples · paddle splashes · hull wake · rain'
      : 'Previous noise-based water for an immediate side-by-side comparison';
  }
  $('modeSim').addEventListener('click',()=>{state.mode=1;updateMode();});
  $('modeClassic').addEventListener('click',()=>{state.mode=0;updateMode();});
  $('resetWater').addEventListener('click',clearRipples);
  $('centerDrop').addEventListener('click',()=>{splashAt(2.4,1.0,.27,.015);addFoam(2.4,1.0,.20,.22);});
  updateMode();

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
  let boatX=0,boatDirection=1,lastOarDrop=-10,lastWake=-10,rainAccumulator=0;
  let simAccumulator=0;
  // The blade's outer segment crosses the surface only during catch/drive.
  // Compute the *actual* intersection with the still-water level.
  function paddleContact(pose){
    const a=pose.bladeStart,b=pose.bladeEnd;
    const level=.040;
    if((a[1]-level)*(b[1]-level)>0)return null;
    const f=clamp((level-a[1])/(b[1]-a[1]),0,1);
    return [mix(a[0],b[0],f)+boatX,mix(a[2],b[2],f)];
  }
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
      let actualSpeed=0;
      if(state.running && state.travel>.001){
        // Demonstration travel: move for real, then reverse within the GPU
        // simulation area. The directional wake changes sides on reversal.
        const speed=1.65*state.travel;
        const next=boatX+boatDirection*speed*dt;
        if(next>3.5){boatX=3.5;boatDirection=-1;}
        else if(next< -3.5){boatX=-3.5;boatDirection=1;}
        else boatX=next;
        actualSpeed=speed*boatDirection;
      }
      // The simulation continues settling even if the majhi is paused.
      if(state.mode===1 && state.showWater){
        if(state.running && state.phase>=.10 && state.phase<.53 &&
           seconds-lastOarDrop>.105){
          lastOarDrop=seconds;
          for(const side of [-1,1]){
            const contact=paddleContact(oarPose(state.phase,side));
            if(contact){
              const [x,z]=contact;
              splashAt(x,z,.028+.040*state.wave,.0085);
              addFoam(x,z,.29,.19);
            }
          }
        }
        // Wake only while physically moving, attached to the back corners.
        if(Math.abs(actualSpeed)>.04 && state.wake>.005 &&
           seconds-lastWake>.115){
          lastWake=seconds;
          const behind=actualSpeed>0?-1:1;
          const intensity=Math.abs(actualSpeed)/1.65;
          for(const side of [-1,1]){
            const x=boatX+behind*(1.15+(Math.random()-.5)*.12);
            const z=side*(.23+.08*Math.random());
            splashAt(x,z,(.018+.040*intensity)*state.wake,.009);
            addFoam(x,z,.13*intensity*state.wake,.22);
          }
        }
        if(state.rain>.005){
          rainAccumulator+=dt*(1.0+19.0*state.rain);
          let count=0;
          while(rainAccumulator>=1 && count++<3){
            rainAccumulator-=1;
            splashAt((Math.random()-.5)*SIM_SPAN*.80,
                     (Math.random()-.5)*SIM_SPAN*.80,
                     .018+state.rain*.025,.005);
          }
        }
        // Fixed-rate ping-pong steps: consistent ripple propagation at 30,
        // 60 or 120 FPS, independent of how fast the canvas draws.
        simAccumulator=Math.min(simAccumulator+dt,.05);
        let steps=0;
        while(simAccumulator>=1/60 && steps++<3){
          simulationPass(sim.update);
          simulationPass(sim.update);
          simAccumulator-=1/60;
        }
        for(let i=0;i<Math.min(8,pendingDrops.length);i++){
          const d=pendingDrops.shift();
          simulationPass(sim.drop,d.uv,d.radius,d.strength);
        }
      } else if(pendingDrops.length>30)pendingDrops.splice(0,pendingDrops.length-30);
      for(let i=foamSpots.length-1;i>=0;i--){
        foamSpots[i].age+=dt;
        if(foamSpots[i].age>=foamSpots[i].lifetime)foamSpots.splice(i,1);
      }
      if(state.mode===1)updateNormalField();
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.useProgram(program);
      gl.enable(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,sim.buffers[sim.read].tex);
      gl.uniform1i(uni.ripple,0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,sim.normalTex);
      gl.uniform1i(uni.normal,1);
      gl.uniform1i(uni.debug,state.debug);
      const activeFoam=foamSpots.slice(-8);
      const foamData=new Float32Array(32);
      for(let i=0;i<activeFoam.length;i++){
        const f=activeFoam[i];
        foamData.set([f.x,f.z,f.amount*(1-f.age/f.lifetime),f.radius],i*4);
      }
      gl.uniform1i(uni.foamCount,activeFoam.length);
      gl.uniform4fv(uni.foam,foamData);
      gl.uniform1i(uni.waterMode,state.mode);
      gl.uniform1f(uni.waveScale,state.wave*.55);
      gl.uniform1f(uni.wind,state.wind);
      gl.uniform1f(uni.reflections,state.reflections);
      gl.clearColor(...(state.lighting===0?[.63,.76,.73,1]:[.52,.63,.68,1]));
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      const horiz=cam.distance*Math.cos(cam.pitch);
      const eye=[cam.target[0]+horiz*Math.cos(cam.yaw),cam.target[1]+cam.distance*Math.sin(cam.pitch),cam.target[2]+horiz*Math.sin(cam.yaw)];
      gl.uniformMatrix4fv(uni.view,false,lookAt(eye,cam.target));
      gl.uniformMatrix4fv(uni.proj,false,perspective(PI/3,canvas.width/canvas.height,.04,100));
      gl.uniform1f(uni.time,seconds);
      gl.uniform1i(uni.lighting,state.lighting);
      gl.uniform3fv(uni.camera,eye);
      if(state.showWater)draw(water,mat(),[.08,.25,.28],1);
      boatOffsetX=boatX;
      // Keep the backdrop out of this focused mechanical inspection.
      // Dhaka architecture will have its own separate visual lab.
      drawBoat();
      drawMajhi(state.phase,state.showRig);
      gl.bindVertexArray(null);
      status.textContent='WebGL 2 active · Water Lab 01.2 ready';
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
