
from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
import math
import random
import time
import sys
from functools import lru_cache

SharedQuadric=None

def getSharedQuadric():
    global SharedQuadric
    if SharedQuadric is None:
        SharedQuadric=gluNewQuadric()
    return SharedQuadric

StaticSceneLists={}
BuildingSceneLists={}
DisplayListsUsable=True
RenderQuality='HIGH'
MaxRenderFPS=60.0
LastRenderUpdateTime=time.perf_counter()


def drawCachedScene(Key,RenderFunction,Cache):
    """Compile scene geometry once after the GLUT context exists."""
    global DisplayListsUsable
    if not DisplayListsUsable:
        RenderFunction()
        return
    if Key in Cache:
        glCallList(Cache[Key])
        return
    try:
        Identifier=glGenLists(1)
    except Exception:
        Identifier=0
    if not Identifier:
        DisplayListsUsable=False
        RenderFunction()
        return
    glNewList(Identifier,GL_COMPILE)
    RenderFunction()
    glEndList()
    Cache[Key]=Identifier
    glCallList(Identifier)


def isWorldObjectInView(PositionX,PositionY,Radius=0):
    """Generous broad-phase view selection for repeating background scenery.

    The boat/camera have different positions, so a tight boat-facing cone can
    incorrectly remove an object that is still visible on screen. Keep all
    nearby scenery and use deliberately wide margins for distant objects.
    The graphics depth buffer, not this check, decides what buildings hide.
    """
    DX=PositionX-CameraPosition[0]
    DY=PositionY-CameraPosition[1]
    Near=585+Radius
    if DX*DX+DY*DY<=Near*Near:
        return True
    Direction=math.radians(BoatFacingAngle)
    FX,FY=math.cos(Direction),math.sin(Direction)
    Forward=DX*FX+DY*FY
    Side=abs(-DX*FY+DY*FX)
    if Forward < -Radius-240:
        return False
    return Side <= max(Forward,0)*2.05+Radius+300


def isWithinSceneryFogHorizon(PositionX,PositionY,Radius=0):
    """Never cull recognisable scenery while it could be seen through fog.

    The fixed-function fog is fully opaque by 3300 world units. A generous
    3650-unit horizon skips geometry only when it is already fog-colored.
    This has no view-cone or building-center visibility discontinuity.
    """
    DX=PositionX-CameraPosition[0]
    DY=PositionY-CameraPosition[1]
    Limit=3650+Radius
    return DX*DX+DY*DY <= Limit*Limit


WindowWidth,WindowHeight=1000,800
ActualWindowWidth,ActualWindowHeight=1000,800
ViewportX,ViewportY=0,0
ViewportWidth,ViewportHeight=1000,800
ViewportScale=1.0

ShowFrameProfile=False
FrameRenderMs=0.0
FrameWaterMs=0.0
FrameCityMs=0.0
FrameHudMs=0.0
FrameUpdateMs=0.0
FrameWorstMs=0.0
LastCameraUpdateTime=None
SmoothedCameraHeading=None

WorldMapLimit,FloodWaterHeight=1650,8
RoadWidth=210
VerticalRoadPositions=[-1100,-550,0,550,1100]
HorizontalRoadPositions=[-1150,-600,-50,500,1050]

WaterAnimationPhase,WaterAnimationSpeed=0,0.85

BRACUPositionX,BRACUPositionY,BRACUHalfSize=0,1360,285
BRACUAuraAngle,BRACUAuraSpeed=0,20

LandmarkList=[
    {"name":"Shaheed Minar","x":825,"y":1350,"photo_x":825,"photo_y":1080,"taken":False,"info_lines":["Shaheed Minar, Dhaka.","Built to commemorate the martyrs","of the 1952 Bengali Language Movement.","Originally designed by Hamidur Rahman","with Novera Ahmed; rebuilt after 1971."]}
]

PhotoCaptureRadius,PhotoFacingAngleTolerance=125,30
PhotoFlashTimer,PhotoPopupTimer=0,0
PhotoPopupTitle=""
PhotoPopupLines=[]

BoatPositionX,BoatPositionY=0,-1450
BoatFacingAngle=90
BoatForwardMovementStep,BoatBackwardMovementStep,BoatTurningStep=18,12,5
BoatRowingStepsPerSecond=15.0
BoatTurningStepsPerSecond=21.0
HeldMovementKeys=set()
HeldArrowKeys=set()
BoatCollisionMargin=25

BoatModelScale=0.62

CameraPosition,CameraFieldOfView=(0,0,70),82
ChaseCameraDistance=235.0


RowingAnimationAngle,IsBoatRowing,RowingAnimationTimer=0,False,0
MaximumDeltaTime=0.05

TrafficZone=(-115,115,-165,70)
TrafficState,TrafficTimer="GREEN",0
TrafficGreenDuration,TrafficRedDuration=5,4
TrafficWasInside=False
TrafficViolations=0
TrafficSafeX,TrafficSafeY=BoatPositionX,BoatPositionY
TrafficViolationMessageTimer=0

WiperActive,WiperAngle,WiperDirection=False,18,1
ScreenRainDrops,ScreenRainSpawnTimer=[],0


PowerDistrictList=[
    {"name":"CENTRAL","repair_x":125,"repair_y":-600},
    {"name":"WEST","repair_x":-975,"repair_y":500},
    {"name":"EAST","repair_x":1225,"repair_y":500}
]

PowerOutageActive=True
PowerOutageDistrictIndex=0
PowerRepairRadius=130
PowerNextOutageTimer,PowerNextOutageDelay=0,15
PowerRestoreMessageTimer=0
PowerRestoredDistrictName=""



ShadedCubeFaces=(
        (0.73,((-0.5,-0.5,-0.5),(-0.5,0.5,-0.5),(-0.5,0.5,0.5),(-0.5,-0.5,0.5))),
        (0.88,((0.5,-0.5,-0.5),(0.5,-0.5,0.5),(0.5,0.5,0.5),(0.5,0.5,-0.5))),
        (0.83,((-0.5,-0.5,-0.5),(-0.5,-0.5,0.5),(0.5,-0.5,0.5),(0.5,-0.5,-0.5))),
        (0.95,((-0.5,0.5,-0.5),(0.5,0.5,-0.5),(0.5,0.5,0.5),(-0.5,0.5,0.5))),
        (0.63,((-0.5,-0.5,-0.5),(0.5,-0.5,-0.5),(0.5,0.5,-0.5),(-0.5,0.5,-0.5))),
        (1.10,((-0.5,-0.5,0.5),(-0.5,0.5,0.5),(0.5,0.5,0.5),(0.5,-0.5,0.5)))
)

def drawScaledCube(PositionX,PositionY,PositionZ,Width,Length,Height,RedColor,GreenColor,BlueColor):
    glPushMatrix()
    glTranslatef(PositionX,PositionY,PositionZ)
    glScalef(Width,Length,Height)
    Base=(RedColor,GreenColor,BlueColor)
    Faces=ShadedCubeFaces
    glBegin(GL_QUADS)
    for Shade,Vertices in Faces:
        glColor3f(min(1.0,Base[0]*Shade),min(1.0,Base[1]*Shade),min(1.0,Base[2]*Shade))
        for Vertex in Vertices:
            glVertex3f(Vertex[0],Vertex[1],Vertex[2])
    glEnd()
    glPopMatrix()



def getSafeChaseCameraDistance(DesiredX,DesiredY,DesiredZ,BoatEyeZ):
    """Shorten the chase-camera arm BEFORE it hits solid building walls.

    The boat has collision checks, but the original camera did not. A 235-unit
    backward camera offset could land behind/in a building. We intersect the
    camera line with each building's XY box and check the height at entry.
    This is a visual camera fix; it never changes game or boat physics.
    """
    FromX=BoatPositionX
    FromY=BoatPositionY
    HitFraction=1.0
    Obstacles=[]
    for Building in BuildingList:
        Obstacles.append((Building[0],Building[1],Building[2],Building[3],Building[4]))
    for X,Y,HW,HL,Top in BRACUSolidVolumes:
        Obstacles.append((BRACUPositionX+X,BRACUPositionY+Y,HW,HL,Top))
    for X,Y,HalfW,HalfL,Top in Obstacles:
        Safety=16.0
        Entry=calculateLineEntryIntoRectangle(
            FromX,FromY,DesiredX,DesiredY,
            X-HalfW-Safety,X+HalfW+Safety,
            Y-HalfL-Safety,Y+HalfL+Safety)
        if Entry is None:
            continue
        TestZ=BoatEyeZ+(DesiredZ-BoatEyeZ)*Entry
        if TestZ<=Top+10 and Entry<HitFraction:
            HitFraction=Entry
    ArmDistance=235.0
    return max(14.0,min(ArmDistance,ArmDistance*HitFraction-16.0))


def setupFirstPersonCamera():
    """Damped chase heading and zoom with strict obstruction avoidance.

    Camera only; the boat heading and all collision/gameplay calculations remain
    exact and instantaneous. Closing zoom is immediate when near a building.
    """
    global CameraPosition,ChaseCameraDistance,SmoothedCameraHeading,LastCameraUpdateTime
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    CameraFOV=72 if ThirdPersonCamera else 78
    gluPerspective(CameraFOV,WindowWidth/float(WindowHeight),1.2,5200)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()
    Now=time.perf_counter()
    Dt=1.0/60 if LastCameraUpdateTime is None else min(0.10,max(0.0,Now-LastCameraUpdateTime))
    LastCameraUpdateTime=Now
    if SmoothedCameraHeading is None:
        SmoothedCameraHeading=BoatFacingAngle
    if ThirdPersonCamera:
        Delta=(BoatFacingAngle-SmoothedCameraHeading+180)%360-180
        Follow=1.0-math.exp(-9.0*Dt)
        SmoothedCameraHeading=(SmoothedCameraHeading+Delta*Follow)%360
        Angle=math.radians(SmoothedCameraHeading)
        FX,FY=math.cos(Angle),math.sin(Angle)
        DesiredX=BoatPositionX-FX*235.0
        DesiredY=BoatPositionY-FY*235.0
        DesiredZ=FloodWaterHeight+145
        BoatEyeZ=FloodWaterHeight+48
        Safe=getSafeChaseCameraDistance(DesiredX,DesiredY,DesiredZ,BoatEyeZ)
        if Safe<ChaseCameraDistance:
            ChaseCameraDistance=Safe
        else:
            ChaseCameraDistance+=min(Safe-ChaseCameraDistance,
                                     (Safe-ChaseCameraDistance)*(1-math.exp(-3.5*Dt)))
        CameraX=BoatPositionX-FX*ChaseCameraDistance
        CameraY=BoatPositionY-FY*ChaseCameraDistance
        CameraZ=BoatEyeZ+(DesiredZ-BoatEyeZ)*ChaseCameraDistance/235.0
        TrueAngle=math.radians(BoatFacingAngle)
        LookX=BoatPositionX+math.cos(TrueAngle)*110
        LookY=BoatPositionY+math.sin(TrueAngle)*110
        LookZ=FloodWaterHeight+23
    else:
        SmoothedCameraHeading=BoatFacingAngle
        FX,FY=math.cos(math.radians(BoatFacingAngle)),math.sin(math.radians(BoatFacingAngle))
        VisualBob,_=getBoatVisualMotion()
        LocalForwardOffset=-42.0
        CameraX=BoatPositionX+FX*LocalForwardOffset
        CameraY=BoatPositionY+FY*LocalForwardOffset
        CameraZ=FloodWaterHeight+58.0+0.65*VisualBob
        LookX=BoatPositionX+FX*230
        LookY=BoatPositionY+FY*230
        LookZ=FloodWaterHeight+37.0+0.25*VisualBob
    CameraPosition=(CameraX,CameraY,CameraZ)
    gluLookAt(CameraX,CameraY,CameraZ,LookX,LookY,LookZ,0,0,1)

def drawFloodWater():
    Wave=math.sin(WaterAnimationPhase)*0.012
    glBegin(GL_QUADS)
    glColor3f(0.06+Wave,0.18,0.245)
    glVertex3f(-WorldMapLimit,-WorldMapLimit,FloodWaterHeight)
    glColor3f(0.065,0.215+Wave,0.265)
    glVertex3f(WorldMapLimit,-WorldMapLimit,FloodWaterHeight)
    glColor3f(0.09,0.25,0.295)
    glVertex3f(WorldMapLimit,WorldMapLimit,FloodWaterHeight)
    glColor3f(0.08,0.225,0.275)
    glVertex3f(-WorldMapLimit,WorldMapLimit,FloodWaterHeight)
    glEnd()


def updateFloodWaterAnimation(DeltaTime):
    global WaterAnimationPhase
    WaterAnimationPhase+=WaterAnimationSpeed*DeltaTime


def getBoatVisualMotion():
    """Visual-only heave and roll follows the exact rendered wave function."""
    T=GameTimeSeconds if GameMode=='PLAYING' else WaterAnimationPhase
    LocalWave=getWaterWaveHeight(BoatPositionX,BoatPositionY)-FloodWaterHeight
    WaveLift=LocalWave*0.76
    Bob=WaveLift+0.30*math.sin(T*2.8)
    Roll=0.75*math.sin(T*1.65)+0.55*math.cos(0.032*(BoatPositionY+0.18*BoatPositionX)-1.8*WaterAnimationPhase)
    return Bob,Roll

def renderCinematicBoatHull():
    """Static handcrafted sampan-inspired hull. No textures or extra dependency.

    Longitudinal stations taper into a visible bow; the open inner well, wood
    seats and weathered color bands provide shape without a cube-shaped bow.
    The same geometry is reused in first and third person.
    """
    Stations=((-100,10),(-92,29),(-66,37),(-24,41),(25,42),
              (72,35),(100,24),(123,1))
    Deep=(0.085,0.22,0.25)
    Port=(0.16,0.42,0.45)
    Starboard=(0.18,0.48,0.49)
    Rim=(0.83,0.68,0.43)
    Inner=(0.12,0.31,0.32)
    Deck=(0.55,0.39,0.25)
    for Side in (-1,1):
        glBegin(GL_QUADS)
        for I in range(len(Stations)-1):
            X0,W0=Stations[I]
            X1,W1=Stations[I+1]
            Y0,Y1=Side*W0,Side*W1
            glColor3f(*Deep)
            glVertex3f(X0,Side*max(0.8,W0-7),-1)
            glVertex3f(X1,Side*max(0.8,W1-7),-1)
            glColor3f(*(Port if Side<0 else Starboard))
            glVertex3f(X1,Y1,25)
            glVertex3f(X0,Y0,25)
            glColor3f(*(Port if Side<0 else Starboard))
            glVertex3f(X0,Y0,25)
            glVertex3f(X1,Y1,25)
            glColor3f(0.30,0.57,0.55)
            glVertex3f(X1,Side*max(0.7,W1-2.4),31)
            glVertex3f(X0,Side*max(0.7,W0-2.4),31)
        glEnd()
        glBegin(GL_QUADS)
        for I in range(len(Stations)-1):
            X0,W0=Stations[I]
            X1,W1=Stations[I+1]
            glColor3f(*Rim)
            glVertex3f(X0,Side*(W0+1),33)
            glVertex3f(X1,Side*(W1+1),33)
            glColor3f(0.70,0.55,0.33)
            glVertex3f(X1,Side*max(.7,W1-5),32)
            glVertex3f(X0,Side*max(.7,W0-5),32)
            glColor3f(*Inner)
            glVertex3f(X0,Side*max(.7,W0-5),32)
            glVertex3f(X1,Side*max(.7,W1-5),32)
            glColor3f(0.075,0.19,0.21)
            glVertex3f(X1,Side*max(.7,W1-6),13)
            glVertex3f(X0,Side*max(.7,W0-6),13)
        glEnd()

    glBegin(GL_QUADS)
    for I in range(1,len(Stations)-2):
        X0,W0=Stations[I]
        X1,W1=Stations[I+1]
        glColor3f(*(Deck if I%2 else (0.59,0.43,0.29)))
        glVertex3f(X0,-max(1,W0-6),13)
        glVertex3f(X0,max(1,W0-6),13)
        glColor3f(0.70,0.52,0.34)
        glVertex3f(X1,max(1,W1-6),13)
        glVertex3f(X1,-max(1,W1-6),13)
    glEnd()

    drawSimpleCube(-95,0,20,7,33,17,(0.14,0.36,0.38))
    drawSimpleCube(-93,0,29,8,28,3,(0.75,0.62,0.41))
    for SeatX,SeatWidth in ((-50,60),(8,66),(65,51)):
        drawSimpleCube(SeatX,0,22,11,SeatWidth,6,(0.43,0.30,0.19))
        drawSimpleCube(SeatX,0,26,12,SeatWidth,2,(0.77,0.57,0.34))
    glBegin(GL_TRIANGLES)
    glColor3f(0.70,0.55,0.33)
    glVertex3f(98,-20,31)
    glVertex3f(122,0,31)
    glVertex3f(98,20,31)
    glEnd()
    drawSimpleCube(98,0,26,7,31,3,(0.20,0.45,0.46))
    for Side in (-1,1):
        drawSimpleCube(-43,Side*36,27,16,3,3,(0.47,0.33,0.22))


def drawPlayerBoat():
    """Frame-light hull: only motion transforms vary between frames."""
    glPushMatrix()
    VisualBob,VisualRoll=getBoatVisualMotion()
    glTranslatef(BoatPositionX,BoatPositionY,FloodWaterHeight+3+VisualBob)
    glRotatef(BoatFacingAngle,0,0,1)
    glRotatef(VisualRoll,1,0,0)
    glScalef(BoatModelScale,BoatModelScale,BoatModelScale)
    drawCachedScene('cinematic-player-boat',renderCinematicBoatHull,StaticSceneLists)
    glPopMatrix()

def getRowingPaddleTilt():
    if not IsBoatRowing:
        return 32.0
    Phase=2.0*math.pi*RowingAnimationTimer/0.65
    return 33.0+7.0*math.sin(Phase-0.45)


def drawPlayerHandsAndPaddles():
    glPushMatrix()

    VisualBob,VisualRoll=getBoatVisualMotion()
    glTranslatef(BoatPositionX,BoatPositionY,FloodWaterHeight+3+VisualBob)
    glRotatef(BoatFacingAngle,0,0,1)
    glRotatef(VisualRoll,1,0,0)
    glScalef(BoatModelScale,BoatModelScale,BoatModelScale)

    if IsBoatRowing==True:
        ArmSwing=RowingAnimationAngle
    else:
        ArmSwing=0

    PaddleSwing=ArmSwing*(24.0/17.0)
    PaddleDownTilt=getRowingPaddleTilt()

    if not ThirdPersonCamera:
        Skin=(0.88,0.67,0.48)
        Sleeve=(0.28,0.59,0.65)
        Wood=(0.43,0.25,0.13)
        BladeColor=(0.56,0.32,0.14)

        def drawLimb(From,To,Radius1,Radius2,Color,Slices=9):
            DX=To[0]-From[0]
            DY=To[1]-From[1]
            DZ=To[2]-From[2]
            Length=math.sqrt(DX*DX+DY*DY+DZ*DZ)
            if Length<=0.001:
                return
            glPushMatrix()
            glColor3f(*Color)
            glTranslatef(*From)
            AxisX=-DY
            AxisY=DX
            Horizontal=math.hypot(DX,DY)
            if Horizontal>0.00001:
                glRotatef(math.degrees(math.atan2(Horizontal,DZ)),AxisX,AxisY,0)
            elif DZ<0:
                glRotatef(180,1,0,0)
            gluCylinder(getSharedQuadric(),Radius1,Radius2,Length,Slices,2)
            glPopMatrix()

        Stroke=PaddleSwing*0.35
        StrokeWave=math.sin(RowingAnimationTimer*9.5) if IsBoatRowing else 0.0

        for Side in (-1,1):
            Shoulder=(-88.0,Side*18.0,55.0)
            Elbow=(-58.0-0.22*Stroke,Side*24.0,55.5+0.7*StrokeWave)
            Grip=(-17.0-0.55*Stroke,Side*28.0,47.0+1.2*StrokeWave)
            Inboard=(-38.0-0.30*Stroke,Side*18.0,49.5)
            Outboard=(30.0+0.28*Stroke,Side*71.0,35.0-0.8*StrokeWave)

            drawLimb(Shoulder,Elbow,7.4,6.0,Sleeve)
            drawLimb(Elbow,Grip,5.8,4.1,Skin)
            glPushMatrix()
            glTranslatef(*Grip)
            glColor3f(*Skin)
            gluSphere(getSharedQuadric(),4.8,9,7)
            glPopMatrix()

            drawLimb(Inboard,Grip,2.0,2.3,Wood,8)
            drawLimb(Grip,Outboard,2.6,2.3,Wood,8)

            DX=Outboard[0]-Grip[0]
            DY=Outboard[1]-Grip[1]
            Angle=math.degrees(math.atan2(DY,DX))
            glPushMatrix()
            glColor3f(*BladeColor)
            glTranslatef(Outboard[0],Outboard[1],Outboard[2]-1.5)
            glRotatef(Angle,0,0,1)
            glRotatef(12.0*Side+6.0*StrokeWave,1,0,0)
            glScalef(17,8,3.2)
            glutSolidCube(1)
            glPopMatrix()
        glPopMatrix()
        return

    ArmHeight=55
    ArmLength=30
    HandPositions=[]
    for Side in (-1,1):
        ShoulderX=-61
        ShoulderY=Side*14
        ArmAngle=Side*(6-ArmSwing)
        glPushMatrix()
        glColor3f(0.88,0.67,0.48)
        glTranslatef(ShoulderX,ShoulderY,ArmHeight)
        glRotatef(ArmAngle,0,0,1)
        glRotatef(90,0,1,0)
        gluCylinder(getSharedQuadric(),4.6,3.8,ArmLength,9,9)
        glPopMatrix()

        ArmRadians=math.radians(ArmAngle)
        HandX=ShoulderX+math.cos(ArmRadians)*ArmLength
        HandY=ShoulderY+math.sin(ArmRadians)*ArmLength
        HandPositions.append((HandX,HandY))
        glPushMatrix()
        glColor3f(0.88,0.67,0.48)
        glTranslatef(HandX,HandY,ArmHeight)
        gluSphere(getSharedQuadric(),5,9,9)
        glPopMatrix()

    PaddleLength=88
    PaddleHorizontalLength=PaddleLength*math.cos(math.radians(PaddleDownTilt))
    PaddleVerticalDrop=PaddleLength*math.sin(math.radians(PaddleDownTilt))
    for Side,(HandX,HandY) in zip((-1,1),HandPositions):
        PaddleAngle=Side*(62+PaddleSwing)
        PaddleRadians=math.radians(PaddleAngle)
        glPushMatrix()
        glColor3f(0.42,0.24,0.10)
        glTranslatef(HandX-3,HandY,ArmHeight-2)
        glRotatef(PaddleAngle,0,0,1)
        glRotatef(90+PaddleDownTilt,0,1,0)
        gluCylinder(getSharedQuadric(),2.6,2.4,PaddleLength,8,8)
        glPopMatrix()

        BladeX=HandX-3+math.cos(PaddleRadians)*PaddleHorizontalLength
        BladeY=HandY+math.sin(PaddleRadians)*PaddleHorizontalLength
        BladeZ=ArmHeight-2-PaddleVerticalDrop
        glPushMatrix()
        glColor3f(0.56,0.32,0.14)
        glTranslatef(BladeX,BladeY,BladeZ)
        glRotatef(PaddleAngle,0,0,1)
        glScalef(20,9,4)
        glutSolidCube(1)
        glPopMatrix()
    glPopMatrix()



def startRowingAnimation():
    global IsBoatRowing,RowingAnimationTimer

    if IsBoatRowing==False:
        IsBoatRowing=True
        RowingAnimationTimer=0


def updateRowingAnimation(DeltaTime):
    global IsBoatRowing,RowingAnimationTimer,RowingAnimationAngle

    if IsBoatRowing==True:
        RowingAnimationTimer=RowingAnimationTimer+DeltaTime
        Phase=2.0*math.pi*RowingAnimationTimer/0.65
        RowingAnimationAngle=17*math.sin(Phase)+2.5*math.sin(2*Phase)

        if RowingAnimationTimer>=0.65:
            IsBoatRowing=False
            RowingAnimationTimer=0
            RowingAnimationAngle=0


BRACUSolidVolumes=(
    (-132,10,89,191,374),
    (38,148,259,66,379),
    (206,102,59,112,379),
    (-8,40,58,66,333),
    (-56,-120,38,49,114),
    (44,-122,34,49,114),
)


def isBoatCollidingWithBuilding(PositionX,PositionY):
    for CurrentBuilding in BuildingList:
        BuildingPositionX=CurrentBuilding[0]
        BuildingPositionY=CurrentBuilding[1]
        BuildingHalfWidth=CurrentBuilding[2]
        BuildingHalfLength=CurrentBuilding[3]

        if BuildingPositionX-BuildingHalfWidth-BoatCollisionMargin<=PositionX<=BuildingPositionX+BuildingHalfWidth+BoatCollisionMargin and BuildingPositionY-BuildingHalfLength-BoatCollisionMargin<=PositionY<=BuildingPositionY+BuildingHalfLength+BoatCollisionMargin:
            return True

    return False



def doesBoatOverlapOrientedObject(BoatX,BoatY,ObjectX,ObjectY,
                                   ObjectAngle,ObjectHalfLength,ObjectHalfWidth,
                                   ExtraClearance=2.0):
    """Boat hull versus a vehicle or solid prop, in the flooded XY plane.

    Four separating-axis tests detect collisions even while the boat or the
    object is diagonal. Both rectangles approximate their visible dimensions,
    avoiding the oversized invisible boxes from the previous car collision.
    This uses only math and does not add an external physics engine.
    """
    BoatHalfLength=63.0
    BoatHalfWidth=27.0
    ObjectHalfLength+=ExtraClearance
    ObjectHalfWidth+=ExtraClearance
    DX=ObjectX-BoatX
    DY=ObjectY-BoatY
    FarLimit=BoatHalfLength+ObjectHalfLength+BoatHalfWidth+ObjectHalfWidth
    if DX*DX+DY*DY>FarLimit*FarLimit:
        return False

    BA=math.radians(BoatFacingAngle)
    OA=math.radians(ObjectAngle)
    BF=(math.cos(BA),math.sin(BA))
    BS=(-BF[1],BF[0])
    OF=(math.cos(OA),math.sin(OA))
    OS=(-OF[1],OF[0])
    for AX,AY in (BF,BS,OF,OS):
        Separation=abs(DX*AX+DY*AY)
        BoatReach=BoatHalfLength*abs(BF[0]*AX+BF[1]*AY)+BoatHalfWidth*abs(BS[0]*AX+BS[1]*AY)
        ObjectReach=ObjectHalfLength*abs(OF[0]*AX+OF[1]*AY)+ObjectHalfWidth*abs(OS[0]*AX+OS[1]*AY)
        if Separation>BoatReach+ObjectReach:
            return False
    return True


def doesBoatOverlapCar(BoatX,BoatY,CarX,CarY,CarAngle,Style=0,Clearance=2.0):
    HalfLength=45 if Style%3==1 else 40
    return doesBoatOverlapOrientedObject(BoatX,BoatY,CarX,CarY,
                                         CarAngle,HalfLength,20,Clearance)


def isBoatCollidingWithCar(PositionX,PositionY):
    for CarIndex,Car in enumerate(getSubmergedCarPositions()):
        if doesBoatOverlapCar(PositionX,PositionY,Car[0],Car[1],Car[2],CarIndex):
            return True
    for Car in getSlowMovingCarPositions():
        if doesBoatOverlapCar(PositionX,PositionY,Car[0],Car[1],Car[2],Car[3]):
            return True
    return False


def doesBoatOverlapRoundPost(BoatX,BoatY,PostX,PostY,PostRadius):
    """Circle-versus-boat-hull collision, including the visible bow/stern."""
    A=math.radians(BoatFacingAngle)
    DX=PostX-BoatX
    DY=PostY-BoatY
    Along=DX*math.cos(A)+DY*math.sin(A)
    Across=-DX*math.sin(A)+DY*math.cos(A)
    NearestX=max(-63.0,min(63.0,Along))
    NearestY=max(-27.0,min(27.0,Across))
    return (Along-NearestX)**2+(Across-NearestY)**2<=PostRadius**2


def isBoatCollidingWithStreetProps(PositionX,PositionY):
    """Solid roadside geometry only; foliage/rain/markers stay non-collidable."""
    for X,Y,Scale in CityTreeList:
        if doesBoatOverlapRoundPost(PositionX,PositionY,X,Y,5*Scale+3):
            return True
    for X,Y,Angle,Style in CityTeaStalls:
        if doesBoatOverlapOrientedObject(PositionX,PositionY,X,Y,Angle,57,61,2):
            return True
    for X,Y,Style,Name in CityBRACUShops:
        if doesBoatOverlapOrientedObject(PositionX,PositionY,X,Y-12,0,64,63,2):
            return True
    for X,Y,Angle,Kind in CityRoadsideProps:
        HalfLength=32 if Kind=='rickshaw' else 29
        HalfWidth=19 if Kind=='rickshaw' else 5
        if doesBoatOverlapOrientedObject(PositionX,PositionY,X,Y,Angle,HalfLength,HalfWidth):
            return True
    for X,Y in getStreetLightPositions():
        if doesBoatOverlapRoundPost(PositionX,PositionY,X,Y,8):
            return True
    if doesBoatOverlapRoundPost(PositionX,PositionY,145,-55,8):
        return True
    for District in PowerDistrictList:
        if doesBoatOverlapOrientedObject(PositionX,PositionY,
                                         District['repair_x'],District['repair_y'],
                                         0,19,18,2):
            return True
    Cars=getSubmergedCarPositions()
    for Index in BrokenCarIndices:
        if Index>=len(Cars):
            continue
        X,Y,Angle=Cars[Index]
        A=math.radians(Angle)
        DriverX=X+math.sin(A)*47
        DriverY=Y-math.cos(A)*47
        if doesBoatOverlapRoundPost(PositionX,PositionY,DriverX,DriverY,9):
            return True
    return False



def isBoatCollidingWithBRACU(PositionX,PositionY):
    LocalX=PositionX-BRACUPositionX
    LocalY=PositionY-BRACUPositionY
    for X,Y,HalfW,HalfL,TopZ in BRACUSolidVolumes:
        if (abs(LocalX-X)<=HalfW+BoatCollisionMargin and
                abs(LocalY-Y)<=HalfL+BoatCollisionMargin):
            return True
    return False

def isBoatCollidingWithLandmark(PositionX,PositionY):
    CollisionMargin=BoatCollisionMargin

    if 825-130-CollisionMargin<=PositionX<=825+130+CollisionMargin and 1350-70-CollisionMargin<=PositionY<=1350+70+CollisionMargin:
        return True

    return False



