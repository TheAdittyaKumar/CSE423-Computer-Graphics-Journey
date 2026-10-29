
/*
 * MAJHI JABEN?! / VISUAL LAB 02
 * Standalone WebGL 2 character-and-rowing inspection scene.
 * No dependencies, downloads, build step, or changes to the main game.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('scene');
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    depth: true,
    alpha: false
  });
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
  const cross = (a, b) => [
    a[1]*b[2]-a[2]*b[1],
    a[2]*b[0]-a[0]*b[2],
    a[0]*b[1]-a[1]*b[0]
  ];
  const unit = v => mul(v, 1 / (Math.hypot(...v) || 1));
  const mid = (a, b) => mul(add(a, b), .5);

  function fail(message) {
    status.textContent = '3D preview unavailable';
    errorMessage.textContent = message;
    errorPanel.hidden = false;
  }

  if (!gl) {
    fail('WebGL 2 is not enabled in this browser. Try Chrome or Edge with hardware acceleration enabled.');
    return;
  }

  // VERTEX SHADER
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
    vNormal = normalize(mat3(uModel) * aNormal);

    vec4 view = uView * p;
    vDistance = length(view.xyz);
    gl_Position = uProjection * view;
  }`;

  // FRAGMENT SHADER
  const fragment = `#version 300 es
  precision highp float;

  in vec3 vNormal, vWorld;
  in float vDistance;

  uniform vec3 uTint;
  uniform float uTime;
  uniform highp int uType;
  uniform int uLighting;

  out vec4 fragColor;

  float hash21(vec2 p) {
    p = fract(p*vec2(123.34,345.45));
    p += dot(p,p+34.345);
    return fract(p.x*p.y);
  }

  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);

    return mix(
      mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
      mix(
        hash21(i+vec2(0.,1.)),
        hash21(i+vec2(1.,1.)),
        f.x
      ),
      f.y
    );
  }

  void main() {
    vec3 color=uTint;

    vec3 sun = normalize(
      uLighting==0
        ? vec3(-.6,1.0,.9)
        : vec3(-.35,1.0,.2)
    );

    if (uType == 1) {
      vec2 p=vWorld.xz;

      float n1=noise(
        p*2.7+vec2(uTime*.16,-uTime*.10)
      );

      float n2=noise(
        p*6.8+vec2(-uTime*.18,uTime*.12)
      );

      float n3=noise(
        p*14.0-vec2(uTime*.11,uTime*.20)
      );

      float dx=(
        noise(
          (p+vec2(.065,0.))*2.7+
          vec2(uTime*.16,-uTime*.10)
        )-n1
      )*.23;

      float dz=(
        noise(
          (p+vec2(0.,.065))*2.7+
          vec2(uTime*.16,-uTime*.10)
        )-n1
      )*.23;

      vec3 normal=normalize(vec3(-dx,1.,-dz));

      float highlight=pow(
        max(
          dot(
            reflect(-sun,normal),
            normalize(vec3(0.,1.0,.42))
          ),
          0.
        ),
        38.
      );

      float detail=
        (n1-.5)*.052+
        (n2-.5)*.035+
        (n3-.5)*.014;

      color=mix(
        vec3(.036,.18,.22),
        vec3(.075,.31,.34),
        clamp(.50+detail*7.0,0.,1.)
      );

      color+=vec3(.10,.17,.15)*highlight*.50;

      if(uLighting==1) color*=.77;

    } else {
      vec3 n=normalize(vNormal);
      float diffuse=max(0.,dot(n,sun));
      float wrapped=clamp(diffuse*.75+.25,0.,1.);

      color*=uLighting==0
        ? (.50+.57*wrapped)
        : (.49+.42*wrapped);

      color+=vec3(.08,.09,.085)*
        pow(
          max(
            dot(
              reflect(-sun,n),
              vec3(0.,1.,0.)
            ),
            0.
          ),
          18.
        )*.09;
    }

    vec3 fog=uLighting==0
      ? vec3(.65,.77,.74)
      : vec3(.57,.66,.69);

    color=mix(
      color,
      fog,
      smoothstep(21.,70.,vDistance)
    );

    fragColor=vec4(color,1.);
  }`;

  // SHADER COMPILATION
  function shader(kind, src) {
    const s=gl.createShader(kind);

    gl.shaderSource(s,src);
    gl.compileShader(s);

    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
      throw Error(gl.getShaderInfoLog(s));
    }

    return s;
  }

  let program;

  try {
    program=gl.createProgram();

    gl.attachShader(
      program,
      shader(gl.VERTEX_SHADER,vertex)
    );

    gl.attachShader(
      program,
      shader(gl.FRAGMENT_SHADER,fragment)
    );

    gl.linkProgram(program);

    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      throw Error(gl.getProgramInfoLog(program));
    }

  } catch(err) {
    fail('Graphics shader error: '+err.message);
    return;
  }

  gl.useProgram(program);

  const uni={
    model:gl.getUniformLocation(program,'uModel'),
    view:gl.getUniformLocation(program,'uView'),
    proj:gl.getUniformLocation(program,'uProjection'),
    tint:gl.getUniformLocation(program,'uTint'),
    type:gl.getUniformLocation(program,'uType'),
    time:gl.getUniformLocation(program,'uTime'),
    lighting:gl.getUniformLocation(program,'uLighting')
  };

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);

  // GEOMETRY BUILDER
  class Geometry {
    constructor() {
      this.vertices=[];
    }

    tri(a,b,c) {
      const n=unit(
        cross(sub(b,a),sub(c,a))
      );

      for(const p of [a,b,c]) {
        this.vertices.push(...p,...n);
      }
    }

    quad(a,b,c,d) {
      this.tri(a,b,c);
      this.tri(a,c,d);
    }

    upload() {
      const data=new Float32Array(this.vertices);

      const vao=gl.createVertexArray();
      const vbo=gl.createBuffer();

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER,vbo);

      gl.bufferData(
        gl.ARRAY_BUFFER,
        data,
        gl.STATIC_DRAW
      );

      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(
        0,3,gl.FLOAT,false,24,0
      );

      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(
        1,3,gl.FLOAT,false,24,12
      );

      gl.bindVertexArray(null);

      return {
        vao,
        count:data.length/6
      };
    }
  }

  // PRIMITIVE MESHES
  function sphereGeo(rings=14,slices=22) {
    const m=new Geometry();

    for(let j=0;j<rings;j++) {
      const lo=-PI/2+j*PI/rings;
      const hi=-PI/2+(j+1)*PI/rings;

      for(let i=0;i<slices;i++) {
        const a=i*TAU/slices;
        const b=(i+1)*TAU/slices;

        const p=(t,v)=>[
          Math.cos(t)*Math.cos(v),
          Math.sin(t),
          Math.cos(t)*Math.sin(v)
        ];

        m.quad(
          p(lo,a),p(lo,b),
          p(hi,b),p(hi,a)
        );
      }
    }

    return m.upload();
  }

  function cylinderGeo(n=16) {
    const m=new Geometry();

    for(let k=0;k<n;k++) {
      const a=k*TAU/n;
      const b=(k+1)*TAU/n;

      const p=(angle,y)=>[
        Math.cos(angle),
        y,
        Math.sin(angle)
      ];

      m.quad(
        p(a,-.5),p(b,-.5),
        p(b,.5),p(a,.5)
      );

      m.tri(
        [0,.5,0],
        p(a,.5),
        p(b,.5)
      );

      m.tri(
        [0,-.5,0],
        p(b,-.5),
        p(a,-.5)
      );
    }

    return m.upload();
  }

  function cubeGeo() {
    const m=new Geometry();

    const p=[
      [-.5,-.5,-.5],
      [.5,-.5,-.5],
      [.5,.5,-.5],
      [-.5,.5,-.5],
      [-.5,-.5,.5],
      [.5,-.5,.5],
      [.5,.5,.5],
      [-.5,.5,.5]
    ];

    const faces=[
      [0,1,2,3],
      [5,4,7,6],
      [4,0,3,7],
      [1,5,6,2],
      [3,2,6,7],
      [4,5,1,0]
    ];

    for(const f of faces) {
      m.quad(...f.map(i=>p[i]));
    }

    return m.upload();
  }

  function waterGeo() {
    const m=new Geometry();
    const N=72;
    const SIZE=42;

    for(let i=0;i<N;i++) {
      for(let j=0;j<N;j++) {
        const x=-SIZE/2+i*SIZE/N;
        const z=-SIZE/2+j*SIZE/N;
        const d=SIZE/N;

        m.quad(
          [x,.035,z],
          [x+d,.035,z],
          [x+d,.035,z+d],
          [x,.035,z+d]
        );
      }
    }

    return m.upload();
  }

  const sphere=sphereGeo();
  const cylinder=cylinderGeo();
  const cube=cubeGeo();
  const water=waterGeo();

  // MODEL TRANSFORMATIONS
  function mat(
    position=[0,0,0],
    scale=[1,1,1]
  ) {
    return new Float32Array([
      scale[0],0,0,0,
      0,scale[1],0,0,
      0,0,scale[2],0,
      position[0],position[1],position[2],1
    ]);
  }

  function between(a,b,radiusX,radiusZ=radiusX) {
    const direction=unit(sub(b,a));

    const seed=Math.abs(direction[2])>.94
      ? [1,0,0]
      : [0,0,1];

    const axisX=unit(cross(seed,direction));
    const axisZ=unit(cross(axisX,direction));

    const len=Math.hypot(...sub(b,a));
    const center=mid(a,b);

    return new Float32Array([
      ...mul(axisX,radiusX),0,
      ...mul(direction,len),0,
      ...mul(axisZ,radiusZ),0,
      ...center,1
    ]);
  }

  function draw(mesh,matrix,color,type=0) {
    gl.uniformMatrix4fv(
      uni.model,false,matrix
    );

    gl.uniform3fv(
      uni.tint,color
    );

    gl.uniform1i(
      uni.type,type
    );

    gl.bindVertexArray(mesh.vao);

    gl.drawArrays(
      gl.TRIANGLES,
      0,
      mesh.count
    );
  }

  const ball=(at,rgb,sc=[1,1,1])=>
    draw(sphere,mat(at,sc),rgb);

  const box=(at,rgb,sc)=>
    draw(cube,mat(at,sc),rgb);

  const bone=(a,b,r,c,r2=r)=>
    draw(
      cylinder,
      between(a,b,r,r2),
      c
    );

  // MATERIAL PALETTE
  const color={
    hull:[.087,.27,.30],
    hullDark:[.045,.18,.21],
    rim:[.61,.37,.18],
    trim:[.86,.59,.29],
    plank:[.67,.42,.22],
    plankAlt:[.51,.32,.18],

    skin:[.57,.37,.25],
    skinLight:[.68,.46,.30],
    hair:[.067,.062,.057],

    shirt:[.20,.51,.49],
    shirtShade:[.14,.39,.39],

    trousers:[.19,.23,.27],
    lungi:[.29,.32,.39],
    sandals:[.16,.13,.11],

    eye:[.075,.065,.058],
    white:[.90,.89,.80],
    metal:[.25,.30,.30],
    rope:[.65,.48,.24],

    brick:[.43,.33,.29],
    brick2:[.50,.37,.29],
    concrete:[.51,.53,.50]
  };

  // CURVED WOODEN BOAT
  function hullGeo() {
    const surface=new Geometry();
    const floor=new Geometry();
    const N=34;

    const width=x=>
      .13+.72*Math.pow(
        Math.max(
          0,
          1-Math.pow(Math.abs(x)/1.85,2.6)
        ),
        .71
      );

    const height=x=>
      .94+.15*Math.pow(
        Math.abs(x)/1.85,
        1.6
      );

    for(let i=0;i<N;i++) {
      const a=-1.85+3.7*i/N;
      const b=-1.85+3.7*(i+1)/N;

      for(const side of [-1,1]) {
        const wa=width(a)*side;
        const wb=width(b)*side;
        const ya=height(a);
        const yb=height(b);

        const outerA=[a,ya,wa];
        const outerB=[b,yb,wb];

        const chineA=[
          a,
          .28+.19*Math.pow(Math.abs(a)/1.85,2),
          wa*.83
        ];

        const chineB=[
          b,
          .28+.19*Math.pow(Math.abs(b)/1.85,2),
          wb*.83
        ];

        const bottomA=[
          a,
          .16+.20*Math.pow(Math.abs(a)/1.85,2),
          wa*.25
        ];

        const bottomB=[
          b,
          .16+.20*Math.pow(Math.abs(b)/1.85,2),
          wb*.25
        ];

        surface.quad(
          outerA,outerB,chineB,chineA
        );

        surface.quad(
          chineA,chineB,bottomB,bottomA
        );

        surface.quad(
          outerB,outerA,
          [a,.44,wa*.77],
          [b,.44,wb*.77]
        );

        floor.quad(
          [a,.44,0],
          [b,.44,0],
          [b,.44,wb*.76],
          [a,.44,wa*.76]
        );
      }
    }

    return {
      surface:surface.upload(),
      floor:floor.upload(),
      width,
      height
    };
  }

  const hull=hullGeo();

  function hullRailsGeo() {
    const rail=new Geometry();
    const n=40;

    for(let s of [-1,1]) {
      for(let k=0;k<n;k++) {
        const x0=-1.86+3.72*k/n;
        const x1=-1.86+3.72*(k+1)/n;

        const w0=hull.width(
          clamp(x0,-1.85,1.85)
        )*s;

        const w1=hull.width(
          clamp(x1,-1.85,1.85)
        )*s;

        const y0=hull.height(
          clamp(x0,-1.85,1.85)
        );

        const y1=hull.height(
          clamp(x1,-1.85,1.85)
        );

        rail.quad(
          [x0,y0,w0-.045],
          [x1,y1,w1-.045],
          [x1,y1+.065,w1+.045],
          [x0,y0+.065,w0+.045]
        );
      }
    }

    return rail.upload();
  }

  const rail=hullRailsGeo();

  function drawBoat() {
    draw(
      hull.surface,
      mat(),
      color.hull
    );

    draw(
      hull.floor,
      mat(),
      color.plankAlt
    );

    draw(
      rail,
      mat(),
      color.trim
    );

    // Visible interior wooden planks
    for(let i=0;i<12;i++) {
      const x=-1.48+i*.265;
      const width=hull.width(x);

      box(
        [x,.455,0],
        i%3?color.plank:color.plankAlt,
        [.19,.045,width*1.52]
      );

      if(i%3===0) {
        box(
          [x,.482,0],
          color.hullDark,
          [.012,.012,width*1.44]
        );
      }
    }

    // Rowing seat
    box(
      [-.49,.645,0],
      color.plank,
      [.43,.095,1.18]
    );

    box(
      [-.49,.58,0],
      color.hullDark,
      [.45,.07,1.24]
    );

    // Trim details
    for(const side of [-1,1]) {
      for(const x of [
        -1.27,-.79,.08,.69,1.17
      ]) {
        ball(
          [
            x,
            .91,
            side*hull.width(x)
          ],
          color.trim,
          [.055,.045,.055]
        );
      }
    }

    // Fixed oarlocks
    for(const side of [-1,1]) {
      bone(
        [-.15,.96,side*.76],
        [-.15,1.12,side*.76],
        .065,
        color.metal
      );

      ball(
        [-.15,1.10,side*.76],
        color.rope,
        [.085,.085,.085]
      );
    }

    // Cross braces
    for(const x of [
      -1.20,.65,1.25
    ]) {
      box(
        [x,.53,0],
        color.plankAlt,
        [
          .11,
          .09,
          hull.width(x)*1.55
        ]
      );
    }

    // Bow cap
    ball(
      [1.78,1.04,0],
      color.trim,
      [.12,.095,.16]
    );
  }

  // ROWING ANIMATION
  function oarPose(t,side) {
    /*
      Continuous rowing cycle:
      0.00-0.08 Catch
      0.08-0.52 Drive
      0.52-0.66 Release
      0.66-1.00 Recovery
    */

    let sweep,lift;

    if(t<.08) {
      const u=smooth(t/.08);

      sweep=mix(.37,.31,u);
      lift=mix(-.27,-.57,u);

    } else if(t<.52) {
      const u=smooth(
        (t-.08)/.44
      );

      sweep=mix(.31,-.38,u);
      lift=-.57;

    } else if(t<.66) {
      const u=smooth(
        (t-.52)/.14
      );

      sweep=mix(-.38,-.33,u);
      lift=mix(-.57,-.11,u);

    } else {
      const u=smooth(
        (t-.66)/.34
      );

      sweep=mix(-.33,.37,u);
      lift=mix(-.11,-.27,u);
    }

    const pivot=[
      -.15,
      1.10,
      side*.76
    ];

    const direction=unit([
      sweep,
      lift,
      side*1.0
    ]);

    const grip=add(
      pivot,
      mul(direction,-.58)
    );

    const end=add(
      pivot,
      mul(direction,2.0)
    );

    const bladeA=add(
      pivot,
      mul(direction,1.64)
    );

    const bladeB=add(
      pivot,
      mul(direction,2.27)
    );

    return {
      pivot,
      grip,
      end,
      bladeA,
      bladeB
    };
  }

  // MAJHI CHARACTER + CONNECTED OARS
  function drawRowing(t,showRig) {
    const drive=Math.sin(t*TAU);
    const lean=.06*drive;

    const hip=[-.50,.83,0];

    const chest=[
      -.48+lean,
      1.39,
      0
    ];

    // Lower body
    ball(
      hip,
      color.lungi,
      [.30,.21,.31]
    );

    // Torso
    ball(
      chest,
      color.shirt,
      [.31,.39,.32]
    );

    ball(
      [chest[0]-.06,1.58,0],
      color.shirtShade,
      [.30,.15,.31]
    );

    // Short neck
    ball(
      [chest[0]+.025,1.74,0],
      color.skin,
      [.115,.105,.12]
    );

    const head=[
      chest[0]+.04,
      1.90,
      0
    ];

    // Adult head proportions
    ball(
      head,
      color.skinLight,
      [.225,.260,.218]
    );

    // Hair
    ball(
      [
        head[0]-.065,
        2.083,
        0
      ],
      color.hair,
      [.226,.094,.228]
    );

    for(const side of [-1,1]) {
      ball(
        [
          head[0]-.09,
          2.052,
          side*.143
        ],
        color.hair,
        [.10,.074,.091]
      );

      // Eyes
      ball(
        [
          head[0]+.18,
          1.90,
          side*.091
        ],
        color.white,
        [.041,.032,.036]
      );

      ball(
        [
          head[0]+.209,
          1.898,
          side*.091
        ],
        color.eye,
        [.016,.017,.017]
      );

      // Ears
      ball(
        [
          head[0]-.006,
          1.905,
          side*.222
        ],
        color.skin,
        [.046,.071,.029]
      );
    }

    // Nose and moustache
    ball(
      [head[0]+.204,1.81,0],
      color.skin,
      [.05,.039,.049]
    );

    ball(
      [
        head[0]+.217,
        1.776,
        -.054
      ],
      color.hair,
      [.034,.019,.046]
    );

    ball(
      [
        head[0]+.217,
        1.776,
        .054
      ],
      color.hair,
      [.034,.019,.046]
    );

    // SEATED LEGS
    for(const side of [-1,1]) {
      const thigh=[
        -.43,
        .79,
        side*.17
      ];

      const knee=[
        .04,
        .67,
        side*.245
      ];

      const ankle=[
        .42,
        .505,
        side*.25
      ];

      bone(
        thigh,
        knee,
        .155,
        color.lungi
      );

      ball(
        knee,
        color.lungi,
        [.152,.145,.14]
      );

      bone(
        knee,
        ankle,
        .118,
        color.skin
      );

      ball(
        [
          .52,
          .50,
          side*.25
        ],
        color.sandals,
        [.205,.065,.116]
      );

      bone(
        [
          .30,
          .52,
          side*.25
        ],
        [
          .44,
          .52,
          side*.25
        ],
        .032,
        color.rope
      );
    }

    // CONNECTED OARS AND ARMS
    for(const side of [-1,1]) {
      const o=oarPose(t,side);

      // Continuous wooden oar shaft
      bone(
        o.grip,
        o.bladeA,
        .034,
        color.plankAlt
      );

      bone(
        o.pivot,
        o.end,
        .043,
        color.trim
      );

      bone(
        o.bladeA,
        o.bladeB,
        .070,
        color.plank
      );

      // Flattened oar blade
      draw(
        sphere,
        between(
          o.bladeA,
          o.bladeB,
          .155,
          .058
        ),
        color.plank
      );

      // Shoulder position
      const shoulder=[
        chest[0]+.055,
        1.56,
        side*.293
      ];

      // Bent elbow
      const elbow=[
        mix(
          shoulder[0],
          o.grip[0],
          .50
        )-.13,

        mix(
          shoulder[1],
          o.grip[1],
          .50
        )-.045,

        mix(
          shoulder[2],
          o.grip[2],
          .50
        )+side*.13
      ];

      ball(
        shoulder,
        color.shirt,
        [.15,.16,.151]
      );

      // Upper arm
      bone(
        shoulder,
        elbow,
        .123,
        color.shirt
      );

      ball(
        elbow,
        color.skin,
        [.106,.107,.106]
      );

      // Forearm
      bone(
        elbow,
        o.grip,
        .088,
        color.skin
      );

      // Hand shares the actual grip position
      ball(
        o.grip,
        color.skinLight,
        [.102,.095,.104]
      );

      // Optional rig markers
      if(showRig) {
        // Red: fixed pivot
        ball(
          o.pivot,
          [1,.30,.20],
          [.092,.092,.092]
        );

        // Green: hand grip
        ball(
          o.grip,
          [.22,.95,.50],
          [.082,.082,.082]
        );

        // Yellow: elbow
        ball(
          elbow,
          [.94,.87,.29],
          [.065,.065,.065]
        );
      }
    }
  }

  // CAMERA MATRICES
  function perspective(
    fovy,
    aspect,
    near,
    far
  ) {
    const f=1/Math.tan(fovy/2);
    const nf=1/(near-far);

    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(far+near)*nf,-1,
      0,0,2*far*near*nf,0
    ]);
  }

  function lookAt(eye,center) {
    const z=unit(sub(eye,center));
    const x=unit(cross([0,1,0],z));
    const y=cross(z,x);

    return new Float32Array([
      x[0],y[0],z[0],0,
      x[1],y[1],z[1],0,
      x[2],y[2],z[2],0,

      -dot(x,eye),
      -dot(y,eye),
      -dot(z,eye),
      1
    ]);
  }

  // CAMERA PRESETS
  const presets={
    threequarter:{
      yaw:.72,
      pitch:.29,
      distance:5.3,
      target:[0,1.10,0]
    },

    front:{
      yaw:0,
      pitch:.15,
      distance:4.4,
      target:[0,1.11,0]
    },

    side:{
      yaw:PI/2,
      pitch:.13,
      distance:4.6,
      target:[0,1.08,0]
    },

    rear:{
      yaw:PI,
      pitch:.18,
      distance:4.5,
      target:[0,1.12,0]
    },

    top:{
      yaw:.50,
      pitch:1.10,
      distance:5.25,
      target:[0,.88,0]
    },

    closeup:{
      yaw:.40,
      pitch:.08,
      distance:2.45,
      target:[-.43,1.73,0]
    }
  };

  const cam={
    ...presets.threequarter,
    target:[...presets.threequarter.target]
  };

  function selectView(name) {
    const p=presets[name];

    if(!p) return;

    Object.assign(
      cam,
      {
        ...p,
        target:[...p.target]
      }
    );

    document
      .querySelectorAll('.view-btn')
      .forEach(btn=>{
        const on=btn.dataset.view===name;

        btn.classList.toggle(
          'active',
          on
        );

        btn.setAttribute(
          'aria-pressed',
          String(on)
        );
      });
  }

  document
    .querySelectorAll('.view-btn')
    .forEach(btn=>{
      btn.addEventListener(
        'click',
        ()=>selectView(btn.dataset.view)
      );
    });

  $('resetCamera').addEventListener(
    'click',
    ()=>selectView('threequarter')
  );

  // MOUSE CAMERA ROTATION
  let pointer=null;

  canvas.addEventListener(
    'pointerdown',
    e=>{
      pointer={
        id:e.pointerId,
        x:e.clientX,
        y:e.clientY
      };

      canvas.setPointerCapture(
        e.pointerId
      );
    }
  );

  canvas.addEventListener(
    'pointermove',
    e=>{
      if(!pointer ||
         pointer.id!==e.pointerId) {
        return;
      }

      const dx=e.clientX-pointer.x;
      const dy=e.clientY-pointer.y;

      cam.yaw-=dx*.007;

      cam.pitch=clamp(
        cam.pitch+dy*.006,
        -.12,
        1.39
      );

      pointer.x=e.clientX;
      pointer.y=e.clientY;

      document
        .querySelectorAll('.view-btn')
        .forEach(btn=>{
          btn.classList.remove('active');

          btn.setAttribute(
            'aria-pressed',
            'false'
          );
        });
    }
  );

  const release=e=>{
    if(pointer &&
       e.pointerId===pointer.id) {
      pointer=null;
    }
  };

  canvas.addEventListener(
    'pointerup',
    release
  );

  canvas.addEventListener(
    'pointercancel',
    release
  );

  canvas.addEventListener(
    'wheel',
    e=>{
      e.preventDefault();

      cam.distance=clamp(
        cam.distance*Math.exp(e.deltaY*.001),
        1.8,
        14
      );
    },
    {passive:false}
  );

  // ANIMATION STATE
  const state={
    phase:0,
    speed:1,
    running:true,
    lighting:0,
    showRig:false,
    showWater:true
  };

  const tempo=$('rowingSpeed');
  const stroke=$('strokePhase');

  function updatePauseButton() {
    $('pauseRowing').textContent=
      state.running
        ? 'Pause Rowing'
        : 'Resume Rowing';

    $('pauseRowing').setAttribute(
      'aria-pressed',
      String(!state.running)
    );

    $('animationStatus').textContent=
      state.running
        ? 'Running'
        : 'Paused';
  }

  $('pauseRowing').addEventListener(
    'click',
    ()=>{
      state.running=!state.running;
      updatePauseButton();
    }
  );

  tempo.addEventListener(
    'input',
    ()=>{
      state.speed=Number(
        tempo.value
      );

      $('speedValue').textContent=
        state.speed.toFixed(1)+'x';
    }
  );

  stroke.addEventListener(
    'input',
    ()=>{
      state.phase=Number(
        stroke.value
      )/100;

      state.running=false;

      updatePauseButton();
      updateStrokeInfo();
    }
  );

  function updateStrokeInfo() {
    const p=state.phase;

    const info=
      p<.08
        ? [
            'Catch',
            'The blades enter the water.'
          ]
        : p<.52
        ? [
            'Drive',
            'The boatman pulls through the water.'
          ]
        : p<.66
        ? [
            'Release',
            'The blades lift clear of the surface.'
          ]
        : [
            'Recovery',
            'The handles return for the next stroke.'
          ];

    $('phaseName').textContent=info[0];

    $('phaseDescription').textContent=
      info[1];

    $('phaseValue').textContent=
      Math.round(p*100)+'%';
  }

  // LIGHTING CONTROLS
  document
    .querySelectorAll('.light-btn')
    .forEach(btn=>{
      btn.addEventListener(
        'click',
        ()=>{
          state.lighting=
            btn.dataset.light==='overcast'
              ? 1
              : 0;

          document
            .querySelectorAll('.light-btn')
            .forEach(b=>{
              const active=b===btn;

              b.classList.toggle(
                'active',
                active
              );

              b.setAttribute(
                'aria-pressed',
                String(active)
              );
            });
        }
      );
    });

  $('showRig').addEventListener(
    'change',
    e=>{
      state.showRig=e.target.checked;
    }
  );

  $('showWater').addEventListener(
    'change',
    e=>{
      state.showWater=e.target.checked;
    }
  );

  // DISTANT DHAKA-INSPIRED BACKDROP
  // Intentionally simple: the majhi is the focus.
  const skyline=[
    {
      x:-8.5,z:-9.0,
      h:4.5,w:2.2,d:2.6,
      c:color.brick2
    },

    {
      x:-5.2,z:-10.6,
      h:6.1,w:2.0,d:2.5,
      c:color.concrete
    },

    {
      x:0,z:-11.7,
      h:5.2,w:2.6,d:2.2,
      c:color.brick
    },

    {
      x:5.1,z:-11.1,
      h:6.8,w:2.6,d:3.1,
      c:color.concrete
    },

    {
      x:8.7,z:-8.5,
      h:4.4,w:2.5,d:2.0,
      c:color.brick2
    }
  ];

  function drawSkyline() {
    for(const b of skyline) {
      box(
        [b.x,b.h*.5,b.z],
        b.c,
        [b.w,b.h,b.d]
      );

      box(
        [b.x,b.h+.06,b.z],
        color.plankAlt,
        [b.w+.15,.12,b.d+.15]
      );

      for(
        let floor=1;
        floor<Math.floor(b.h);
        floor++
      ) {
        const y=floor+.12;

        for(const dx of [-.48,.48]) {
          box(
            [
              b.x+dx,
              y,
              b.z+b.d*.504
            ],
            [.12,.21,.22],
            [.31,.46,.038]
          );

          box(
            [
              b.x+dx,
              y-.28,
              b.z+b.d*.53
            ],
            [.40,.43,.40],
            [.38,.06,.18]
          );
        }
      }

      // Rooftop tank
      box(
        [
          b.x+b.w*.22,
          b.h+.25,
          b.z
        ],
        color.hullDark,
        [.38,.38,.38]
      );
    }
  }

  // CANVAS RESIZING
  function resize() {
    const dpr=Math.min(
      window.devicePixelRatio||1,
      2
    );

    const w=Math.max(
      1,
      Math.round(
        canvas.clientWidth*dpr
      )
    );

    const h=Math.max(
      1,
      Math.round(
        canvas.clientHeight*dpr
      )
    );

    if(
      canvas.width!==w ||
      canvas.height!==h
    ) {
      canvas.width=w;
      canvas.height=h;
    }

    gl.viewport(
      0,0,w,h
    );
  }

  // MAIN RENDER LOOP
  let previous=0;
  let fpsClock=0;
  let fpsFrames=0;
  let lastFps=0;
  let seconds=0;

  function frame(now) {
    try {
      resize();

      const dt=previous
        ? Math.min(
            (now-previous)/1000,
            .05
          )
        : 0;

      previous=now;
      seconds+=dt;

      // Continuous rowing
      if(state.running) {
        state.phase=(
          state.phase+
          dt*state.speed*.34
        )%1;

        stroke.value=String(
          Math.round(state.phase*100)
        );
      }

      updateStrokeInfo();

      // FPS counter
      fpsClock+=dt;
      fpsFrames++;

      if(fpsClock>.65) {
        lastFps=Math.round(
          fpsFrames/fpsClock
        );

        $('fpsValue').textContent=
          lastFps+' FPS';

        fpsClock=0;
        fpsFrames=0;
      }

      // Background color
      gl.clearColor(
        ...(
          state.lighting===0
            ? [.63,.76,.73,1]
            : [.52,.63,.68,1]
        )
      );

      gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
      );

      gl.useProgram(program);

      // Camera location
      const horiz=
        cam.distance*
        Math.cos(cam.pitch);

      const eye=[
        cam.target[0]+
          horiz*Math.cos(cam.yaw),

        cam.target[1]+
          cam.distance*Math.sin(cam.pitch),

        cam.target[2]+
          horiz*Math.sin(cam.yaw)
      ];

      gl.uniformMatrix4fv(
        uni.view,
        false,
        lookAt(eye,cam.target)
      );

      gl.uniformMatrix4fv(
        uni.proj,
        false,
        perspective(
          PI/3,
          canvas.width/canvas.height,
          .04,
          100
        )
      );

      gl.uniform1f(
        uni.time,
        seconds
      );

      gl.uniform1i(
        uni.lighting,
        state.lighting
      );

      // Water
      if(state.showWater) {
        draw(
          water,
          mat(),
          [.08,.25,.28],
          1
        );
      }

      // Environment
      drawSkyline();

      // Boat and majhi
      drawBoat();

      drawRowing(
        state.phase,
        state.showRig
      );

      gl.bindVertexArray(null);

      status.textContent=
        'WebGL 2 active · Rowing prototype ready';

      requestAnimationFrame(frame);

    } catch(err) {
      console.error(
        'Visual Lab 02:',
        err
      );

      fail(
        'Rendering error: '+err.message
      );
    }
  }

  updatePauseButton();
  updateStrokeInfo();

  requestAnimationFrame(frame);
})();
