"""Offline geometry converter for the user's original PyOpenGL source.
Exports vertices FROM source rendering functions, preserving their geometry.
No PyOpenGL runtime required. Only touches the supplied Python file.
"""
import ast, math, struct, json, sys, os, traceback
from collections import defaultdict
import numpy as np
SOURCE=sys.argv[1]
OUT=sys.argv[2]

class Collector:
 def __init__(self):
  self.matrix=[np.identity(4)];self.mode=None;self.vert=[];self.color=(1.,1.,1.,1.);self.tri=[];self.lines=[];self.line_width=1
  self.byname={};self.active=None;self.draws=defaultdict(int)
 def reset(self):self.matrix=[np.identity(4)];self.mode=None;self.vert=[];self.color=(1,1,1,1);self.tri=[];self.lines=[]
 def begin_group(self,name):self.reset();self.active=name
 def end_group(self):
  self.byname[self.active]=self.tri
  print('GROUP',self.active,'verts',len(self.tri)//7,'lines',len(self.lines)//7)
  self.active=None;self.tri=[];self.lines=[]
 def push(self):self.matrix.append(self.matrix[-1].copy())
 def pop(self):self.matrix.pop()
 def translate(self,x,y,z):
  t=np.identity(4);t[:3,3]=[x,y,z];self.matrix[-1]=self.matrix[-1]@t
 def scale(self,x,y,z):
  t=np.diag([x,y,z,1]);self.matrix[-1]=self.matrix[-1]@t
 def rotate(self,a,x,y,z):
  rad=math.radians(a); c=math.cos(rad);s=math.sin(rad);v=np.array([x,y,z],dtype=float);v=v/(np.linalg.norm(v) or 1)
  v1,v2,v3=v;R=np.array([[c+v1*v1*(1-c),v1*v2*(1-c)-v3*s,v1*v3*(1-c)+v2*s,0],
  [v2*v1*(1-c)+v3*s,c+v2*v2*(1-c),v2*v3*(1-c)-v1*s,0],
  [v3*v1*(1-c)-v2*s,v3*v2*(1-c)+v1*s,c+v3*v3*(1-c),0],[0,0,0,1]])
  self.matrix[-1]=self.matrix[-1]@R
 def vertex(self,x,y,z):
  M=self.matrix[-1];px=M[0,0]*x+M[0,1]*y+M[0,2]*z+M[0,3];py=M[1,0]*x+M[1,1]*y+M[1,2]*z+M[1,3];pz=M[2,0]*x+M[2,1]*y+M[2,2]*z+M[2,3]
  self.vert.append((px,pz,py,*self.color))
 def start(self,mode):self.vert=[];self.mode=mode
 def close(self):
  v=self.vert;mode=self.mode; self.mode=None
  def tri(a,b,c):
   for p in (a,b,c):self.tri.extend((*p[:3],*p[3:6],0))
  def line(a,b):
   # Three-dimensional world-space line as a narrow double-sided vertical ribbon.
   x,y,z=a[:3];u,v,w=b[:3];dx=u-x;dz=w-z;d=math.hypot(dx,dz);wd=max(.55,min(2.,self.line_width*.42));nx=dz/d*wd if d else wd;nz=-dx/d*wd if d else 0
   aa=(x+nx,y,z+nz,*a[3:]);bb=(u+nx,v,w+nz,*b[3:]);cc=(u-nx,v,w-nz,*b[3:]);dd=(x-nx,y,z-nz,*a[3:]);tri(aa,bb,cc);tri(aa,cc,dd)
  if mode=='GL_QUADS':
   for i in range(0,len(v)-3,4):tri(v[i],v[i+1],v[i+2]);tri(v[i],v[i+2],v[i+3])
  elif mode=='GL_TRIANGLES':
   for i in range(0,len(v)-2,3):tri(*v[i:i+3])
  elif mode=='GL_TRIANGLE_STRIP':
   for i in range(0,len(v)-2):tri(v[i],v[i+1],v[i+2]) if i%2==0 else tri(v[i+1],v[i],v[i+2])
  elif mode=='GL_TRIANGLE_FAN' or mode=='GL_POLYGON':
   for i in range(1,len(v)-1):tri(v[0],v[i],v[i+1])
  elif mode=='GL_LINES':
   for i in range(0,len(v)-1,2):line(v[i],v[i+1])
  elif mode=='GL_LINE_STRIP':
   for i in range(0,len(v)-1):line(v[i],v[i+1])
  elif mode=='GL_LINE_LOOP':
   for i in range(len(v)):line(v[i],v[(i+1)%len(v)])
  elif mode=='GL_POINTS':
   for p in v:
    x,y,z=p[:3];d=1.3
    tri((x-d,y,z-d,*p[3:]),(x+d,y,z-d,*p[3:]),(x+d,y,z+d,*p[3:]));tri((x-d,y,z-d,*p[3:]),(x+d,y,z+d,*p[3:]),(x-d,y,z+d,*p[3:]))
  self.vert=[]
 def sphere(self,r,slices=10,stacks=8):
  for i in range(stacks):
   a=-math.pi/2+math.pi*i/stacks;b=-math.pi/2+math.pi*(i+1)/stacks
   self.start('GL_QUADS')
   for j in range(slices):
    c=2*math.pi*j/slices;d=2*math.pi*(j+1)/slices
    for lat,lon in ((a,c),(a,d),(b,d),(b,c)):
     self.vertex(r*math.cos(lat)*math.cos(lon),r*math.cos(lat)*math.sin(lon),r*math.sin(lat))
   self.close()
 def cylinder(self,a,b,h,slices=10):
  self.start('GL_QUADS')
  for i in range(slices):
   u=i*2*math.pi/slices;v=(i+1)*2*math.pi/slices
   for radius,z,ang in ((a,0,u),(a,0,v),(b,h,v),(b,h,u)):
    self.vertex(radius*math.cos(ang),radius*math.sin(ang),z)
  self.close()
 def disk(self,inner,outer,slices=10):
  self.start('GL_QUADS')
  for i in range(slices):
   u=i*2*math.pi/slices;v=(i+1)*2*math.pi/slices
   for radius,ang in ((inner,u),(outer,u),(outer,v),(inner,v)):
    self.vertex(radius*math.cos(ang),radius*math.sin(ang),0)
  self.close()
 def cube(self,size):
  s=size*.5
  for face in (((-s,-s,-s),(-s,s,-s),(-s,s,s),(-s,-s,s)),((s,-s,-s),(s,-s,s),(s,s,s),(s,s,-s)),((-s,-s,-s),(-s,-s,s),(s,-s,s),(s,-s,-s)),((-s,s,-s),(s,s,-s),(s,s,s),(-s,s,s)),((-s,-s,-s),(s,-s,-s),(s,s,-s),(-s,s,-s)),((-s,-s,s),(-s,s,s),(s,s,s),(s,-s,s))):
   self.start('GL_QUADS');[self.vertex(*v) for v in face];self.close()

col=Collector()
names={}
modekeys=['GL_QUADS','GL_TRIANGLES','GL_TRIANGLE_STRIP','GL_TRIANGLE_FAN','GL_LINES','GL_LINE_LOOP','GL_LINE_STRIP','GL_POINTS','GL_POLYGON']
for key in modekeys:names[key]=key
for key in ['GL_BLEND','GL_TRUE','GL_FALSE','GL_DEPTH_TEST','GL_SRC_ALPHA','GL_ONE_MINUS_SRC_ALPHA','GL_COMPILE','GL_FOG']:
 names[key]=key
names.update(dict(glPushMatrix=col.push,glPopMatrix=col.pop,glTranslatef=col.translate,glRotatef=col.rotate,glScalef=col.scale,glBegin=col.start,glEnd=col.close,glVertex3f=col.vertex,glVertex2f=lambda x,y:col.vertex(x,y,0),glColor3f=lambda r,g,b:setattr(col,'color',(r,g,b,1)),glColor4f=lambda r,g,b,a:setattr(col,'color',(r,g,b,a)),glLineWidth=lambda w:setattr(col,'line_width',w),glPointSize=lambda w:None,gluNewQuadric=lambda:1,gluSphere=lambda quad,r,slices,stacks:col.sphere(r,max(5,int(slices)),max(4,int(stacks))),gluCylinder=lambda quad,r1,r2,height,slices,stacks:col.cylinder(r1,r2,height,max(5,int(slices))),gluDisk=lambda quad,inner,outer,slices,stacks:col.disk(inner,outer,max(6,int(slices))),glutSolidCube=col.cube,glutStrokeCharacter=lambda *a:None,glutStrokeWidth=lambda font,character:105.0,glutBitmapCharacter=lambda *a:None,glRasterPos2f=lambda *a:None))
for k in ['glDepthMask','glDisable','glEnable','glBlendFunc','glMatrixMode','glLoadIdentity','gluPerspective','gluLookAt','glViewport','glClear','glClearColor','glFogi','glFogfv','glFogf','glDepthFunc','gluOrtho2D']:
 names[k]=lambda *args:None
for k in ['GLUT_STROKE_ROMAN','GLUT_BITMAP_HELVETICA_12','GLUT_BITMAP_HELVETICA_10','GLUT_BITMAP_HELVETICA_18']:
 names[k]=0
# Use the actual source drawing functions without PyOpenGL imports.
tree=ast.parse(open(SOURCE,encoding='utf8').read())
tree.body=[n for n in tree.body if not (isinstance(n,ast.ImportFrom) and n.module and n.module.startswith('OpenGL.'))]
code=compile(ast.fix_missing_locations(tree),SOURCE,'exec'); names['__name__']='majhi_reference'
exec(code,names)
names['DisplayListsUsable']=False

def group(name,func):
 col.begin_group(name)
 try:func()
 except Exception as e:
  print('ERROR GROUP',name,repr(e));traceback.print_exc(limit=4)
 col.end_group()

def buildings():
 for idx,b in enumerate(names['BuildingList']):
  names['renderSingleBuildingGeometry'](b,names['BuildingColors'][idx%len(names['BuildingColors'])])

def fixed():
 names['drawSubmergedCityBlocks']();names['drawSubmergedRoadClues']()

def props():
 for t in names['CityTreeList']:names['drawCityTree'](*t)
 for t in names['CityTeaStalls']:names['drawCityTeaStall'](*t)
 for t in names['CityBRACUShops']:names['drawNeighborhoodShop'](*t)
 for t in names['CityRoadsideProps']:names['drawRoadsideProp'](*t)
 for t in names['getStreetLightPositions']():names['drawStreetLight'](*t)

def cars():
 for i,car in enumerate(names['getSubmergedCarPositions']()):
  names['drawSingleSubmergedCar'](*car,i,i in names['BrokenCarIndices'])

def scenery():
 names['drawShaheedMinar']();names['drawLandmarkPhotoSpot'](names['LandmarkList'][0])
 names['drawFloodTrafficSignal']()
 for x in names['PowerDistrictList']:names['drawPowerRepairStation'](x)

for n,f in [('buildings',buildings),('streets',fixed),('campus',names['renderBRACUStaticGeometry']),('props',props),('cars',cars),('landmarks',scenery),('sky',names['drawStormySky']),('clouds',names['drawStormClouds']),('clear-sky',names['drawBRACUClearSky']),('boat',names['renderCinematicBoatHull'])]:group(n,f)
# Export a snapshot of the original captain model in boat-local space by resetting player at origin.
names['BoatPositionX']=0;names['BoatPositionY']=0;names['BoatFacingAngle']=0
for n,f in [('captain',names['drawBoatCaptain']),('paddles',names['drawPlayerHandsAndPaddles']),('dock',names['drawUniversityArrivalDock'])]:group(n,f)
names['ThirdPersonCamera']=False
group('firstperson-hands',names['drawPlayerHandsAndPaddles'])
for i,color in enumerate(names['StudentColors']):
 group('student-'+str(i),lambda c=color:names['drawStudentAvatar'](0,0,0,c,0.79))
for i in range(3):
 names['FloatingDebrisList']=[dict(x=0,y=0,phase=0,type=i)];group('debris-'+str(i),names['drawDebrisObjects'])
# Geometry is packed into a single contiguous Float32 buffer, split using the ranges file.
index={};blob=[]
for key,vertices in col.byname.items():
 index[key]=dict(start=len(blob)//7,count=len(vertices)//7)
 blob.extend(vertices)
os.makedirs(OUT,exist_ok=True)
with open(os.path.join(OUT,'original-geometry.bin'),'wb') as f:
 for v in blob:f.write(struct.pack('<f',float(v)))
with open(os.path.join(OUT,'original-geometry.json'),'w') as f:json.dump(index,f,indent=2)
print('TOTAL',len(blob)//7,'vertices;',len(blob)*4/1048576,'MiB',flush=True)