def isBoatPositionValid(PositionX,PositionY,CheckCars=True):
    WorldBoundaryMargin=35

    if PositionX<-WorldMapLimit+WorldBoundaryMargin or PositionX>WorldMapLimit-WorldBoundaryMargin:
        return False

    if PositionY<-WorldMapLimit+WorldBoundaryMargin or PositionY>WorldMapLimit-WorldBoundaryMargin:
        return False

    if isBoatCollidingWithBuilding(PositionX,PositionY)==True:
        return False

    if CheckCars and isBoatCollidingWithCar(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithStreetProps(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithBRACU(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithLandmark(PositionX,PositionY)==True:
        return False

    return True


TrafficContactMessageCooldown=0.0


def getCarOverlapSeverity(BoatX,BoatY,CarX,CarY,CarAngle,Style):
    """Zero outside a car, positive inside; decreases on a safe escape path.

    Unlike a yes/no collision test, this measures overlap on all four SAT
    axes. A boat already inside a moving car's footprint can row outward one
    small step at a time instead of being locked in place indefinitely.
    """
    BA=math.radians(BoatFacingAngle)
    OA=math.radians(CarAngle)
    BF=(math.cos(BA),math.sin(BA))
    BS=(-BF[1],BF[0])
    CF=(math.cos(OA),math.sin(OA))
    CS=(-CF[1],CF[0])
    DX,DY=CarX-BoatX,CarY-BoatY
    BoatLength,BoatWidth=63.0,27.0
    CarLength=45.0 if Style%3==1 else 40.0
    CarWidth=20.0
    CarLength+=2.0
    CarWidth+=2.0
    Depth=0.0
    for AX,AY in (BF,BS,CF,CS):
        Separation=abs(DX*AX+DY*AY)
        Reach=(BoatLength*abs(BF[0]*AX+BF[1]*AY)+
               BoatWidth*abs(BS[0]*AX+BS[1]*AY)+
               CarLength*abs(CF[0]*AX+CF[1]*AY)+
               CarWidth*abs(CS[0]*AX+CS[1]*AY))
        if Separation>=Reach:
            return 0.0
        Depth+=(Reach-Separation)/Reach
    return Depth


def getDynamicObstacleOverlapSeverity(PositionX,PositionY,ObstacleSnapshot=None):
    """Overlap with cars/debris; optional per-movement position snapshot.

    The original function re-created moving-car positions for BOTH endpoints
    of every movement substep. Those positions cannot change within a single
    movement call, so the caller can safely reuse one snapshot.
    """
    if ObstacleSnapshot is None:
        DebrisList=FloatingDebrisList
        ParkedCars=getSubmergedCarPositions()
        MovingCars=getSlowMovingCarPositions()
    else:
        DebrisList,ParkedCars,MovingCars=ObstacleSnapshot
    Severity=0.0
    for Debris in DebrisList:
        Radius=Debris['radius']+18.0
        Distance=math.hypot(PositionX-Debris['x'],PositionY-Debris['y'])
        if Distance<Radius:
            Severity+=(Radius-Distance)/Radius
    for CarIndex,Car in enumerate(ParkedCars):
        Severity+=getCarOverlapSeverity(PositionX,PositionY,
                                        Car[0],Car[1],Car[2],CarIndex)
    for Car in MovingCars:
        Severity+=getCarOverlapSeverity(PositionX,PositionY,
                                        Car[0],Car[1],Car[2],Car[3])
    return Severity


def moveBoatForwardOrBackward(MovementDirection,MovementScale=1.0):
    global BoatPositionX,BoatPositionY,BoatLastMovementTime,TrafficContactMessageCooldown
    BoatAngleInRadians=math.radians(BoatFacingAngle)
    BoatFacingDirectionX=math.cos(BoatAngleInRadians)
    BoatFacingDirectionY=math.sin(BoatAngleInRadians)
    if MovementDirection==1:
        BoatMovementDistance=BoatForwardMovementStep
    else:
        BoatMovementDistance=BoatBackwardMovementStep
    BoatMovementDistance=BoatMovementDistance*MovementScale
    if BoatBoostActive==True:
        BoatMovementDistance=BoatMovementDistance*1.65
    BoatLastMovementTime=GameTimeSeconds
    TotalMovement=BoatMovementDistance*MovementDirection
    SegmentCount=max(1,int(math.ceil(abs(TotalMovement)/9.0)))
    SegmentDistance=TotalMovement/SegmentCount
    ObstacleSnapshot=(FloatingDebrisList,getSubmergedCarPositions(),getSlowMovingCarPositions())
    CurrentOverlap=getDynamicObstacleOverlapSeverity(BoatPositionX,BoatPositionY,ObstacleSnapshot)
    for SegmentIndex in range(SegmentCount):
        NewBoatPositionX=BoatPositionX+BoatFacingDirectionX*SegmentDistance
        NewBoatPositionY=BoatPositionY+BoatFacingDirectionY*SegmentDistance
        if not isBoatPositionValid(NewBoatPositionX,NewBoatPositionY,CheckCars=False):
            break

        NextOverlap=getDynamicObstacleOverlapSeverity(NewBoatPositionX,NewBoatPositionY,ObstacleSnapshot)
        if NextOverlap>0.00001 and (CurrentOverlap<=0.00001 or
                                    NextOverlap>=CurrentOverlap-0.00001):
            if isBoatCollidingWithDebris(NewBoatPositionX,NewBoatPositionY):
                registerDebrisCollision()
            elif (TrafficContactMessageCooldown<=0.0 and
                  isBoatCollidingWithCar(NewBoatPositionX,NewBoatPositionY)):
                showGameMessage('Vehicle ahead so kindly reverse or steer around it.',2.0)
                TrafficContactMessageCooldown=3.0
            break
        BoatPositionX=NewBoatPositionX
        BoatPositionY=NewBoatPositionY
        CurrentOverlap=NextOverlap

def rotateBoatLeftOrRight(TurningDirection,TurningScale=1.0):
    global BoatFacingAngle,BoatLastMovementTime
    BoatFacingAngle=BoatFacingAngle+(BoatTurningStep*TurningDirection*TurningScale)
    BoatFacingAngle=BoatFacingAngle%360
    BoatLastMovementTime=GameTimeSeconds


def drawFloodedDhakaWorld():
    drawFloodWater()



RainDropPositions=[]

for RainDropNumber in range(330):
    RainDropPositions.append([random.uniform(-WorldMapLimit,WorldMapLimit),random.uniform(-WorldMapLimit,WorldMapLimit),random.uniform(100,950)])

RainSplashList=[]



def isInsideBRACUClearArea(PositionX,PositionY):
    DifferenceX=PositionX-BRACUPositionX
    DifferenceY=PositionY-(BRACUPositionY+18)
    ClearRadius=BRACUHalfSize+92
    return DifferenceX*DifferenceX+DifferenceY*DifferenceY<=ClearRadius*ClearRadius


def getBRACUDaylightWeight(PositionX,PositionY):
    """0 in storm; smooth 0..1 transition inside BRACU's sunshine zone.

    Uses the same center as the no-rain test but softens the lighting and
    water transition so the boundary is not a hard square/color switch.
    """
    DX=PositionX-BRACUPositionX
    DY=PositionY-(BRACUPositionY+18)
    if abs(DX)>570 or abs(DY)>570:
        return 0.0
    Distance=math.sqrt(DX*DX+DY*DY)
    Blend=max(0.0,min(1.0,(560.0-Distance)/300.0))
    return Blend*Blend*(3.0-2.0*Blend)


WaterRingAngles=[(math.cos(I*2*math.pi/28),math.sin(I*2*math.pi/28)) for I in range(29)]



def drawStormySky():
    """Storm front: layered slate horizon and nearly indigo cloud cover."""
    E=WorldMapLimit+35
    glBegin(GL_QUADS)
    for Wall in (((-E,E),(E,E)),((E,-E),(-E,-E)),((E,E),(E,-E)),((-E,-E),(-E,E))):
        A,B=Wall
        glColor3f(0.24,0.32,0.36)
        glVertex3f(A[0],A[1],15)
        glVertex3f(B[0],B[1],15)
        glColor3f(0.16,0.23,0.30)
        glVertex3f(B[0],B[1],730)
        glVertex3f(A[0],A[1],730)
        glColor3f(0.115,0.17,0.23)
        glVertex3f(A[0],A[1],730)
        glVertex3f(B[0],B[1],730)
        glVertex3f(B[0],B[1],1820)
        glVertex3f(A[0],A[1],1820)
    glColor3f(0.115,0.17,0.23)
    for P in ((-E,-E),(E,-E),(E,E),(-E,E)):
        glVertex3f(P[0],P[1],1820)
    glEnd()

def drawStormClouds():
    Clouds=[(-1230,-1220,800,310),(-350,-1440,770,350),(650,-1210,840,300),
            (1350,-430,760,270),(-1360,200,825,285),(1170,680,845,320),
            (-1180,1170,775,265),(520,1200,865,285)]
    for Index,Cloud in enumerate(Clouds):
        X,Y,Z,Size=Cloud
        for Offset in range(3):
            glPushMatrix()
            glTranslatef(X+(Offset-1)*Size*0.57,Y+(Offset%2)*Size*0.23,Z+Offset*10)
            glScalef(Size*0.75,Size*0.43,48+Index%3*8)
            Shade=0.27+Offset*0.026
            glColor3f(Shade*0.78,Shade*0.87,Shade)
            gluSphere(getSharedQuadric(),1,11,7)
            glPopMatrix()



def drawBRACUClearSky():
    RearY=WorldMapLimit-9
    Columns=(-1100,-850,-580,-290,0,290,580,850,1100)
    glBegin(GL_QUADS)
    for I in range(len(Columns)-1):
        ColorList=[]
        for X in (Columns[I],Columns[I+1]):
            Strength=max(0.0,1-abs(X)/1030.0)**1.40
            Bottom=(0.15+0.42*Strength,0.22+0.49*Strength,0.28+0.53*Strength)
            Top=(0.20+0.43*Strength,0.27+0.55*Strength,0.34+0.61*Strength)
            ColorList.append((Bottom,Top))
        for K,Index,Z in ((0,0,20),(1,1,20),(1,1,1740),(0,0,1740)):
            Color=ColorList[Index][0 if Z==20 else 1]
            glColor3f(*Color)
            glVertex3f(Columns[I+K],RearY,Z)
    glEnd()
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    glBegin(GL_QUADS)
    glColor4f(1.0,0.97,0.82,0.03)
    glVertex3f(-480,BRACUPositionY-250,30)
    glVertex3f(480,BRACUPositionY-250,30)
    glColor4f(0.92,0.96,1.0,0.25)
    glVertex3f(325,RearY-2,1480)
    glVertex3f(-325,RearY-2,1480)
    glEnd()
    glDepthMask(GL_TRUE)
    glDisable(GL_BLEND)


def drawRainAndSplashEffects():
    glLineWidth(1.0)
    glBegin(GL_LINES)
    for Index,Drop in enumerate(RainDropPositions):
        if RenderQuality=='BALANCED' and Index%2==1:
            continue
        X,Y,Z=Drop
        if not isInsideBRACUClearArea(X,Y):
            Blue=0.65+(Index%4)*0.045
            glColor3f(Blue*0.78,Blue*0.91,Blue)
            glVertex3f(X,Y,Z)
            glVertex3f(X+3.5,Y-1.4,Z-(16+Index%4*5))
    glEnd()

    Count=108 if RenderQuality=='HIGH' else 64
    Fall=WaterAnimationPhase*360.0
    glLineWidth(1.0)
    glBegin(GL_LINES)
    for Index in range(Count):
        X=BoatPositionX+((Index*151)%930)-465
        Y=BoatPositionY+((Index*269+37)%1050)-525
        if isInsideBRACUClearArea(X,Y):
            continue
        Z=42+((Index*83-Fall)%470)
        Bright=0.64+0.045*(Index%4)
        glColor3f(Bright*0.74,Bright*0.87,Bright)
        glVertex3f(X,Y,Z)
        glVertex3f(X+2.0,Y-1.0,Z-(14+Index%5*5))
    glEnd()

    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    glLineWidth(1.2)
    UnitRing=[(math.cos(I*2*math.pi/12),math.sin(I*2*math.pi/12)) for I in range(13)]
    glBegin(GL_LINES)
    for SplashIndex,Splash in enumerate(RainSplashList):
        if RenderQuality=='BALANCED' and SplashIndex%2==1:
            continue
        SX,SY,Age=Splash
        if (SX-BoatPositionX)**2+(SY-BoatPositionY)**2>480*480:
            continue
        Radius=1.8+Age*25
        Fade=max(0.0,0.62*(1.0-Age/0.55))
        glColor4f(0.79,0.94,0.97,Fade)
        Z=getWaterWaveHeight(SX,SY)+0.6
        for I in range(12):
            DX1,DY1=UnitRing[I]
            DX2,DY2=UnitRing[I+1]
            glVertex3f(SX+DX1*Radius,SY+DY1*Radius,Z)
            glVertex3f(SX+DX2*Radius,SY+DY2*Radius,Z)
        if Age<0.15:
            glColor4f(0.89,0.96,0.99,0.76*(1-Age/0.15))
            glVertex3f(SX,SY,Z)
            glVertex3f(SX,SY,Z+1.1+2.0*(1-Age/0.15))
    glEnd()
    glDepthMask(GL_TRUE)
    glDisable(GL_BLEND)


def updateRainDropPositions(DeltaTime):
    for CurrentRainDrop in RainDropPositions:
        CurrentRainDrop[2]=CurrentRainDrop[2]-(540*DeltaTime)

        if CurrentRainDrop[2]<FloodWaterHeight+2:
            if isInsideBRACUClearArea(CurrentRainDrop[0],CurrentRainDrop[1])==False and len(RainSplashList)<65 and random.random()<0.28:
                RainSplashList.append([CurrentRainDrop[0],CurrentRainDrop[1],0])

            CurrentRainDrop[0]=random.uniform(-WorldMapLimit,WorldMapLimit)
            CurrentRainDrop[1]=random.uniform(-WorldMapLimit,WorldMapLimit)
            CurrentRainDrop[2]=random.uniform(560,980)

    RemainingRainSplashList=[]

    for CurrentRainSplash in RainSplashList:
        CurrentRainSplash[2]=CurrentRainSplash[2]+DeltaTime

        if CurrentRainSplash[2]<0.55:
            RemainingRainSplashList.append(CurrentRainSplash)

    RainSplashList[:]=RemainingRainSplashList



def drawWeatherBackground():
    def renderSky():
        drawStormySky()
        drawStormClouds()
        drawBRACUClearSky()
    drawCachedScene('sky',renderSky,StaticSceneLists)


def drawWeatherEffects():
    drawRainAndSplashEffects()



def updateBRACUSunAura(DeltaTime):
    global BRACUAuraAngle

    BRACUAuraAngle=BRACUAuraAngle+(BRACUAuraSpeed*DeltaTime)

    if BRACUAuraAngle>=360:
        BRACUAuraAngle=BRACUAuraAngle-360






def drawBRACUSunAura():
    Pulse=0.5+0.5*math.sin(math.radians(BRACUAuraAngle*1.7))
    BaseRadius=BRACUHalfSize+80
    
    glPushMatrix()
    glTranslatef(BRACUPositionX+290,BRACUPositionY+165,700)
    glColor3f(0.98,0.92,0.68)
    gluSphere(getSharedQuadric(),33,18,14)
    glPopMatrix()

    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)

    TopRadius=BaseRadius*0.48
    BottomZ=FloodWaterHeight+1.5
    TopZ=760
    Segments=28
    glBegin(GL_QUADS)
    for Segment in range(Segments):
        Angle1=2*math.pi*Segment/Segments
        Angle2=2*math.pi*(Segment+1)/Segments
        Bottom1X=BRACUPositionX+math.cos(Angle1)*BaseRadius
        Bottom1Y=BRACUPositionY+18+math.sin(Angle1)*BaseRadius
        Bottom2X=BRACUPositionX+math.cos(Angle2)*BaseRadius
        Bottom2Y=BRACUPositionY+18+math.sin(Angle2)*BaseRadius
        Top1X=BRACUPositionX+math.cos(Angle1)*TopRadius
        Top1Y=BRACUPositionY+60+math.sin(Angle1)*TopRadius
        Top2X=BRACUPositionX+math.cos(Angle2)*TopRadius
        Top2Y=BRACUPositionY+60+math.sin(Angle2)*TopRadius
        glColor4f(0.98,0.95,0.80,0.11+0.03*Pulse)
        glVertex3f(Bottom1X,Bottom1Y,BottomZ)
        glVertex3f(Bottom2X,Bottom2Y,BottomZ)
        glColor4f(0.98,0.96,0.88,0.00)
        glVertex3f(Top2X,Top2Y,TopZ)
        glVertex3f(Top1X,Top1Y,TopZ)
    glEnd()

    for RingNumber in range(3):
        RingRadius=BaseRadius-(RingNumber*36)+12*math.sin(math.radians(BRACUAuraAngle*2+RingNumber*42))
        glLineWidth(4.0-RingNumber*0.8)
        glColor4f(0.98,0.89,0.34,0.75-RingNumber*0.18)
        glBegin(GL_LINE_LOOP)
        for Step in range(72):
            Angle=2*math.pi*Step/72.0
            glVertex3f(BRACUPositionX+math.cos(Angle)*RingRadius,
                       BRACUPositionY+18+math.sin(Angle)*RingRadius,
                       FloodWaterHeight+0.95+RingNumber*0.05)
        glEnd()

    glColor4f(0.96,0.94,0.72,0.10+0.03*Pulse)
    glBegin(GL_TRIANGLE_FAN)
    glVertex3f(BRACUPositionX,BRACUPositionY+18,FloodWaterHeight+0.6)
    for Step in range(73):
        Angle=2*math.pi*Step/72.0
        glVertex3f(BRACUPositionX+math.cos(Angle)*BaseRadius,
                   BRACUPositionY+18+math.sin(Angle)*BaseRadius,
                   FloodWaterHeight+0.6)
    glEnd()

    glDepthMask(GL_TRUE)
    glDisable(GL_BLEND)






def drawBRACUWindowFacade(LeftX,RightX,WallY,Columns,Rows):
    """Dark-blue glazed windows mounted flush to a real south-facing wall.

    WallY must be the actual *front face* of the building volume. The outward
    normal points toward decreasing Y (the direction the boat approaches from).
    No detached strips are placed over the courtyard or entrance.
    """
    GlassNavy=(0.035,0.105,0.235)
    GlassBlue=(0.075,0.18,0.34)
    GlassReflection=(0.15,0.31,0.46)
    ConcreteFrame=(0.69,0.69,0.64)
    ThinFrame=(0.44,0.53,0.56)
    CellWidth=(RightX-LeftX)/Columns
    GlassY=WallY-3.4
    for Column in range(Columns):
        CenterX=LeftX+(Column+0.5)*CellWidth
        for Row in range(Rows):
            WindowZ=139+Row*31
            WindowColor=GlassBlue if (Column+Row)%4==0 else GlassNavy
            drawSimpleCube(CenterX,GlassY,WindowZ,CellWidth-5.2,3.8,24,WindowColor)
            drawSimpleCube(CenterX-CellWidth*0.20,GlassY-2.1,WindowZ+7,
                           (CellWidth-5.2)*0.40,0.8,4.8,GlassReflection)
            drawSimpleCube(CenterX,GlassY-1.9,WindowZ-1,
                           CellWidth-5.0,0.9,1.25,(0.29,0.39,0.43))
            drawSimpleCube(CenterX,GlassY-2.1,WindowZ-12.2,
                           CellWidth-3.5,1.3,2.7,ThinFrame)

    for Column in range(Columns+1):
        X=LeftX+Column*CellWidth
        drawSimpleCube(X,WallY-7.8,229,3.9,9,224,ConcreteFrame)

    drawSimpleCube((LeftX+RightX)*0.5,WallY-7.6,124,
                   RightX-LeftX+5,7,5,ConcreteFrame)


def drawFlatSignText(CenterX,FrontY,BaseZ,Label,MaxWidth,LetterHeight,
                     LetterColor=(1,1,1),LineWidth=2.4):
    """Draw a flat sign on a wall whose outward face points toward -Y.

    GLUT bitmap characters are fixed pixel-sized objects and can clip or
    detach from an angled sign. GLUT stroke characters are FLAT vector lines
    measured in world units, so the sign and the text share perspective.
    This is not camera-facing/billboard text and has no extrusion or depth.
    """
    Font=GLUT_STROKE_ROMAN
    Width=sum(float(glutStrokeWidth(Font,ord(Character))) for Character in Label)
    if Width<=0:
        return
    Scale=min(MaxWidth/Width,LetterHeight/119.05)
    glPushMatrix()
    glTranslatef(CenterX,FrontY,BaseZ)
    glRotatef(90,1,0,0)
    glScalef(Scale,Scale,Scale)
    glTranslatef(-Width*0.5,0,0)
    glColor3f(*LetterColor)
    glLineWidth(LineWidth)
    for Character in Label:
        glutStrokeCharacter(Font,ord(Character))
    glLineWidth(1.0)
    glPopMatrix()



def drawBRACULowerBrickWing(LeftX,RightX,FrontWallY):
    """Clad the two formerly blank entrance wings with brick and greenery.

    FrontWallY is the REAL south-facing plane of the wing. All new pieces
    attach just outside that plane and are compiled into the BRACU display list.
    No collidable solids or new per-frame animation are introduced.
    """
    Width=RightX-LeftX
    CenterX=(LeftX+RightX)*0.5
    Brick=(0.51,0.32,0.26)
    Mortar=(0.39,0.27,0.24)
    Sand=(0.69,0.68,0.61)
    DarkVent=(0.15,0.23,0.24)
    drawSimpleCube(CenterX,FrontWallY-3.0,61,Width,6,88,Brick)
    for Z in (29,44,59,74,89):
        drawSimpleCube(CenterX,FrontWallY-6.3,Z,Width-4,1.0,1.5,Mortar)
    for X in (LeftX+4,RightX-4):
        drawSimpleCube(X,FrontWallY-7.0,60,5,3.0,89,Sand)
    for Index in range(4):
        X=LeftX+Width*(Index+0.70)/5.0
        drawSimpleCube(X,FrontWallY-7.1,48,8,1.4,34,DarkVent)
        drawSimpleCube(X,FrontWallY-7.9,66,10,2,2.5,Sand)
    drawSimpleCube(CenterX,FrontWallY-6.3,109,Width+10,11,7,Sand)
    drawSimpleCube(CenterX,FrontWallY-8.5,115,Width+8,10,5,(0.21,0.40,0.27))
    for Index in range(9):
        X=LeftX+7+(Width-14)*Index/8.0
        Length=12+(Index*7)%20
        Green=(0.17+0.02*(Index%3),0.33+0.025*(Index%4),0.17)
        drawSimpleCube(X,FrontWallY-11,107-Length*0.5,4.7,2.7,Length,Green)
        if Index%2==0:
            drawSimpleCube(X+3,FrontWallY-12.2,101-Length*0.6,8,2.7,5,
                           (0.24,0.44,0.22))


def drawBRACUCentralVerticalWindows():
    """Turn the tall blank entrance-side bridge wall into slim glazed bays."""
    FacadeY=-30.0
    drawSimpleCube(-8,FacadeY,250,99,7,149,(0.66,0.66,0.61))
    drawSimpleCube(-8,FacadeY-4.5,176,104,6,5,(0.51,0.55,0.52))
    drawSimpleCube(-8,FacadeY-4.5,326,104,6,5,(0.52,0.55,0.53))
    for Index in range(6):
        X=-46+Index*15
        drawSimpleCube(X,FacadeY-4.7,250,8.6,2.6,123,(0.11,0.22,0.29))
        drawSimpleCube(X-2.0,FacadeY-6.3,251,1.1,1.0,117,(0.28,0.42,0.46))
    for Index in range(7):
        X=-53.5+Index*15
        drawSimpleCube(X,FacadeY-7.0,251,3.2,10,147,(0.73,0.72,0.67))
    for Z in (215,289):
        drawSimpleCube(-8,FacadeY-7.4,Z,92,2,3.3,(0.60,0.63,0.60))


def renderBRACUStaticGeometry():
    Concrete=(0.70,0.68,0.61)
    ShadowConcrete=(0.60,0.60,0.55)
    DarkGlass=(0.14,0.25,0.29)
    GlassLine=(0.48,0.56,0.55)
    GreenWall=(0.16,0.37,0.24)
    Steel=(0.49,0.53,0.54)
    Solar=(0.10,0.19,0.25)

    glPushMatrix()
    glTranslatef(BRACUPositionX,BRACUPositionY,0)

    drawSimpleCube(0,0,FloodWaterHeight+7,540,510,14,(0.57,0.58,0.53))
    drawSimpleCube(0,-228,FloodWaterHeight+12,190,40,8,(0.64,0.64,0.58))
    drawSimpleCube(0,-178,FloodWaterHeight+12,126,72,8,(0.63,0.63,0.57))

    drawSimpleCube(-132,10,226,178,382,286,Concrete)
    drawSimpleCube(38,148,230,518,132,294,Concrete)
    drawSimpleCube(206,102,228,118,224,290,Concrete)
    drawSimpleCube(-8,40,208,116,132,250,(0.62,0.63,0.58))

    drawSimpleCube(-132,18,67,178,382,92,(0.66,0.65,0.60))
    drawSimpleCube(38,148,69,518,132,88,(0.66,0.65,0.60))
    drawSimpleCube(206,102,68,118,224,90,(0.65,0.64,0.59))
    drawSimpleCube(-56,-120,66,76,98,90,(0.64,0.63,0.58))
    drawSimpleCube(44,-122,66,68,98,90,(0.64,0.63,0.58))

    drawBRACULowerBrickWing(-209,-113,-181)
    drawBRACULowerBrickWing(158,254,-10)

    drawSimpleCube(58,8,117,196,218,6,(0.25,0.44,0.31))
    drawSimpleCube(58,8,121,214,236,2,(0.55,0.61,0.49))

    drawSimpleCube(-6,-178,71,148,12,105,(0.18,0.30,0.32))
    drawSimpleCube(-6,-204,115,186,58,9,(0.61,0.62,0.57))
    drawSimpleCube(-6,-210,111,172,44,3,(0.28,0.34,0.34))
    for X in (-92,-46,46,92):
        drawSimpleCube(X,-204,67,12,14,101,(0.66,0.66,0.60))

    drawBRACUCentralVerticalWindows()

    drawSimpleCube(-6,-218,145,218,7,42,(0.095,0.19,0.215))
    drawSimpleCube(-6,-222,164,218,2,2,(0.66,0.76,0.70))
    drawSimpleCube(-6,-214,127,218,1.5,2,(0.10,0.18,0.19))
    drawFlatSignText(-6,-224.5,135,'BRAC UNIVERSITY',196,20,
                     (0.99,0.95,0.75),LineWidth=2.6)

    drawSimpleCube(-6,-213,173,192,12,6,(0.25,0.41,0.27))
    for Index in range(11):
        X=-92+Index*17.2
        Hang=5+(Index*3)%8
        drawSimpleCube(X,-221,169-Hang*0.5,3.4,2,Hang,
                       (0.18+0.015*(Index%3),0.39+0.025*(Index%4),0.22))
    for X in (-29,17):
        drawSimpleCube(X,-215,64,40,3,75,(0.075,0.19,0.27))
        drawSimpleCube(X,-218,66,1.6,4,72,(0.63,0.69,0.66))
        drawSimpleCube(X+12,-219,62,2.5,3,16,(0.86,0.73,0.48))
    drawSimpleCube(-6,-220,103,88,5,3,(0.66,0.69,0.63))

    drawBRACUWindowFacade(-214,-53,-181,8,7)
    drawBRACUWindowFacade(153,259,-10,5,7)

    for Column in range(17):
        X=-192+Column*24
        drawSimpleCube(X,78,228,16,4,232,DarkGlass)
        for Floor in range(6):
            Z=136+Floor*34
            drawSimpleCube(X,75.5,Z,16,2,4,GlassLine)

    for Column in range(11):
        X=-86+Column*26
        drawSimpleCube(X,214,226,18,4.5,226,DarkGlass)
        for Floor in range(6):
            Z=138+Floor*34
            drawSimpleCube(X,210,Z,18,2.3,4,GlassLine)

    for Floor in range(6):
        Z=138+Floor*36
        drawSimpleCube(268,100,Z,4,176,25,DarkGlass)
        drawSimpleCube(271,100,Z+13,2,182,4,(0.58,0.60,0.56))
    for Column in range(4):
        Y=42+Column*38
        drawSimpleCube(152,Y,210,6,20,205,DarkGlass)
        for Floor in range(5):
            Z=138+Floor*36
            drawSimpleCube(148,Y,Z,4,20,4,GlassLine)

    drawSimpleCube(128,26,232,24,188,258,GreenWall)
    drawSimpleCube(-92,-166,228,24,12,252,GreenWall)
    drawSimpleCube(-60,56,222,18,140,226,(0.17,0.35,0.23))
    for Leaf in range(10):
        Z=132+Leaf*22
        drawSimpleCube(126+(-1)**Leaf*2,26,Z,30,8,12,(0.24,0.43+0.03*(Leaf%3),0.27))
        drawSimpleCube(-92,-176,Z,28,7,11,(0.25,0.42+0.03*((Leaf+1)%3),0.26))

    drawSimpleCube(-132,10,372,184,388,8,(0.74,0.73,0.67))
    drawSimpleCube(38,148,378,524,138,8,(0.74,0.73,0.67))
    drawSimpleCube(206,102,376,124,230,8,(0.74,0.73,0.67))
    for X,Y,W,H in ((-132,10,56,160),(118,150,56,70),(-188,112,46,48)):
        drawSimpleCube(X,Y,385,W,H,6,(0.28,0.47,0.30))

    RoofZ=405
    Panels=[(-247,-24,-178,210),(-24,260,95,212),(155,257,-8,210)]
    for X1,X2,Y1,Y2 in Panels:
        XC=(X1+X2)*0.5
        YC=(Y1+Y2)*0.5
        W=X2-X1
        H=Y2-Y1
        drawSimpleCube(XC,YC,RoofZ-5,W+10,H+10,10,Steel)
        drawSimpleCube(XC,YC,RoofZ+1,W-6,H-6,2,Solar)
        glColor3f(0.39,0.51,0.55)
        glBegin(GL_LINES)
        Cols=max(2,int(W/24))
        Rows=max(2,int(H/24))
        for I in range(1,Cols):
            X=X1+W*I/Cols
            glVertex3f(X,Y1+4,RoofZ+3.2)
            glVertex3f(X,Y2-4,RoofZ+3.2)
        for J in range(1,Rows):
            Y=Y1+H*J/Rows
            glVertex3f(X1+4,Y,RoofZ+3.2)
            glVertex3f(X2-4,Y,RoofZ+3.2)
        glEnd()

    for X,Y,H in ((-247,16,60),(-24,16,60),(-247,210,60),(-24,210,60),(-24,95,56),(260,95,56),(155,-8,56),(260,-8,56)):
        drawSimpleCube(X,Y,RoofZ-30,7,7,H,Steel)

    drawSimpleCube(-112,-243,FloodWaterHeight+4,92,38,2,(0.30,0.49,0.57))
    drawSimpleCube(104,-243,FloodWaterHeight+4,92,38,2,(0.30,0.49,0.57))

    for X in (-218,-185,-151,-118,-85,-53):
        drawSimpleCube(X,-193,240,4.0,20,256,(0.75,0.73,0.66))
        drawSimpleCube(X,-204,247,2.3,3.5,250,(0.53,0.53,0.49))
    for X in (146,172,197,222,247,265):
        drawSimpleCube(X,-22,241,4.0,19,256,(0.76,0.74,0.67))
    for Z in (166,228,290):
        drawSimpleCube(-132,-193,Z,169,7,3.6,(0.70,0.70,0.65))
        drawSimpleCube(206,-23,Z,113,7,3.6,(0.70,0.70,0.65))

    for X,Y,Length in ((-92,-178,97),(131,27,114)):
        for Index in range(12):
            Z=157+Index*16
            LeafGreen=(0.18+0.02*(Index%3),0.39+0.035*(Index%4),0.20)
            drawSimpleCube(X,Y-4,Z,18,6,7,LeafGreen)
        drawSimpleCube(X,Y-6,267,3,7,222,(0.39,0.50,0.39))

    glColor3f(0.50,0.59,0.59)
    glLineWidth(2)
    glBegin(GL_LINES)
    for RoofX in (-240,-190,-140,-90,-38,40,115,192,252):
        glVertex3f(RoofX,100,391)
        glVertex3f(RoofX,211,391)
    for RoofY in (100,155,207):
        glVertex3f(-240,RoofY,391)
        glVertex3f(254,RoofY,391)
    glEnd()

    glPopMatrix()

def drawBRACUDestination():
    if isWorldObjectInView(BRACUPositionX,BRACUPositionY,720):
        glDisable(GL_FOG)
        try:
            drawCachedScene('BRACU-architecture',renderBRACUStaticGeometry,StaticSceneLists)
            drawBRACUSunAura()
        finally:
            glEnable(GL_FOG)




def begin2DDrawing():
    glDisable(GL_DEPTH_TEST)
    glDisable(GL_FOG)
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    gluOrtho2D(0,WindowWidth,0,WindowHeight)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()


def end2DDrawing():
    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)
    glDisable(GL_BLEND)
    glEnable(GL_DEPTH_TEST)



def draw2DRectangle(LeftPosition,BottomPosition,RightPosition,TopPosition,RectangleColor):
    glColor3f(RectangleColor[0],RectangleColor[1],RectangleColor[2])
    glBegin(GL_QUADS)
    glVertex3f(LeftPosition,BottomPosition,0)
    glVertex3f(RightPosition,BottomPosition,0)
    glVertex3f(RightPosition,TopPosition,0)
    glVertex3f(LeftPosition,TopPosition,0)
    glEnd()



def draw2DText(PositionX,PositionY,Text,TextColor=(1,1,1),TextFont=GLUT_BITMAP_HELVETICA_18):
    glColor3f(TextColor[0],TextColor[1],TextColor[2])
    glRasterPos2f(PositionX,PositionY)
    for CurrentCharacter in str(Text):
        glutBitmapCharacter(TextFont,ord(CurrentCharacter))

def drawSimpleCube(PositionX,PositionY,PositionZ,Width,Length,Height,ObjectColor):
    drawScaledCube(PositionX,PositionY,PositionZ,Width,Length,Height,
                   ObjectColor[0],ObjectColor[1],ObjectColor[2])



def convertWorldPositionToMinimap(PositionX,PositionY,MinimapLeft,MinimapBottom,MinimapSize):
    NormalizedPositionX=(PositionX+WorldMapLimit)/(WorldMapLimit*2)
    NormalizedPositionY=(PositionY+WorldMapLimit)/(WorldMapLimit*2)
    MinimapPositionX=MinimapLeft+NormalizedPositionX*MinimapSize
    MinimapPositionY=MinimapBottom+NormalizedPositionY*MinimapSize
    return MinimapPositionX,MinimapPositionY


def drawMinimapRoads(MinimapLeft,MinimapBottom,MinimapSize):
    MinimapRoadColor=(0.14,0.32,0.40)
    for RoadPositionX in VerticalRoadPositions:
        RoadWorldLeft=RoadPositionX-RoadWidth/2
        RoadWorldRight=RoadPositionX+RoadWidth/2
        MinimapRoadLeft,MinimapRoadBottom=convertWorldPositionToMinimap(RoadWorldLeft,-WorldMapLimit,MinimapLeft,MinimapBottom,MinimapSize)
        MinimapRoadRight,MinimapRoadTop=convertWorldPositionToMinimap(RoadWorldRight,WorldMapLimit,MinimapLeft,MinimapBottom,MinimapSize)
        draw2DRectangle(MinimapRoadLeft,MinimapRoadBottom,MinimapRoadRight,MinimapRoadTop,MinimapRoadColor)
    for RoadPositionY in HorizontalRoadPositions:
        RoadWorldBottom=RoadPositionY-RoadWidth/2
        RoadWorldTop=RoadPositionY+RoadWidth/2
        MinimapRoadLeft,MinimapRoadBottom=convertWorldPositionToMinimap(-WorldMapLimit,RoadWorldBottom,MinimapLeft,MinimapBottom,MinimapSize)
        MinimapRoadRight,MinimapRoadTop=convertWorldPositionToMinimap(WorldMapLimit,RoadWorldTop,MinimapLeft,MinimapBottom,MinimapSize)
        draw2DRectangle(MinimapRoadLeft,MinimapRoadBottom,MinimapRoadRight,MinimapRoadTop,MinimapRoadColor)




def drawMinimapSymbolAt(X,Y,Kind,Pending=False):
    if Kind=='HOME':
        Fill=(0.15,0.94,0.98)
        Radius=8
        glColor3f(0.01,0.04,0.07)
        glBegin(GL_QUADS)
        for PX,PY in ((X-10,Y-10),(X+10,Y-10),(X+10,Y+10),(X-10,Y+10)):
            glVertex2f(PX,PY)
        glEnd()
        glColor3f(*( (0.08,0.30,0.36) if Pending else Fill ))
        glBegin(GL_QUADS)
        for PX,PY in ((X-7,Y-7),(X+7,Y-7),(X+7,Y+7),(X-7,Y+7)):
            glVertex2f(PX,PY)
        glEnd()
        glColor3f(*Fill) if Pending else glColor3f(1.0,1.0,1.0)
        glLineWidth(2.2)
        glBegin(GL_LINES)
        for PX1,PY1,PX2,PY2 in ((X-3,Y-4,X-3,Y+4),
                                 (X+3,Y-4,X+3,Y+4),
                                 (X-3,Y,X+3,Y)):
            glVertex2f(PX1,PY1)
            glVertex2f(PX2,PY2)
        glEnd()
    elif Kind=='SOS':
        Fill=(1.0,0.26,0.74)
        glColor3f(0.02,0.03,0.07)
        glBegin(GL_QUADS)
        for PX,PY in ((X,Y+12),(X+12,Y),(X,Y-12),(X-12,Y)):
            glVertex2f(PX,PY)
        glEnd()
        glColor3f(*( (0.42,0.12,0.33) if Pending else Fill ))
        glBegin(GL_QUADS)
        for PX,PY in ((X,Y+8),(X+8,Y),(X,Y-8),(X-8,Y)):
            glVertex2f(PX,PY)
        glEnd()
        glColor3f(*Fill) if Pending else glColor3f(1,1,1)
        glLineWidth(2.4)
        glBegin(GL_LINES)
        glVertex2f(X,Y+4)
        glVertex2f(X,Y-1.6)
        glEnd()
        glPointSize(2.7)
        glBegin(GL_POINTS)
        glVertex2f(X,Y-4.3)
        glEnd()
    elif Kind=='BRACU':
        glColor3f(0.02,0.04,0.06)
        glBegin(GL_TRIANGLE_FAN)
        glVertex2f(X,Y)
        for I in range(17):
            Angle=math.tau*I/16
            glVertex2f(X+9*math.cos(Angle),Y+9*math.sin(Angle))
        glEnd()
        glColor3f(1.0,0.76,0.26)
        glBegin(GL_TRIANGLE_FAN)
        glVertex2f(X,Y)
        for I in range(17):
            Angle=math.tau*I/16
            glVertex2f(X+6.8*math.cos(Angle),Y+6.8*math.sin(Angle))
        glEnd()
        glColor3f(0.08,0.12,0.12)
        glBegin(GL_QUADS)
        for PX,PY in ((X-2.4,Y-3),(X+2.4,Y-3),(X+2.4,Y+3),(X-2.4,Y+3)):
            glVertex2f(PX,PY)
        glEnd()
    elif Kind=='DOCK':
        glColor3f(0.01,0.06,0.07)
        glBegin(GL_TRIANGLES)
        for PX,PY in ((X,Y+10),(X+10,Y-9),(X-10,Y-9)):
            glVertex2f(PX,PY)
        glEnd()
        glColor3f(0.50,1.0,0.28)
        glBegin(GL_TRIANGLES)
        for PX,PY in ((X,Y+7),(X+7,Y-6),(X-7,Y-6)):
            glVertex2f(PX,PY)
        glEnd()
    elif Kind=='REPAIR':
        glColor3f(0.02,0.04,0.07)
        glPointSize(12)
        glBegin(GL_POINTS)
        glVertex2f(X,Y)
        glEnd()
        glColor3f(1.0,0.53,0.23)
        glPointSize(9)
        glBegin(GL_POINTS)
        glVertex2f(X,Y)
        glEnd()
        glColor3f(0.05,0.08,0.09)
        glLineWidth(2)
        glBegin(GL_LINES)
        glVertex2f(X-3,Y)
        glVertex2f(X+3,Y)
        glVertex2f(X,Y-3)
        glVertex2f(X,Y+3)
        glEnd()
    elif Kind=='LANDMARK':
        glColor3f(0.50,0.58,0.60)
        glPointSize(4)
        glBegin(GL_POINTS)
        glVertex2f(X,Y)
        glEnd()
    glLineWidth(1)
    glPointSize(1)


def drawMinimapSymbol(WorldX,WorldY,Left,Bottom,Size,Kind,Pending=False):
    X,Y=convertWorldPositionToMinimap(WorldX,WorldY,Left,Bottom,Size)
    drawMinimapSymbolAt(X,Y,Kind,Pending)


def drawMinimapLegendEntry(X,Y,Kind,Caption,Scale,TextOffset):
    """One legend key; both camera modes share these drawing operations."""
    glPushMatrix()
    glTranslatef(X,Y,0)
    glScalef(Scale,Scale,1)
    drawMinimapSymbolAt(0,0,Kind)
    glPopMatrix()
    draw2DText(X+TextOffset,Y-4,Caption,(0.88,0.96,0.96),GLUT_BITMAP_HELVETICA_10)


def drawMinimapLegend(Left,Bottom):
    PanelLeft=Left-8
    PanelBottom=Bottom-61
    drawHUDPanel(PanelLeft,PanelBottom,188,51,(0.017,0.063,0.086),0.96,(0.32,0.56,0.61))
    Items=[('HOME',Left+4,PanelBottom+34,'HOME'),
           ('SOS',Left+94,PanelBottom+34,'SOS'),
           ('BRACU',Left+4,PanelBottom+12,'BRACU'),
           ('DOCK',Left+94,PanelBottom+12,'DOCK')]
    for Kind,X,Y,Text in Items:
        drawMinimapLegendEntry(X,Y,Kind,Text,0.62,10)


def drawCompactFirstPersonMinimapLegend(Left,Bottom,Size):
    """Two restrained legend rows under the small first-person minimap."""
    PanelBottom=Bottom-45
    drawHUDPanel(Left-8,PanelBottom,Size+16,36,
                 (0.017,0.063,0.086),0.82,(0.32,0.56,0.61))
    for Kind,X,Y,Caption in (
        ('HOME',Left+5,PanelBottom+24,'HOME'),
        ('SOS',Left+77,PanelBottom+24,'SOS'),
        ('BRACU',Left+5,PanelBottom+9,'BRACU'),
        ('DOCK',Left+77,PanelBottom+9,'DOCK')):
        drawMinimapLegendEntry(X,Y,Kind,Caption,0.50,9)


def drawRealTimeMinimap():
    begin2DDrawing()
    Compact=not ThirdPersonCamera
    Size=140 if Compact else 172
    Left=WindowWidth-Size-18
    Bottom=WindowHeight-Size-18
    drawHUDPanel(Left-8,Bottom-8,Size+16,Size+16,
                 (0.017,0.063,0.086),0.83 if Compact else 0.95,(0.45,0.84,0.79))
    draw2DRectangle(Left,Bottom,Left+Size,Bottom+Size,(0.085,0.17,0.195))
    drawMinimapRoads(Left,Bottom,Size)
    for Landmark in LandmarkList:
        if not Landmark['taken']:
            drawMinimapSymbol(Landmark['photo_x'],Landmark['photo_y'],Left,Bottom,Size,'LANDMARK')
    drawMinimapSymbol(BRACUPositionX,BRACUPositionY,Left,Bottom,Size,'BRACU')
    drawMinimapSymbol(DeliveryZoneX,DeliveryZoneY,Left,Bottom,Size,'DOCK')
    if PowerOutageActive:
        District=getCurrentPowerDistrict()
        drawMinimapSymbol(District['repair_x'],District['repair_y'],Left,Bottom,Size,'REPAIR')
    drawArcadeMinimapMarkers(Left,Bottom,Size)
    PX,PY=convertWorldPositionToMinimap(BoatPositionX,BoatPositionY,Left,Bottom,Size)
    Angle=math.radians(BoatFacingAngle)
    FX,FY=math.cos(Angle),math.sin(Angle)
    SX,SY=-FY,FX
    glColor3f(0.02,0.06,0.08)
    glBegin(GL_TRIANGLES)
    for X,Y in ((PX+FX*13,PY+FY*13),
                (PX-FX*8+SX*8,PY-FY*8+SY*8),
                (PX-FX*8-SX*8,PY-FY*8-SY*8)):
        glVertex2f(X,Y)
    glEnd()
    glColor3f(1.0,1.0,1.0)
    glBegin(GL_TRIANGLES)
    for X,Y in ((PX+FX*9,PY+FY*9),
                (PX-FX*5+SX*5,PY-FY*5+SY*5),
                (PX-FX*5-SX*5,PY-FY*5-SY*5)):
        glVertex2f(X,Y)
    glEnd()
    if Compact:
        draw2DText(Left+8,Bottom+Size-14,'N  DHAKA',
                   (0.90,0.94,0.90),GLUT_BITMAP_HELVETICA_10)
        drawCompactFirstPersonMinimapLegend(Left,Bottom,Size)
    else:
        draw2DText(Left+10,Bottom+Size-16,'N  |  DHAKA',
                   (0.90,0.94,0.90),GLUT_BITMAP_HELVETICA_12)
        drawMinimapLegend(Left,Bottom)
    end2DDrawing()



def drawShaheedMinar():
    LandmarkPositionX=825
    LandmarkPositionY=1350
    drawSimpleCube(LandmarkPositionX,LandmarkPositionY,FloodWaterHeight+8,260,140,16,(0.54,0.28,0.16))
    drawSimpleCube(LandmarkPositionX,LandmarkPositionY,FloodWaterHeight+16,220,100,10,(0.86,0.85,0.84))
    glPushMatrix()
    glTranslatef(LandmarkPositionX,LandmarkPositionY-8,FloodWaterHeight+132)
    glColor3f(0.90,0.10,0.13)
    glScalef(84,10,84)
    gluSphere(getSharedQuadric(),1,18,18)
    glPopMatrix()
    FrameInformation=[[-118,96],[-58,160],[0,210],[58,160],[118,96]]
    for CurrentFrame in FrameInformation:
        FrameOffsetX=CurrentFrame[0]
        FrameHeight=CurrentFrame[1]
        FrameColor=(0.96,0.96,0.95)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX-10,LandmarkPositionY,FloodWaterHeight+16+FrameHeight*0.5,10,18,FrameHeight,FrameColor)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX+10,LandmarkPositionY,FloodWaterHeight+16+FrameHeight*0.5,10,18,FrameHeight,FrameColor)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX,LandmarkPositionY,FloodWaterHeight+16+FrameHeight,36,18,10,FrameColor)


