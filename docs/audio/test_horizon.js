const vm=require('vm'),fs=require('fs');
const src=fs.readFileSync(__dirname+'/game.js','utf8');
const noop=()=>{};
const classList={add:noop,remove:noop,contains:()=>true,toggle:noop};
const style=new Proxy({}, {get(o,k){if(k==='setProperty')return noop;return o[k]??''},set(o,k,v){o[k]=v;return true}});
function makeEl(id){return {id,style:{...style},classList,hidden:false,value:'',innerHTML:'',textContent:'',clientWidth:960,clientHeight:700,width:960,height:700,onclick:null,dataset:{},offsetWidth:100,scrollHeight:100,offsetHeight:100,children:[],
  insertAdjacentElement:noop,replaceChildren:noop,setAttribute:noop,getAttribute:()=>'',appendChild:noop,addEventListener:noop,removeEventListener:noop,setPointerCapture:noop,
  getBoundingClientRect:()=>({left:0,top:0,width:960,height:700}),closest:()=>null,querySelector:()=>({addEventListener:noop}),querySelectorAll:()=>[],
  getContext:function(type){return type==='2d'?ctx2:gl;}}}
const ctx2=new Proxy({}, {get(o,k){if(k==='canvas')return {width:960,height:700};if(k==='measureText')return ()=>({width:45});if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop:noop});return o[k]||noop;},set(o,k,v){o[k]=v;return true}});
let totalDraw=0;let createdShaders=[];let textureOps=0;
const specials={getShaderPrecisionFormat:()=>({precision:23}),getShaderParameter:()=>true,getProgramParameter:()=>true,checkFramebufferStatus:()=>0x8CD5,getAttribLocation:()=>0,getUniformLocation:(_,s)=>({name:s}),createBuffer:()=>({}),createTexture:()=>({}),createFramebuffer:()=>({}),createProgram:()=>({}),createShader:()=>({}),createVertexArray:()=>({}),getParameter:()=>4096,getError:()=>0,shaderSource:(_,s)=>{createdShaders.push(s)},drawArrays:()=>{totalDraw++},copyTexSubImage2D:()=>{textureOps++}};
const gl=new Proxy({}, {get(o,k){if(k in specials)return specials[k];if(typeof k==='string'&&/^[A-Z][A-Z0-9_]*$/.test(k))return ({FRAMEBUFFER_COMPLETE:0x8CD5,MAX_TEXTURE_SIZE:0x0D33})[k]||1;return noop}});
const els={};const doc={head:makeEl('head'),body:makeEl('body'),createElement:id=>makeEl(id),getElementById:id=>els[id]??(els[id]=makeEl(id)),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:noop};
let raf=null;
const win={innerWidth:960,innerHeight:700,devicePixelRatio:1,addEventListener:noop,removeEventListener:noop,location:{hostname:'localhost'},matchMedia:()=>({matches:false}),setTimeout:noop,clearTimeout:noop};
const fakefetch=async url=>String(url).includes('original-geometry.json')?{ok:true,json:async()=>({})}:String(url).includes('original-geometry.bin')?{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}:{ok:false,status:404};
let logs=[];
const cnsl={log:noop,info:noop,warn:(...args)=>logs.push('warning '+args.map(String).join(' ')),error:(...args)=>logs.push('error '+args.map(String).join(' '))};
const perf={now:()=>105};
const context={window:win,devicePixelRatio:1,document:doc,navigator:{userAgent:'Chrome'},location:{hostname:'localhost'},performance:perf,console:cnsl,fetch:fakefetch,requestAnimationFrame:fn=>{raf=fn},setTimeout:noop,clearTimeout:noop,XMLHttpRequest:function(){},Blob,Math,Array,Uint8Array,Float32Array,Int32Array,Set,WeakSet,Map,Promise,Date,JSON};
vm.createContext(context);
(async()=>{
try{
 vm.runInContext(src,context,{timeout:14000});
 await new Promise(r=>setImmediate(r));
 if(!win.MajhiDiagnostics)throw Error('No diagnostics');
 win.MajhiDiagnostics.start();
 if(!raf)throw Error('No animation loop');
 const before=win.majhiDiagnostics().carProgress;
 for(let tick=1;tick<=120;tick++)raf(tick*16);
 const after=win.majhiDiagnostics().carProgress;
 if(after.every((x,i)=>x===before[i]))throw Error('Moving car progress did not advance '+JSON.stringify({before,after}));
 // Wheels must rotate with distance, not animation time; test another travel interval.
 const wheelsBefore=win.majhiDiagnostics().movingCarWheelFrames;
 for(let tick=121;tick<=145;tick++)raf(tick*16);
 const wheelsAfter=win.majhiDiagnostics().movingCarWheelFrames;
 if(wheelsBefore.every((v,i)=>v===wheelsAfter[i]))throw Error('Wheel frames did not advance with traffic');
 // Pin the boat directly over the first moving car route. A stopped car must
 // neither advance its route progress nor change its wheel rotation frame.
 const state=win.majhiTesting.S;
 state.x=state.movingCars[0].x;state.z=state.movingCars[0].z;
 const holdBefore=state.carProgress[0];
 for(let tick=146;tick<=158;tick++)raf(tick*16);
 const holdAfter=state.carProgress[0];
 if(Math.abs(holdBefore-holdAfter)>1e-5)throw Error('Blocked moving car still advanced: '+(holdAfter-holdBefore));
 const frames=win.majhiDiagnostics().movingCarWheelFrames;
 if(!frames.every(v=>v>=0&&v<24))throw Error('Wheel frame index out of range: '+frames);
 // Three-seat boarding smoke: exercise first- and third-person draw without
 // mutating the real pickup/delivery rules in the production source.
 state.rides=[0,1,2].map((i)=>({id:i+301,name:'Test '+i,colorId:i,boardedAt:state.time-3,boardSide:i%2?1:-1,type:'HOME',state:'ONBOARD',timeLeft:600,x:0,z:0}));
 state.camera3=false;raf(159*16);
 if(win.majhiDiagnostics().onboard!==3||win.majhiDiagnostics().camera!=='first')throw Error('Three-seat first-person rendering failed');
 state.camera3=true;raf(160*16);
 if(win.majhiDiagnostics().onboard!==3||win.majhiDiagnostics().camera!=='third')throw Error('Three-seat third-person rendering failed');
 state.rides=[];
 const horizon=win.majhiHorizonDiagnostics();
 if(!horizon.visualOnly || horizon.playableBoundary!==1615 || horizon.outerWaterEdge!==3300)throw Error('Visual-only map bounds changed '+JSON.stringify(horizon));
 if(horizon.skylineBuildings<20 || horizon.skylineBuildings>75 || horizon.nearSkylineBuildings<12 || horizon.skylineWindowClusters<100)throw Error('Distant skyline not populated '+JSON.stringify(horizon));
 if(horizon.outerTreeCount<15||horizon.outerHazardCount<5)throw Error('Missing trees and hazards');
 if(horizon.distantRainCurtains!==8 || horizon.hazeBanks!==4)throw Error('Missing rain-fog distance layers');
 if(horizon.nearEdgeDistance<=1615||horizon.nearEdgeDistance>1710)throw Error('Nearest skyline should be just outside playable map: '+horizon.nearEdgeDistance);
 if(horizon.horizonRenderedFrames<100)throw Error('Backdrop not submitted for rendering');
 if(win.majhiVersion!=='phase20-storm-outskirts-lightning')throw Error('Version not updated');
 if(!createdShaders.some(v=>v.includes('Buildings in the visual-only horizon are solid silhouettes')&&v.includes('opacity=1.0;')))throw Error('Backdrop shader still transparent');
 if(!createdShaders.some(v=>v.includes('float distant=(vKind>10.5&&vKind<11.5)?1.:0.')))throw Error('Distinct skyline atmospheric material missing');
 if(win.majhiWaterDiagnostics().phase!=='20-storm-outskirts-lightning')throw Error('Wrong phase diagnostic');
 const first=win.MajhiDiagnostics.getState();
 const water=win.majhiWaterDiagnostics();
 if(first.mode!=='PLAYING')throw Error('Cannot start game: '+first.mode+' '+JSON.stringify(logs));
 if(water.waterSurfaceY!==36||!water.opticalRenderer)throw Error('Wrong water surface: '+JSON.stringify(water));
 if(!textureOps)throw Error('Optical scene capture missing');
 const info=win.majhiDiagnostics();
 if(!info.boatHullVertices||!info.seatedPassengerMeshVertices||info.majhiRigFrames!==24)throw Error('Boat or seated passenger rig missing: '+JSON.stringify({boat:info.boatHullVertices,passengers:info.seatedPassengerMeshVertices,frames:info.majhiRigFrames}));
 for(let k=0;k<900;k++)win.majhiTesting.step(.025);
 const storm=win.majhiStormDiagnostics();
 if(storm.strikes<1||storm.thunderEvents<1||storm.lightningVariants!==5)throw Error('Lightning/thunder not triggered '+JSON.stringify(storm));
 const shaders=createdShaders.map(x=>x.length);
 console.log(JSON.stringify({ok:true,mode:first.mode,waterDepthMeters:water.waterDepthMeters,waterSurfaceY:water.waterSurfaceY,renderer:water.opticalRenderer,framePasses:totalDraw,sceneCaptures:textureOps,carProgress:win.majhiDiagnostics().carProgress,shaderCount:shaders.length,boatHullVertices:info.boatHullVertices,majhiFullVertices:info.majhiFullVertices,seatedPassengerVertices:info.seatedPassengerMeshVertices,aiStrokePhases:info.aiStrokePhases,wheelBefore:wheelsBefore,wheelAfter:wheelsAfter,blockedCarProgressStable:Math.abs(holdBefore-holdAfter)<1e-5,horizon,storm,warnings:logs.slice(0,4)},null,2));
}catch(e){console.error('FAIL',e.stack);process.exitCode=1;}
})()