def drawLandmarkWorldObject(LandmarkInformation):
    if LandmarkInformation["name"]=="Shaheed Minar":
        drawShaheedMinar()


def drawLandmarkPhotoSpot(LandmarkInformation):
    if LandmarkInformation["taken"]==True:
        PhotoSpotColor=(0.25,0.85,0.30)
    else:
        PhotoSpotColor=(1.0,0.47,0.08)
    drawSimpleCube(LandmarkInformation["photo_x"],LandmarkInformation["photo_y"],FloodWaterHeight+3.5,68,68,7,PhotoSpotColor)


def calculate2DDistance(FirstPositionX,FirstPositionY,SecondPositionX,SecondPositionY):
    DifferenceX=SecondPositionX-FirstPositionX
    DifferenceY=SecondPositionY-FirstPositionY
    return math.sqrt(DifferenceX*DifferenceX+DifferenceY*DifferenceY)

def calculateAngleDifference(FirstAngle,SecondAngle):
    AngleDifference=(FirstAngle-SecondAngle+180)%360-180
    return abs(AngleDifference)


def tryLandmarkPhoto():
    global PhotoFlashTimer,PhotoPopupTimer,PhotoPopupTitle,PhotoPopupLines
    ClosestLandmark=None
    ClosestLandmarkDistance=999999
    for CurrentLandmark in LandmarkList:
        if CurrentLandmark["taken"]==True:
            continue
        CurrentDistance=calculate2DDistance(BoatPositionX,BoatPositionY,CurrentLandmark["photo_x"],CurrentLandmark["photo_y"])
        if CurrentDistance<ClosestLandmarkDistance:
            ClosestLandmarkDistance=CurrentDistance
            ClosestLandmark=CurrentLandmark
    if ClosestLandmark==None:
        print("All landmark photos completed!")
        return
    if ClosestLandmarkDistance>PhotoCaptureRadius:
        print("Move onto an orange photo spot first")
        return
    DifferenceX=ClosestLandmark["x"]-BoatPositionX
    DifferenceY=ClosestLandmark["y"]-BoatPositionY
    TargetFacingAngle=math.degrees(math.atan2(DifferenceY,DifferenceX))
    FacingDifference=calculateAngleDifference(BoatFacingAngle,TargetFacingAngle)
    if FacingDifference<=PhotoFacingAngleTolerance:
        ClosestLandmark["taken"]=True
        CompletedPhotoCount=0
        for CurrentLandmark in LandmarkList:
            if CurrentLandmark["taken"]==True:
                CompletedPhotoCount=CompletedPhotoCount+1
        PhotoFlashTimer=3.0
        PhotoPopupTimer=10.0
        PhotoPopupTitle=ClosestLandmark["name"]
        PhotoPopupLines=list(ClosestLandmark["info_lines"])
        global Score
        Score=Score+70
        showGameMessage("Landmark photographed! +70 points",3)
        print("Photo captured:",ClosestLandmark["name"],CompletedPhotoCount,"/",len(LandmarkList))
    else:
        print("Face the landmark, then press P")

def drawPhotoFeedback():
    if PhotoFlashTimer<=0 and PhotoPopupTimer<=0:
        return
    begin2DDrawing()
    if PhotoFlashTimer>2.82:
        glColor4f(1.0,1.0,0.96,0.46)
        glBegin(GL_QUADS)
        for X,Y in ((0,0),(WindowWidth,0),(WindowWidth,WindowHeight),(0,WindowHeight)):
            glVertex3f(X,Y,0)
        glEnd()
    if PhotoPopupTimer>0 and PhotoPopupTitle:
        drawHUDPanel(658,338,324,248,(0.019,0.060,0.080),0.94,(0.95,0.78,0.45))
        draw2DText(673,556,'LANDMARK RECORDED',(0.95,0.78,0.45),GLUT_BITMAP_HELVETICA_12)
        draw2DText(673,523,PhotoPopupTitle,(0.90,0.97,0.95),GLUT_BITMAP_HELVETICA_18)
        YY=493
        for Line in PhotoPopupLines:
            draw2DText(673,YY,Line[:42],(0.79,0.91,0.92),GLUT_BITMAP_HELVETICA_12)
            YY-=24
        draw2DText(673,352,'PHOTO CHECK-IN COMPLETE',(0.52,0.94,0.80),GLUT_BITMAP_HELVETICA_12)
    end2DDrawing()


def updatePhotoFeedback(DeltaTime):
    global PhotoFlashTimer,PhotoPopupTimer,PhotoPopupTitle,PhotoPopupLines
    if PhotoFlashTimer>0:
        PhotoFlashTimer=PhotoFlashTimer-DeltaTime
        if PhotoFlashTimer<0:
            PhotoFlashTimer=0
    if PhotoPopupTimer>0:
        PhotoPopupTimer=PhotoPopupTimer-DeltaTime
        if PhotoPopupTimer<0:
            PhotoPopupTimer=0
            PhotoPopupTitle=""
            PhotoPopupLines=[]


def isBoatInsideTrafficZone():
    return TrafficZone[0]<=BoatPositionX<=TrafficZone[1] and TrafficZone[2]<=BoatPositionY<=TrafficZone[3]

def updateFloodTrafficSignal(DeltaTime):
    global TrafficTimer,TrafficState
    TrafficTimer=TrafficTimer+DeltaTime
    if TrafficState=="GREEN":
        if TrafficTimer>=TrafficGreenDuration:
            TrafficState="RED"
            TrafficTimer=0
    else:
        if TrafficTimer>=TrafficRedDuration:
            TrafficState="GREEN"
            TrafficTimer=0

def applyFloodTrafficRule():
    global TrafficSafeX,TrafficSafeY,BoatPositionX,BoatPositionY,TrafficViolations,TrafficViolationMessageTimer,TrafficWasInside,Score
    BoatInsideTrafficZone=isBoatInsideTrafficZone()
    if BoatInsideTrafficZone==False:
        TrafficSafeX=BoatPositionX
        TrafficSafeY=BoatPositionY
    if BoatInsideTrafficZone==True and TrafficWasInside==False and TrafficState=="RED":
        BoatPositionX=TrafficSafeX
        BoatPositionY=TrafficSafeY
        TrafficViolations=TrafficViolations+1
        Score=max(0,Score-35)
        TrafficViolationMessageTimer=2.5
        BoatInsideTrafficZone=False
        print("RED LIGHT! Returned to the stop line. Violations:",TrafficViolations)
    TrafficWasInside=BoatInsideTrafficZone

def drawFloodTrafficSignal():
    glColor3f(0.95,0.82,0.18)
    glBegin(GL_QUADS)
    glVertex3f(-100,-170,FloodWaterHeight+2)
    glVertex3f(100,-170,FloodWaterHeight+2)
    glVertex3f(100,-152,FloodWaterHeight+2)
    glVertex3f(-100,-152,FloodWaterHeight+2)
    glEnd()
    glPushMatrix()
    glTranslatef(145,-55,FloodWaterHeight-4)
    glColor3f(0.15,0.15,0.16)
    gluCylinder(getSharedQuadric(),5,4,145,10,8)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(145,-55,FloodWaterHeight+148)
    if TrafficState=="GREEN":
        glColor3f(0.05,1.0,0.15)
    else:
        glColor3f(1.0,0.05,0.05)
    gluSphere(getSharedQuadric(),22,12,10)
    glPopMatrix()

def drawTrafficViolationFeedback():
    if TrafficViolationMessageTimer<=0:
        return
    begin2DDrawing()
    MessageBoxLeft=250
    MessageBoxRight=750
    MessageBoxBottom=360
    MessageBoxTop=440
    draw2DRectangle(MessageBoxLeft,MessageBoxBottom,MessageBoxRight,MessageBoxTop,(0.18,0.03,0.03))
    draw2DRectangle(MessageBoxLeft+8,MessageBoxBottom+8,MessageBoxRight-8,MessageBoxTop-8,(0.35,0.05,0.05))
    draw2DText(325,405,"RED LIGHT VIOLATION!",(1.0,0.85,0.20))
    draw2DText(305,375,"Boat returned before intersection",(1.0,1.0,1.0))
    end2DDrawing()

def updateTrafficViolationFeedback(DeltaTime):
    global TrafficViolationMessageTimer
    if TrafficViolationMessageTimer>0:
        TrafficViolationMessageTimer=TrafficViolationMessageTimer-DeltaTime
        if TrafficViolationMessageTimer<0:
            TrafficViolationMessageTimer=0


def startWindshieldWiper():
    global WiperActive,WiperDirection,WiperAngle
    if WiperActive==True:
        return
    WiperActive=True
    WiperDirection=1
    if WiperAngle<18 or WiperAngle>158:
        WiperAngle=18

def removeRainDropsInWiperPath():
    global ScreenRainDrops
    WiperPivotX=505
    WiperPivotY=55
    RemainingRainDrops=[]
    for CurrentRainDrop in ScreenRainDrops:
        DifferenceX=CurrentRainDrop[0]-WiperPivotX
        DifferenceY=CurrentRainDrop[1]-WiperPivotY
        RainDropDistance=math.sqrt(DifferenceX*DifferenceX+DifferenceY*DifferenceY)
        RainDropAngle=math.degrees(math.atan2(DifferenceY,DifferenceX))
        if RainDropAngle<0:
            RainDropAngle=RainDropAngle+360
        AngleDifference=abs(RainDropAngle-WiperAngle)
        if not (RainDropDistance<=430 and AngleDifference<=11):
            RemainingRainDrops.append(CurrentRainDrop)
    ScreenRainDrops=RemainingRainDrops

def updateWindshieldWiper(DeltaTime):
    global ScreenRainSpawnTimer,WiperAngle,WiperDirection,WiperActive
    DistanceFromBRACU=calculate2DDistance(BoatPositionX,BoatPositionY,BRACUPositionX,BRACUPositionY)
    InsideBRACURainFreeArea=isInsideBRACUClearArea(BoatPositionX,BoatPositionY)
    if WiperActive==False:
        if InsideBRACURainFreeArea==False:
            ScreenRainSpawnTimer=ScreenRainSpawnTimer+DeltaTime
            if ScreenRainSpawnTimer>=0.08:
                ScreenRainSpawnTimer=0
                for RainDropNumber in range(4):
                    if len(ScreenRainDrops)<180:
                        RainDropPositionX=random.uniform(70,930)
                        RainDropPositionY=random.uniform(115,730)
                        ScreenRainDrops.append([RainDropPositionX,RainDropPositionY])
        return
    WiperAngle=WiperAngle+(WiperDirection*155*DeltaTime)
    removeRainDropsInWiperPath()
    if WiperDirection>0 and WiperAngle>=158:
        WiperAngle=158
        WiperDirection=-1
    elif WiperDirection<0 and WiperAngle<=18:
        WiperAngle=18
        WiperDirection=1
        WiperActive=False

def drawWindshieldOverlay():
    begin2DDrawing()
    glColor3f(0.62,0.82,1.0)
    glBegin(GL_QUADS)
    for CurrentRainDrop in ScreenRainDrops:
        RainDropPositionX=CurrentRainDrop[0]
        RainDropPositionY=CurrentRainDrop[1]
        glVertex3f(RainDropPositionX-2.5,RainDropPositionY-7,0)
        glVertex3f(RainDropPositionX+2.5,RainDropPositionY-7,0)
        glVertex3f(RainDropPositionX+2.5,RainDropPositionY+7,0)
        glVertex3f(RainDropPositionX-2.5,RainDropPositionY+7,0)
    glEnd()
    glPushMatrix()
    glTranslatef(505,55,0)
    glRotatef(WiperAngle,0,0,1)
    glColor3f(0.06,0.06,0.07)
    glBegin(GL_QUADS)
    glVertex3f(0,-4,0)
    glVertex3f(430,-4,0)
    glVertex3f(430,4,0)
    glVertex3f(0,4,0)
    glEnd()
    glPopMatrix()
    end2DDrawing()


def getCurrentPowerDistrict():
    return PowerDistrictList[PowerOutageDistrictIndex]

def isPositionInsideBlackoutDistrict(PositionX):
    if PowerOutageActive==False:
        return False
    CurrentDistrict=getCurrentPowerDistrict()
    DistrictName=CurrentDistrict["name"]
    if DistrictName=="WEST":
        return PositionX<-500
    elif DistrictName=="EAST":
        return PositionX>500
    else:
        return -500<=PositionX<=500

def calculateDistanceToPowerRepairStation():
    CurrentDistrict=getCurrentPowerDistrict()
    return calculate2DDistance(BoatPositionX,BoatPositionY,CurrentDistrict["repair_x"],CurrentDistrict["repair_y"])

def tryRepairPower():
    global PowerOutageActive,PowerNextOutageTimer,PowerRestoreMessageTimer,PowerRestoredDistrictName,PowerOutageDistrictIndex
    if PowerOutageActive==False:
        print("There is currently no power outage.")
        return
    DistanceToRepairStation=calculateDistanceToPowerRepairStation()
    if DistanceToRepairStation>PowerRepairRadius:
        print("Move closer to the electrical repair box.")
        return
    CurrentDistrict=getCurrentPowerDistrict()
    RestoredDistrictName=CurrentDistrict["name"]
    PowerOutageActive=False
    PowerNextOutageTimer=0
    PowerRestoreMessageTimer=3
    PowerRestoredDistrictName=RestoredDistrictName
    PowerOutageDistrictIndex=PowerOutageDistrictIndex+1
    if PowerOutageDistrictIndex>=len(PowerDistrictList):
        PowerOutageDistrictIndex=0
    global Score
    Score=Score+100
    showGameMessage("Power restored in "+RestoredDistrictName+"! +100 points",3)
    print("POWER RESTORED:",RestoredDistrictName,"DISTRICT")

def updatePowerOutageSystem(DeltaTime):
    global PowerRestoreMessageTimer,PowerNextOutageTimer,PowerOutageActive
    if PowerRestoreMessageTimer>0:
        PowerRestoreMessageTimer=PowerRestoreMessageTimer-DeltaTime
        if PowerRestoreMessageTimer<0:
            PowerRestoreMessageTimer=0
    if PowerOutageActive==False:
        PowerNextOutageTimer=PowerNextOutageTimer+DeltaTime
        if PowerNextOutageTimer>=PowerNextOutageDelay:
            PowerNextOutageTimer=0
            PowerOutageActive=True
            CurrentDistrict=getCurrentPowerDistrict()
            print("POWER OUTAGE:",CurrentDistrict["name"],"DISTRICT")

def drawPowerRepairStation(PowerDistrictInformation):
    RepairPositionX=PowerDistrictInformation["repair_x"]
    RepairPositionY=PowerDistrictInformation["repair_y"]
    IsActiveRepairStation=False
    if PowerOutageActive==True and PowerDistrictInformation["name"]==getCurrentPowerDistrict()["name"]:
        IsActiveRepairStation=True
    drawSimpleCube(RepairPositionX,RepairPositionY,FloodWaterHeight+24,36,32,48,(0.20,0.23,0.24))
    if IsActiveRepairStation==True:
        PanelColor=(0.85,0.08,0.05)
    else:
        PanelColor=(0.08,0.55,0.15)
    drawSimpleCube(RepairPositionX,RepairPositionY-18,FloodWaterHeight+25,22,5,24,PanelColor)
    glPushMatrix()
    glTranslatef(RepairPositionX,RepairPositionY,FloodWaterHeight+53)
    if IsActiveRepairStation==True:
        glColor3f(1.0,0.08,0.04)
    else:
        glColor3f(0.10,0.85,0.20)
    gluSphere(getSharedQuadric(),7,8,8)
    glPopMatrix()





BuildingList=[]
BuildingGridXPositions=[-1375,-825,-275,275,825,1375]
BuildingGridYPositions=[-1375,-875,-325,225,775]

for BuildingRow in range(len(BuildingGridYPositions)):
    for BuildingColumn in range(len(BuildingGridXPositions)):
        BuildingPositionX=BuildingGridXPositions[BuildingColumn]
        BuildingPositionY=BuildingGridYPositions[BuildingRow]

        if BuildingPositionY>=775 and abs(BuildingPositionX)<500:
            continue

        BuildingHalfWidth=115+((BuildingRow+BuildingColumn)%3)*12
        BuildingHalfLength=125+((BuildingRow*2+BuildingColumn)%3)*10
        BuildingHeight=160+((BuildingRow*3+BuildingColumn*2)%5)*38
        BuildingList.append([BuildingPositionX,BuildingPositionY,BuildingHalfWidth,BuildingHalfLength,BuildingHeight])

BuildingColors=[
    (0.46,0.54,0.56),
    (0.59,0.50,0.44),
    (0.43,0.52,0.50),
    (0.54,0.48,0.53),
    (0.52,0.56,0.51),
]

SubmergedCarList=[
    [-1100,-920,90],
    [-550,-320,90],
    [0,-720,90],
    [550,260,90],
    [1100,-380,90],
    [-820,500,0],
    [760,1050,0],
    [-260,-1150,0]
]



CityTreeList=[
    (-1552,335,0.86),(-1545,120,0.76),(-215,875,0.93),
    (402,890,0.82),(-1530,-1330,0.72),(1562,-959,0.86),
    (-145,852,0.91),(1545,-230,0.78),(-1260,-1540,0.96),
    (1541,847,0.76),(1545,-365,0.87),(-1550,-230,0.84),
    (-1545,-420,0.70),(1555,100,0.74)
]
CityTeaStalls=[
    (178,885,0,1)
]
CityBRACUShops=[
    (-367,885,0,'ICON STATIONERY'),
    (320,715,2,'FOOD VALLEY'),
]
CityRoadsideProps=[
    (1550,266,90,'poster'),
    (-1550,-792,0,'poster')
]
SlowMovingCarList=[
    {'axis':'x','fixed':-555,'min':-470,'max':-130,'speed':30.0,'phase':65,'style':3},
    {'axis':'y','fixed':598,'min':-490,'max':-130,'speed':24.0,'phase':190,'style':4}
]
BrokenCarIndices={1,4}
SlowMovingCarProgress=[float(Car['phase']) for Car in SlowMovingCarList]
SlowMovingCarStopped=[False for Car in SlowMovingCarList]


def getSlowCarAtProgress(Car,Progress):
    Travel=Car['max']-Car['min']
    Offset=Progress%(2*Travel)
    Forward=Offset<=Travel
    Along=Car['min']+(Offset if Forward else 2*Travel-Offset)
    if Car['axis']=='x':
        return (Along,Car['fixed'],0 if Forward else 180,Car['style'])
    return (Car['fixed'],Along,90 if Forward else 270,Car['style'])


def getSlowMovingCarPositions():
    return [getSlowCarAtProgress(Car,SlowMovingCarProgress[Index])
            for Index,Car in enumerate(SlowMovingCarList)]


def updateSlowMovingCars(DeltaTime):
    """Traffic waits for the boat instead of passing through or pushing it.

    Stop BEFORE overlapping the boat; as soon as the route clears, driving
    resumes. Keeping progress per car makes stopping real rather than a visual
    pause that jumps ahead when game time advances.
    """
    for Index,Car in enumerate(SlowMovingCarList):
        CurrentProgress=SlowMovingCarProgress[Index]
        NextProgress=CurrentProgress+Car['speed']*DeltaTime
        Segments=max(1,int(math.ceil(Car['speed']*DeltaTime/5.0)))
        Blocked=False
        for Part in range(1,Segments+1):
            Fraction=Part/Segments
            X,Y,Angle,Style=getSlowCarAtProgress(Car,CurrentProgress+
                                                       (NextProgress-CurrentProgress)*Fraction)
            if doesBoatOverlapCar(BoatPositionX,BoatPositionY,X,Y,Angle,Style,12.0):
                Blocked=True
                break
        SlowMovingCarStopped[Index]=Blocked
        if not Blocked:
            SlowMovingCarProgress[Index]=NextProgress



def calculateObjectDistanceFromCamera(PositionX,PositionY):
    DistanceX=PositionX-CameraPosition[0]
    DistanceY=PositionY-CameraPosition[1]
    return DistanceX*DistanceX+DistanceY*DistanceY


def calculateLineEntryIntoRectangle(StartPositionX,StartPositionY,EndPositionX,EndPositionY,RectangleMinimumX,RectangleMaximumX,RectangleMinimumY,RectangleMaximumY):
    DifferenceX=EndPositionX-StartPositionX
    DifferenceY=EndPositionY-StartPositionY
    EntryValue=0
    ExitValue=1

    CoordinateInformation=[
        [StartPositionX,DifferenceX,RectangleMinimumX,RectangleMaximumX],
        [StartPositionY,DifferenceY,RectangleMinimumY,RectangleMaximumY]
    ]

    for CurrentCoordinate in CoordinateInformation:
        StartValue=CurrentCoordinate[0]
        DifferenceValue=CurrentCoordinate[1]
        MinimumValue=CurrentCoordinate[2]
        MaximumValue=CurrentCoordinate[3]

        if abs(DifferenceValue)<0.000001:
            if StartValue<MinimumValue or StartValue>MaximumValue:
                return None
        else:
            FirstIntersection=(MinimumValue-StartValue)/DifferenceValue
            SecondIntersection=(MaximumValue-StartValue)/DifferenceValue

            if FirstIntersection>SecondIntersection:
                FirstIntersection,SecondIntersection=SecondIntersection,FirstIntersection

            if FirstIntersection>EntryValue:
                EntryValue=FirstIntersection
            if SecondIntersection<ExitValue:
                ExitValue=SecondIntersection
            if EntryValue>ExitValue:
                return None

    if ExitValue<=0 or EntryValue>=1:
        return None
    return max(EntryValue,0)


def isRectangleBlockingView(TargetPositionX,TargetPositionY,TargetPositionZ,RectangleCenterX,RectangleCenterY,RectangleHalfWidth,RectangleHalfLength,RectangleBottomHeight,RectangleTopHeight):
    CameraPositionX=CameraPosition[0]
    CameraPositionY=CameraPosition[1]
    CameraPositionZ=CameraPosition[2]

    LineEntryValue=calculateLineEntryIntoRectangle(CameraPositionX,CameraPositionY,TargetPositionX,TargetPositionY,RectangleCenterX-RectangleHalfWidth,RectangleCenterX+RectangleHalfWidth,RectangleCenterY-RectangleHalfLength,RectangleCenterY+RectangleHalfLength)

    if LineEntryValue==None or LineEntryValue>=0.985:
        return False

    SightLineHeight=CameraPositionZ+(TargetPositionZ-CameraPositionZ)*LineEntryValue
    return RectangleBottomHeight<=SightLineHeight<=RectangleTopHeight


def isObjectHiddenByBuilding(TargetPositionX,TargetPositionY,TargetPositionZ):
    for CurrentBuilding in BuildingList:
        if isRectangleBlockingView(TargetPositionX,TargetPositionY,TargetPositionZ,CurrentBuilding[0],CurrentBuilding[1],CurrentBuilding[2],CurrentBuilding[3],FloodWaterHeight-18,CurrentBuilding[4]+8)==True:
            return True

    for X,Y,HW,HL,Top in BRACUSolidVolumes:
        if isRectangleBlockingView(TargetPositionX,TargetPositionY,TargetPositionZ,
                                   BRACUPositionX+X,BRACUPositionY+Y,HW,HL,
                                   FloodWaterHeight-5,Top+8):
            return True

    return False


def getCityBlockRanges(RoadPositions,HalfRoadWidth):
    BlockRanges=[]
    PreviousBlockStart=-WorldMapLimit

    for RoadPosition in RoadPositions:
        BlockRanges.append([PreviousBlockStart,RoadPosition-HalfRoadWidth])
        PreviousBlockStart=RoadPosition+HalfRoadWidth

    BlockRanges.append([PreviousBlockStart,WorldMapLimit])
    return BlockRanges



def drawSubmergedCityBlocks():
    BlocksX=getCityBlockRanges(VerticalRoadPositions,RoadWidth/2)
    BlocksY=getCityBlockRanges(HorizontalRoadPositions,RoadWidth/2)
    glBegin(GL_QUADS)
    for XIndex,XR in enumerate(BlocksX):
        for YIndex,YR in enumerate(BlocksY):
            if (XIndex+YIndex)%3==0:
                glColor3f(0.20,0.265,0.255)
            elif (XIndex+YIndex)%3==1:
                glColor3f(0.23,0.285,0.275)
            else:
                glColor3f(0.21,0.265,0.265)
            Z=FloodWaterHeight+0.025
            for X,Y in ((XR[0],YR[0]),(XR[1],YR[0]),(XR[1],YR[1]),(XR[0],YR[1])):
                glVertex3f(X,Y,Z)
    glEnd()


def drawSubmergedRoadClues():
    Half=RoadWidth/2
    glBegin(GL_QUADS)
    glColor3f(0.073,0.218,0.265)
    for X in VerticalRoadPositions:
        for PX,PY in ((X-Half,-WorldMapLimit),(X+Half,-WorldMapLimit),
                      (X+Half,WorldMapLimit),(X-Half,WorldMapLimit)):
            glVertex3f(PX,PY,FloodWaterHeight+0.038)
    for Y in HorizontalRoadPositions:
        for PX,PY in ((-WorldMapLimit,Y-Half),(WorldMapLimit,Y-Half),
                      (WorldMapLimit,Y+Half),(-WorldMapLimit,Y+Half)):
            glVertex3f(PX,PY,FloodWaterHeight+0.038)
    glColor3f(0.30,0.415,0.425)
    for X in VerticalRoadPositions:
        for Y in range(-1550,1600,185):
            for PX,PY in ((X-2.2,Y),(X+2.2,Y),(X+2.2,Y+42),(X-2.2,Y+42)):
                glVertex3f(PX,PY,FloodWaterHeight+0.07)
    for Y in HorizontalRoadPositions:
        for X in range(-1550,1600,185):
            for PX,PY in ((X,Y-2.2),(X+42,Y-2.2),(X+42,Y+2.2),(X,Y+2.2)):
                glVertex3f(PX,PY,FloodWaterHeight+0.07)
    glEnd()



def getWaterWaveHeight(PositionX,PositionY):
    """Single authoritative wave height for water, boats, people, and debris.

    Waves flatten gradually inside BRACU's rain-free sunlight. This changes
    *appearance only*; gameplay collisions still use FloodWaterHeight.
    """
    T=WaterAnimationPhase
    MainAngle=0.032*(PositionY+0.18*PositionX)-1.80*T
    CrossAngle=0.047*PositionX-0.014*PositionY+1.13*T
    SmallAngle=0.085*PositionY+0.029*PositionX-2.25*T
    MainSine=math.sin(MainAngle)
    LongSwell=6.9*(0.5+0.5*MainSine)
    CrossSwell=1.25*math.sin(CrossAngle)
    SmallChop=0.60*math.sin(SmallAngle)
    CrestLip=1.55*max(0.0,MainSine)**6
    Height=max(0.22,0.58+LongSwell+CrossSwell+SmallChop+CrestLip)
    Calm=1.0-0.70*getBRACUDaylightWeight(PositionX,PositionY)
    return FloodWaterHeight+0.22+(Height-0.22)*Calm

@lru_cache(maxsize=48)
def getStaticWaterPatch(CellSize,HalfCells,Kind,CenterX,CenterY,InnerRadius):
    """Cache ONLY boat-centered static water coordinates, colors and fade data.

    Heights and time-dependent wave phases are still calculated every frame.
    A bounded cache avoids revisiting the same grid cells on every frame while
    rowing slowly, and does not add any new mesh level-of-detail changes.
    """
    PatchRadius=CellSize*HalfCells
    XValues=tuple(CenterX+I*CellSize for I in range(-HalfCells,HalfCells+1))
    YValues=tuple(CenterY+I*CellSize for I in range(-HalfCells,HalfCells+1))
    XWaves=tuple(tuple((math.sin(A),math.cos(A)) for A in
                  (0.00576*X,0.047*X,0.029*X)) for X in XValues)
    DaylightRows=[]
    FadeRows=[]
    for Y in YValues:
        DaylightRow=[]
        FadeRow=[]
        for X in XValues:
            DaylightRow.append(getBRACUDaylightWeight(X,Y))
            Edge=max(abs(X-CenterX),abs(Y-CenterY))
            if Kind=='INNER':
                Fade=min(1.0,max(0.0,(InnerRadius-Edge)/85.0))
            else:
                ExteriorFade=min(1.0,max(0.0,(PatchRadius-Edge)/185.0))
                CenterFade=min(1.0,max(0.0,(Edge-(InnerRadius-75.0))/150.0))
                Fade=ExteriorFade*CenterFade
            FadeRow.append(Fade)
        DaylightRows.append(tuple(DaylightRow))
        FadeRows.append(tuple(FadeRow))
    return XValues,YValues,XWaves,tuple(DaylightRows),tuple(FadeRows)


def drawAnimatedWaterSurface():
    """Two-resolution wave mesh: detailed nearby, inexpensive far away.

    The two patches crossfade in alpha. Distant swells still appear but cost
    much less than tessellating the whole city at the close-up resolution.
    Precomputed column/row trigonometry avoids per-vertex sin/cos calls.
    """
    if RenderQuality=='BALANCED':
        Patches=((118,8,'OUTER'),(40,8,'INNER'))
        InnerRadius=320.0
    else:
        Patches=((100,10,'OUTER'),(30,11,'INNER'))
        InnerRadius=330.0
    T=WaterAnimationPhase
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    try:
        for CellSize,HalfCells,Kind in Patches:
            CenterX=math.floor(BoatPositionX/CellSize)*CellSize
            CenterY=math.floor(BoatPositionY/CellSize)*CellSize
            XValues,YValues,XWaves,DaylightRows,FadeRows=getStaticWaterPatch(
                CellSize,HalfCells,Kind,CenterX,CenterY,InnerRadius)
            YWaves=[]
            for Y in YValues:
                YWaves.append(tuple((math.sin(A),math.cos(A)) for A in
                                    (0.032*Y-1.8*T,-0.014*Y+1.13*T,0.085*Y-2.25*T)))
            for Row in range(len(YValues)-1):
                glBegin(GL_TRIANGLE_STRIP)
                for Column,X in enumerate(XValues):
                    XS=XWaves[Column]
                    for YIndex in (Row,Row+1):
                        Y=YValues[YIndex]
                        YS=YWaves[YIndex]
                        Main=XS[0][0]*YS[0][1]+XS[0][1]*YS[0][0]
                        MainCos=XS[0][1]*YS[0][1]-XS[0][0]*YS[0][0]
                        Cross=XS[1][0]*YS[1][1]+XS[1][1]*YS[1][0]
                        Chop=XS[2][0]*YS[2][1]+XS[2][1]*YS[2][0]
                        Crest=max(0.0,Main)
                        Relative=max(0.22,0.58+6.9*(0.5+0.5*Main)+1.25*Cross+
                                     0.60*Chop+1.55*Crest**6)
                        Daylight=DaylightRows[YIndex][Column]
                        WaveZ=FloodWaterHeight+0.22+(Relative-0.22)*(1.0-0.70*Daylight)
                        HeightFraction=min(1.0,max(0.0,(WaveZ-FloodWaterHeight)/11.0))
                        Highlight=max(0.0,MainCos)
                        Shade=0.23+0.48*Highlight+0.29*HeightFraction
                        Red=0.038+0.135*Shade+0.050*Daylight
                        Green=0.14+0.255*Shade+0.095*Daylight
                        Blue=0.20+0.28*Shade+0.070*Daylight
                        Fade=FadeRows[YIndex][Column]
                        Alpha=(0.31+0.15*Crest+0.08*Highlight)*Fade
                        glColor4f(Red,Green,Blue,Alpha)
                        glVertex3f(X,Y,WaveZ)
                glEnd()
    finally:
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)

def drawWaterWaveCrests():
    """Draw visible white-blue rolling foam on actual elevated wave ridges.

    The ridge location comes from sin(angle)=1, with the same phase used by
    getWaterWaveHeight. It travels across the world as the wave rises/falls.
    """
    T=WaterAnimationPhase
    Radius=315 if RenderQuality=='BALANCED' else 385
    StepX=100 if RenderQuality=='BALANCED' else 80
    CenterPhase=0.032*(BoatPositionY+0.18*BoatPositionX)-1.8*T
    CenterK=round((CenterPhase-math.pi*0.5)/(2*math.pi))
    StartX=BoatPositionX-Radius
    EndX=BoatPositionX+Radius
    AlphaBase=0.47 if RenderQuality=='HIGH' else 0.39

    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    try:
        for K in range(CenterK-3,CenterK+4):
            PeakAngle=math.pi*0.5+K*2*math.pi
            YC=(PeakAngle+1.80*T)/0.032-0.18*BoatPositionX
            if abs(YC-BoatPositionY)>Radius+85:
                continue
            Segments=int((EndX-StartX)/StepX)
            CrestSamples=[]
            glBegin(GL_TRIANGLE_STRIP)
            for Segment in range(Segments+1):
                X=StartX+(EndX-StartX)*Segment/Segments
                Y=(PeakAngle+1.80*T)/0.032-0.18*X
                Fade=max(0.0,min(1.0,(Radius-max(abs(X-BoatPositionX),abs(Y-BoatPositionY)))/125.0))
                Breakup=0.66+0.34*math.sin(X*0.055+K*7.9+T*0.4)**2
                Z=getWaterWaveHeight(X,Y)
                Width=3.6+1.2*math.sin(X*0.035+K*2.3)**2
                CrestSamples.append((X,Y,Z,Fade))
                glColor4f(0.61,0.87,0.91,AlphaBase*Fade*Breakup)
                glVertex3f(X,Y-Width,Z+0.24)
                glColor4f(0.87,0.96,0.96,AlphaBase*0.85*Fade*Breakup)
                glVertex3f(X,Y+Width,Z+0.29)
            glEnd()
            glLineWidth(1.6 if RenderQuality=='HIGH' else 1.2)
            glBegin(GL_LINE_STRIP)
            for X,Y,Z,Fade in CrestSamples:
                glColor4f(0.84,0.96,0.97,0.49*Fade)
                glVertex3f(X,Y,Z+0.36)
            glEnd()
    finally:
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)


def drawFloodedRoadEnvironment():
    def renderStaticFloodedStreets():
        drawSubmergedCityBlocks()
        drawSubmergedRoadClues()
    drawCachedScene('flooded-streets',renderStaticFloodedStreets,StaticSceneLists)
    drawAnimatedWaterSurface()
    drawWaterWaveCrests()




def renderSingleBuildingGeometry(BuildingInformation,BuildingColor):
    """Rain-weathered Dhaka architecture with stable, distance-INDEPENDENT detail.

    Flat glass panes use one batched immediate-mode block instead of dozens of
    separate cubes. Compiling the result in a display list keeps CPU load low.
    Every facade is built at startup and never morphs as the camera approaches.
    """
    X,Y,HalfW,HalfL,H=BuildingInformation
    Blackout=isPositionInsideBlackoutDistrict(X)
    Style=(int(abs(X)*0.13+abs(Y)*0.07))%5
    Day=0.10*getBRACUDaylightWeight(X,Y)
    Base=tuple(min(1.0,C*(0.94+Day)) for C in BuildingColor)
    FloorZ=FloodWaterHeight-18
    drawScaledCube(X,Y,(H+FloorZ)/2,2*HalfW,2*HalfL,H-FloorZ,*Base)
    Front=Y-HalfL
    Back=Y+HalfL
    Left=X-HalfW
    Right=X+HalfW
    Frame=tuple(min(1,C*1.13) for C in Base)
    Concrete=tuple(max(.12,C*.77) for C in Base)

    for Z in (H*0.33,H*0.66):
        drawSimpleCube(X,Front-1.5,Z,2*HalfW+2,3,3,Concrete)
        drawSimpleCube(X,Back+1.5,Z,2*HalfW+2,3,3,Concrete)
    drawSimpleCube(X,Y,H+2,2*HalfW+6,2*HalfL+6,5,Concrete)
    for Side in (-1,1):
        drawSimpleCube(X+Side*HalfW,Y,H+11,4,2*HalfL+4,18,Concrete)
        drawSimpleCube(X,Y+Side*HalfL,H+11,2*HalfW+3,4,18,Concrete)

    Rows=4
    Cols=3
    GlassDark=(0.066,0.158,0.197)
    GlassLite=(0.13,0.25,0.28)
    NightGold=(0.78,0.56,0.30)
    glBegin(GL_QUADS)
    for Row in range(Rows):
        Z=47+Row*max(25,(H-86)/3)
        ZTop=Z+25
        ZBot=Z-14
        for Column in range(Cols):
            Off=(Column-1)*0.61
            Width=min(34,HalfW*.29)
            Depth=min(33,HalfL*.29)
            PaneLit=not Blackout and (int(abs(X)/20)+int(abs(Y)/20)+Row*7+Column*3)%10==0
            Glass=NightGold if PaneLit else (GlassLite if (Row+Column+Style)%6==0 else GlassDark)
            for FaceY in (Front-1.2,Back+1.2):
                WX=X+Off*HalfW
                glColor3f(*Frame)
                for PX,PZ in ((WX-Width/2-2,ZBot-2),(WX+Width/2+2,ZBot-2),
                              (WX+Width/2+2,ZTop+2),(WX-Width/2-2,ZTop+2)):
                    glVertex3f(PX,FaceY,PZ)
                glColor3f(*Glass)
                Outside=FaceY+(-1.5 if FaceY<Y else 1.5)
                for PX,PZ in ((WX-Width/2,ZBot),(WX+Width/2,ZBot),
                              (WX+Width/2,ZTop),(WX-Width/2,ZTop)):
                    glVertex3f(PX,Outside,PZ)
            for FaceX in (Left-1.2,Right+1.2):
                WY=Y+Off*HalfL
                glColor3f(*Frame)
                for PY,PZ in ((WY-Depth/2-2,ZBot-2),(WY+Depth/2+2,ZBot-2),
                              (WY+Depth/2+2,ZTop+2),(WY-Depth/2-2,ZTop+2)):
                    glVertex3f(FaceX,PY,PZ)
                glColor3f(*Glass)
                Outside=FaceX+(-1.5 if FaceX<X else 1.5)
                for PY,PZ in ((WY-Depth/2,ZBot),(WY+Depth/2,ZBot),
                              (WY+Depth/2,ZTop),(WY-Depth/2,ZTop)):
                    glVertex3f(Outside,PY,PZ)
    glEnd()

    if Style in (0,2,4):
        for Level in (H*.37,H*.69):
            drawSimpleCube(X,Front-9.5,Level,HalfW*1.05,17,4,Concrete)
            drawSimpleCube(X,Front-16.5,Level+12,HalfW*1.04,2.4,19,
                           (0.27,0.38,0.40))
            for Offset in (-.38,0,.38):
                drawSimpleCube(X+Offset*HalfW,Front-16.5,Level+7,2.3,2.6,13,Frame)
    else:
        for Level in (H*.33,H*.66):
            drawSimpleCube(X,Front-4,Level,HalfW*1.5,6,3,Frame)

    if Style in (1,3):
        TankX=X+HalfW*.36
        TankY=Y+HalfL*.2
        drawSimpleCube(TankX,TankY,H+17,34,33,18,(0.42,0.44,0.43))
        drawSimpleCube(TankX,TankY,H+38,30,31,26,(0.18,0.26,0.30))
        drawSimpleCube(TankX,TankY,H+53,33,34,4,(0.36,0.43,0.44))
    else:
        drawSimpleCube(X+HalfW*.25,Y+HalfL*.1,H+13,43,44,21,Concrete)
    if Style in (2,3):
        for Z in (H*.43,H*.70):
            drawSimpleCube(X+HalfW*.35,Front-5,Z,26,9,16,(0.64,0.66,0.61))
            drawSimpleCube(X+HalfW*.35,Front-10,Z,22,2,12,(0.34,0.42,0.43))

    drawSimpleCube(X,Front-3.0,FloodWaterHeight+23,59,5,40,(0.115,0.22,0.25))
    drawSimpleCube(X,Front-7.3,FloodWaterHeight+48,76,10,5,
                   ((0.41,0.40,0.32),(0.36,0.47,0.45),
                    (0.50,0.37,0.34),(0.35,0.41,0.47),(0.39,0.47,0.34))[Style])
    drawSimpleCube(X,Front-9.1,FloodWaterHeight+43,73,1.6,2,(0.75,0.69,0.54))
    for Side in (-1,1):
        drawSimpleCube(X+Side*22,Front-7.4,FloodWaterHeight+24,2,2.5,38,Frame)

def drawSingleBuilding(BuildingInformation,BuildingColor):
    X,Y,HalfW,HalfL,H=BuildingInformation
    Blackout=isPositionInsideBlackoutDistrict(X)
    drawCachedScene(('cinematic-building',X,Y,Blackout),
                    lambda:renderSingleBuildingGeometry(BuildingInformation,BuildingColor),
                    BuildingSceneLists)

@lru_cache(maxsize=1)
def getSubmergedCarPositions():
    ShiftedCarList=[]
    LaneOffset=RoadWidth*0.22

    for CarNumber in range(len(SubmergedCarList)):
        CarPositionX,CarPositionY,CarRotationAngle=SubmergedCarList[CarNumber]

        if CarNumber%2==0:
            CarLaneSide=-1
        else:
            CarLaneSide=1

        if abs(CarRotationAngle-90)<0.1:
            CarPositionX=CarPositionX+CarLaneSide*LaneOffset
        else:
            CarPositionY=CarPositionY+CarLaneSide*LaneOffset

        ShiftedCarList.append([CarPositionX,CarPositionY,CarRotationAngle])

    return ShiftedCarList


def renderImprovedCarBody(Style=0,Broken=False):
    Palette=[(0.52,0.57,0.62),(0.64,0.48,0.37),(0.36,0.54,0.58),
             (0.67,0.65,0.49),(0.42,0.55,0.40)]
    Body=Palette[Style%len(Palette)]
    Roof=tuple(min(1.0,Value*1.09) for Value in Body)
    Glass=(0.085,0.18,0.26)
    Metal=(0.64,0.68,0.66)
    Tire=(0.11,0.13,0.14)
    Van=(Style%3==1)
    Length=88 if Van else 78
    CabinLength=51 if Van else 40
    CabinHeight=25 if Van else 18
    drawSimpleCube(0,0,8,Length,37,15,Body)
    drawSimpleCube(-5,0,20.5,CabinLength,32,CabinHeight,Roof)
    drawSimpleCube(-5,-16.8,21,CabinLength-7,2,14,Glass)
    drawSimpleCube(-5,16.8,21,CabinLength-7,2,14,Glass)
    drawSimpleCube(CabinLength*0.5-4,0,22,2,30,13,Glass)
    drawSimpleCube(-CabinLength*0.5-6,0,22,2,30,13,Glass)
    FrontEdge=-5+CabinLength/2
    RoofTop=20.5+CabinHeight/2
    glBegin(GL_QUADS)
    glColor3f(0.08,0.18,0.23)
    glVertex3f(FrontEdge+1,-14,RoofTop-2)
    glVertex3f(FrontEdge+1,14,RoofTop-2)
    glColor3f(0.13,0.27,0.31)
    glVertex3f(FrontEdge+6,15,17.0)
    glVertex3f(FrontEdge+6,-15,17.0)
    glEnd()
    for X in (-17,9):
        drawSimpleCube(X,-18.1,21.0,2.5,2,16,Metal)
        drawSimpleCube(X,18.1,21.0,2.5,2,16,Metal)
    drawSimpleCube(Length/2+1,0,8,4,33,5,(0.22,0.25,0.26))
    drawSimpleCube(-Length/2-1,0,8,4,33,5,(0.24,0.26,0.27))
    drawSimpleCube(Length/2+2,0,11,2,15,4,(0.12,0.19,0.21))
    drawSimpleCube(-Length/2-3,0,10,1.8,12,4,(0.82,0.81,0.64))
    for Side in (-1,1):
        drawSimpleCube(Length/2+2,Side*13,13,2,8,6,(0.91,0.88,0.68))
        drawSimpleCube(-Length/2-2,Side*13,13,2,8,6,(0.74,0.18,0.15))
        drawSimpleCube(-22,Side*20,5.0,13,3,12,Tire)
        drawSimpleCube(21,Side*20,5.0,13,3,12,Tire)
        drawSimpleCube(-22,Side*22,5.0,7,1.5,6,(0.51,0.54,0.56))
        drawSimpleCube(21,Side*22,5.0,7,1.5,6,(0.51,0.54,0.56))
    drawSimpleCube(Length*.32,0,16,2,33,1.5,(0.33,0.38,0.38))
    for Side in (-1,1):
        drawSimpleCube(-2,Side*19.3,15,1.5,2.0,15,(0.31,0.37,0.38))
        drawSimpleCube(16,Side*20.5,26,8,7,4,(0.13,0.20,0.22))
        drawSimpleCube(-1,Side*19.4,13.5,5,1.2,1.4,(0.83,0.80,0.63))
    if Van:
        for Side in (-1,1):
            drawSimpleCube(-6,Side*14,36,45,2,3,Metal)
        for X in (-23,10):
            drawSimpleCube(X,0,36,3,28,2,Metal)
    if Broken:
        drawSimpleCube(34,0,23,22,34,3,(0.34,0.35,0.36))
        glPushMatrix()
        glTranslatef(31,0,28)
        glRotatef(-23,0,1,0)
        drawSimpleCube(8,0,5,27,36,3,Body)
        glPopMatrix()
        drawSimpleCube(35,0,17,14,16,5,(0.15,0.16,0.17))


def drawSingleSubmergedCar(CarPositionX,CarPositionY,CarRotationAngle,Style=0,Broken=False):
    SurfaceZ=getWaterWaveHeight(CarPositionX,CarPositionY)
    glPushMatrix()
    glTranslatef(CarPositionX,CarPositionY,SurfaceZ-7)
    glRotatef(CarRotationAngle,0,0,1)
    drawCachedScene(('city-car',Style,Broken),
                    lambda:renderImprovedCarBody(Style,Broken),StaticSceneLists)
    glPopMatrix()


def drawSlowMovingCarWake(CarX,CarY,CarAngle,CarStyle):
    """A restrained water wake behind a slowly driving flooded car."""
    A=math.radians(CarAngle)
    FX=math.cos(A)
    FY=math.sin(A)
    SX=-FY
    SY=FX
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    glLineWidth(1.4)
    glBegin(GL_LINES)
    for Side in (-1,1):
        for I in range(3):
            Distance=35+I*16
            Width=19+I*5
            X1=CarX-FX*Distance+SX*Side*Width
            Y1=CarY-FY*Distance+SY*Side*Width
            X2=CarX-FX*(Distance+14)+SX*Side*(Width+6)
            Y2=CarY-FY*(Distance+14)+SY*Side*(Width+6)
            glColor4f(0.75,0.88,0.89,max(0.12,0.38-I*0.09))
            glVertex3f(X1,Y1,getWaterWaveHeight(X1,Y1)+0.9)
            glVertex3f(X2,Y2,getWaterWaveHeight(X2,Y2)+0.9)
    glEnd()
    glDepthMask(GL_TRUE)
    glDisable(GL_BLEND)


def drawStrandedCarDriver(CarX,CarY,CarAngle,Index):
    Angle=math.radians(CarAngle)
    X=CarX+math.sin(Angle)*47
    Y=CarY-math.cos(Angle)*47
    WaveZ=getWaterWaveHeight(X,Y)
    Wave=math.sin(GameTimeSeconds*3.0+Index*1.8)
    glPushMatrix()
    glTranslatef(X,Y,WaveZ+1)
    drawSimpleCube(0,0,10,13,10,22,(0.91,0.66,0.19))
    drawSimpleCube(0,0,26,12,11,6,(0.18,0.26,0.31))
    glColor3f(0.65,0.47,0.31)
    glPushMatrix()
    glTranslatef(0,0,36)
    gluSphere(getSharedQuadric(),7,9,8)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(6,0,24)
    glRotatef(15+27*Wave,0,1,0)
    glColor3f(0.90,0.65,0.42)
    gluCylinder(getSharedQuadric(),2.5,2,24,7,4)
    glTranslatef(0,0,24)
    gluSphere(getSharedQuadric(),3.3,7,6)
    glPopMatrix()
    glPopMatrix()


def renderCityTreeGeometry(Scale):
    """Small rain-soaked banyan-like street tree with layered low-poly canopy."""
    glPushMatrix()
    glScalef(Scale,Scale,Scale)
    glColor3f(0.30,0.255,0.19)
    glPushMatrix()
    glTranslatef(0,0,0)
    gluCylinder(getSharedQuadric(),5.8,3.4,56,8,5)
    glPopMatrix()
    for X,Y,Angle,Length in ((-4,-3,-26,24),(4,5,29,27),(2,-5,12,21)):
        glPushMatrix()
        glTranslatef(X,Y,43)
        glRotatef(Angle,0,1,0)
        glColor3f(0.30,0.25,0.19)
        gluCylinder(getSharedQuadric(),2.4,1.3,Length,7,2)
        glPopMatrix()
    LeafClusters=(
        (-15,-5,64,18,(0.17,0.34,0.24)),
        (12,-2,65,20,(0.19,0.38,0.25)),
        (1,14,69,18,(0.22,0.42,0.27)),
        (-8,7,79,19,(0.21,0.40,0.27)),
        (9,1,81,17,(0.28,0.46,0.30)),
        (0,-11,74,17,(0.14,0.31,0.23)),
    )
    for LX,LY,LZ,R,Color in LeafClusters:
        glPushMatrix()
        glTranslatef(LX,LY,LZ)
        glScalef(1.0,0.83,0.68)
        glColor3f(*Color)
        gluSphere(getSharedQuadric(),R,9,7)
        glPopMatrix()
    glPopMatrix()

def drawCityTree(X,Y,Scale):
    glPushMatrix()
    glTranslatef(X,Y,FloodWaterHeight-9)
    drawCachedScene(('city-tree',Scale),lambda:renderCityTreeGeometry(Scale),StaticSceneLists)
    glPopMatrix()


def drawTeaStallPersonHead(X,Y,Z,SkinColor,FaceDirection):
    """Small low-poly head; the eyes face the counter or the street."""
    glPushMatrix()
    glTranslatef(X,Y,Z)
    glColor3f(*SkinColor)
    gluSphere(getSharedQuadric(),6.2,9,7)
    glPushMatrix()
    glTranslatef(0,0,4.3)
    glScalef(1.06,1.06,0.40)
    glColor3f(0.13,0.11,0.10)
    gluSphere(getSharedQuadric(),6.0,9,6)
    glPopMatrix()
    EyeY=FaceDirection*5.5
    for EyeX in (-2.15,2.15):
        drawSimpleCube(EyeX,EyeY,0.8,1.0,1.1,1.1,(0.12,0.12,0.13))
    drawSimpleCube(0,FaceDirection*6.0,-1.5,1.8,1.2,1.5,(0.70,0.48,0.34))
    glPopMatrix()


def drawTeaStallSeatedCustomer(X,Style,SeatIndex):
    """One customer per stool, seated facing the tea counter (+Y).

    Stool top is Z=25. The character's hips stay above the seat, knees
    bend towards the shop, and the feet hang near the flooded platform.
    Kept under the corrugated roof (underside around Z=72).
    """
    Shirts=[((0.84,0.52,0.27),(0.26,0.52,0.62)),
            ((0.32,0.58,0.48),(0.85,0.60,0.33)),
            ((0.63,0.49,0.70),(0.30,0.57,0.66))]
    ShirtColor=Shirts[Style][SeatIndex]
    PantsColor=(0.14,0.20,0.28) if SeatIndex==0 else (0.24,0.23,0.27)
    Skin=(0.78,0.53,0.34) if SeatIndex==0 else (0.91,0.70,0.50)
    SeatY=-53
    drawSimpleCube(X,SeatY,28,14,12,8,PantsColor)
    for Offset in (-4.4,4.4):
        drawSimpleCube(X+Offset,SeatY+6,25.5,5.5,16,5.3,PantsColor)
        drawSimpleCube(X+Offset,SeatY+13,18,5.5,5.5,16,PantsColor)
        drawSimpleCube(X+Offset,SeatY+16,10,6.5,9,4,(0.12,0.13,0.15))
    drawSimpleCube(X,SeatY,40.0,16,13,21,ShirtColor)
    for Side in (-1,1):
        drawSimpleCube(X+Side*10.2,SeatY+2,44,5.2,9,9,ShirtColor)
        drawSimpleCube(X+Side*10.2,SeatY+11,42,4.5,13,5.5,Skin)
        drawSimpleCube(X+Side*10.2,SeatY+18.0,42,5.1,5,4.3,Skin)
    drawSimpleCube(X,SeatY,51.5,5.8,6,4,Skin)
    drawTeaStallPersonHead(X,SeatY+0.8,59,Skin,1)


def drawTeaStallSeller(Style):
    """A single tea seller stands INSIDE behind the counter, facing out."""
    Skin=(0.82,0.58,0.40)
    Shirt=[(0.78,0.74,0.57),(0.45,0.67,0.60),(0.76,0.57,0.54)][Style]
    Pants=(0.19,0.21,0.27)
    glPushMatrix()
    glTranslatef(-9,0,0)
    Y=3.5
    for Offset in (-4.4,4.4):
        drawSimpleCube(Offset,Y,20,6,8,20,Pants)
    drawSimpleCube(0,Y,39.5,20,13,23,Shirt)
    drawSimpleCube(0,Y-7.0,38,13,2.2,17,(0.88,0.79,0.61))
    for Side in (-1,1):
        drawSimpleCube(Side*12,Y-2.0,45,5.3,10,10,Shirt)
        drawSimpleCube(Side*12,Y-10,46,4.0,10,4.2,Skin)
        drawSimpleCube(Side*12,Y-15,46.2,4.6,5.1,3.4,Skin)
    drawSimpleCube(0,Y,51.5,6,5,3.5,Skin)
    drawTeaStallPersonHead(0,Y-0.5,59.0,Skin,-1)
    glPopMatrix()


def renderTeaStallGeometry(Style):
    Paint=[(0.20,0.42,0.38),(0.52,0.34,0.26),(0.36,0.39,0.52)][Style]
    drawSimpleCube(0,0,5,78,58,10,(0.30,0.27,0.22))
    drawSimpleCube(0,21,34,80,9,48,Paint)
    drawSimpleCube(0,16,59,85,18,7,(0.18,0.32,0.37))
    drawSimpleCube(0,-8,75,106,81,5,(0.44,0.48,0.44))
    for Rib in range(10):
        XX=-45+Rib*10
        drawSimpleCube(XX,-11,79,2,76,2,(0.63,0.64,0.58))
        drawSimpleCube(XX,-51,72,8,3,10,(0.68,0.36,0.22) if Rib%2==0 else (0.82,0.70,0.48))
    for Side in (-1,1):
        for Y in (-36,29):
            drawSimpleCube(Side*45,Y,39,4,4,74,(0.27,0.26,0.25))
    drawSimpleCube(1,-20,26,68,22,34,(0.39,0.27,0.20))
    drawSimpleCube(1,-22,44,72,26,5,(0.58,0.42,0.27))
    for X in (-19,4,23):
        glPushMatrix()
        glTranslatef(X,-22,52)
        glColor3f(0.58,0.69,0.65) if X<20 else glColor3f(0.66,0.68,0.67)
        gluCylinder(getSharedQuadric(),5,5,12,9,4)
        glColor3f(0.78,0.80,0.72)
        glTranslatef(0,0,12)
        gluDisk(getSharedQuadric(),0,5,9,1)
        glPopMatrix()
    for X in (-29,29):
        drawSimpleCube(X,-53,12,18,16,18,(0.41,0.30,0.21))
        drawSimpleCube(X,-53,23,21,20,4,(0.70,0.45,0.24))
    drawTeaStallSeller(Style)
    drawTeaStallSeatedCustomer(-29,Style,0)
    drawTeaStallSeatedCustomer(29,Style,1)
    drawSimpleCube(0,-53,83,66,4,13,(0.08,0.28,0.29))
    drawFlatSignText(0,-55.9,78.5,'CHA',53,10,(0.99,0.90,0.61),LineWidth=2.4)


def drawCityTeaStall(X,Y,Angle,Style):
    glPushMatrix()
    glTranslatef(X,Y,FloodWaterHeight-8)
    glRotatef(Angle,0,0,1)
    drawCachedScene(('tea-stall',Style),lambda:renderTeaStallGeometry(Style),StaticSceneLists)
    glPopMatrix()



def drawNeighborhoodPerson(X,Y,Pose,Color,Skin=(0.75,0.53,0.37),YawDegrees=0,
                           BodyBob=0.0,SwayDegrees=0.0,AnimatedArm=None,
                           ArmLift=0.0):
    """Tiny shop customer/seller built from cubes and one low-poly head."""
    glPushMatrix()
    glTranslatef(X,Y,BodyBob)
    glRotatef(YawDegrees+SwayDegrees,0,0,1)
    Pants=(0.13,0.20,0.28)
    if Pose=='SEATED':
        drawSimpleCube(0,3,21,16,17,4,(0.34,0.26,0.20))
        for Offset in (-6,6):
            drawSimpleCube(Offset,3,10,3,3,18,(0.27,0.23,0.21))
            drawSimpleCube(Offset,-6,13,5,16,6,Pants)
            drawSimpleCube(Offset,-17,7,4,4,12,Pants)
        BodyZ=36
    else:
        for Offset in (-5,5):
            drawSimpleCube(Offset,0,30,6,7,26,Pants)
        BodyZ=56
    drawSimpleCube(0,0,BodyZ,20,12,24,Color)
    for Side in (-1,1):
        Lift=0.0
        ReachY=0.0
        if (AnimatedArm=='LEFT' and Side<0) or (AnimatedArm=='RIGHT' and Side>0):
            Lift=ArmLift
            ReachY=0.32*ArmLift
        drawSimpleCube(Side*12,-1+ReachY,BodyZ+3+0.55*Lift,5,9,15,Color)
        drawSimpleCube(Side*12,-5+ReachY*1.15,BodyZ-5+0.95*Lift,4,5,11,Skin)
    glPushMatrix()
    glTranslatef(0,-1,BodyZ+21)
    glColor3f(*Skin)
    gluSphere(getSharedQuadric(),10,9,7)
    glPopMatrix()
    drawSimpleCube(0,1,BodyZ+29,18,15,5,(0.13,0.12,0.12))
    for Offset in (-3,3):
        drawSimpleCube(Offset,-10.4,BodyZ+22,1.8,1.5,1.7,(0.08,0.08,0.08))
    glPopMatrix()


def drawNeighborhoodShopPeople(Style):
    """Per-frame lightweight people animation so the BRACU block feels alive."""
    T=GameTimeSeconds
    if Style==0:
        drawNeighborhoodPerson(26,-11,'STAND',(0.28,0.64,0.56),YawDegrees=6,
                               BodyBob=0.5*math.sin(T*2.1))
    elif Style==1:
        drawNeighborhoodPerson(26,-11,'STAND',(0.28,0.64,0.56),YawDegrees=0,BodyBob=0.35*math.sin(T*1.8+0.3))
        drawNeighborhoodPerson(-29,-58,'SEATED',(0.68,0.42,0.34),YawDegrees=176,
                               AnimatedArm='RIGHT',ArmLift=8.0+6.0*math.sin(T*3.0))
        drawNeighborhoodPerson(34,-47,'STAND',(0.37,0.53,0.75),YawDegrees=154,
                               SwayDegrees=3.2*math.sin(T*1.7+1.2))
    else:
        drawNeighborhoodPerson(26,-11,'STAND',(0.28,0.64,0.56),YawDegrees=-6,
                               AnimatedArm='LEFT',ArmLift=6.0+5.0*math.sin(T*3.4),
                               BodyBob=0.35*math.sin(T*2.2))
        drawNeighborhoodPerson(-29,-58,'SEATED',(0.68,0.42,0.34),YawDegrees=180)
        drawNeighborhoodPerson(34,-47,'STAND',(0.37,0.53,0.75),YawDegrees=162,
                               SwayDegrees=2.8*math.sin(T*1.6+0.5),
                               BodyBob=0.25*math.sin(T*2.0+0.6))


def renderNeighborhoodShopGeometry(Style):
    """Compact raised shop; everything here is cached in one display list."""
    Main=[(0.27,0.46,0.56),(0.21,0.26,0.28),(0.51,0.24,0.21)][Style]
    Sign=[(0.08,0.29,0.41),(0.15,0.19,0.20),(0.53,0.16,0.14)][Style]
    Front=[(0.61,0.79,0.80),(0.65,0.55,0.43),(0.83,0.65,0.43)][Style]
    Label=('ICON STATIONERY','CAFEISTA','FOOD VALLEY')[Style]
    SubLabel=('BOOKS  PRINT  COPIES','COFFEE  AND  TEA','SNACKS  AND  MEALS')[Style]

    drawSimpleCube(0,-8,8,122,108,16,(0.37,0.39,0.36))
    drawSimpleCube(0,-61,10,120,24,20,(0.49,0.46,0.39))
    drawSimpleCube(0,-68,20,115,4,3,(0.65,0.61,0.52))
    drawSimpleCube(0,33,62,114,16,83,Main)
    drawSimpleCube(0,-5,103,124,91,7,(0.39,0.40,0.38))
    for I in range(9):
        XX=-54+I*13.5
        drawSimpleCube(XX,-5,108,1.7,88,2,(0.61,0.61,0.57))
    drawSimpleCube(0,-46,98,128,12,40,Sign)
    drawSimpleCube(0,-52.6,115,126,1.8,3.0,Front)
    drawSimpleCube(0,-52.6,76,126,1.8,2.4,Front)
    for I in range(8):
        Strip=(-53+I*15.1)
        Shade=(0.71,0.69,0.56) if I%2 else (0.31,0.46,0.44)
        if Style==2:
            Shade=(0.81,0.67,0.47) if I%2 else (0.59,0.28,0.25)
        drawSimpleCube(Strip,-55.5,74.5,14,7,3,Shade)
    drawFlatSignText(0,-53.4,96,Label,118,18,
                     (0.97,0.97,0.89),LineWidth=2.2)
    drawFlatSignText(0,-53.5,81.5,SubLabel,110,5.6,
                     (0.88,0.92,0.78),LineWidth=1.6)
    for Side in (-1,1):
        drawSimpleCube(Side*57,-26,57,4,4,87,(0.46,0.48,0.45))
    drawSimpleCube(0,-1,42,91,9,36,(0.12,0.20,0.22))

    if Style==0:
        for ShelfZ in (37,55,73):
            drawSimpleCube(0,-2,ShelfZ,91,8,4,(0.61,0.65,0.62))
            for I in range(6):
                XX=-36+I*14
                Color=((0.23,0.52,0.70),(0.76,0.44,0.29),
                       (0.82,0.77,0.48))[I%3]
                drawSimpleCube(XX,-8,ShelfZ+8,9,3,13,Color)
        drawSimpleCube(0,-32,32,77,24,29,(0.39,0.46,0.49))
        drawSimpleCube(0,-35,49,80,25,4,(0.67,0.74,0.71))
        for XX in (-25,-8,14):
            drawSimpleCube(XX,-32,56,14,15,8,(0.79,0.81,0.74))
    elif Style==1:
        drawSimpleCube(0,-29,35,91,24,37,(0.29,0.20,0.17))
        drawSimpleCube(0,-32,55,95,27,4,(0.65,0.48,0.32))
        for XX in (-29,-8,17):
            drawSimpleCube(XX,-33,59,11,10,7,(0.89,0.89,0.81))
        for XX in (-38,36):
            drawSimpleCube(XX,-2,69,16,3,23,(0.69,0.74,0.72))
    else:
        drawSimpleCube(0,-29,35,96,24,35,(0.44,0.31,0.22))
        drawSimpleCube(0,-34,55,100,27,5,(0.80,0.67,0.42))
        for XX in (-25,24):
            glPushMatrix()
            glTranslatef(XX,-32,61)
            glColor3f(0.66,0.68,0.65)
            gluCylinder(getSharedQuadric(),9,9,8,10,2)
            glTranslatef(0,0,8)
            gluDisk(getSharedQuadric(),0,9,10,1)
            glPopMatrix()
        drawSimpleCube(0,-45,72,46,2.5,7,(0.86,0.71,0.35))


def drawNeighborhoodShop(X,Y,Style,Name):
    glPushMatrix()
    glTranslatef(X,Y,FloodWaterHeight-8)
    drawCachedScene(('neighborhood-shop',Style),
                    lambda:renderNeighborhoodShopGeometry(Style),StaticSceneLists)
    drawNeighborhoodShopPeople(Style)
    glPopMatrix()


def renderRoadsideProp(Kind):
    if Kind=='rickshaw':
        for X in (-25,24):
            glPushMatrix()
            glTranslatef(X,0,8)
            glColor3f(0.13,0.16,0.17)
            gluDisk(getSharedQuadric(),0,15,12,1)
            glPopMatrix()
        drawSimpleCube(-1,0,26,45,22,10,(0.18,0.47,0.48))
        drawSimpleCube(2,12,38,34,4,30,(0.56,0.27,0.35))
        drawSimpleCube(0,0,55,46,29,5,(0.69,0.25,0.27))
        drawSimpleCube(23,-6,37,4,25,4,(0.26,0.28,0.29))
    else:
        for Side in (-1,1):
            drawSimpleCube(Side*26,0,42,5,6,79,(0.28,0.26,0.23))
        drawSimpleCube(0,0,83,66,7,37,(0.19,0.38,0.40))
        drawSimpleCube(0,-5,92,53,2,4,(0.86,0.74,0.37))
        drawSimpleCube(0,-5,79,43,2,3,(0.85,0.87,0.74))
        drawSimpleCube(0,-5,70,37,2,3,(0.85,0.87,0.74))


def drawRoadsideProp(X,Y,Angle,Kind):
    glPushMatrix()
    glTranslatef(X,Y,FloodWaterHeight-8)
    glRotatef(Angle,0,0,1)
    drawCachedScene(('roadside',Kind),lambda:renderRoadsideProp(Kind),StaticSceneLists)
    glPopMatrix()



StreetLightPositionsCache=None

def getStreetLightPositions():
    global StreetLightPositionsCache
    if StreetLightPositionsCache is not None:
        return StreetLightPositionsCache
    StreetLightPositions=[]
    StreetLightRoadOffset=RoadWidth*0.5+28
    VerticalRoadYEdges=[-WorldMapLimit]+HorizontalRoadPositions+[WorldMapLimit]

    for RoadPositionX in VerticalRoadPositions:
        StreetLightSide=1 if RoadPositionX<=0 else -1
        StreetLightPositionX=RoadPositionX+StreetLightSide*StreetLightRoadOffset

        for RoadSectionNumber in range(len(VerticalRoadYEdges)-1):
            StreetLightPositionY=(VerticalRoadYEdges[RoadSectionNumber]+VerticalRoadYEdges[RoadSectionNumber+1])*0.5
            if isInsideBRACUClearArea(StreetLightPositionX,StreetLightPositionY)==False:
                StreetLightPositions.append((StreetLightPositionX,StreetLightPositionY))

    HorizontalRoadXEdges=[-WorldMapLimit]+VerticalRoadPositions+[WorldMapLimit]

    for RoadPositionY in HorizontalRoadPositions:
        StreetLightSide=-1 if RoadPositionY>=0 else 1
        StreetLightPositionY=RoadPositionY+StreetLightSide*StreetLightRoadOffset

        for RoadSectionNumber in range(len(HorizontalRoadXEdges)-1):
            StreetLightPositionX=(HorizontalRoadXEdges[RoadSectionNumber]+HorizontalRoadXEdges[RoadSectionNumber+1])*0.5
            if isInsideBRACUClearArea(StreetLightPositionX,StreetLightPositionY)==False:
                StreetLightPositions.append((StreetLightPositionX,StreetLightPositionY))

    FilteredStreetLightPositions=[]
    for CurrentStreetLight in StreetLightPositions:
        ShouldKeepStreetLight=True

        for ExistingStreetLight in FilteredStreetLightPositions:
            if abs(CurrentStreetLight[0]-ExistingStreetLight[0])<10 and abs(CurrentStreetLight[1]-ExistingStreetLight[1])<10:
                ShouldKeepStreetLight=False
                break

        if ShouldKeepStreetLight==True:
            FilteredStreetLightPositions.append(CurrentStreetLight)

    StreetLightPositionsCache=FilteredStreetLightPositions
    return FilteredStreetLightPositions


def renderCinematicStreetLightPole():
    """Shared cast-metal mast and hanging bracket, cached for all streetlights."""
    glColor3f(0.22,0.27,0.28)
    gluCylinder(getSharedQuadric(),4.6,3.1,104,8,2)
    drawSimpleCube(0,0,102,11,11,5,(0.31,0.37,0.37))
    drawSimpleCube(0,-6,110,4,22,3,(0.31,0.36,0.35))
    drawSimpleCube(0,-15,106,11,9,5,(0.25,0.30,0.31))


def drawStreetLight(PositionX,PositionY):
    glPushMatrix()
    glTranslatef(PositionX,PositionY,FloodWaterHeight-7)
    drawCachedScene('cinematic-light-mast',renderCinematicStreetLightPole,StaticSceneLists)
    glPopMatrix()
    Off=isPositionInsideBlackoutDistrict(PositionX)
    LightColor=(0.13,0.15,0.16) if Off else (1.0,0.77,0.41)
    glPushMatrix()
    glTranslatef(PositionX,PositionY-15,FloodWaterHeight+99)
    glColor3f(*LightColor)
    gluSphere(getSharedQuadric(),6.5,8,6)
    glPopMatrix()
    if not Off and RenderQuality=='HIGH':
        DX=PositionX-BoatPositionX
        DY=PositionY-BoatPositionY
        if DX*DX+DY*DY<680*680:
            glEnable(GL_BLEND)
            glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
            glDepthMask(GL_FALSE)
            glPushMatrix()
            glTranslatef(PositionX,PositionY-15,FloodWaterHeight+99)
            glColor4f(1.0,0.72,0.39,0.10)
            gluSphere(getSharedQuadric(),16,8,6)
            glPopMatrix()
            glDepthMask(GL_TRUE)
            glDisable(GL_BLEND)

def drawCityEnvironment():
    """Render recognizable city objects without camera-distance pop-in.

    Cars, shops, the tea stall and Shaheed Minar stay submitted until they
    have passed the fully opaque fog distance. Never hide an entire object
    based on a single ray to its center: OpenGL depth testing clips the
    portions that are genuinely behind buildings instead.
    """
    CityDrawingList=[]

    for BuildingNumber,CurrentBuilding in enumerate(BuildingList):
        Radius=max(CurrentBuilding[2],CurrentBuilding[3])+55
        if isWithinSceneryFogHorizon(CurrentBuilding[0],CurrentBuilding[1],Radius):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentBuilding[0],CurrentBuilding[1]),"building",BuildingNumber,CurrentBuilding])

    for CarIndex,CurrentCar in enumerate(getSubmergedCarPositions()):
        if isWithinSceneryFogHorizon(CurrentCar[0],CurrentCar[1],95):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentCar[0],CurrentCar[1]),"car",CarIndex,CurrentCar])

    for CarIndex,MovingCar in enumerate(getSlowMovingCarPositions()):
        if isWithinSceneryFogHorizon(MovingCar[0],MovingCar[1],95):
            CityDrawingList.append([calculateObjectDistanceFromCamera(MovingCar[0],MovingCar[1]),"movingcar",CarIndex,MovingCar])

    for TreeIndex,Tree in enumerate(CityTreeList):
        if isWorldObjectInView(Tree[0],Tree[1],85):
            CityDrawingList.append([calculateObjectDistanceFromCamera(Tree[0],Tree[1]),"tree",TreeIndex,Tree])

    for StallIndex,Stall in enumerate(CityTeaStalls):
        if isWithinSceneryFogHorizon(Stall[0],Stall[1],110):
            CityDrawingList.append([calculateObjectDistanceFromCamera(Stall[0],Stall[1]),"stall",StallIndex,Stall])

    for ShopIndex,Shop in enumerate(CityBRACUShops):
        if isWithinSceneryFogHorizon(Shop[0],Shop[1],145):
            CityDrawingList.append([calculateObjectDistanceFromCamera(Shop[0],Shop[1]),"shop",ShopIndex,Shop])

    for PropIndex,Prop in enumerate(CityRoadsideProps):
        if isWorldObjectInView(Prop[0],Prop[1],78):
            CityDrawingList.append([calculateObjectDistanceFromCamera(Prop[0],Prop[1]),"roadside",PropIndex,Prop])

    for CurrentStreetLight in getStreetLightPositions():
        if isWorldObjectInView(CurrentStreetLight[0],CurrentStreetLight[1],65):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentStreetLight[0],CurrentStreetLight[1]),"light",0,CurrentStreetLight])

    for LandmarkNumber,CurrentLandmark in enumerate(LandmarkList):
        if isWithinSceneryFogHorizon(CurrentLandmark["x"],CurrentLandmark["y"],220):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentLandmark["x"],CurrentLandmark["y"]),"landmark",LandmarkNumber,CurrentLandmark])
        if isWorldObjectInView(CurrentLandmark["photo_x"],CurrentLandmark["photo_y"],100):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentLandmark["photo_x"],CurrentLandmark["photo_y"]),"photo",LandmarkNumber,CurrentLandmark])

    if isWorldObjectInView(145,-55,95):
        CityDrawingList.append([calculateObjectDistanceFromCamera(145,-55),"traffic",0,None])

    for PowerDistrictNumber,CurrentPowerDistrict in enumerate(PowerDistrictList):
        if isWorldObjectInView(CurrentPowerDistrict["repair_x"],CurrentPowerDistrict["repair_y"],100):
            CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentPowerDistrict["repair_x"],CurrentPowerDistrict["repair_y"]),"powerstation",PowerDistrictNumber,CurrentPowerDistrict])

    CityDrawingList.sort(key=lambda CurrentItem:CurrentItem[0],reverse=True)

    for CurrentItem in CityDrawingList:
        CurrentObjectType=CurrentItem[1]

        if CurrentObjectType=="building":
            BuildingNumber=CurrentItem[2]
            BuildingInformation=CurrentItem[3]
            drawSingleBuilding(BuildingInformation,BuildingColors[BuildingNumber%len(BuildingColors)])

        elif CurrentObjectType=="car":
            CarInformation=CurrentItem[3]
            CarIndex=CurrentItem[2]
            drawSingleSubmergedCar(CarInformation[0],CarInformation[1],CarInformation[2],
                                   CarIndex,CarIndex in BrokenCarIndices)
            if CarIndex in BrokenCarIndices:
                drawStrandedCarDriver(CarInformation[0],CarInformation[1],
                                     CarInformation[2],CarIndex)

        elif CurrentObjectType=="movingcar":
            MovingCar=CurrentItem[3]
            CarIndex=CurrentItem[2]
            drawSingleSubmergedCar(MovingCar[0],MovingCar[1],MovingCar[2],MovingCar[3],False)
            if not SlowMovingCarStopped[CarIndex]:
                drawSlowMovingCarWake(*MovingCar)

        elif CurrentObjectType=="tree":
            Tree=CurrentItem[3]
            drawCityTree(Tree[0],Tree[1],Tree[2])

        elif CurrentObjectType=="stall":
            drawCityTeaStall(*CurrentItem[3])

        elif CurrentObjectType=="shop":
            drawNeighborhoodShop(*CurrentItem[3])

        elif CurrentObjectType=="roadside":
            drawRoadsideProp(*CurrentItem[3])

        elif CurrentObjectType=="light":
            StreetLightInformation=CurrentItem[3]
            drawStreetLight(StreetLightInformation[0],StreetLightInformation[1])

        elif CurrentObjectType=="landmark":
            drawCachedScene(('city-landmark',CurrentItem[2]),
                            lambda:drawLandmarkWorldObject(CurrentItem[3]),StaticSceneLists)

        elif CurrentObjectType=="photo":
            drawLandmarkPhotoSpot(CurrentItem[3])

        elif CurrentObjectType=="traffic":
            drawFloodTrafficSignal()

        elif CurrentObjectType=="powerstation":
            drawPowerRepairStation(CurrentItem[3])




GameMode="MENU"
MenuSelectedOption='START'
MenuHoveredOption=None
MenuHelpVisible=False
MenuOptions=(('START',(716,448,961,507)),
             ('HELP',(716,368,961,427)),
             ('EXIT',(716,288,961,347)))
MenuCloseBounds=(944,739,985,783)
MenuBackBounds=(745,152,953,206)
ShowInstructions=False
ThirdPersonCamera=True
GameTimeSeconds=0.0
GameDurationLimit=900.0
DeliveryGoal=6
MaximumFailedRides=6
Score=0
DeliveredRideCount=0
FailedRideCount=0
RescuedPersonCount=0
MissedRescueCount=0

BoatBoostMeter=100.0
BoatBoostActive=False
BoatBoostDrainPerSecond=30.0
BoatBoostRechargePerSecond=15.0
BoatLastMovementTime=-100.0
BoatLastX,BoatLastY=BoatPositionX,BoatPositionY
BoatDebrisCooldown=0.0
DockingProgress=0.0
DockingRequiredSeconds=1.3
DrowningRescueSeconds=0.65
DockingTargetId=-1
DeliveryZoneX,DeliveryZoneY,DeliveryZoneRadius=0,1080,122
HomePickupRadius=72
DrowningPickupRadius=56
BoatCurrentZoneName=""

IncomingRideRequest=None
IncomingRequestLifetime=22.0
IncomingRequestTimeLeft=0.0
RequestSpawnTimer=0.0
RequestSpawnInterval=9.5
RequestGenerationIndex=0
ActiveRideRequests=[]
MaximumActiveRequests=5

GameNotification=""
GameNotificationTimer=0.0

PickupSplashEffects=[]
DeliveryExitAnimations=[]
DeliveryFeedbackTime=0.0
DeliveryFeedbackCount=0
DeliveryFeedbackScore=0
DeliveryFeedbackStartedAt=0.0
PickupArrivalSeconds=0.85
DeliveryExitSeconds=1.65
DeliveryBannerSeconds=2.65

RideDeadlineBase=43.0
RideDeadlineDistanceDivisor=130.0
RideDeadlineMinimum=66.0
RideDeadlineMaximum=118.0
RideDeadlineHomeExtra=7.0
RideDeadlineWarningAt=25.0

MissedPassengerEffects=[]
MissedPassengerExitSeconds=0.80
MissedPassengerStruggleUntil=2.85
MissedPassengerSinkUntil=3.85
MissedPassengerDuration=4.35

HomePickupLocations=[]
DrowningPickupLocations=[]

SelectedHomeBuildings=[
    (-275,-1375),(275,-1375),(-825,-875),(825,-875),
    (-275,-325),(275,-325),(-825,225),(825,225),
    (-825,775),(825,775),(-1375,-875),(1375,-325),
    (-1375,225),(1375,225),(-275,-875),(275,-875)
]
for HomeNumber in range(len(SelectedHomeBuildings)):
    RequestedBuildingX,RequestedBuildingY=SelectedHomeBuildings[HomeNumber]
    for CurrentBuilding in BuildingList:
        if CurrentBuilding[0]!=RequestedBuildingX or CurrentBuilding[1]!=RequestedBuildingY:
            continue
        BuildingX,BuildingY,HalfWidth,HalfLength,BuildingHeight=CurrentBuilding
        RoadY=min(HorizontalRoadPositions,key=lambda Road:abs(Road-BuildingY))
        FrontDirection=1 if RoadY>BuildingY else -1
        DoorY=BuildingY+FrontDirection*(HalfLength+30)
        BoatDockY=DoorY+FrontDirection*80
        if isBoatPositionValid(BuildingX,BoatDockY):
            HomePickupLocations.append({
                "id":"H"+str(HomeNumber+1).zfill(2),
                "name":"Home "+str(HomeNumber+1).zfill(2),
                "x":BuildingX,"y":BoatDockY,
                "door_x":BuildingX,"door_y":DoorY,
                "building_x":BuildingX,"building_y":BuildingY,
                "building_face_y":BuildingY+FrontDirection*(HalfLength+2),
                "front_direction":FrontDirection,
                "type":"HOME"
            })
        break

DrowningStreetSpots=[
    (0,-1150),(-550,-1150),(550,-1150),(-1100,-600),(1100,-600),
    (-550,-600),(550,-600),(0,-50),(-1100,-50),(1100,-50),
    (-550,500),(550,500),(-1100,1050),(1100,1050),(-550,1050),(550,1050)
]
for StreetNumber in range(len(DrowningStreetSpots)):
    StreetX,StreetY=DrowningStreetSpots[StreetNumber]
    if isBoatPositionValid(StreetX,StreetY):
        DrowningPickupLocations.append({
            "id":"S"+str(StreetNumber+1).zfill(2),
            "name":"Flooded Street "+str(StreetNumber+1).zfill(2),
            "x":StreetX,"y":StreetY,"type":"DROWNING"
        })

StudentNames=["Adittya","Usaeed","Nafisa","Sujail","Kazmi","Safin","Shammo",
              "Fahim","Rafi","Nabil","Sadia","Tanvir","Mushfiq","Jara","Tahmid",
              "Nusrat","Riad","Faria","Zarin","Adnan"]
StudentColors=[(0.95,0.38,0.21),(0.32,0.79,0.91),(0.91,0.68,0.21),
               (0.66,0.46,0.91),(0.39,0.88,0.61),(0.92,0.44,0.68)]

WaterCurrentZones=[
    {"name":"WEST CURRENT","min_x":-1260,"max_x":-940,"min_y":-450,"max_y":200,"dx":39,"dy":4},
    {"name":"CENTRAL CURRENT","min_x":-150,"max_x":150,"min_y":-950,"max_y":-350,"dx":-38,"dy":0},
    {"name":"EAST CURRENT","min_x":430,"max_x":680,"min_y":150,"max_y":850,"dx":0,"dy":-43},
    {"name":"NORTH CURRENT","min_x":-700,"max_x":-390,"min_y":710,"max_y":1150,"dx":34,"dy":0}
]
FloatingDebrisList=[]


def showGameMessage(Message,Duration=3.0):
    global GameNotification,GameNotificationTimer
    GameNotification=str(Message)
    GameNotificationTimer=Duration


def getOnboardPassengerCount():
    Count=0
    for CurrentRide in ActiveRideRequests:
        if CurrentRide["state"]=="ONBOARD":
            Count=Count+1
    return Count


def formatArcadeTime(Seconds):
    SafeSeconds=max(0,int(Seconds))
    return str(SafeSeconds//60).zfill(2)+":"+str(SafeSeconds%60).zfill(2)


def createFloatingDebris():
    global FloatingDebrisList
    FloatingDebrisList=[]
    DebrisPositions=[(-1120,-220),(-535,-660),(40,-360),(595,-980),
                     (1125,-50),(-1060,720),(-510,880),(0,270),
                     (550,870),(1100,1000)]
    for DebrisNumber in range(len(DebrisPositions)):
        Position=DebrisPositions[DebrisNumber]
        DriftDirection=1 if DebrisNumber%2==0 else -1
        FloatingDebrisList.append({"x":Position[0],"y":Position[1],
                                   "start_x":Position[0],"start_y":Position[1],
                                   "phase":DebrisNumber*0.67,"type":DebrisNumber%3,
                                   "drift":DriftDirection,"radius":37})


def smoothVisualStep(Value):
    """Smooth position interpolation, used only by character animations."""
    Value=max(0.0,min(1.0,Value))
    return Value*Value*(3.0-2.0*Value)


def getDockingVisualFraction(Ride):
    """How far along the unchanged hold-still pickup timer are we?"""
    if DockingTargetId!=Ride['id'] or DockingProgress<=0:
        return 0.0
    Required=(DockingRequiredSeconds if Ride['pickup_type']=='HOME'
              else DrowningRescueSeconds)
    return smoothVisualStep(DockingProgress/max(0.01,Required))


def getBoatVisualSeatWorldPosition(SeatX,SeatY):
    """World-space seat point, used to launch brief arrival/exit visuals."""
    Heading=math.radians(BoatFacingAngle)
    CS,SN=math.cos(Heading),math.sin(Heading)
    LX,LY=SeatX*BoatModelScale,SeatY*BoatModelScale
    Bob,_=getBoatVisualMotion()
    return (BoatPositionX+CS*LX-SN*LY,
            BoatPositionY+SN*LX+CS*LY,
            FloodWaterHeight+10+Bob+BoatModelScale*28)


def addRescueSplash(X,Y,IsSOS):
    PickupSplashEffects.append({'x':X,'y':Y,'time':GameTimeSeconds,
                                'sos':IsSOS})
    del PickupSplashEffects[:-5]


def addMissedPassengerVisual(Ride,AlreadyInWater=False):
    """Keep a cosmetic character after its expired ride is removed.

    A previously boarded student moves from the correct seat to the side of
    the boat before slipping into the water. Waiting SOS students start in
    the water. This never creates a new pickup or affects boat collision.
    """
    if AlreadyInWater:
        X=Ride['x']
        Y=Ride['y']
        Z=getWaterWaveHeight(X,Y)+8
        ExitX,ExitY=X,Y
        Started=GameTimeSeconds-MissedPassengerExitSeconds
    else:
        Seats=[(8,-19),(8,19),(67,0)]
        SeatIndex=max(0,min(len(Seats)-1,Ride.get('_seat_index',0)))
        X,Y,Z=getBoatVisualSeatWorldPosition(*Seats[SeatIndex])
        Angle=math.radians(BoatFacingAngle)
        Side=(-1 if SeatIndex==0 else 1)
        if SeatIndex==2:
            Side=1 if Ride['id']%2 else -1
        ExitX=X-math.sin(Angle)*Side*47
        ExitY=Y+math.cos(Angle)*Side*47
        Started=GameTimeSeconds
    MissedPassengerEffects.append({
        'x0':X,'y0':Y,'z0':Z,
        'x1':ExitX,'y1':ExitY,
        'time':Started,'color':Ride['color'],
        'id':Ride['id'],'in_water':AlreadyInWater
    })
    del MissedPassengerEffects[:-6]


def addDeliveryVisuals(Rides,ScoreIncrease):
    global DeliveryFeedbackTime,DeliveryFeedbackCount,DeliveryFeedbackScore
    global DeliveryFeedbackStartedAt
    Seats=[(8,-19),(8,19),(67,0)]
    for Index,Ride in enumerate(Rides):
        Seat=Seats[Index]
        StartX,StartY,StartZ=getBoatVisualSeatWorldPosition(*Seat)
        EndX=max(-78.0,min(78.0,StartX*0.25+(Index-1)*24))
        EndY=1164.0+(Index-1)*9
        DeliveryExitAnimations.append({'x0':StartX,'y0':StartY,'z0':StartZ,
             'x1':EndX,'y1':EndY,'time':GameTimeSeconds,
             'color':Ride['color'],'id':Ride['id']})
    del DeliveryExitAnimations[:-9]
    DeliveryFeedbackTime=DeliveryBannerSeconds
    DeliveryFeedbackCount=len(Rides)
    DeliveryFeedbackScore=ScoreIncrease
    DeliveryFeedbackStartedAt=GameTimeSeconds


def expireVisualEffects():
    global DeliveryFeedbackTime
    PickupSplashEffects[:]=[E for E in PickupSplashEffects
                          if GameTimeSeconds-E['time']<1.15]
    DeliveryExitAnimations[:]=[E for E in DeliveryExitAnimations
                               if GameTimeSeconds-E['time']<DeliveryExitSeconds]
    MissedPassengerEffects[:]=[E for E in MissedPassengerEffects
                              if GameTimeSeconds-E['time']<MissedPassengerDuration]
    if DeliveryFeedbackTime>0:
        DeliveryFeedbackTime=max(0.0,DeliveryBannerSeconds-
                                 (GameTimeSeconds-DeliveryFeedbackStartedAt))


def resetArcadeGame():
    global GameMode,ShowInstructions,ThirdPersonCamera,GameTimeSeconds,Score
    global DeliveredRideCount,FailedRideCount,RescuedPersonCount,MissedRescueCount
    global BoatPositionX,BoatPositionY,BoatFacingAngle,BoatLastMovementTime
    global BoatBoostMeter,BoatBoostActive,BoatDebrisCooldown,DockingProgress,DockingTargetId
    global IncomingRideRequest,IncomingRequestTimeLeft,RequestSpawnTimer,RequestGenerationIndex
    global BoatCurrentZoneName
    global TrafficState,TrafficTimer,TrafficWasInside,TrafficViolations,TrafficSafeX,TrafficSafeY
    global PowerOutageActive,PowerOutageDistrictIndex,PowerNextOutageTimer,PowerRestoreMessageTimer
    global WiperActive,WiperAngle,WiperDirection,ScreenRainSpawnTimer
    global PhotoFlashTimer,PhotoPopupTimer,PhotoPopupTitle,PhotoPopupLines
    global GameNotification,GameNotificationTimer
    global DeliveryFeedbackTime,DeliveryFeedbackCount,DeliveryFeedbackScore,DeliveryFeedbackStartedAt
    global ChaseCameraDistance,SmoothedCameraHeading,LastCameraUpdateTime
    global TrafficContactMessageCooldown

    ChaseCameraDistance=235.0
    SmoothedCameraHeading=None
    LastCameraUpdateTime=None
    HeldMovementKeys.clear()
    HeldArrowKeys.clear()
    GameMode="PLAYING"
    ShowInstructions=False
    ThirdPersonCamera=True
    GameTimeSeconds=0.0
    TrafficContactMessageCooldown=0.0
    SlowMovingCarProgress[:]=[float(Car['phase']) for Car in SlowMovingCarList]
    SlowMovingCarStopped[:]=[False for Car in SlowMovingCarList]
    Score=0
    DeliveredRideCount=0
    FailedRideCount=0
    RescuedPersonCount=0
    MissedRescueCount=0
    BoatPositionX,BoatPositionY=0,-1450
    BoatFacingAngle=90
    BoatLastMovementTime=-100
    BoatBoostMeter=100.0
    BoatBoostActive=False
    BoatDebrisCooldown=0.0
    DockingProgress=0.0
    DockingTargetId=-1
    IncomingRideRequest=None
    IncomingRequestTimeLeft=0
    RequestSpawnTimer=0
    RequestGenerationIndex=0
    ActiveRideRequests[:]=[]
    PickupSplashEffects[:]=[]
    DeliveryExitAnimations[:]=[]
    MissedPassengerEffects[:]=[]
    DeliveryFeedbackTime=0.0
    DeliveryFeedbackCount=0
    DeliveryFeedbackScore=0
    DeliveryFeedbackStartedAt=0.0
    BoatCurrentZoneName=""
    TrafficState="GREEN"
    TrafficTimer=0
    TrafficWasInside=False
    TrafficViolations=0
    TrafficSafeX,TrafficSafeY=BoatPositionX,BoatPositionY
    PowerOutageActive=True
    PowerOutageDistrictIndex=0
    PowerNextOutageTimer=0
    PowerRestoreMessageTimer=0
    WiperActive=False
    WiperAngle=18
    WiperDirection=1
    ScreenRainSpawnTimer=0
    ScreenRainDrops[:]=[]
    PhotoFlashTimer=0
    PhotoPopupTimer=0
    PhotoPopupTitle=""
    PhotoPopupLines=[]
    for CurrentLandmark in LandmarkList:
        CurrentLandmark["taken"]=False
    createFloatingDebris()
    spawnNextRideRequest()
    showGameMessage("Take students to BRAC University before their timers expire!",5)


def calculateUrgentRideDeadline(Pickup,PickupType):
    """Short deadline scaled to an approximate street-route distance.

    Use Manhattan distance because the player navigates flooded road lanes,
    not through buildings. Both travel legs count: where the boat currently
    is, to the student, and from the student to BRACU. A few seconds of
    variation keep rides different without random impossible deadlines.
    """
    ToPickup=(abs(BoatPositionX-Pickup['x'])+
              abs(BoatPositionY-Pickup['y']))
    ToBRACU=(abs(Pickup['x']-DeliveryZoneX)+
             abs(Pickup['y']-DeliveryZoneY))
    Extra=RideDeadlineHomeExtra if PickupType=='HOME' else 0.0
    Allowance=(RideDeadlineBase+(ToPickup+ToBRACU)/RideDeadlineDistanceDivisor+
               Extra+random.randint(-4,6))
    return max(RideDeadlineMinimum,min(RideDeadlineMaximum,round(Allowance)))


def spawnNextRideRequest():
    global IncomingRideRequest,IncomingRequestTimeLeft,RequestGenerationIndex
    if IncomingRideRequest is not None or len(ActiveRideRequests)>=MaximumActiveRequests:
        return

    RequestNumber=RequestGenerationIndex
    RequestGenerationIndex=RequestGenerationIndex+1
    PickupType="HOME" if RequestNumber%2==0 else "DROWNING"
    CandidateLocations=HomePickupLocations if PickupType=="HOME" else DrowningPickupLocations
    AvailableLocations=[]
    for Candidate in CandidateLocations:
        LocationOccupied=False
        for Ride in ActiveRideRequests:
            if Ride["location_id"]==Candidate["id"]:
                LocationOccupied=True
                break
        if not LocationOccupied:
            AvailableLocations.append(Candidate)
    if len(AvailableLocations)==0:
        return

    if RequestNumber<2:
        Pickup=AvailableLocations[0]
    else:
        Pickup=random.choice(AvailableLocations)
    StudentName=StudentNames[RequestNumber%len(StudentNames)]
    TimeLimit=calculateUrgentRideDeadline(Pickup,PickupType)
    IncomingRideRequest={
        "id":RequestNumber,"name":StudentName,"pickup":Pickup["name"],
        "pickup_type":PickupType,"location_id":Pickup["id"],
        "x":Pickup["x"],"y":Pickup["y"],
        "time_left":TimeLimit,"state":"OFFERED",
        "color":StudentColors[RequestNumber%len(StudentColors)]
    }
    if PickupType=="HOME":
        IncomingRideRequest["door_x"]=Pickup["door_x"]
        IncomingRideRequest["door_y"]=Pickup["door_y"]
        IncomingRideRequest["building_face_y"]=Pickup["building_face_y"]
        IncomingRideRequest["front_direction"]=Pickup["front_direction"]
    IncomingRequestTimeLeft=IncomingRequestLifetime

def acceptRideRequest():
    global IncomingRideRequest,RequestSpawnTimer
    if IncomingRideRequest==None:
        showGameMessage("No incoming ride request.",2)
        return
    if len(ActiveRideRequests)>=MaximumActiveRequests:
        showGameMessage("Ride queue is full (5 active requests).",3)
        return
    IncomingRideRequest["state"]="WAITING"
    ActiveRideRequests.append(IncomingRideRequest)
    PickupDescription="HOME" if IncomingRideRequest["pickup_type"]=="HOME" else "SOS / FLOODED STREET"
    showGameMessage("Accepted "+IncomingRideRequest["name"]+" - "+PickupDescription,3)
    IncomingRideRequest=None
    RequestSpawnTimer=0


def rejectRideRequest():
    global IncomingRideRequest,RequestSpawnTimer
    if IncomingRideRequest==None:
        showGameMessage("No incoming request to reject.",2)
        return
    showGameMessage("Ride rejected: "+IncomingRideRequest["name"],2)
    IncomingRideRequest=None
    RequestSpawnTimer=0


def finishExpiredRide(CurrentRide):
    global FailedRideCount,Score,DockingTargetId,DockingProgress
    global MissedRescueCount
    DrownedBeforeBoarding=(CurrentRide['pickup_type']=='DROWNING'
                           and CurrentRide['state']=='WAITING')
    MissedOnBoat=(CurrentRide['state']=='ONBOARD')
    if MissedOnBoat:
        addMissedPassengerVisual(CurrentRide)
    elif DrownedBeforeBoarding:
        addMissedPassengerVisual(CurrentRide,AlreadyInWater=True)
    CurrentRide['state']='FAILED'
    FailedRideCount+=1
    if DrownedBeforeBoarding:
        MissedRescueCount+=1
    Score=max(0,Score-75)
    if DockingTargetId==CurrentRide['id']:
        DockingTargetId=-1
        DockingProgress=0
    if MissedOnBoat:
        showGameMessage(CurrentRide['name']+' ran out of time - left the boat!',4)
    elif DrownedBeforeBoarding:
        showGameMessage(CurrentRide['name']+' could not be rescued in time!',4)
    else:
        showGameMessage(CurrentRide['name']+' missed the class deadline!',4)


def updateStudentRideSystem(DeltaTime):
    global IncomingRideRequest,IncomingRequestTimeLeft,RequestSpawnTimer
    global DockingTargetId,DockingProgress,DeliveredRideCount,Score,RescuedPersonCount
    if IncomingRideRequest is not None:
        IncomingRequestTimeLeft-=DeltaTime
        if IncomingRequestTimeLeft<=0:
            IncomingRideRequest=None
            RequestSpawnTimer=0
    else:
        RequestSpawnTimer+=DeltaTime
        if RequestSpawnTimer>=RequestSpawnInterval:
            RequestSpawnTimer=0
            spawnNextRideRequest()

    SeatIndex=0
    for Ride in ActiveRideRequests:
        if Ride['state']=='ONBOARD':
            Ride['_seat_index']=SeatIndex
            SeatIndex+=1
    for Ride in ActiveRideRequests:
        if Ride['state'] in ('WAITING','ONBOARD'):
            PreviousTime=Ride['time_left']
            Ride['time_left']-=DeltaTime
            if Ride['time_left']<=0:
                Ride['time_left']=0
                finishExpiredRide(Ride)
            elif (Ride['state']=='ONBOARD' and
                  Ride['time_left']<=RideDeadlineWarningAt and
                  not Ride.get('deadline_warning_shown',False)):
                Ride['deadline_warning_shown']=True
                showGameMessage('HURRY! '+Ride['name']+' has 25 seconds to reach BRACU!',3)
    ActiveRideRequests[:]=[Ride for Ride in ActiveRideRequests if Ride['state'] in ('WAITING','ONBOARD')]

    if calculate2DDistance(BoatPositionX,BoatPositionY,DeliveryZoneX,DeliveryZoneY)<=DeliveryZoneRadius:
        DeliveredRides=[Ride for Ride in ActiveRideRequests if Ride['state']=='ONBOARD']
        DeliveredNow=len(DeliveredRides)
        if DeliveredNow:
            DeliveryScore=0
            for Ride in DeliveredRides:
                Ride['state']='DELIVERED'
                RidePoints=200+int(Ride['time_left']*0.4)
                DeliveryScore+=RidePoints
                DeliveredRideCount+=1
                Score+=RidePoints
            addDeliveryVisuals(DeliveredRides,DeliveryScore)
            showGameMessage(str(DeliveredNow)+" student(s) arrived at BRACU!",4)
            ActiveRideRequests[:]=[Ride for Ride in ActiveRideRequests if Ride['state']!='DELIVERED']

    NearestRide=None
    NearestDistance=999999
    for Ride in ActiveRideRequests:
        if Ride["state"]=="WAITING":
            Distance=calculate2DDistance(BoatPositionX,BoatPositionY,Ride["x"],Ride["y"])
            Radius=HomePickupRadius if Ride["pickup_type"]=="HOME" else DrowningPickupRadius
            if Distance<=Radius and Distance<NearestDistance:
                NearestDistance=Distance
                NearestRide=Ride

    if NearestRide is None or getOnboardPassengerCount()>=3:
        DockingProgress=0
        DockingTargetId=-1
        return

    if GameTimeSeconds-BoatLastMovementTime<0.38:
        DockingProgress=0
        DockingTargetId=-1
        return

    if DockingTargetId!=NearestRide["id"]:
        DockingTargetId=NearestRide["id"]
        DockingProgress=0
    DockingProgress+=DeltaTime
    HoldSeconds=(DockingRequiredSeconds if NearestRide["pickup_type"]=="HOME"
                 else DrowningRescueSeconds)
    if DockingProgress>=HoldSeconds:
        NearestRide["state"]="ONBOARD"
        NearestRide['boarded_at']=GameTimeSeconds
        NearestRide['boarding_boat_side']=-1 if (NearestRide['id']%2==0) else 1
        SplashX=(NearestRide['x'] if NearestRide['pickup_type']=='DROWNING'
                 else BoatPositionX)
        SplashY=(NearestRide['y'] if NearestRide['pickup_type']=='DROWNING'
                 else BoatPositionY)
        addRescueSplash(SplashX,SplashY,NearestRide['pickup_type']=='DROWNING')
        DockingProgress=0
        DockingTargetId=-1
        if NearestRide["pickup_type"]=="DROWNING":
            RescuedPersonCount+=1
            Score+=90
            showGameMessage("RESCUED "+NearestRide["name"]+"! Now deliver to BRACU.",3.5)
        else:
            Score+=35
            showGameMessage(NearestRide["name"]+" boarded from home! "+str(getOnboardPassengerCount())+"/3 seats.",3.5)

def updateBoatBoost(DeltaTime):
    global BoatBoostMeter,BoatBoostActive
    if BoatBoostActive==True:
        BoatBoostMeter=BoatBoostMeter-BoatBoostDrainPerSecond*DeltaTime
        if BoatBoostMeter<=0:
            BoatBoostMeter=0
            BoatBoostActive=False
    else:
        BoatBoostMeter=min(100,BoatBoostMeter+BoatBoostRechargePerSecond*DeltaTime)


def activateBoatBoost():
    global BoatBoostActive
    if BoatBoostActive==True:
        BoatBoostActive=False
        showGameMessage("Boost stopped. Meter recharging.",2)
    elif BoatBoostMeter>=25:
        BoatBoostActive=True
        showGameMessage("PADDLE BOOST! Press SPACE again to turn off.",2)
    else:
        showGameMessage("Recharge boost to at least 25%.",2)


def applyCurrentForces(DeltaTime):
    global BoatPositionX,BoatPositionY,BoatCurrentZoneName
    BoatCurrentZoneName=""
    for CurrentZone in WaterCurrentZones:
        if (CurrentZone["min_x"]<=BoatPositionX<=CurrentZone["max_x"] and
            CurrentZone["min_y"]<=BoatPositionY<=CurrentZone["max_y"]):
            BoatCurrentZoneName=CurrentZone["name"]
            FutureX=BoatPositionX+CurrentZone["dx"]*DeltaTime
            FutureY=BoatPositionY+CurrentZone["dy"]*DeltaTime
            if isBoatPositionValid(FutureX,FutureY)==True and isBoatCollidingWithDebris(FutureX,FutureY)==False:
                BoatPositionX=FutureX
                BoatPositionY=FutureY
            break


def isBoatCollidingWithDebris(PositionX,PositionY):
    for CurrentDebris in FloatingDebrisList:
        if calculate2DDistance(PositionX,PositionY,CurrentDebris["x"],CurrentDebris["y"])<=CurrentDebris["radius"]+18:
            return True
    return False


def registerDebrisCollision():
    global BoatDebrisCooldown,Score
    if BoatDebrisCooldown>0:
        return
    BoatDebrisCooldown=1.8
    Score=max(0,Score-25)
    showGameMessage("Floating debris! -25 points. Steer around the obstacle.",3)


def updateDebris(DeltaTime):
    global BoatDebrisCooldown
    BoatDebrisCooldown=max(0,BoatDebrisCooldown-DeltaTime)
    for CurrentDebris in FloatingDebrisList:
        CurrentDebris["phase"]+=DeltaTime*0.65
        FutureX=CurrentDebris["start_x"]+math.sin(CurrentDebris["phase"])*26
        FutureY=CurrentDebris["start_y"]+math.cos(CurrentDebris["phase"]*0.7)*18
        SafeRadius=CurrentDebris["radius"]+18.0+1.0
        if math.hypot(FutureX-BoatPositionX,FutureY-BoatPositionY)>=SafeRadius:
            CurrentDebris["x"]=FutureX
            CurrentDebris["y"]=FutureY


def updateArcadeGameplay(DeltaTime):
    global GameTimeSeconds,GameMode,GameNotificationTimer,TrafficContactMessageCooldown
    GameTimeSeconds=GameTimeSeconds+DeltaTime
    TrafficContactMessageCooldown=max(0.0,TrafficContactMessageCooldown-DeltaTime)
    if GameNotificationTimer>0:
        GameNotificationTimer=max(0,GameNotificationTimer-DeltaTime)
    updateBoatBoost(DeltaTime)
    updateDebris(DeltaTime)
    updateSlowMovingCars(DeltaTime)
    applyCurrentForces(DeltaTime)
    updateStudentRideSystem(DeltaTime)
    expireVisualEffects()
    if DeliveredRideCount>=DeliveryGoal:
        GameMode="WON"
    elif GameTimeSeconds>=GameDurationLimit:
        GameMode='LOST'
    elif FailedRideCount>=MaximumFailedRides and not MissedPassengerEffects:
        GameMode='LOST'



def drawWaterRing(PositionX,PositionY,Radius,Height,Color):
    Elevation=Height-FloodWaterHeight
    glColor3f(Color[0],Color[1],Color[2])
    glBegin(GL_LINE_STRIP)
    for CosAngle,SinAngle in WaterRingAngles:
        X=PositionX+CosAngle*Radius
        Y=PositionY+SinAngle*Radius
        glVertex3f(X,Y,getWaterWaveHeight(X,Y)+Elevation)
    glEnd()

def drawStudentAvatar(PositionX,PositionY,PositionZ,ShirtColor,Scale=1.0):
    """Readable low-poly student with head, hair, torso, limbs and backpack.
    Every piece uses basic cubes/spheres taught in the faculty template.
    """
    glPushMatrix()
    glTranslatef(PositionX,PositionY,PositionZ)
    glScalef(Scale,Scale,Scale)

    drawSimpleCube(2,-6,-7,10,7,20,(0.12,0.16,0.23))
    drawSimpleCube(2,6,-7,10,7,20,(0.12,0.16,0.23))
    drawSimpleCube(6,-6,-18,13,10,5,(0.07,0.09,0.12))
    drawSimpleCube(6,6,-18,13,10,5,(0.07,0.09,0.12))
    drawSimpleCube(0,0,17,24,24,31,ShirtColor)

    SkinColor=(0.88,0.67,0.49)
    drawSimpleCube(2,-16,16,9,9,24,SkinColor)
    drawSimpleCube(2,16,16,9,9,24,SkinColor)
    drawSimpleCube(-13,0,15,12,21,26,(0.17,0.24,0.34))
    drawSimpleCube(-21,0,16,3,11,13,(0.98,0.74,0.20))
    for Side in (-1,1):
        drawSimpleCube(5,Side*9,27,3,3,18,(0.20,0.28,0.32))
    drawSimpleCube(12,0,19,2,17,3,(0.82,0.86,0.78))
    drawSimpleCube(-14,0,32,6,17,2,(0.28,0.36,0.41))

    glPushMatrix()
    glTranslatef(0,0,44)
    glColor3f(SkinColor[0],SkinColor[1],SkinColor[2])
    gluSphere(getSharedQuadric(),12,12,10)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(-2,0,52)
    glColor3f(0.13,0.11,0.12)
    gluSphere(getSharedQuadric(),10,10,8)
    glPopMatrix()
    drawSimpleCube(10,-4,46,1.8,2.1,2.1,(0.14,0.14,0.16))
    drawSimpleCube(10,4,46,1.8,2.1,2.1,(0.14,0.14,0.16))
    drawSimpleCube(12,0,42,2,4,1.4,(0.60,0.34,0.27))
    glPopMatrix()


def drawPickupStations():
    """Home students wait at the actual building frontage, not on a platform.
    Minimal water-level guidance replaces the old wood deck and tall sign.
    """
    for Ride in ActiveRideRequests:
        if Ride["state"]!="WAITING" or Ride["pickup_type"]!="HOME":
            continue
        DoorX,DoorY=Ride["door_x"],Ride["door_y"]
        DockX,DockY=Ride["x"],Ride["y"]
        Facing=Ride["front_direction"]
        Pulse=math.sin(GameTimeSeconds*3.5+Ride["id"])*0.5+0.5

        drawSimpleCube(DoorX,Ride["building_face_y"],FloodWaterHeight+24,
                       25,5,42,(0.14,0.22,0.27))
        drawSimpleCube(DoorX-8,Ride["building_face_y"]+Facing*4,
                       FloodWaterHeight+23,3,3,3,(0.87,0.73,0.37))

        BoardProgress=getDockingVisualFraction(Ride)
        if BoardProgress>0:
            Heading=math.radians(BoatFacingAngle)
            Side=1 if Ride['id']%2 else -1
            TargetX=BoatPositionX-math.sin(Heading)*Side*30
            TargetY=BoatPositionY+math.cos(Heading)*Side*30
            Walk=smoothVisualStep(BoardProgress)
            PersonX=DoorX+(TargetX-DoorX)*Walk
            PersonY=DoorY+(TargetY-DoorY)*Walk
            Surface=getWaterWaveHeight(PersonX,PersonY)
            StepBounce=2.2*abs(math.sin(BoardProgress*math.pi*3.0))
            Height=(FloodWaterHeight+11)*(1-Walk)+(Surface+18)*Walk+StepBounce
            glPushMatrix()
            glTranslatef(PersonX,PersonY,Height)
            glRotatef(13*math.sin(BoardProgress*math.pi*2),1,0,0)
            drawStudentAvatar(0,0,0,Ride['color'],0.50)
            glPopMatrix()
        else:
            drawStudentAvatar(DoorX,DoorY,FloodWaterHeight+11,Ride['color'],0.50)

        drawWaterRing(DockX,DockY,28+3*Pulse,FloodWaterHeight+0.7,
                      (0.82,0.72,0.37))
        drawWaterRing(DockX,DockY,13,FloodWaterHeight+0.8,(0.48,0.80,0.75))


def drawBoatCaptain():
    """Purpose-made seated rower rather than a student/backpack wearing a hat."""
    glPushMatrix()
    VisualBob,VisualRoll=getBoatVisualMotion()
    glTranslatef(BoatPositionX,BoatPositionY,FloodWaterHeight+3+VisualBob)
    glRotatef(BoatFacingAngle,0,0,1)
    glRotatef(VisualRoll,1,0,0)
    glScalef(BoatModelScale,BoatModelScale,BoatModelScale)
    Shirt=(0.25,0.53,0.55)
    Vest=(0.86,0.45,0.23)
    Skin=(0.88,0.67,0.48)
    Hair=(0.085,0.10,0.115)
    Pant=(0.13,0.20,0.26)
    for Side in (-1,1):
        drawSimpleCube(-42,Side*8,24,25,9,8,Pant)
        drawSimpleCube(-26,Side*8,21,10,9,5,(0.10,0.14,0.17))
    drawSimpleCube(-62,0,41,23,26,29,Shirt)
    drawSimpleCube(-62,0,54,25,26,11,Shirt)
    drawSimpleCube(-72,0,43,4,26,27,(0.18,0.29,0.32))
    for Side in (-1,1):
        drawSimpleCube(-62,Side*13.2,46,6,3.5,20,Vest)
        drawSimpleCube(-52,Side*8.2,50,4.0,4,22,Vest)
    drawSimpleCube(-47,0,46,3,14,3,(0.92,0.74,0.35))
    drawSimpleCube(-55,0,65,8,10,9,Skin)
    glPushMatrix()
    glTranslatef(-53,0,78)
    glColor3f(*Skin)
    gluSphere(getSharedQuadric(),11,12,9)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(-55,0,85)
    glColor3f(*Hair)
    glScalef(1.0,1.0,0.64)
    gluSphere(getSharedQuadric(),10.7,11,8)
    glPopMatrix()
    drawSimpleCube(-47,0,84.5,5,16,3,Hair)
    for Side in (-1,1):
        drawSimpleCube(-60,Side*16,55,10,8,10,Shirt)
    glPopMatrix()

def drawPassengerSeats():
    """Three appropriately sized passenger models in their original seats.

    In first-person the player should still be able to see riders ahead in the
    boat, so these are rendered in both camera modes.
    """
    glPushMatrix()
    VisualBob,VisualRoll=getBoatVisualMotion()
    glTranslatef(BoatPositionX,BoatPositionY,FloodWaterHeight+10+VisualBob)
    glRotatef(BoatFacingAngle,0,0,1)
    glRotatef(VisualRoll,1,0,0)
    glScalef(BoatModelScale,BoatModelScale,BoatModelScale)
    PassengerNumber=0
    SeatLocations=[(8,-19),(8,19),(67,0)]
    for Ride in ActiveRideRequests:
        if Ride["state"]=="ONBOARD":
            Seat=SeatLocations[PassengerNumber]
            TimeOnBoat=max(0.0,GameTimeSeconds-Ride.get('boarded_at',-100))
            Settle=smoothVisualStep(TimeOnBoat/PickupArrivalSeconds)
            Side=Ride.get('boarding_boat_side',-1)
            SeatY=Side*48+(Seat[1]-Side*48)*Settle
            SeatZ=25+3*math.sin(math.pi*Settle)+3*Settle
            glPushMatrix()
            glTranslatef(Seat[0],SeatY,SeatZ)
            glRotatef(Side*(1-Settle)*13,1,0,0)
            drawStudentAvatar(0,0,0,Ride['color'],0.79)
            glPopMatrix()
            PassengerNumber=PassengerNumber+1
            if PassengerNumber>=3:
                break
    glPopMatrix()


def drawUniversityArrivalDock():
    drawSimpleCube(DeliveryZoneX,1165,FloodWaterHeight+5,220,92,9,(0.52,0.52,0.45))
    for PierNumber in range(7):
        PierX=-93+PierNumber*31
        drawSimpleCube(PierX,1163,FloodWaterHeight+10,5,81,3,(0.39,0.35,0.27))
    drawWaterRing(DeliveryZoneX,DeliveryZoneY,65,FloodWaterHeight+0.78,(0.67,0.67,0.44))
    drawWaterRing(DeliveryZoneX,DeliveryZoneY,108,FloodWaterHeight+0.8,(0.49,0.68,0.66))
    for PX in (-98,98):
        drawSimpleCube(PX,1150,FloodWaterHeight+18,8,8,28,(0.57,0.58,0.53))
        drawSimpleCube(PX,1150,FloodWaterHeight+34,11,11,4,(0.88,0.73,0.42))


def drawWaterCurrentEffects():
    for Zone in WaterCurrentZones:
        CenterX=(Zone['min_x']+Zone['max_x'])/2
        CenterY=(Zone['min_y']+Zone['max_y'])/2
        DX,DY=Zone['dx'],Zone['dy']
        Length=max(1,math.sqrt(DX*DX+DY*DY))
        DX,DY=DX/Length,DY/Length
        glColor3f(0.29,0.61,0.60)
        glBegin(GL_LINES)
        for I in range(3):
            Shift=(I-1)*43+math.sin(WaterAnimationPhase*2+I)*7
            X=CenterX+Shift
            Y=CenterY+(I-1)*35
            glVertex3f(X,Y,getWaterWaveHeight(X,Y)+0.56)
            glVertex3f(X+DX*65,Y+DY*65,getWaterWaveHeight(X+DX*65,Y+DY*65)+0.56)
        glEnd()


def drawDebrisObjects():
    for Debris in FloatingDebrisList:
        X,Y=Debris['x'],Debris['y']
        WaveZ=getWaterWaveHeight(X,Y)
        SmallBob=0.65*math.sin(GameTimeSeconds*2+Debris['phase'])
        glPushMatrix()
        glTranslatef(X,Y,WaveZ+1+SmallBob)
        glRotatef(33+math.sin(Debris['phase'])*13,0,0,1)
        glRotatef(2.5*math.sin(WaterAnimationPhase*1.5+Debris['phase']),1,0,0)
        if Debris['type']==0:
            drawSimpleCube(0,0,0,60,19,17,(0.38,0.22,0.10))
            drawSimpleCube(-18,0,9,5,23,3,(0.53,0.34,0.17))
        elif Debris['type']==1:
            drawSimpleCube(0,0,0,46,43,20,(0.42,0.28,0.18))
            drawSimpleCube(0,0,11,42,40,3,(0.59,0.40,0.23))
        else:
            glColor3f(0.83,0.42,0.12)
            glRotatef(90,1,0,0)
            gluCylinder(getSharedQuadric(),13,13,43,10,5)
        glPopMatrix()
        drawWaterRing(X,Y,35,FloodWaterHeight+0.5,(0.47,0.68,0.68))

def drawFloodRescuePeople():
    """Rescue students rise with waves, while visibly waving for help."""
    for Ride in ActiveRideRequests:
        if Ride['state']!='WAITING' or Ride['pickup_type']!='DROWNING':
            continue
        X,Y=Ride['x'],Ride['y']
        Lift=getDockingVisualFraction(Ride)
        if Lift>0:
            Heading=math.radians(BoatFacingAngle)
            Side=1 if Ride['id']%2 else -1
            ToX=BoatPositionX-math.sin(Heading)*Side*26
            ToY=BoatPositionY+math.cos(Heading)*Side*26
            X=X+(ToX-X)*Lift*0.78
            Y=Y+(ToY-Y)*Lift*0.78
        Pulse=math.sin(GameTimeSeconds*4+Ride['id'])
        Surface=getWaterWaveHeight(X,Y)
        Bob=0.50*math.sin(GameTimeSeconds*5+Ride['id'])
        glPushMatrix()
        glTranslatef(X,Y,Surface+5.8+Bob+Lift*14)
        glRotatef(4*math.sin(GameTimeSeconds*2.1+Ride['id']),1,0,0)
        glScalef(0.54,0.54,0.54)
        drawSimpleCube(0,0,-8,24,31,20,Ride['color'])
        glColor3f(0.91,0.69,0.50)
        glPushMatrix()
        glTranslatef(0,0,14)
        gluSphere(getSharedQuadric(),13,12,10)
        glPopMatrix()
        glPushMatrix()
        glTranslatef(0,0,25)
        glColor3f(0.14,0.11,0.12)
        gluSphere(getSharedQuadric(),10,10,8)
        glPopMatrix()
        for Side in (-1,1):
            glPushMatrix()
            glTranslatef(Side*19,0,10)
            glRotatef(Side*(12+22*math.sin(GameTimeSeconds*4.2+Ride['id']+Side)),0,1,0)
            glColor3f(0.91,0.69,0.50)
            drawSimpleCube(Side*5,0,12,9,9,26,(0.91,0.69,0.50))
            glPushMatrix()
            glTranslatef(Side*6,0,27)
            gluSphere(getSharedQuadric(),5.0,8,8)
            glPopMatrix()
            glPopMatrix()
        drawSimpleCube(5,0,-1,2,20,3,(0.82,0.83,0.77))
        glPopMatrix()
        Ripple=19+3*Pulse
        drawWaterRing(X,Y,Ripple,FloodWaterHeight+0.65,(0.59,0.86,0.94))
        drawWaterRing(X,Y,31+4*Pulse,FloodWaterHeight+0.75,(0.35,0.68,0.77))

def drawPaddleContactSplashes():
    """Small water sprays at both paddle blades during the power stroke.

    This is entirely decorative: no acceleration, stamina, or collision change.
    The tip positions reuse the angles in drawPlayerHandsAndPaddles.
    """
    if GameMode!='PLAYING' or not IsBoatRowing or not ThirdPersonCamera:
        return
    Phase=2.0*math.pi*RowingAnimationTimer/0.65
    Strength=max(0.0,math.sin(Phase-0.35))
    if Strength<0.14:
        return
    Facing=math.radians(BoatFacingAngle)
    FX,FY=math.cos(Facing),math.sin(Facing)
    SideX,SideY=-FY,FX
    ArmSwing=RowingAnimationAngle
    ShaftHorizontal=88*math.cos(math.radians(getRowingPaddleTilt()))
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    try:
        glLineWidth(1.1)
        glBegin(GL_LINES)
        for Side in (-1,1):
            ShoulderY=Side*14
            ArmAngle=math.radians((-6+ArmSwing) if Side==-1 else (6-ArmSwing))
            HandX=-61+math.cos(ArmAngle)*30-3
            HandY=ShoulderY+math.sin(ArmAngle)*30
            PaddleAngle=math.radians((-62-ArmSwing*24/17) if Side==-1 else (62+ArmSwing*24/17))
            TipX=(HandX+math.cos(PaddleAngle)*ShaftHorizontal)*BoatModelScale
            TipY=(HandY+math.sin(PaddleAngle)*ShaftHorizontal)*BoatModelScale
            X=BoatPositionX+FX*TipX+SideX*TipY
            Y=BoatPositionY+FY*TipX+SideY*TipY
            Z=getWaterWaveHeight(X,Y)+0.65
            for I in range(5 if RenderQuality=='HIGH' else 3):
                A=(I+1)*1.10+Side*0.35+WaterAnimationPhase*0.25
                Radius=(3+I*2)*Strength
                TipZ=Z+(3.8+I*1.2)*Strength
                glColor4f(0.78,0.95,0.98,(0.50-I*0.055)*Strength)
                glVertex3f(X,Y,Z)
                glVertex3f(X+math.cos(A)*Radius,Y+math.sin(A)*Radius,TipZ)
        glEnd()
    finally:
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)


def drawRescueSplashEffects():
    """Short spray and widening water rings on completed HOME/SOS pickups."""
    if not PickupSplashEffects:
        return
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    try:
        glLineWidth(1.4)
        for Effect in PickupSplashEffects:
            Age=max(0.0,GameTimeSeconds-Effect['time'])
            Progress=min(1.0,Age/1.15)
            X,Y=Effect['x'],Effect['y']
            Strength=1.0 if Effect['sos'] else 0.55
            glColor4f(0.70,0.94,0.99,(1-Progress)*0.70)
            for Radius in (13+45*Progress,30+55*Progress):
                glBegin(GL_LINE_LOOP)
                for CS,SN in WaterRingAngles[:-1]:
                    RX,RY=X+CS*Radius,Y+SN*Radius
                    glVertex3f(RX,RY,getWaterWaveHeight(RX,RY)+0.9)
                glEnd()
            if Age<0.65:
                glBegin(GL_LINES)
                for Index in range(8 if Effect['sos'] else 4):
                    Angle=Index*math.pi/4+Effect['time']
                    Dist=(7+Index%3*3)*(0.25+Age*1.5)
                    VX=X+math.cos(Angle)*Dist
                    VY=Y+math.sin(Angle)*Dist
                    Z=getWaterWaveHeight(VX,VY)+1.1
                    Height=Strength*(8+Index%3*3)*math.sin(math.pi*Age/0.75)
                    glColor4f(0.78,0.96,0.98,(1-Age/0.75)*0.85)
                    glVertex3f(VX,VY,Z)
                    glVertex3f(VX+math.cos(Angle)*3,VY+math.sin(Angle)*3,Z+Height)
                glEnd()
    finally:
        glLineWidth(1.0)
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)


def drawDeliveryExitPeople():
    """Departing passengers are a short-lived visual after real delivery."""
    if not DeliveryExitAnimations:
        return
    for Effect in DeliveryExitAnimations:
        Progress=min(1.0,max(0.0,(GameTimeSeconds-Effect['time'])/DeliveryExitSeconds))
        Walk=smoothVisualStep(Progress)
        X=Effect['x0']+(Effect['x1']-Effect['x0'])*Walk
        Y=Effect['y0']+(Effect['y1']-Effect['y0'])*Walk
        Z0=Effect['z0']
        Z1=FloodWaterHeight+22
        Z=Z0+(Z1-Z0)*Walk+8*math.sin(math.pi*Progress)
        glPushMatrix()
        glTranslatef(X,Y,Z)
        glRotatef(-12*(1-Walk),0,1,0)
        drawStudentAvatar(0,0,0,Effect['color'],0.50)
        glPopMatrix()


def drawMissedPassengerEffects():
    """Non-graphic late-passenger animation: exit, struggle, submerge, vanish.

    Rides have already failed and left the active queue; this draws only
    temporary models and ripples. It samples the same moving wave function.
    """
    if not MissedPassengerEffects:
        return
    for Effect in MissedPassengerEffects:
        Age=max(0.0,GameTimeSeconds-Effect['time'])
        if Age>=MissedPassengerDuration:
            continue
        X,Y=Effect['x1'],Effect['y1']
        Surface=getWaterWaveHeight(X,Y)
        if Age<MissedPassengerExitSeconds and not Effect['in_water']:
            P=smoothVisualStep(Age/MissedPassengerExitSeconds)
            X=Effect['x0']+(X-Effect['x0'])*P
            Y=Effect['y0']+(Y-Effect['y0'])*P
            WaterZ=getWaterWaveHeight(X,Y)
            Z=Effect['z0']+(WaterZ+3-Effect['z0'])*P+5*math.sin(math.pi*P)
            glPushMatrix()
            glTranslatef(X,Y,Z)
            glRotatef(35*P,1,0,0)
            drawStudentAvatar(0,0,0,Effect['color'],0.48)
            glPopMatrix()
            continue

        Sink=0.0
        if Age>MissedPassengerStruggleUntil:
            Fade=(Age-MissedPassengerStruggleUntil)/max(
                0.01,MissedPassengerSinkUntil-MissedPassengerStruggleUntil)
            Sink=36.0*smoothVisualStep(Fade)
        Bob=1.7*math.sin(GameTimeSeconds*4.7+Effect['id'])
        if Age<MissedPassengerSinkUntil:
            glPushMatrix()
            glTranslatef(X,Y,Surface+4.5+Bob-Sink)
            glScalef(0.58,0.58,0.58)
            drawSimpleCube(0,0,-9,23,24,22,Effect['color'])
            glColor3f(0.89,0.67,0.49)
            glPushMatrix()
            glTranslatef(0,0,16)
            gluSphere(getSharedQuadric(),12,10,8)
            glPopMatrix()
            glColor3f(0.12,0.11,0.12)
            glPushMatrix()
            glTranslatef(0,0,23)
            gluSphere(getSharedQuadric(),10,9,7)
            glPopMatrix()
            for Side in (-1,1):
                glPushMatrix()
                glTranslatef(Side*18,0,4)
                glRotatef(Side*(17+29*math.sin(Age*7.2+Side)),0,1,0)
                drawSimpleCube(Side*2,0,12,8,8,25,(0.89,0.67,0.49))
                glPopMatrix()
            glPopMatrix()

        if MissedPassengerExitSeconds<=Age<MissedPassengerDuration:
            Fade=1.0-smoothVisualStep((Age-MissedPassengerExitSeconds)/(
                                      MissedPassengerDuration-MissedPassengerExitSeconds))
            if Fade>0:
                drawWaterRing(X,Y,14+Age*10,FloodWaterHeight+0.95,
                              (0.30+0.40*Fade,0.42+0.40*Fade,0.48+0.43*Fade))
                if RenderQuality=='HIGH':
                    glPointSize(2.1)
                    glBegin(GL_POINTS)
                    for I in range(5):
                        Angle=I*2.3999+Effect['id']
                        Distance=4+(Age-MissedPassengerExitSeconds)*6+I*2
                        BX=X+math.cos(Angle)*Distance
                        BY=Y+math.sin(Angle)*Distance
                        glVertex3f(BX,BY,getWaterWaveHeight(BX,BY)+0.8)
                    glEnd()
                    glPointSize(1.0)


def drawBRACUDeliverySparkle():
    if DeliveryFeedbackTime<=0:
        return
    Age=GameTimeSeconds-DeliveryFeedbackStartedAt
    if Age>2.0:
        return
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    try:
        CenterX,CenterY=DeliveryZoneX,DeliveryZoneY
        for Offset in (0.0,0.45):
            Radius=35+76*max(0.0,Age-Offset)
            Alpha=max(0.0,0.48*(1-(Age-Offset)/1.8))
            if Age<Offset: continue
            glColor4f(1.0,0.86,0.49,Alpha)
            glLineWidth(2.3)
            glBegin(GL_LINE_LOOP)
            for CS,SN in WaterRingAngles[:-1]:
                X,Y=CenterX+CS*Radius,CenterY+SN*Radius
                glVertex3f(X,Y,getWaterWaveHeight(X,Y)+1.5)
            glEnd()
    finally:
        glLineWidth(1.0)
        glDepthMask(GL_TRUE)
        glDisable(GL_BLEND)


def drawDeliverySuccessBanner():
    if DeliveryFeedbackTime<=0:
        return
    Ink=(0.022,0.085,0.085)
    Gold=(1.0,0.84,0.45)
    Light=(0.88,0.99,0.88)
    begin2DDrawing()
    drawHUDPanel(359,558,283,65,Ink,0.94,Gold)
    draw2DText(375,596,'DELIVERY COMPLETE!',Gold,GLUT_BITMAP_HELVETICA_18)
    draw2DText(376,572,'+'+str(DeliveryFeedbackScore)+' POINTS  /  '
               +str(DeliveryFeedbackCount)+' STUDENT(S)',Light,GLUT_BITMAP_HELVETICA_12)
    drawArcadeMeter(375,563,248,5,DeliveryFeedbackTime/DeliveryBannerSeconds,
                    (0.15,0.24,0.25),Gold)
    end2DDrawing()


def drawBoatWake():
    if GameMode!='PLAYING' or GameTimeSeconds-BoatLastMovementTime>0.9:
        return
    Angle=math.radians(BoatFacingAngle)
    ForwardX,ForwardY=math.cos(Angle),math.sin(Angle)
    SideX,SideY=-ForwardY,ForwardX
    Now=GameTimeSeconds
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA)
    glDepthMask(GL_FALSE)
    glLineWidth(1.8)
    glBegin(GL_LINES)
    for I in range(3):
        Distance=(Now*55+I*46)%175
        Fade=max(0.0,1-Distance/195)
        CenterX=BoatPositionX-ForwardX*(34+Distance)
        CenterY=BoatPositionY-ForwardY*(34+Distance)
        Width=13+Distance*0.48
        WaveBend=3*math.sin(Now*3+I)
        glColor4f(0.71,0.93,0.96,0.70*Fade)
        for Side in (-1,1):
            OuterX=CenterX-ForwardX*(9+Distance*.07)+SideX*Side*Width
            OuterY=CenterY-ForwardY*(9+Distance*.07)+SideY*Side*Width
            FoamX=OuterX+SideX*WaveBend
            FoamY=OuterY+SideY*WaveBend
            glVertex3f(CenterX,CenterY,getWaterWaveHeight(CenterX,CenterY)+0.55)
            glVertex3f(FoamX,FoamY,getWaterWaveHeight(FoamX,FoamY)+0.55)
    glEnd()
    glPointSize(2.1)
    glBegin(GL_POINTS)
    for I in range(24 if RenderQuality=='HIGH' else 12):
        Drift=(Now*32+I*13)%130
        Side=(I%2)*2-1
        Width=9+Drift*0.18+4*math.sin(I*2.1+Now)
        X=BoatPositionX-ForwardX*(20+Drift)+SideX*Side*Width
        Y=BoatPositionY-ForwardY*(20+Drift)+SideY*Side*Width
        Fade=max(0.0,1-Drift/150)
        glColor4f(0.80,0.97,0.98,0.60*Fade)
        glVertex3f(X,Y,getWaterWaveHeight(X,Y)+0.58)
    glEnd()
    glDepthMask(GL_TRUE)
    glDisable(GL_BLEND)




def drawHUDPanel(Left,Bottom,Width,Height,Color,Alpha=0.90,Accent=(0.44,0.83,0.79)):
    """A clean layered card, using faculty-template 2D quads and line loops."""
    glColor4f(0.005,0.016,0.024,0.38)
    glBegin(GL_QUADS)
    glVertex3f(Left+4,Bottom-4,0)
    glVertex3f(Left+Width+4,Bottom-4,0)
    glVertex3f(Left+Width+4,Bottom+Height-4,0)
    glVertex3f(Left+4,Bottom+Height-4,0)
    glEnd()
    glColor4f(Color[0],Color[1],Color[2],Alpha)
    glBegin(GL_QUADS)
    glVertex3f(Left,Bottom,0)
    glVertex3f(Left+Width,Bottom,0)
    glVertex3f(Left+Width,Bottom+Height,0)
    glVertex3f(Left,Bottom+Height,0)
    glEnd()
    glColor4f(0.50,0.70,0.72,0.50)
    glLineWidth(1)
    glBegin(GL_LINE_LOOP)
    glVertex3f(Left,Bottom,0)
    glVertex3f(Left+Width,Bottom,0)
    glVertex3f(Left+Width,Bottom+Height,0)
    glVertex3f(Left,Bottom+Height,0)
    glEnd()
    draw2DRectangle(Left,Bottom+Height-3,Left+Width,Bottom+Height,Accent)


def drawArcadeMeter(Left,Bottom,Width,Height,Ratio,BackColor,FillColor):
    Ratio=max(0,min(1,Ratio))
    draw2DRectangle(Left,Bottom,Left+Width,Bottom+Height,BackColor)
    draw2DRectangle(Left+2,Bottom+2,Left+2+(Width-4)*Ratio,Bottom+Height-2,FillColor)


def drawSharedHUDFeedback(Compact):
    """Transient notices shared by the two camera HUDs (layout kept exact)."""
    Ink=(0.018,0.055,0.078)
    Gold=(1.0,0.81,0.45)
    Sea=(0.46,0.88,0.82)
    Mist=(0.82,0.91,0.94)

    if DockingTargetId!=-1 and DockingProgress>0:
        begin2DDrawing()
        IsSOS=False
        for Ride in ActiveRideRequests:
            if Ride['id']==DockingTargetId:
                IsSOS=Ride['pickup_type']=='DROWNING'
                break
        Need=DrowningRescueSeconds if IsSOS else DockingRequiredSeconds
        if Compact:
            Left,Bottom,Width,Height,Alpha=374,674,252,35,0.87
            TextX,TextY,MeterY,MeterWidth,MeterHeight=389,690,681,222,6
        else:
            Left,Bottom,Width,Height,Alpha=372,182,265,55,0.93
            TextX,TextY,MeterY,MeterWidth,MeterHeight=391,211,196,226,8
        drawHUDPanel(Left,Bottom,Width,Height,Ink,Alpha,Gold)
        draw2DText(TextX,TextY,
                   'RESCUING - HOLD STILL' if IsSOS else 'BOARDING - HOLD STILL',
                   Mist,GLUT_BITMAP_HELVETICA_12)
        drawArcadeMeter(TextX,MeterY,MeterWidth,MeterHeight,DockingProgress/Need,
                        (0.13,0.28,0.29),Sea)
        end2DDrawing()

    if GameNotificationTimer>0:
        begin2DDrawing()
        if Compact:
            Left,Bottom,Width,Height,Alpha=344,724,324,28,0.80
            TextX,TextY,Font,TextLimit=353,733,GLUT_BITMAP_HELVETICA_10,43
        else:
            Left,Bottom,Width,Height,Alpha=288,534,424,34,0.93
            TextX,TextY,Font,TextLimit=303,546,GLUT_BITMAP_HELVETICA_12,52
        drawHUDPanel(Left,Bottom,Width,Height,Ink,Alpha,Gold)
        draw2DText(TextX,TextY,GameNotification[:TextLimit],Gold,Font)
        end2DDrawing()
    if ShowInstructions:
        drawHelpOverlay()
    if GameMode=='PAUSED':
        drawPauseOverlay()
    elif GameMode in ('WON','LOST'):
        drawGameEndingOverlay()


def drawFirstPersonHUD():
    """Minimal in-boat UI: status corners, clear center, essential controls.

    Only the first-person camera uses this layout. Keep every active request
    visible, including its deadline, and retain original Y/N/F/SPACE controls.
    """
    Ink=(0.018,0.055,0.078)
    Gold=(1.0,0.81,0.45)
    Sea=(0.46,0.88,0.82)
    Mist=(0.82,0.91,0.94)
    Muted=(0.63,0.79,0.82)
    Coral=(1.0,0.52,0.44)

    begin2DDrawing()
    drawHUDPanel(16,743,308,41,Ink,0.81,Gold)
    draw2DText(27,763,
               'DEL '+str(DeliveredRideCount)+'/'+str(DeliveryGoal)+
               '   MISS '+str(FailedRideCount)+'/'+str(MaximumFailedRides)+
               '   '+formatArcadeTime(GameTimeSeconds),Mist,GLUT_BITMAP_HELVETICA_12)
    draw2DText(27,748,
               'SCORE '+str(Score)+'   ONBOARD '+str(getOnboardPassengerCount())+
               '/3   C: VIEW',
               Muted,GLUT_BITMAP_HELVETICA_10)

    if PowerOutageActive:
        DrawnDistrict=getCurrentPowerDistrict()['name']
        drawHUDPanel(16,713,308,24,(0.15,0.048,0.047),0.78,Coral)
        draw2DText(26,720,'BLACKOUT '+DrawnDistrict+'   FIND RED BOX [F]',
                   Gold,GLUT_BITMAP_HELVETICA_10)
    elif PowerRestoreMessageTimer>0:
        drawHUDPanel(16,713,308,24,(0.033,0.13,0.093),0.78,Sea)
        draw2DText(26,720,'POWER RESTORED  /  '+PowerRestoredDistrictName,
                   Sea,GLUT_BITMAP_HELVETICA_12)

    ShownRides=ActiveRideRequests[:5]
    if ShownRides:
        RidePanelBottom=18
        RidePanelHeight=33+17*len(ShownRides)
        drawHUDPanel(16,RidePanelBottom,320,RidePanelHeight,Ink,0.83,Sea)
        HeadingY=RidePanelBottom+RidePanelHeight-17
        draw2DText(27,HeadingY,'ACTIVE RIDES  '+str(len(ActiveRideRequests))+'/'+
                   str(MaximumActiveRequests),Gold,GLUT_BITMAP_HELVETICA_12)
        for I,Ride in enumerate(ShownRides):
            YY=HeadingY-17-I*17
            Kind=('BOAT' if Ride['state']=='ONBOARD' else
                  ('HOME' if Ride['pickup_type']=='HOME' else 'SOS'))
            Shade=Coral if Ride['time_left']<35 else Mist
            Label=Ride['name'][:9]+'  '+Ride['pickup'][:12]+'  '+Kind
            draw2DText(27,YY,Label,Shade,GLUT_BITMAP_HELVETICA_10)
            draw2DText(280,YY,formatArcadeTime(Ride['time_left']),Shade,
                       GLUT_BITMAP_HELVETICA_10)

    if IncomingRideRequest is not None:
        IsHome=IncomingRideRequest['pickup_type']=='HOME'
        HeadColor=Gold if IsHome else Coral
        Left=681
        drawHUDPanel(Left,18,303,108,Ink,0.87,HeadColor)
        draw2DText(Left+12,108,'NEW  '+('HOME PICKUP' if IsHome else 'SOS RESCUE'),
                   HeadColor,GLUT_BITMAP_HELVETICA_12)
        RideDescription=(IncomingRideRequest['name']+' / '+IncomingRideRequest['pickup'])[:34]
        draw2DText(Left+12,87,RideDescription,Mist,GLUT_BITMAP_HELVETICA_12)
        draw2DText(Left+12,68,
                   'DUE '+formatArcadeTime(IncomingRideRequest['time_left'])+
                   '   EXPIRES '+str(max(0,int(IncomingRequestTimeLeft)))+'s',
                   Muted,GLUT_BITMAP_HELVETICA_12)
        draw2DRectangle(Left+12,29,Left+139,49,(0.13,0.35,0.32))
        draw2DText(Left+31,34,'Y  ACCEPT',(0.80,1.0,0.85),GLUT_BITMAP_HELVETICA_12)
        draw2DRectangle(Left+148,29,Left+291,49,(0.35,0.15,0.14))
        draw2DText(Left+167,34,'N  DECLINE',(1.0,0.79,0.74),GLUT_BITMAP_HELVETICA_12)

    BoostLeft=393
    drawHUDPanel(BoostLeft,17,214,39,Ink,0.75,Sea)
    draw2DText(BoostLeft+11,41,'BOOST [SPACE]',Mist,GLUT_BITMAP_HELVETICA_10)
    draw2DText(BoostLeft+168,41,str(int(BoatBoostMeter))+'%',Mist,
               GLUT_BITMAP_HELVETICA_10)
    drawArcadeMeter(BoostLeft+11,27,191,7,BoatBoostMeter/100,
                    (0.13,0.27,0.30),Gold if BoatBoostActive else Sea)
    end2DDrawing()

    drawSharedHUDFeedback(True)


def drawArcadeHUD():
    if GameMode == 'MENU':
        drawMenuOverlay()
        return
    if not ThirdPersonCamera:
        drawFirstPersonHUD()
        return
    begin2DDrawing()
    Ink = (0.018, 0.055, 0.078)
    Gold = (1.0, 0.81, 0.45)
    Sea = (0.46, 0.88, 0.82)
    Mist = (0.82, 0.91, 0.94)
    Muted = (0.56, 0.74, 0.78)
    Coral = (1.0, 0.52, 0.44)
    TopLeft, TopBottom, TopWidth, TopHeight, TopAlpha = (16, 683, 397, 101, 0.92)
    NoticeBottom, NoticeWidth = (650, 397)
    QueueLeft, QueueWidth, QueueHeight, QueueAlpha = (16, 353, 149, 0.94)
    RequestLeft, RequestWidth, RequestHeight, RequestAlpha = (650, 334, 149, 0.95)
    BoostLeft, BoostBottom, BoostWidth, BoostHeight = (384, 17, 250, 51)
    NotificationLeft, NotificationBottom, NotificationWidth = (288, 534, 424)
    drawHUDPanel(TopLeft, TopBottom, TopWidth, TopHeight, Ink, TopAlpha, (0.98, 0.71, 0.33))
    draw2DText(30, 754, 'MAJHI JABEN?!', Gold, GLUT_BITMAP_HELVETICA_18)
    draw2DText(30, 734, 'FLOODED DHAKA   /   BRACU EXPRESS', Muted, GLUT_BITMAP_HELVETICA_12)
    draw2DRectangle(30, 722, 398, 723, (0.22, 0.38, 0.42))
    draw2DText(30, 705, 'DELIVERED ' + str(DeliveredRideCount) + '/' + str(DeliveryGoal), Sea, GLUT_BITMAP_HELVETICA_12)
    draw2DText(158, 705, 'MISSED ' + str(FailedRideCount) + '/' + str(MaximumFailedRides), Coral if FailedRideCount else Mist, GLUT_BITMAP_HELVETICA_12)
    draw2DText(298, 705, formatArcadeTime(GameTimeSeconds), Gold, GLUT_BITMAP_HELVETICA_12)
    draw2DText(30, 690, 'SCORE ' + str(Score) + '    ONBOARD ' + str(getOnboardPassengerCount()) + '/3    C: CAMERA', Muted, GLUT_BITMAP_HELVETICA_10)
    if PowerOutageActive:
        DrawnDistrict = getCurrentPowerDistrict()['name']
        drawHUDPanel(16, NoticeBottom, NoticeWidth, 27, (0.15, 0.048, 0.047), 0.89, Coral)
        draw2DText(30, NoticeBottom + 8, 'BLACKOUT  /  ' + DrawnDistrict + '   -  FIND RED BOX [F]', Gold, GLUT_BITMAP_HELVETICA_12)
    elif PowerRestoreMessageTimer > 0:
        drawHUDPanel(16, NoticeBottom, NoticeWidth, 27, (0.033, 0.13, 0.093), 0.9, Sea)
        draw2DText(30, NoticeBottom + 8, 'POWER RESTORED  /  ' + PowerRestoredDistrictName, Sea, GLUT_BITMAP_HELVETICA_12)
    drawHUDPanel(QueueLeft, 17, QueueWidth, QueueHeight, Ink, QueueAlpha, Sea)
    draw2DText(30, 137, 'ACTIVE RIDES', Gold)
    draw2DText(QueueLeft + QueueWidth - 72, 141, str(len(ActiveRideRequests)) + '/' + str(MaximumActiveRequests), Sea, GLUT_BITMAP_HELVETICA_12)
    draw2DRectangle(30, 126, QueueLeft + QueueWidth - 18, 127, (0.21, 0.36, 0.4))
    if not ActiveRideRequests:
        draw2DText(30, 99, 'No active rides yet.', Mist, GLUT_BITMAP_HELVETICA_12)
        draw2DText(30, 73, 'Press Y when an offer arrives.', Muted, GLUT_BITMAP_HELVETICA_12)
    for I, Ride in enumerate(ActiveRideRequests[:5]):
        YY = 106 - I * 20
        Kind = 'BOAT' if Ride['state'] == 'ONBOARD' else 'HOME' if Ride['pickup_type'] == 'HOME' else 'SOS'
        Shade = Coral if Ride['time_left'] < 35 else Mist
        draw2DText(30, YY, Ride['name'][:9] + '  ' + Ride['pickup'][:11] + '  ' + Kind, Shade, GLUT_BITMAP_HELVETICA_12)
        draw2DText(QueueLeft + QueueWidth - 58, YY, formatArcadeTime(Ride['time_left']), Shade, GLUT_BITMAP_HELVETICA_10)
    if IncomingRideRequest is not None:
        IsHome = IncomingRideRequest['pickup_type'] == 'HOME'
        HeadColor = Gold if IsHome else Coral
        drawHUDPanel(RequestLeft, 17, RequestWidth, RequestHeight, Ink, RequestAlpha, HeadColor)
        draw2DText(RequestLeft + 14, 137, 'NEW REQUEST', HeadColor)
        draw2DText(RequestLeft + 14, 109, 'HOME PICKUP' if IsHome else 'SOS / WATER RESCUE', Mist, GLUT_BITMAP_HELVETICA_12)
        draw2DText(RequestLeft + 14, 87, IncomingRideRequest['name'] + '  /  ' + IncomingRideRequest['pickup'], Mist, GLUT_BITMAP_HELVETICA_12)
        draw2DText(RequestLeft + 14, 63, 'DEADLINE ' + formatArcadeTime(IncomingRideRequest['time_left']) + '    EXPIRES ' + str(max(0, int(IncomingRequestTimeLeft))) + 's', Muted, GLUT_BITMAP_HELVETICA_12)
        draw2DRectangle(RequestLeft + 14, 28, RequestLeft + 125, 50, (0.13, 0.35, 0.32))
        draw2DText(RequestLeft + 37, 34, 'Y  ACCEPT', (0.8, 1.0, 0.85), GLUT_BITMAP_HELVETICA_12)
        draw2DRectangle(RequestLeft + 145, 28, RequestLeft + 275, 50, (0.35, 0.15, 0.14))
        draw2DText(RequestLeft + 168, 34, 'N  DECLINE', (1.0, 0.79, 0.74), GLUT_BITMAP_HELVETICA_12)
    drawHUDPanel(BoostLeft, BoostBottom, BoostWidth, BoostHeight, Ink, 0.94, (0.45, 0.87, 0.82))
    draw2DText(BoostLeft + 14, 51, 'PADDLE BOOST   [SPACE]', Mist, GLUT_BITMAP_HELVETICA_12)
    drawArcadeMeter(BoostLeft + 14, 30, 184, 10, BoatBoostMeter / 100, (0.13, 0.27, 0.3), Gold if BoatBoostActive else Sea)
    draw2DText(BoostLeft + 202, 31, str(int(BoatBoostMeter)) + '%', Mist, GLUT_BITMAP_HELVETICA_12)
    end2DDrawing()
    drawSharedHUDFeedback(False)



def drawMenuCircle(X,Y,Radius,Color,Segments=30,VerticalScale=1.0):
    glColor4f(*Color) if len(Color)==4 else glColor3f(*Color)
    glBegin(GL_TRIANGLE_FAN)
    glVertex2f(X,Y)
    for I in range(Segments+1):
        Angle=I*2*math.pi/Segments
        glVertex2f(X+math.cos(Angle)*Radius,Y+math.sin(Angle)*Radius*VerticalScale)
    glEnd()


def drawMenuLine(Points,Color,Width=2):
    glColor4f(*Color) if len(Color)==4 else glColor3f(*Color)
    glLineWidth(Width)
    glBegin(GL_LINE_STRIP)
    for X,Y in Points:
        glVertex2f(X,Y)
    glEnd()


def drawMenuPolygon(Points,Color):
    glColor4f(*Color) if len(Color)==4 else glColor3f(*Color)
    glBegin(GL_POLYGON)
    for X,Y in Points:
        glVertex2f(X,Y)
    glEnd()


def isMenuInside(X,Y,Bounds):
    return Bounds[0]<=X<=Bounds[2] and Bounds[1]<=Y<=Bounds[3]


def getMenuOptionAt(X,Y):
    if isMenuInside(X,Y,MenuCloseBounds):
        return 'CLOSE'
    if MenuHelpVisible:
        return 'BACK' if isMenuInside(X,Y,MenuBackBounds) else None
    for Option,Bounds in MenuOptions:
        if isMenuInside(X,Y,Bounds):
            return Option
    return None


def getMenuCurrentTarget():
    return MenuHoveredOption if MenuHoveredOption else MenuSelectedOption


def closeMajhiJabenGame():
    try:
        glutLeaveMainLoop()
    except (NameError,AttributeError):
        sys.exit(0)


def chooseMenuOption(Option):
    global MenuSelectedOption,MenuHoveredOption,MenuHelpVisible
    if Option in ('EXIT','CLOSE'):
        closeMajhiJabenGame()
        return
    elif Option=='BACK':
        MenuHelpVisible=False
        MenuSelectedOption='HELP'
        MenuHoveredOption=None
    elif Option=='HELP':
        MenuHelpVisible=True
        MenuSelectedOption='HELP'
        MenuHoveredOption=None
    elif Option=='START':
        MenuHelpVisible=False
        resetArcadeGame()
    glutPostRedisplay()


def drawRescueSceneBackground():
    Now=time.perf_counter()
    Rock=math.sin(Now*1.9)*3.0
    Swim=math.sin(Now*3.8)*5

    glBegin(GL_QUADS)
    for I in range(20):
        Y1=I*WindowHeight/20
        Y2=(I+1)*WindowHeight/20
        K=I/19.0
        glColor3f(0.045+0.055*K,0.105+0.10*K,0.16+0.13*K)
        glVertex2f(0,Y1)
        glVertex2f(WindowWidth,Y1)
        glVertex2f(WindowWidth,Y2)
        glVertex2f(0,Y2)
    glEnd()
    for I in range(10):
        X=I*124-45
        drawMenuCircle(X,747+(I%3)*26,93+(I%4)*17,(0.18,0.25,0.31,0.65),18,0.45)
    for I in range(17):
        X=I*65-32
        H=132+(I*59)%200
        Base=(0.075,0.15,0.19) if I%2 else (0.095,0.185,0.215)
        draw2DRectangle(X,238,X+56,238+H,Base)
        for Row in range(int(H//37)):
            for Column in range(3):
                if (I*7+Row*5+Column*3)%6==0:
                    draw2DRectangle(X+9+Column*14,254+Row*36,
                                    X+17+Column*14,266+Row*36,(0.35,0.35,0.24))
    draw2DRectangle(0,0,WindowWidth,270,(0.025,0.19,0.25))
    drawMenuPolygon([(0,265),(1000,265),(1000,236),(0,235)],(0.12,0.28,0.32,0.40))
    glBegin(GL_LINES)
    for I in range(88):
        X=(I*137+29)%1000
        Y=(I*47+int(Now*9))%247
        glColor4f(0.42,0.70,0.72,0.20+(I%4)*0.085)
        glVertex2f(X,Y)
        glVertex2f(X+12+(I%5)*9,Y)
    glEnd()

    glBegin(GL_QUADS)
    glColor4f(0.80,0.88,0.73,0.0)
    glVertex2f(440,755)
    glVertex2f(682,755)
    glColor4f(1.0,0.94,0.66,0.24)
    glVertex2f(692,270)
    glVertex2f(416,270)
    glEnd()
    drawMenuCircle(559,415,165,(0.90,0.92,0.72,0.07),36,1.36)
    drawMenuLine([(426,287),(445,324),(465,365),(487,410),(520,470),(559,551),
                  (599,472),(634,410),(665,352),(684,288)],
                 (0.98,0.84,0.38,0.50),2.0)
    drawMenuCircle(557,269,152,(1.0,0.80,0.35,0.15),42,0.22)
    drawMenuLine([(557+152*math.cos(I*math.pi/32),269+34*math.sin(I*math.pi/32))
                  for I in range(65)],(0.98,0.82,0.38,0.9),3)

    draw2DRectangle(449,280,514,510,(0.72,0.68,0.59))
    draw2DRectangle(514,445,660,510,(0.73,0.69,0.61))
    draw2DRectangle(614,300,660,445,(0.67,0.67,0.59))
    draw2DRectangle(532,308,610,435,(0.17,0.33,0.33))
    draw2DRectangle(544,311,600,412,(0.12,0.37,0.24))
    draw2DRectangle(611,322,630,466,(0.11,0.38,0.26))
    for Col in range(4):
        for Row in range(6):
            X=455+Col*14
            Y=307+Row*30
            draw2DRectangle(X,Y,X+9,Y+21,(0.105,0.21,0.34))
            if Row%2==0:
                drawMenuLine([(X,Y+9),(X+9,Y+9)],(0.38,0.54,0.58),1)
    for Col in range(10):
        X=520+Col*13
        draw2DRectangle(X,453,X+9,495,(0.11,0.23,0.32))
    drawMenuPolygon([(434,510),(660,511),(673,527),(446,527)],(0.10,0.19,0.24))
    for I in range(16):
        X=447+I*14
        drawMenuLine([(X,512),(X+7,525)],(0.42,0.54,0.56),1)
    draw2DRectangle(501,275,608,292,(0.48,0.55,0.50))
    draw2DText(485,286,'BRAC UNIVERSITY',(0.95,0.93,0.78),GLUT_BITMAP_HELVETICA_12)

    DrownX,DrownY=522,206+Swim
    for Ripple in range(3):
        R=24+Ripple*13+6*math.sin(Now*1.8+Ripple)
        drawMenuLine([(DrownX+math.cos(I*math.pi/24)*R,
                       191+math.sin(I*math.pi/24)*R*0.28) for I in range(49)],
                     (0.65,0.87,0.88,0.46-Ripple*0.10),1)
    draw2DRectangle(DrownX-12,188,DrownX+12,204+Swim,(0.83,0.31,0.25))
    drawMenuCircle(DrownX,DrownY+15,15,(0.86,0.64,0.45),22)
    drawMenuCircle(DrownX-3,DrownY+25,10,(0.12,0.13,0.15),20,0.42)
    drawMenuLine([(DrownX+8,DrownY+3),(DrownX+21,DrownY+27),
                  (DrownX+15,DrownY+51+Swim*0.4)],(0.87,0.69,0.53),8)
    drawMenuCircle(DrownX+15,DrownY+51+Swim*0.4,5,(0.90,0.69,0.52),13)
    draw2DText(488,276,'HELP!',(1.0,0.70,0.48),GLUT_BITMAP_HELVETICA_18)

    BY=192+Rock
    drawMenuPolygon([(194,BY+18),(427,BY+18),(451,BY+43),(203,BY+47)],(0.53,0.30,0.16))
    drawMenuPolygon([(203,BY+28),(436,BY+28),(418,BY-6),(230,BY-6)],(0.08,0.39,0.43))
    drawMenuPolygon([(220,BY+26),(433,BY+26),(413,BY+14),(235,BY+12)],(0.17,0.60,0.61))
    drawMenuLine([(216,BY+46),(432,BY+43)],(0.98,0.72,0.37),5)
    drawMenuPolygon([(311,BY+47),(351,BY+47),(345,BY+94),(318,BY+94)],(0.96,0.61,0.29))
    drawMenuCircle(334,BY+109,18,(0.85,0.62,0.42),24)
    drawMenuPolygon([(313,BY+122),(325,BY+141),(345,BY+140),(354,BY+122)],(0.11,0.23,0.24))

    drawMenuLine([(319,BY+78),(297,BY+67)],(0.90,0.69,0.50),8)
    drawMenuCircle(295,BY+66,5,(0.95,0.73,0.52),14)

    drawMenuLine([(344,BY+83),(372,BY+72)],(0.91,0.69,0.50),10)
    drawMenuCircle(374,BY+71,5,(0.95,0.73,0.52),14)
    drawMenuLine([(374,BY+71),(392,BY+67)],(0.16,0.18,0.20),11)
    drawMenuLine([(387,BY+68),(401,BY+65)],(0.22,0.24,0.26),10)
    drawMenuLine([(398,BY+66),(409,BY+63)],(0.42,0.45,0.47),15)
    drawMenuCircle(411,BY+63,7,(0.78,0.79,0.76),18)
    for Radius,Alpha in ((18,0.06),(12,0.10),(8,0.18)):
        drawMenuCircle(412,BY+63,Radius,(1.0,0.90,0.58,Alpha),24)
    drawMenuCircle(412,BY+63,4,(1.0,0.96,0.76),18)

    drawMenuLine([(277,BY+35),(290,BY-12)],(0.54,0.35,0.18),7)
    drawMenuLine([(290,BY-12),(310,BY-17)],(0.60,0.40,0.24),9)

    glLineWidth(1.2)
    glBegin(GL_LINES)
    T=int(Now*95)
    for I in range(125):
        X=(I*73+19)%1000
        Y=(I*149-T)%790
        if 413<X<694 and Y>267:
            continue
        glColor4f(0.62,0.80,0.90,0.36+(I%3)*0.12)
        glVertex2f(X,Y)
        glVertex2f(X-5,Y-19)
    glEnd()
    draw2DText(445,566,'ONLY HERE, THE RAIN STOPS',(0.99,0.90,0.58),GLUT_BITMAP_HELVETICA_12)
    return (412, BY+63)


def drawMenuRadialGlow(X,Y,Radius,Alpha,Color=(1.0,0.96,0.79),Segments=48):
    glBegin(GL_TRIANGLE_FAN)
    glColor4f(Color[0],Color[1],Color[2],Alpha)
    glVertex2f(X,Y)
    for I in range(Segments+1):
        Angle=2*math.pi*I/Segments
        glColor4f(Color[0],Color[1],Color[2],0.0)
        glVertex2f(X+math.cos(Angle)*Radius,Y+math.sin(Angle)*Radius)
    glEnd()


def drawMenuSearchlight(Pivot):
    Option=getMenuCurrentTarget()
    X,Y=Pivot
    Now=time.perf_counter()

    if Option in ('EXIT','CLOSE'):
        Pulse=0.96+0.04*math.sin(Now*1.6)

        drawMenuPolygon([(0,0),(WindowWidth,0),
                         (WindowWidth,WindowHeight),(0,WindowHeight)],
                        (1.0,0.96,0.84,0.18*Pulse))

        drawMenuRadialGlow(X,Y,490,0.38*Pulse,(1.0,0.88,0.65),64)
        drawMenuRadialGlow(X,Y,340,0.48*Pulse,(1.0,0.93,0.76),60)
        drawMenuRadialGlow(X,Y,210,0.68*Pulse,(1.0,0.96,0.85),56)
        drawMenuRadialGlow(X,Y,114,0.88*Pulse,(1.0,0.99,0.94),48)
        drawMenuRadialGlow(X,Y,58,0.97*Pulse,(1.0,1.0,0.98),40)

        for I in range(12):
            Angle=I*math.pi/6
            CA=math.cos(Angle)
            SA=math.sin(Angle)
            Length=330 if I%2==0 else 215
            drawMenuLine([(X+CA*22,Y+SA*22),
                          (X+CA*Length,Y+SA*Length)],
                         (1.0,0.95,0.73,0.27*Pulse),8 if I%2==0 else 4)
            drawMenuLine([(X+CA*18,Y+SA*18),
                          (X+CA*(Length+40),Y+SA*(Length+40))],
                         (1.0,1.0,0.92,0.58*Pulse),1.7)

        drawMenuCircle(X,Y,28,(1.0,0.98,0.84,0.82),36)
        drawMenuCircle(X,Y,16,(1.0,1.0,0.97,1.0),32)
        drawMenuCircle(X,Y,8,(1.0,1.0,1.0,1.0),28)

    else:
        if Option=='HELP':
            TX,TY=716,395
        else:
            TX,TY=716,478
        DX,DY=TX-X,TY-Y
        Distance=max(1,math.sqrt(DX*DX+DY*DY))
        PerpX=-DY/Distance
        PerpY=DX/Distance
        NearWidth=5
        MidWidth=14
        FarWidth=30
        MX=X+DX*0.42
        MY=Y+DY*0.42
        drawMenuPolygon([(X+PerpX*NearWidth,Y+PerpY*NearWidth),
                         (MX+PerpX*MidWidth,MY+PerpY*MidWidth),
                         (MX-PerpX*MidWidth,MY-PerpY*MidWidth),
                         (X-PerpX*NearWidth,Y-PerpY*NearWidth)],
                        (1.0,0.88,0.56,0.19))
        drawMenuPolygon([(MX+PerpX*MidWidth,MY+PerpY*MidWidth),
                         (TX+PerpX*FarWidth,TY+PerpY*FarWidth),
                         (TX-PerpX*FarWidth,TY-PerpY*FarWidth),
                         (MX-PerpX*MidWidth,MY-MidWidth*PerpY)],
                        (1.0,0.84,0.44,0.10))
        drawMenuLine([(X,Y),(TX,TY)],(1.0,0.94,0.74,0.78),1.6)
        for Radius,Alpha in ((15,0.14),(10,0.22),(6,0.82)):
            drawMenuCircle(TX,TY,Radius,(0.99,0.87,0.52,Alpha),22)
        drawMenuCircle(X,Y,8,(0.98,0.94,0.75,0.95),18)


def drawMenuViewerLensWash(Pivot):
    if getMenuCurrentTarget() not in ('EXIT','CLOSE'):
        return
    X,Y=Pivot
    drawMenuPolygon([(0,0),(WindowWidth,0),
                     (WindowWidth,WindowHeight),(0,WindowHeight)],
                    (1.0,0.98,0.91,0.13))
    drawMenuRadialGlow(X,Y,250,0.26,(1.0,0.99,0.94),60)


def drawRescueMenuButtons():
    Gold=(1.0,0.82,0.47)
    Pale=(0.90,0.96,0.96)
    Muted=(0.63,0.77,0.80)
    drawHUDPanel(697,258,280,323,(0.013,0.048,0.066),0.93,Gold)
    draw2DText(721,549,'CHOOSE YOUR ROUTE',Gold,GLUT_BITMAP_HELVETICA_18)
    draw2DText(721,530,'THE CITY NEEDS A MAJHI.',Muted,GLUT_BITMAP_HELVETICA_12)
    for Option,Bounds in MenuOptions:
        L,B,R,T=Bounds
        Active=Option==getMenuCurrentTarget()
        Color=(0.12,0.38,0.39) if Option=='START' else (0.10,0.23,0.29)
        if Option=='EXIT':
            Color=(0.35,0.13,0.12) if Active else (0.19,0.13,0.15)
        if Active and Option!='EXIT':
            Color=(0.16,0.49,0.47)
        draw2DRectangle(L,B,R,T,Color)
        Border=(1.0,0.83,0.45) if Active else (0.37,0.58,0.58)
        drawMenuLine([(L,B),(R,B),(R,T),(L,T),(L,B)],Border,2 if Active else 1)
        if Active:
            draw2DRectangle(L+8,B+9,L+12,T-9,Gold)
        Label={'START':'START RESCUE','HELP':'HOW TO PLAY','EXIT':'EXIT GAME'}[Option]
        draw2DText(L+36,B+23,Label,Pale if Active else (0.76,0.87,0.89),GLUT_BITMAP_HELVETICA_18)
    draw2DText(717,273,'MOVE MOUSE TO AIM THE TORCH LIGHT',Muted,GLUT_BITMAP_HELVETICA_10)
    draw2DText(716,244,'CLICK  /  ENTER TO SELECT',(0.70,0.82,0.85),GLUT_BITMAP_HELVETICA_12)


def drawMenuHelpPanel():
    Ink=(0.012,0.046,0.063)
    White=(0.90,0.96,0.95)
    Gold=(1.0,0.82,0.47)
    Muted=(0.75,0.87,0.89)
    drawHUDPanel(676,132,314,468,Ink,0.97,Gold)
    draw2DText(704,560,'HOW TO PLAY',Gold,GLUT_BITMAP_HELVETICA_18)
    draw2DText(704,528,'YOUR MISSION',Gold,GLUT_BITMAP_HELVETICA_12)
    MissionLines=(
        'Accept rides and row through flooded Dhaka.',
        'Home pickup: stop near the waiting student.',
        'SOS rescue: save students from the floodwater.',
        'Maximum passengers on board: 3.',
        'Deliver them to BRACU before time runs out.'
    )
    for I,Line in enumerate(MissionLines):
        draw2DText(704,505-I*24,Line,White,GLUT_BITMAP_HELVETICA_10)
    draw2DText(704,360,'CONTROLS',Gold,GLUT_BITMAP_HELVETICA_12)
    Controls=(
        ('W / S','Forward / reverse'),
        ('A / D','Steer while rowing'),
        ('Y / N','Accept / reject ride'),
        ('SPACE','Paddle boost'),
        ('C / H','Camera / help'),
        ('ESC','Pause during gameplay')
    )
    for I,(KeyLabel,ActionLabel) in enumerate(Controls):
        Y=336-I*24
        draw2DText(706,Y,KeyLabel,Gold,GLUT_BITMAP_HELVETICA_12)
        draw2DText(765,Y,ActionLabel,Muted,GLUT_BITMAP_HELVETICA_12)
    L,B,R,T=MenuBackBounds
    draw2DRectangle(L,B,R,T,(0.12,0.43,0.41))
    drawMenuLine([(L,B),(R,B),(R,T),(L,T),(L,B)],Gold,2)
    draw2DText(L+70,B+20,'BACK',White,GLUT_BITMAP_HELVETICA_18)


def drawMenuCloseButton():
    L,B,R,T=MenuCloseBounds
    Active=getMenuCurrentTarget()=='CLOSE'
    draw2DRectangle(L,B,R,T,(0.42,0.12,0.11) if Active else (0.08,0.15,0.19))
    drawMenuLine([(L+10,B+11),(R-10,T-11)],(1.0,0.94,0.87),3)
    drawMenuLine([(R-10,B+11),(L+10,T-11)],(1.0,0.94,0.87),3)
    if Active:
        drawMenuLine([(L,B),(R,B),(R,T),(L,T),(L,B)],(1.0,0.68,0.49),2)


def drawMenuOverlay():
    begin2DDrawing()
    Pivot=drawRescueSceneBackground()
    drawMenuSearchlight(Pivot)
    Gold=(1.0,0.82,0.47)
    White=(0.92,0.98,0.97)
    Muted=(0.65,0.83,0.86)
    draw2DText(42,758,'CSE423  /  GROUP 07  /  FLOODED DHAKA',Muted,GLUT_BITMAP_HELVETICA_12)
    draw2DText(42,706,'MAJHI JABEN?!',Gold,GLUT_BITMAP_HELVETICA_18)
    draw2DText(42,671,'THE STREETS ARE FLOODED. THE STUDENTS ARE WAITING.',White,GLUT_BITMAP_HELVETICA_12)
    drawMenuLine([(42,650),(616,650)],(0.90,0.73,0.39),2)
    draw2DText(42,618,'ONE BOAT. THREE SEATS. A CITY TO SAVE.',Muted,GLUT_BITMAP_HELVETICA_12)
    draw2DText(45,82,'ROW INTO THE STORM. BRACU IS THE ONLY DRY PLACE.',
               (0.84,0.94,0.91),GLUT_BITMAP_HELVETICA_12)
    if MenuHelpVisible:
        drawMenuHelpPanel()
    else:
        drawRescueMenuButtons()
    drawMenuCloseButton()
    drawMenuViewerLensWash(Pivot)
    end2DDrawing()

def drawHelpOverlay():
    begin2DDrawing()
    Ink=(0.018,0.055,0.078)
    White=(0.85,0.94,0.95)
    Gold=(1.0,0.81,0.46)
    Sea=(0.48,0.88,0.82)
    drawHUDPanel(164,138,680,527,Ink,0.97,Gold)
    draw2DText(194,613,"CAPTAIN'S FIELD GUIDE",Gold)
    draw2DText(194,583,'DRIVING  /  PICKUPS  /  SURVIVAL',Sea,GLUT_BITMAP_HELVETICA_12)
    draw2DRectangle(194,565,815,566,(0.23,0.39,0.42))
    HelpLines=[
        "Y / N          Accept or decline an incoming student ride",
        "W / S          Hold to row forwards / backwards",
        "A / D          Hold to steer; use W+A or W+D together",
        "HOME           Stop near a house; hold still for 1.3 seconds",
        "SOS            Rescue a student in water; hold for 0.65 seconds",
        "BRACU          Deliver quickly: deadlines are short and route-based",
        "SPACE          Activate paddle boost; it recharges over time",
        "P              Photograph a landmark while facing it",
        "V / F          Windshield wiper / repair electrical box",
        "C              Toggle first-person and third-person view",
        "F3             Visual quality (HIGH or BALANCED)",
    ]
    Y=536
    for Line in HelpLines:
        draw2DText(194,Y,Line,White,GLUT_BITMAP_HELVETICA_12)
        Y-=32
    draw2DRectangle(194,166,816,203,(0.12,0.36,0.35))
    draw2DText(377,178,'PRESS H TO CLOSE',White,GLUT_BITMAP_HELVETICA_18)
    end2DDrawing()


def drawPauseOverlay():
    begin2DDrawing()
    drawHUDPanel(288,301,425,202,(0.017,0.061,0.081),0.97,(1.0,0.81,0.46))
    draw2DText(455,452,'PAUSED',(1.0,0.81,0.46))
    draw2DText(360,407,'ESC  -  RESUME THE JOURNEY',(0.89,0.96,0.95),GLUT_BITMAP_HELVETICA_12)
    draw2DText(360,376,'H  -  HELP AND CONTROLS',(0.68,0.88,0.88),GLUT_BITMAP_HELVETICA_12)
    draw2DText(360,344,'R  -  RESTART THE SHIFT',(0.68,0.88,0.88),GLUT_BITMAP_HELVETICA_12)
    end2DDrawing()


def drawGameEndingOverlay():
    begin2DDrawing()
    Success=(GameMode=='WON')
    Ink=(0.017,0.061,0.081)
    Accent=(0.48,0.88,0.71) if Success else (1.0,0.53,0.44)
    White=(0.87,0.95,0.95)
    drawHUDPanel(202,214,596,400,Ink,0.97,Accent)
    Header='BRACU EXPRESS COMPLETED' if Success else 'SHIFT ENDED'
    draw2DText(270,562,Header,Accent)
    draw2DText(263,515,'STUDENTS DELIVERED     '+str(DeliveredRideCount),White)
    draw2DText(263,474,'DEADLINES MISSED       '+str(FailedRideCount),White)
    draw2DText(263,433,'WATER RESCUES          '+str(RescuedPersonCount),White)
    draw2DText(263,392,'TRAFFIC VIOLATIONS     '+str(TrafficViolations),White)
    draw2DText(263,351,'SCORE '+str(Score)+'    /    TIME '+formatArcadeTime(GameTimeSeconds),
               (1.0,0.81,0.46))
    draw2DRectangle(260,247,738,306,(0.12,0.39,0.36))
    draw2DText(332,267,'ENTER OR R TO PLAY AGAIN',White)
    end2DDrawing()


def drawArcadeMinimapMarkers(MinimapLeft,MinimapBottom,MinimapSize):
    if IncomingRideRequest is not None:
        Kind='SOS' if IncomingRideRequest['pickup_type']=='DROWNING' else 'HOME'
        drawMinimapSymbol(IncomingRideRequest['x'],IncomingRideRequest['y'],
                          MinimapLeft,MinimapBottom,MinimapSize,Kind,Pending=True)
    for Ride in ActiveRideRequests:
        if Ride['state']=='WAITING':
            Kind='SOS' if Ride['pickup_type']=='DROWNING' else 'HOME'
            drawMinimapSymbol(Ride['x'],Ride['y'],
                              MinimapLeft,MinimapBottom,MinimapSize,Kind)


PreviousFrameTime=time.time()


def updateProfileAverage(Name,Sample,Weight=0.18):
    global FrameWorstMs
    Previous=globals()[Name]
    globals()[Name]=Previous*(1.0-Weight)+Sample*Weight
    if Name=='FrameRenderMs':
        FrameWorstMs=max(FrameWorstMs*0.995,Sample)


def drawFrameProfiler():
    if not ShowFrameProfile:
        return
    begin2DDrawing()
    drawHUDPanel(391,102,262,139,(0.012,0.044,0.059),0.95,(0.43,0.85,0.78))
    draw2DText(404,218,'PERFORMANCE / F4', (0.97,0.82,0.48),GLUT_BITMAP_HELVETICA_12)
    draw2DText(404,197,'FRAME   %.1f ms' % FrameRenderMs,(0.84,0.95,0.96),GLUT_BITMAP_HELVETICA_12)
    draw2DText(404,177,'WATER   %.1f ms' % FrameWaterMs,(0.72,0.89,0.89),GLUT_BITMAP_HELVETICA_12)
    draw2DText(404,157,'CITY    %.1f ms' % FrameCityMs,(0.72,0.89,0.89),GLUT_BITMAP_HELVETICA_12)
    draw2DText(404,137,'HUD     %.1f ms' % FrameHudMs,(0.72,0.89,0.89),GLUT_BITMAP_HELVETICA_12)
    draw2DText(404,116,'UPDATE  %.1f ms' % FrameUpdateMs,(0.72,0.89,0.89),GLUT_BITMAP_HELVETICA_12)
    end2DDrawing()



def displayGameFrame():
    RenderBegin=time.perf_counter()
    glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    glViewport(ViewportX,ViewportY,ViewportWidth,ViewportHeight)
    if GameMode=='MENU':
        drawMenuOverlay()
        glutSwapBuffers()
        updateProfileAverage('FrameRenderMs',(time.perf_counter()-RenderBegin)*1000)
        return
    setupFirstPersonCamera()
    glEnable(GL_DEPTH_TEST)
    glDepthMask(GL_TRUE)
    glDisable(GL_FOG)
    drawWeatherBackground()
    glEnable(GL_FOG)
    drawFloodedDhakaWorld()
    StageStart=time.perf_counter()
    drawFloodedRoadEnvironment()
    updateProfileAverage('FrameWaterMs',(time.perf_counter()-StageStart)*1000)
    drawWaterCurrentEffects()
    drawBRACUDestination()
    drawUniversityArrivalDock()
    StageStart=time.perf_counter()
    drawCityEnvironment()
    updateProfileAverage('FrameCityMs',(time.perf_counter()-StageStart)*1000)
    drawPickupStations()
    drawDebrisObjects()
    drawFloodRescuePeople()
    drawRescueSplashEffects()
    drawBRACUDeliverySparkle()
    drawDeliveryExitPeople()
    drawBoatWake()
    if ThirdPersonCamera:
        drawPlayerBoat()
        drawPlayerHandsAndPaddles()
        drawBoatCaptain()
        drawPassengerSeats()
        drawPaddleContactSplashes()
    else:
        drawPlayerBoat()
        drawPassengerSeats()
        drawPlayerHandsAndPaddles()
        drawPaddleContactSplashes()
    drawMissedPassengerEffects()
    drawWeatherEffects()
    glDisable(GL_FOG)
    if not ThirdPersonCamera:
        drawWindshieldOverlay()
    StageStart=time.perf_counter()
    if GameMode!='MENU':
        drawRealTimeMinimap()
    drawArcadeHUD()
    if GameMode in ('PLAYING','PAUSED'):
        drawDeliverySuccessBanner()
    if GameMode in ('PLAYING','PAUSED'):
        drawPhotoFeedback()
        drawTrafficViolationFeedback()
    updateProfileAverage('FrameHudMs',(time.perf_counter()-StageStart)*1000)
    drawFrameProfiler()
    glutSwapBuffers()
    updateProfileAverage('FrameRenderMs',(time.perf_counter()-RenderBegin)*1000)



def clearHeldBoatControls():
    HeldMovementKeys.clear()
    HeldArrowKeys.clear()


def updateHeldBoatMovement(DeltaTime):
    """Combine rowing and steering every update, independently of key repeat.

    W + A / W + D turn while moving forward; S + A / S + D do the
    same while reversing. The arrow keys work in exactly the same way.
    Opposing directions cancel instead of taking precedence.
    """
    if GameMode!="PLAYING" or DeltaTime<=0:
        return

    MovingForward=(b'w' in HeldMovementKeys or GLUT_KEY_UP in HeldArrowKeys)
    MovingBackward=(b's' in HeldMovementKeys or GLUT_KEY_DOWN in HeldArrowKeys)
    TurningLeft=(b'a' in HeldMovementKeys or GLUT_KEY_LEFT in HeldArrowKeys)
    TurningRight=(b'd' in HeldMovementKeys or GLUT_KEY_RIGHT in HeldArrowKeys)

    MovementDirection=int(MovingForward)-int(MovingBackward)
    TurningDirection=int(TurningLeft)-int(TurningRight)

    if TurningDirection:
        rotateBoatLeftOrRight(TurningDirection,DeltaTime*BoatTurningStepsPerSecond)
    if MovementDirection:
        moveBoatForwardOrBackward(MovementDirection,DeltaTime*BoatRowingStepsPerSecond)
        startRowingAnimation()



def handleKeyboardInput(KeyPressed,MousePositionX,MousePositionY):
    global GameMode,ShowInstructions,ThirdPersonCamera
    LowerCaseKey=KeyPressed.lower()
    if GameMode=="MENU":
        global MenuSelectedOption,MenuHoveredOption,MenuHelpVisible
        if MenuHelpVisible:
            if LowerCaseKey in (b'\x1b',b'h',b'\r',b'\n'):
                chooseMenuOption('BACK')
        elif LowerCaseKey in (b'\r',b'\n'):
            chooseMenuOption(getMenuCurrentTarget())
        elif LowerCaseKey in (b'w',b's'):
            Options=['START','HELP','EXIT']
            Current=MenuSelectedOption if MenuSelectedOption in Options else 'START'
            Delta=-1 if LowerCaseKey==b'w' else 1
            MenuSelectedOption=Options[(Options.index(Current)+Delta)%len(Options)]
            MenuHoveredOption=None
        elif LowerCaseKey==b'\x1b':
            chooseMenuOption('EXIT')
        glutPostRedisplay()
        return
    if GameMode=="WON" or GameMode=="LOST":
        if LowerCaseKey==b'\r' or LowerCaseKey==b'\n' or LowerCaseKey==b'r':
            resetArcadeGame()
        glutPostRedisplay()
        return
    if LowerCaseKey==b'\x1b':
        clearHeldBoatControls()
        GameMode="PLAYING" if GameMode=="PAUSED" else "PAUSED"
        ShowInstructions=False
        glutPostRedisplay()
        return
    if GameMode=="PAUSED":
        if LowerCaseKey==b'h':
            ShowInstructions=not ShowInstructions
        elif LowerCaseKey==b'r':
            resetArcadeGame()
        glutPostRedisplay()
        return
    if LowerCaseKey==b'h':
        clearHeldBoatControls()
        GameMode="PAUSED"
        ShowInstructions=True
    elif LowerCaseKey in (b'w',b's',b'a',b'd'):
        HeldMovementKeys.add(LowerCaseKey)
    elif LowerCaseKey==b'y':
        acceptRideRequest()
    elif LowerCaseKey==b'n':
        rejectRideRequest()
    elif LowerCaseKey==b' ':
        activateBoatBoost()
    elif LowerCaseKey==b'c':
        ThirdPersonCamera=not ThirdPersonCamera
    elif LowerCaseKey==b'p':
        tryLandmarkPhoto()
    elif LowerCaseKey==b'v':
        startWindshieldWiper()
    elif LowerCaseKey==b'f':
        tryRepairPower()
    glutPostRedisplay()


def handleKeyboardRelease(KeyReleased,MousePositionX,MousePositionY):
    HeldMovementKeys.discard(KeyReleased.lower())



def handleSpecialKeyInput(KeyPressed,MousePositionX,MousePositionY):
    global RenderQuality,ShowFrameProfile
    if KeyPressed==GLUT_KEY_F4:
        ShowFrameProfile=not ShowFrameProfile
        glutPostRedisplay()
        return
    if KeyPressed==GLUT_KEY_F3:
        RenderQuality='BALANCED' if RenderQuality=='HIGH' else 'HIGH'
        glutPostRedisplay()
        return
    if GameMode=='MENU':
        global MenuSelectedOption,MenuHoveredOption
        if not MenuHelpVisible and KeyPressed in (GLUT_KEY_UP,GLUT_KEY_DOWN):
            Options=['START','HELP','EXIT']
            Current=MenuSelectedOption if MenuSelectedOption in Options else 'START'
            Delta=-1 if KeyPressed==GLUT_KEY_UP else 1
            MenuSelectedOption=Options[(Options.index(Current)+Delta)%len(Options)]
            MenuHoveredOption=None
            glutPostRedisplay()
        return
    if GameMode!="PLAYING":
        return
    if KeyPressed in (GLUT_KEY_UP,GLUT_KEY_DOWN,GLUT_KEY_LEFT,GLUT_KEY_RIGHT):
        HeldArrowKeys.add(KeyPressed)
    glutPostRedisplay()


def handleSpecialKeyRelease(KeyReleased,MousePositionX,MousePositionY):
    HeldArrowKeys.discard(KeyReleased)


def handleWindowFocusChange(WindowState):
    if WindowState==GLUT_LEFT:
        clearHeldBoatControls()



def handleWindowReshape(Width,Height):
    global ActualWindowWidth,ActualWindowHeight,ViewportX,ViewportY
    global ViewportWidth,ViewportHeight,ViewportScale
    ActualWindowWidth=max(1,int(Width))
    ActualWindowHeight=max(1,int(Height))
    ViewportScale=min(ActualWindowWidth/float(WindowWidth),
                      ActualWindowHeight/float(WindowHeight))
    ViewportWidth=max(1,int(WindowWidth*ViewportScale))
    ViewportHeight=max(1,int(WindowHeight*ViewportScale))
    ViewportX=(ActualWindowWidth-ViewportWidth)//2
    ViewportY=(ActualWindowHeight-ViewportHeight)//2
    glViewport(ViewportX,ViewportY,ViewportWidth,ViewportHeight)
    glutPostRedisplay()


def getVirtualMousePosition(MousePositionX,MousePositionY):
    """Window pixels -> virtual UI pixels, accounting for black sidebars."""
    VirtualX=(MousePositionX-ViewportX)/max(ViewportScale,0.0001)
    VirtualY=(ActualWindowHeight-MousePositionY-ViewportY)/max(ViewportScale,0.0001)
    return VirtualX,VirtualY


def handleMenuPointerMovement(MousePositionX,MousePositionY):
    global MenuHoveredOption
    if GameMode!='MENU':
        return
    VirtualX,VirtualY=getVirtualMousePosition(MousePositionX,MousePositionY)
    MenuHoveredOption=getMenuOptionAt(VirtualX,VirtualY)
    glutPostRedisplay()


def handleMouseInput(MouseButton,ButtonState,MousePositionX,MousePositionY):
    if GameMode=='MENU' and MouseButton==GLUT_LEFT_BUTTON and ButtonState==GLUT_DOWN:
        VirtualX,VirtualY=getVirtualMousePosition(MousePositionX,MousePositionY)
        Target=getMenuOptionAt(VirtualX,VirtualY)
        if Target is not None:
            chooseMenuOption(Target)



def updateGameContinuously():
    global PreviousFrameTime,LastRenderUpdateTime
    CurrentPerfTime=time.perf_counter()
    if CurrentPerfTime-LastRenderUpdateTime < 1.0/MaxRenderFPS:
        time.sleep(0.001)
        return
    LastRenderUpdateTime=CurrentPerfTime
    UpdateBegin=time.perf_counter()
    CurrentFrameTime=time.time()
    DeltaTime=max(0.0,min(CurrentFrameTime-PreviousFrameTime,0.20))
    PreviousFrameTime=CurrentFrameTime
    while DeltaTime>0.0000001:
        Step=min(MaximumDeltaTime,DeltaTime)
        DeltaTime=DeltaTime-Step
        if GameMode in ('MENU','PLAYING'):
            updateRainDropPositions(Step)
            updateFloodWaterAnimation(Step)
            updateBRACUSunAura(Step)
        if GameMode=='PLAYING':
            updateHeldBoatMovement(Step)
            updateRowingAnimation(Step)
            updatePhotoFeedback(Step)
            updateFloodTrafficSignal(Step)
            updateArcadeGameplay(Step)
            applyFloodTrafficRule()
            updateTrafficViolationFeedback(Step)
            updateWindshieldWiper(Step)
            updatePowerOutageSystem(Step)
    updateProfileAverage('FrameUpdateMs',(time.perf_counter()-UpdateBegin)*1000)
    glutPostRedisplay()


def startGame():
    global PreviousFrameTime
    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE|GLUT_RGB|GLUT_DEPTH)
    glutInitWindowSize(WindowWidth,WindowHeight)
    glutInitWindowPosition(0,0)
    glutCreateWindow(b'Majhi Jaben?! - CSE423 Group 07 / Living Dhaka')
    glEnable(GL_DEPTH_TEST)
    glDepthFunc(GL_LEQUAL)
    glClearColor(0.012,0.036,0.050,1)
    glFogi(GL_FOG_MODE,GL_LINEAR)
    glFogfv(GL_FOG_COLOR,(0.16,0.23,0.29,1.0))
    glFogf(GL_FOG_START,950.0)
    glFogf(GL_FOG_END,3300.0)
    glutDisplayFunc(displayGameFrame)
    glutReshapeFunc(handleWindowReshape)
    glutKeyboardFunc(handleKeyboardInput)
    glutKeyboardUpFunc(handleKeyboardRelease)
    glutSpecialFunc(handleSpecialKeyInput)
    glutSpecialUpFunc(handleSpecialKeyRelease)
    try:
        glutIgnoreKeyRepeat(1)
    except Exception:
        pass
    try:
        glutEntryFunc(handleWindowFocusChange)
    except Exception:
        pass
    glutMouseFunc(handleMouseInput)
    glutPassiveMotionFunc(handleMenuPointerMovement)
    glutMotionFunc(handleMenuPointerMovement)
    glutIdleFunc(updateGameContinuously)
    PreviousFrameTime=time.time()
    global LastRenderUpdateTime
    LastRenderUpdateTime=time.perf_counter()-1.0/MaxRenderFPS
    glutMainLoop()


if __name__=="__main__":
    startGame()