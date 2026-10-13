from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
import math
import random
import time

# ============================================================
# GAME STATE
# ============================================================

WindowWidth,WindowHeight=1000,800

WorldMapLimit,FloodWaterHeight=1650,8
RoadWidth=210
VerticalRoadPositions=[-1100,-550,0,550,1100]
HorizontalRoadPositions=[-1150,-600,-50,500,1050]

WaterAnimationPhase,WaterAnimationSpeed=0,0.85


WaveTime=0
WaveTimeSpeed=0.04
WaveGridDivisions=50

def get_wave_height(x, y):
    """Calculates water height offset at (x,y) using dual overlapping waves."""
    return 12*math.sin(0.01*x+WaveTime)+4*math.cos(0.015*y+WaveTime)

BRACUPositionX,BRACUPositionY,BRACUHalfSize=0,1360,285
BRACUAuraAngle,BRACUAuraSpeed=0,20

LandmarkList=[
    {"name":"National Martyrs' Monument","x":-825,"y":1350,"photo_x":-825,"photo_y":1080,"taken":False,"info_lines":["National Martyrs' Memorial, Savar.","Built to honour those who died","in the 1971 Bangladesh Liberation War.","It stands about 35 km northwest","of Dhaka as a symbol of independence."]},
    {"name":"Shaheed Minar","x":825,"y":1350,"photo_x":825,"photo_y":1080,"taken":False,"info_lines":["Shaheed Minar, Dhaka.","Built to commemorate the martyrs","of the 1952 Bengali Language Movement.","Originally designed by Hamidur Rahman","with Novera Ahmed; rebuilt after 1971."]}
]

PhotoCaptureRadius,PhotoFacingAngleTolerance=125,30
PhotoFlashTimer,PhotoPopupTimer=0,0
PhotoPopupTitle=""
PhotoPopupLines=[]

BoatPositionX,BoatPositionY=0,-1450
BoatFacingAngle=90
BoatForwardMovementStep,BoatBackwardMovementStep,BoatTurningStep=18,12,5
BoatCollisionMargin=25
# ============================================================
# SWIMMER RESCUE SYSTEM GLOBALS
# ============================================================
SwimmerList=[]
MaxSwimmersInWorld=10
SwimmerSpawnTimer=0
SwimmerSpawnInterval=8
SwimmerBoardingRadius=100
MaxPassengersOnBoat=10
RescuedSwimmerCount=0
SwimmersDeliveredCount=0
SwimmerDeliveryMessageTimer=0
SwimmerDeliveryMessageText=""
CameraPosition,CameraFieldOfView=(0,0,70),82

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

# ============================================================
# FEATURE 5 - CITY BLACKOUT AND POWER RESTORATION
# ============================================================

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

# ============================================================
# USAEED RAHMAN TIBRO - GLOBALS
# ============================================================

# FEATURE 1 - WATER CURRENT ZONES
WaterCurrentZoneList = [
    {"x": -1100, "y": -550, "half_width": 400, "half_length": 80, "direction": 0, "strength": 85},
    {"x": 550, "y": 600, "half_width": 80, "half_length": 400, "direction": 90, "strength": 75},
    {"x": 0, "y": -600, "half_width": 80, "half_length": 350, "direction": 270, "strength": 90},
    {"x": 1100, "y": 500, "half_width": 350, "half_length": 80, "direction": 180, "strength": 80}
]
CurrentPushIndicatorTimer = 0.0

# FEATURE 2 - PADDLE BOOST RESOURCE SYSTEM
BoostState = "IDLE"
BoostMeter = 100.0
BoostMeterMax = 100.0
BoostDrainRate = 60.0
BoostRechargeRate = 25.0
BoostSpeedMultiplier = 2.2
BoostActiveTimer = 0.0

# FEATURE 3 - PRECISION DOCKING
PickupZoneList = [
    {"x": -825, "y": -875, "name": "Zone A"},
    {"x": 825, "y": -325, "name": "Zone B"},
    {"x": -275, "y": 775, "name": "Zone C"},
    {"x": 550, "y": 1050, "name": "Zone D"}
]
DockingTimer = 0.0
DockingRequiredTime = 1.2
IsDocked = False
CurrentDockingZone = None
DockingJustCompletedTimer = 0.0

# FEATURE 4 - MOVING FLOATING DEBRIS
FloatingDebrisList = []
for DebrisIndex in range(12):
    FloatingDebrisList.append({
        "x": random.uniform(-1400, 1400),
        "y": random.uniform(-1400, 1400),
        "speed_x": random.choice([-1, 1]) * random.uniform(15, 45),
        "speed_y": random.choice([-1, 1]) * random.uniform(10, 35),
        "size": random.uniform(18, 32),
        "type": random.choice(["box", "log"]),
        "rotation": random.uniform(0, 360)
    })
DebrisStunTimer = 0.0
DebrisCollisionCooldown = 0.0



# ============================================================
# WORLD SETUP
# ============================================================

# ============================================================
# BASIC CUBE
# ============================================================

def drawScaledCube(PositionX,PositionY,PositionZ,Width,Length,Height,RedColor,GreenColor,BlueColor):
    glPushMatrix()
    glTranslatef(PositionX,PositionY,PositionZ)
    glScalef(Width,Length,Height)
    glColor3f(RedColor,GreenColor,BlueColor)
    glutSolidCube(1)
    glPopMatrix()


# ============================================================
# FIRST PERSON CAMERA
# ============================================================

def setupFirstPersonCamera():
    global CameraPosition

    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(CameraFieldOfView,1.25,0.1,5000)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()

    BoatAngleInRadians=math.radians(BoatFacingAngle)
    BoatFacingDirectionX=math.cos(BoatAngleInRadians)
    BoatFacingDirectionY=math.sin(BoatAngleInRadians)

    CameraPositionX=BoatPositionX-BoatFacingDirectionX*40
    CameraPositionY=BoatPositionY-BoatFacingDirectionY*40

    # Camera bobs with the water swell at boat position
    water_z=get_wave_height(BoatPositionX,BoatPositionY)
    CameraPositionZ=FloodWaterHeight+70+water_z*0.3

    CameraLookPositionX=BoatPositionX+BoatFacingDirectionX*220
    CameraLookPositionY=BoatPositionY+BoatFacingDirectionY*220
    CameraLookPositionZ=FloodWaterHeight+45+water_z*0.15

    CameraPosition=(CameraPositionX,CameraPositionY,CameraPositionZ)

    gluLookAt(CameraPositionX,CameraPositionY,CameraPositionZ,CameraLookPositionX,CameraLookPositionY,CameraLookPositionZ,0,0,1)


# ============================================================
# FLOOD WATER
# ============================================================

def drawFloodWater():
    step=(WorldMapLimit*2)/WaveGridDivisions

    

    glBegin(GL_QUADS)
    for i in range(WaveGridDivisions):
        for j in range(WaveGridDivisions):
            x1=-WorldMapLimit+i*step
            y1=-WorldMapLimit+j*step
            x2=-WorldMapLimit+(i+1)*step
            y2=-WorldMapLimit+(j+1)*step

            z1=FloodWaterHeight+get_wave_height(x1,y1)
            z2=FloodWaterHeight+get_wave_height(x2,y1)
            z3=FloodWaterHeight+get_wave_height(x2,y2)
            z4=FloodWaterHeight+get_wave_height(x1,y2)

            c=(z1-FloodWaterHeight+16)/32.0
            glColor3f(0.07+0.03*c, 0.45+0.07*c, 0.72+0.08*c)

            glVertex3f(x1,y1,z1)
            glVertex3f(x2,y1,z2)
            glVertex3f(x2,y2,z3)
            glVertex3f(x1,y2,z4)
    glEnd()



def updateFloodWaterAnimation(DeltaTime):
    global WaterAnimationPhase,WaveTime

    WaterAnimationPhase=WaterAnimationPhase+WaterAnimationSpeed*DeltaTime
    if WaterAnimationPhase>math.pi*2:
        WaterAnimationPhase=WaterAnimationPhase-math.pi*2

    WaveTime=WaveTime+WaveTimeSpeed*DeltaTime


# ============================================================
# PLAYER BOAT
# ============================================================

def drawPlayerBoat():
    glPushMatrix()

    water_z=FloodWaterHeight+get_wave_height(BoatPositionX,BoatPositionY)
    glTranslatef(BoatPositionX,BoatPositionY,water_z+5)
    glRotatef(BoatFacingAngle,0,0,1)

    # Wave rocking motion (Naval Defense style)
    roll=3*math.cos(WaveTime*1.5)
    pitch=2*math.sin(WaveTime*1.0)
    glRotatef(roll,0,1,0)
    glRotatef(pitch,1,0,0)
        # Draw rescued passengers sitting on the deck
    drawBoardedPassengers()
    drawScaledCube(50,0,3,125,42,7,0.48,0.27,0.12)
    drawScaledCube(50,24,12,130,7,22,0.36,0.18,0.07)
    drawScaledCube(50,-24,12,130,7,22,0.36,0.18,0.07)
    drawScaledCube(108,0,13,16,45,24,0.55,0.30,0.12)
    drawScaledCube(80,0,17,38,34,8,0.62,0.37,0.16)

    glPopMatrix()


# ============================================================
# HANDS AND PADDLES
# ============================================================

def drawPlayerHandsAndPaddles():
    glPushMatrix()

    water_z=FloodWaterHeight+get_wave_height(BoatPositionX,BoatPositionY)
    glTranslatef(BoatPositionX,BoatPositionY,water_z+5)
    glRotatef(BoatFacingAngle,0,0,1)

    # Wave rocking motion (same as boat)
    roll=3*math.cos(WaveTime*1.5)
    pitch=2*math.sin(WaveTime*1.0)
    glRotatef(roll,0,1,0)
    glRotatef(pitch,1,0,0)

    if IsBoatRowing==True:
        ArmSwing=RowingAnimationAngle
    else:
        ArmSwing=0

    PaddleSwing=ArmSwing*(24.0/17.0)

    LeftShoulderX=-27
    LeftShoulderY=-19
    ArmHeight=27
    ArmLength=39

    glPushMatrix()
    glColor3f(0.88,0.67,0.48)
    glTranslatef(LeftShoulderX,LeftShoulderY,ArmHeight)
    glRotatef(-6+ArmSwing,0,0,1)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),4.6,3.8,ArmLength,9,9)
    glPopMatrix()

    LeftArmAngleInRadians=math.radians(-6+ArmSwing)
    LeftHandPositionX=LeftShoulderX+math.cos(LeftArmAngleInRadians)*ArmLength
    LeftHandPositionY=LeftShoulderY+math.sin(LeftArmAngleInRadians)*ArmLength

    glPushMatrix()
    glColor3f(0.88,0.67,0.48)
    glTranslatef(LeftHandPositionX,LeftHandPositionY,ArmHeight)
    gluSphere(gluNewQuadric(),5,9,9)
    glPopMatrix()

    RightShoulderX=-27
    RightShoulderY=19

    glPushMatrix()
    glColor3f(0.88,0.67,0.48)
    glTranslatef(RightShoulderX,RightShoulderY,ArmHeight)
    glRotatef(6-ArmSwing,0,0,1)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),4.6,3.8,ArmLength,9,9)
    glPopMatrix()

    RightArmAngleInRadians=math.radians(6-ArmSwing)
    RightHandPositionX=RightShoulderX+math.cos(RightArmAngleInRadians)*ArmLength
    RightHandPositionY=RightShoulderY+math.sin(RightArmAngleInRadians)*ArmLength

    glPushMatrix()
    glColor3f(0.88,0.67,0.48)
    glTranslatef(RightHandPositionX,RightHandPositionY,ArmHeight)
    gluSphere(gluNewQuadric(),5,9,9)
    glPopMatrix()

    LeftPaddleAngle=-62-PaddleSwing
    LeftPaddleLength=105
    LeftPaddleAngleInRadians=math.radians(LeftPaddleAngle)

    glPushMatrix()
    glColor3f(0.42,0.24,0.10)
    glTranslatef(LeftHandPositionX-3,LeftHandPositionY,ArmHeight-2)
    glRotatef(LeftPaddleAngle,0,0,1)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),2.6,2.4,LeftPaddleLength,8,8)
    glPopMatrix()

    LeftPaddleBladeX=LeftHandPositionX-3+math.cos(LeftPaddleAngleInRadians)*LeftPaddleLength
    LeftPaddleBladeY=LeftHandPositionY+math.sin(LeftPaddleAngleInRadians)*LeftPaddleLength

    glPushMatrix()
    glColor3f(0.56,0.32,0.14)
    glTranslatef(LeftPaddleBladeX,LeftPaddleBladeY,ArmHeight-2)
    glRotatef(LeftPaddleAngle,0,0,1)
    glScalef(25,10,5)
    glutSolidCube(1)
    glPopMatrix()

    RightPaddleAngle=62+PaddleSwing
    RightPaddleLength=105
    RightPaddleAngleInRadians=math.radians(RightPaddleAngle)

    glPushMatrix()
    glColor3f(0.42,0.24,0.10)
    glTranslatef(RightHandPositionX-3,RightHandPositionY,ArmHeight-2)
    glRotatef(RightPaddleAngle,0,0,1)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),2.6,2.4,RightPaddleLength,8,8)
    glPopMatrix()

    RightPaddleBladeX=RightHandPositionX-3+math.cos(RightPaddleAngleInRadians)*RightPaddleLength
    RightPaddleBladeY=RightHandPositionY+math.sin(RightPaddleAngleInRadians)*RightPaddleLength

    glPushMatrix()
    glColor3f(0.56,0.32,0.14)
    glTranslatef(RightPaddleBladeX,RightPaddleBladeY,ArmHeight-2)
    glRotatef(RightPaddleAngle,0,0,1)
    glScalef(25,10,5)
    glutSolidCube(1)
    glPopMatrix()

    glPopMatrix()


# ============================================================
# ROWING
# ============================================================

def startRowingAnimation():
    global IsBoatRowing,RowingAnimationTimer

    if IsBoatRowing==False:
        IsBoatRowing=True
        RowingAnimationTimer=0


def updateRowingAnimation(DeltaTime):
    global IsBoatRowing,RowingAnimationTimer,RowingAnimationAngle

    if IsBoatRowing==True:
        RowingAnimationTimer=RowingAnimationTimer+DeltaTime
        RowingAnimationAngle=math.sin(RowingAnimationTimer*10)*17

        if RowingAnimationTimer>=0.65:
            IsBoatRowing=False
            RowingAnimationTimer=0
            RowingAnimationAngle=0


# ============================================================
# BUILDING COLLISION
# ============================================================

def isBoatCollidingWithBuilding(PositionX,PositionY):
    for CurrentBuilding in BuildingList:
        BuildingPositionX=CurrentBuilding[0]
        BuildingPositionY=CurrentBuilding[1]
        BuildingHalfWidth=CurrentBuilding[2]
        BuildingHalfLength=CurrentBuilding[3]

        if BuildingPositionX-BuildingHalfWidth-BoatCollisionMargin<=PositionX<=BuildingPositionX+BuildingHalfWidth+BoatCollisionMargin and BuildingPositionY-BuildingHalfLength-BoatCollisionMargin<=PositionY<=BuildingPositionY+BuildingHalfLength+BoatCollisionMargin:
            return True

    return False


# ============================================================
# CAR COLLISION
# ============================================================

def isBoatCollidingWithCar(PositionX,PositionY):
    ShiftedCarList=getSubmergedCarPositions()

    for CurrentCar in ShiftedCarList:
        CarPositionX=CurrentCar[0]
        CarPositionY=CurrentCar[1]
        CarRotationAngle=CurrentCar[2]

        if abs(CarRotationAngle-90)<0.1:
            if abs(PositionX-CarPositionX)<=38 and abs(PositionY-CarPositionY)<=54:
                return True
        else:
            if abs(PositionX-CarPositionX)<=54 and abs(PositionY-CarPositionY)<=38:
                return True

    return False


# ============================================================
# BRACU COLLISION
# ============================================================

def isBoatCollidingWithBRACU(PositionX,PositionY):
    if BRACUPositionX-225<=PositionX<=BRACUPositionX+225 and BRACUPositionY-165<=PositionY<=BRACUPositionY+165:
        return True

    return False


# ============================================================
# LANDMARK COLLISION
# ============================================================

def isBoatCollidingWithLandmark(PositionX,PositionY):
    CollisionMargin=BoatCollisionMargin

    if -825-150-CollisionMargin<=PositionX<=-825+150+CollisionMargin and 1350-65-CollisionMargin<=PositionY<=1350+65+CollisionMargin:
        return True

    if 825-130-CollisionMargin<=PositionX<=825+130+CollisionMargin and 1350-70-CollisionMargin<=PositionY<=1350+70+CollisionMargin:
        return True

    return False


# ============================================================
# COMPLETE POSITION VALIDATION
# ============================================================

def isBoatPositionValid(PositionX,PositionY):
    WorldBoundaryMargin=35

    if PositionX<-WorldMapLimit+WorldBoundaryMargin or PositionX>WorldMapLimit-WorldBoundaryMargin:
        return False

    if PositionY<-WorldMapLimit+WorldBoundaryMargin or PositionY>WorldMapLimit-WorldBoundaryMargin:
        return False

    if isBoatCollidingWithBuilding(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithCar(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithBRACU(PositionX,PositionY)==True:
        return False

    if isBoatCollidingWithLandmark(PositionX,PositionY)==True:
        return False

    return True


# ============================================================
# MOVEMENT
# ============================================================

def moveBoatForwardOrBackward(MovementDirection):
    global BoatPositionX,BoatPositionY

    BoatAngleInRadians=math.radians(BoatFacingAngle)
    BoatFacingDirectionX=math.cos(BoatAngleInRadians)
    BoatFacingDirectionY=math.sin(BoatAngleInRadians)

    if MovementDirection==1:
        BoatMovementDistance=BoatForwardMovementStep
    else:
        BoatMovementDistance=BoatBackwardMovementStep

    NewBoatPositionX=BoatPositionX+(BoatFacingDirectionX*BoatMovementDistance*MovementDirection)
    NewBoatPositionY=BoatPositionY+(BoatFacingDirectionY*BoatMovementDistance*MovementDirection)

    if isBoatPositionValid(NewBoatPositionX,NewBoatPositionY)==True:
        BoatPositionX=NewBoatPositionX
        BoatPositionY=NewBoatPositionY


def rotateBoatLeftOrRight(TurningDirection):
    global BoatFacingAngle

    BoatFacingAngle=BoatFacingAngle+(BoatTurningStep*TurningDirection)
    BoatFacingAngle=BoatFacingAngle%360


# ============================================================
# COMPLETE WORLD
# ============================================================

def drawFloodedDhakaWorld():
    drawFloodWater()

# ============================================================
# WEATHER SETUP
# ============================================================

# ============================================================
# RAIN DATA
# ============================================================

RainDropPositions=[]

for RainDropNumber in range(480):
    RainDropPositions.append([random.uniform(-WorldMapLimit,WorldMapLimit),random.uniform(-WorldMapLimit,WorldMapLimit),random.uniform(100,950)])

# Each rain splash stores: [X position, Y position, age]
RainSplashList=[]


# ============================================================
# BASIC WEATHER HELPERS
# ============================================================

def isInsideBRACUClearArea(PositionX,PositionY):
    return abs(PositionX-BRACUPositionX)<=BRACUHalfSize+40 and abs(PositionY-BRACUPositionY)<=BRACUHalfSize+40


def drawWeatherQuad(Color,Vertex1,Vertex2,Vertex3,Vertex4):
    glColor3f(Color[0],Color[1],Color[2])
    glBegin(GL_QUADS)
    glVertex3f(Vertex1[0],Vertex1[1],Vertex1[2])
    glVertex3f(Vertex2[0],Vertex2[1],Vertex2[2])
    glVertex3f(Vertex3[0],Vertex3[1],Vertex3[2])
    glVertex3f(Vertex4[0],Vertex4[1],Vertex4[2])
    glEnd()


# ============================================================
# STORM SKY
# ============================================================

def drawStormySky():
    SkyBottomHeight=10
    SkyTopHeight=1750
    SkyEdge=WorldMapLimit+30

    drawWeatherQuad((0.22,0.31,0.40),(-SkyEdge,SkyEdge,SkyBottomHeight),(SkyEdge,SkyEdge,SkyBottomHeight),(SkyEdge,SkyEdge,SkyTopHeight),(-SkyEdge,SkyEdge,SkyTopHeight))
    drawWeatherQuad((0.29,0.33,0.39),(SkyEdge,-SkyEdge,SkyBottomHeight),(-SkyEdge,-SkyEdge,SkyBottomHeight),(-SkyEdge,-SkyEdge,SkyTopHeight),(SkyEdge,-SkyEdge,SkyTopHeight))
    drawWeatherQuad((0.24,0.32,0.40),(SkyEdge,SkyEdge,SkyBottomHeight),(SkyEdge,-SkyEdge,SkyBottomHeight),(SkyEdge,-SkyEdge,SkyTopHeight),(SkyEdge,SkyEdge,SkyTopHeight))
    drawWeatherQuad((0.27,0.33,0.40),(-SkyEdge,-SkyEdge,SkyBottomHeight),(-SkyEdge,SkyEdge,SkyBottomHeight),(-SkyEdge,SkyEdge,SkyTopHeight),(-SkyEdge,-SkyEdge,SkyTopHeight))
    drawWeatherQuad((0.36,0.39,0.44),(-SkyEdge,-SkyEdge,SkyTopHeight),(SkyEdge,-SkyEdge,SkyTopHeight),(SkyEdge,SkyEdge,SkyTopHeight),(-SkyEdge,SkyEdge,SkyTopHeight))


# ============================================================
# STORM CLOUDS
# ============================================================

def drawStormClouds():
    CloudColors=[(0.44,0.47,0.51),(0.37,0.41,0.46),(0.50,0.52,0.55)]
    CloudInformation=[[-1250,-1250,720,480,210,80],[-500,-1480,810,540,220,90],[520,-1390,735,520,210,82],[1320,-900,825,470,200,88],[-1390,-320,840,450,210,85],[1380,280,760,520,220,92],[-1250,930,800,470,200,82],[1100,1100,835,530,210,88]]

    for CloudNumber in range(len(CloudInformation)):
        CurrentCloud=CloudInformation[CloudNumber]
        CurrentCloudColor=CloudColors[CloudNumber%len(CloudColors)]
        drawScaledCube(CurrentCloud[0],CurrentCloud[1],CurrentCloud[2],CurrentCloud[3],CurrentCloud[4],CurrentCloud[5],CurrentCloudColor[0],CurrentCloudColor[1],CurrentCloudColor[2])


# ============================================================
# BRACU CLEAR SKY
# ============================================================

def drawBRACUClearSky():
    BRACUSkyPositionY=WorldMapLimit-12

    drawWeatherQuad((0.34,0.68,0.99),(-950,BRACUSkyPositionY,25),(950,BRACUSkyPositionY,25),(950,BRACUSkyPositionY,1650),(-950,BRACUSkyPositionY,1650))
    drawWeatherQuad((0.43,0.75,1.0),(BRACUPositionX-560,BRACUPositionY-450,925),(BRACUPositionX+560,BRACUPositionY-450,925),(BRACUPositionX+560,BRACUPositionY+380,925),(BRACUPositionX-560,BRACUPositionY+380,925))

    drawScaledCube(-430,BRACUSkyPositionY-7,760,190,22,28,0.95,0.97,1.0)
    drawScaledCube(-315,BRACUSkyPositionY-7,792,120,22,22,0.95,0.97,1.0)
    drawScaledCube(340,BRACUSkyPositionY-7,710,225,22,30,0.95,0.97,1.0)
    drawScaledCube(465,BRACUSkyPositionY-7,748,120,22,22,0.95,0.97,1.0)


# ============================================================
# FALLING RAIN + WATER SPLASHES
# ============================================================

def drawRainAndSplashEffects():
    glPointSize(3)
    glColor3f(0.74,0.84,1.0)
    glBegin(GL_POINTS)

    for CurrentRainDrop in RainDropPositions:
        if isInsideBRACUClearArea(CurrentRainDrop[0],CurrentRainDrop[1])==False:
            glVertex3f(CurrentRainDrop[0],CurrentRainDrop[1],CurrentRainDrop[2])

    glEnd()

    glPointSize(3)
    glColor3f(0.78,0.92,1.0)
    glBegin(GL_POINTS)

    for CurrentRainSplash in RainSplashList:
        RainSplashRadius=4+(CurrentRainSplash[2]*38)

        for SplashPointNumber in range(12):
            SplashPointAngle=math.radians(SplashPointNumber*30)
            glVertex3f(CurrentRainSplash[0]+math.cos(SplashPointAngle)*RainSplashRadius,CurrentRainSplash[1]+math.sin(SplashPointAngle)*RainSplashRadius,FloodWaterHeight+0.45)

    glEnd()


# ============================================================
# UPDATE FALLING RAIN + SPLASHES
# ============================================================

def updateRainDropPositions(DeltaTime):
    for CurrentRainDrop in RainDropPositions:
        CurrentRainDrop[2]=CurrentRainDrop[2]-(540*DeltaTime)

        if CurrentRainDrop[2]<FloodWaterHeight+2:
            if isInsideBRACUClearArea(CurrentRainDrop[0],CurrentRainDrop[1])==False and len(RainSplashList)<100 and random.random()<0.28:
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


# ============================================================
# WEATHER DRAWING FUNCTIONS
# ============================================================

def drawWeatherBackground():
    drawStormySky()
    drawStormClouds()
    drawBRACUClearSky()


def drawWeatherEffects():
    drawRainAndSplashEffects()

# ============================================================
# BRACU SETUP
# ============================================================

# ============================================================
# BRACU SUN AURA UPDATE
# ============================================================

def updateBRACUSunAura(DeltaTime):
    global BRACUAuraAngle

    BRACUAuraAngle=BRACUAuraAngle+(BRACUAuraSpeed*DeltaTime)

    if BRACUAuraAngle>=360:
        BRACUAuraAngle=BRACUAuraAngle-360


# ============================================================
# SUN RAY
# ============================================================

def drawRayBetweenGroundAndSun(GroundPositionX,GroundPositionY,GroundPositionZ,SunPositionX,SunPositionY,SunPositionZ):
    DifferenceX=SunPositionX-GroundPositionX
    DifferenceY=SunPositionY-GroundPositionY
    DifferenceZ=SunPositionZ-GroundPositionZ

    HorizontalDistance=math.sqrt(DifferenceX*DifferenceX+DifferenceY*DifferenceY)
    RayLength=math.sqrt(HorizontalDistance*HorizontalDistance+DifferenceZ*DifferenceZ)

    RayYawAngle=math.degrees(math.atan2(DifferenceY,DifferenceX))
    RayTiltAngle=math.degrees(math.atan2(HorizontalDistance,DifferenceZ))

    glPushMatrix()
    glColor3f(0.98,0.86,0.40)
    glTranslatef(GroundPositionX,GroundPositionY,GroundPositionZ)
    glRotatef(RayYawAngle,0,0,1)
    glRotatef(RayTiltAngle,0,1,0)
    gluCylinder(gluNewQuadric(),3,1.5,RayLength,8,8)
    glPopMatrix()


# ============================================================
# BRACU SUN + ROTATING AURA
# ============================================================

def drawBRACUSunAura():
    SunHeight=700

    glPushMatrix()
    glColor3f(1.0,0.90,0.16)
    glTranslatef(BRACUPositionX,BRACUPositionY,SunHeight)
    gluSphere(gluNewQuadric(),62,14,14)
    glPopMatrix()

    NumberOfSunRays=8
    CurrentRayRadius=390+24*math.sin(math.radians(BRACUAuraAngle*2))

    for SunRayNumber in range(NumberOfSunRays):
        SunRayAngleInRadians=math.radians(BRACUAuraAngle+(360/NumberOfSunRays)*SunRayNumber)
        GroundPositionX=BRACUPositionX+math.cos(SunRayAngleInRadians)*CurrentRayRadius
        GroundPositionY=BRACUPositionY+math.sin(SunRayAngleInRadians)*CurrentRayRadius
        drawRayBetweenGroundAndSun(GroundPositionX,GroundPositionY,24,BRACUPositionX,BRACUPositionY,SunHeight-48)

    glPointSize(8)
    glColor3f(1.0,0.90,0.30)
    glBegin(GL_POINTS)

    for GlowPointNumber in range(84):
        GlowPointAngle=math.radians(BRACUAuraAngle*1.7+GlowPointNumber*(360/84))
        GlowRingRadius=410+12*math.sin(GlowPointAngle*2)
        glVertex3f(BRACUPositionX+math.cos(GlowPointAngle)*GlowRingRadius,BRACUPositionY+math.sin(GlowPointAngle)*GlowRingRadius,22)

    glEnd()


# ============================================================
# BRACU WINDOWS
# ============================================================

def drawBRACUWindows():
    for WindowRow in range(5):
        WindowPositionZ=78+WindowRow*48

        for WindowColumn in range(7):
            drawScaledCube(BRACUPositionX-105+WindowColumn*35,BRACUPositionY-83,WindowPositionZ,20,5,24,0.08,0.17,0.22)


# ============================================================
# COMPLETE BRACU DESTINATION
# ============================================================

def drawBRACUDestination():
    CampusHeight=FloodWaterHeight+8

    # Draw sunlight first so BRACU can visually cover rays behind it
    drawBRACUSunAura()

    # Dry raised BRACU campus
    glColor3f(0.64,0.62,0.43)
    glBegin(GL_QUADS)
    glVertex3f(BRACUPositionX-BRACUHalfSize,BRACUPositionY-BRACUHalfSize,CampusHeight)
    glVertex3f(BRACUPositionX+BRACUHalfSize,BRACUPositionY-BRACUHalfSize,CampusHeight)
    glVertex3f(BRACUPositionX+BRACUHalfSize,BRACUPositionY+BRACUHalfSize,CampusHeight)
    glVertex3f(BRACUPositionX-BRACUHalfSize,BRACUPositionY+BRACUHalfSize,CampusHeight)
    glEnd()

    # Main university complex
    drawScaledCube(BRACUPositionX,BRACUPositionY+20,190,330,205,350,0.78,0.67,0.47)
    drawScaledCube(BRACUPositionX-185,BRACUPositionY+10,165,95,245,300,0.72,0.62,0.44)
    drawScaledCube(BRACUPositionX+185,BRACUPositionY+10,165,95,245,300,0.72,0.62,0.44)

    # Green vertical facade sections
    drawScaledCube(BRACUPositionX-122,BRACUPositionY-92,188,42,14,318,0.22,0.45,0.25)
    drawScaledCube(BRACUPositionX+122,BRACUPositionY-92,188,42,14,318,0.22,0.45,0.25)

    # Entrance
    drawScaledCube(BRACUPositionX,BRACUPositionY-126,70,145,70,105,0.58,0.54,0.46)

    # Entrance canopy
    drawScaledCube(BRACUPositionX,BRACUPositionY-158,122,220,92,14,0.35,0.38,0.36)

    # Roof
    drawScaledCube(BRACUPositionX,BRACUPositionY+12,372,450,295,15,0.34,0.36,0.34)

    drawBRACUWindows()

# ============================================================
# MAP AND ENVIRONMENT FEATURES
# ============================================================

# ============================================================
# 2D MINIMAP MODE
# ============================================================

def begin2DDrawing():
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

# ============================================================
# 2D RECTANGLE
# ============================================================

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
    glPushMatrix()
    glTranslatef(PositionX,PositionY,PositionZ)
    glColor3f(ObjectColor[0],ObjectColor[1],ObjectColor[2])
    glScalef(Width,Length,Height)
    glutSolidCube(1)
    glPopMatrix()

# ============================================================
# WORLD TO MINIMAP
# ============================================================

def convertWorldPositionToMinimap(PositionX,PositionY,MinimapLeft,MinimapBottom,MinimapSize):
    NormalizedPositionX=(PositionX+WorldMapLimit)/(WorldMapLimit*2)
    NormalizedPositionY=(PositionY+WorldMapLimit)/(WorldMapLimit*2)
    MinimapPositionX=MinimapLeft+NormalizedPositionX*MinimapSize
    MinimapPositionY=MinimapBottom+NormalizedPositionY*MinimapSize
    return MinimapPositionX,MinimapPositionY

# ============================================================
# MINIMAP ROADS
# ============================================================

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

# ============================================================
# MINIMAP POINT
# ============================================================

def drawMinimapPoint(WorldPositionX,WorldPositionY,MinimapLeft,MinimapBottom,MinimapSize,PointSize,PointColor):
    MinimapPositionX,MinimapPositionY=convertWorldPositionToMinimap(WorldPositionX,WorldPositionY,MinimapLeft,MinimapBottom,MinimapSize)
    glPointSize(PointSize)
    glColor3f(PointColor[0],PointColor[1],PointColor[2])
    glBegin(GL_POINTS)
    glVertex3f(MinimapPositionX,MinimapPositionY,0)
    glEnd()

# ============================================================
# REAL-TIME MINIMAP
# ============================================================

def drawRealTimeMinimap():
    begin2DDrawing()
    MinimapSize=225
    MinimapLeft=WindowWidth-MinimapSize-18
    MinimapBottom=WindowHeight-MinimapSize-18
    draw2DRectangle(MinimapLeft-7,MinimapBottom-7,MinimapLeft+MinimapSize+7,MinimapBottom+MinimapSize+7,(0.03,0.04,0.05))
    draw2DRectangle(MinimapLeft,MinimapBottom,MinimapLeft+MinimapSize,MinimapBottom+MinimapSize,(0.06,0.20,0.29))
    drawMinimapRoads(MinimapLeft,MinimapBottom,MinimapSize)
    drawMinimapPoint(BRACUPositionX,BRACUPositionY,MinimapLeft,MinimapBottom,MinimapSize,12,(1.0,0.90,0.12))
    for CurrentLandmark in LandmarkList:
        if CurrentLandmark["taken"]==False:
            drawMinimapPoint(CurrentLandmark["photo_x"],CurrentLandmark["photo_y"],MinimapLeft,MinimapBottom,MinimapSize,6,(1.0,0.55,0.12))
    if PowerOutageActive==True:
        CurrentPowerDistrict=getCurrentPowerDistrict()
        drawMinimapPoint(CurrentPowerDistrict["repair_x"],CurrentPowerDistrict["repair_y"],MinimapLeft,MinimapBottom,MinimapSize,9,(1.0,0.10,0.05))
    # Waiting student pickup locations (Nafisa - student ride system)
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="waiting":
            drawMinimapPoint(CurrentRequest["pickup_x"],CurrentRequest["pickup_y"],MinimapLeft,MinimapBottom,MinimapSize,8,(1.0,0.90,0.20))
    drawMinimapPoint(BoatPositionX,BoatPositionY,MinimapLeft,MinimapBottom,MinimapSize,11,(1.0,1.0,1.0))
    end2DDrawing()

# ============================================================
# TRIANGULAR LANDMARK FIN USING ONLY GL_QUADS
# ============================================================

def drawTriangularLandmarkFin(CenterPositionX,CenterPositionY,BaseHeight,FinWidth,FinDepth,FinHeight,FinColor):
    HalfFinWidth=FinWidth*0.5
    HalfFinDepth=FinDepth*0.5
    TopHalfWidth=1.5
    TopHeight=BaseHeight+FinHeight
    glColor3f(FinColor[0],FinColor[1],FinColor[2])
    glBegin(GL_QUADS)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+TopHalfWidth,CenterPositionY+HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX-TopHalfWidth,CenterPositionY+HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX-TopHalfWidth,CenterPositionY-HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX+TopHalfWidth,CenterPositionY-HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX-TopHalfWidth,CenterPositionY+HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX-TopHalfWidth,CenterPositionY-HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+TopHalfWidth,CenterPositionY-HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX+TopHalfWidth,CenterPositionY+HalfFinDepth,TopHeight)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY-HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX+HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glVertex3f(CenterPositionX-HalfFinWidth,CenterPositionY+HalfFinDepth,BaseHeight)
    glEnd()

# ============================================================
# NATIONAL MARTYRS' MONUMENT
# ============================================================

def drawNationalMartyrsMonument():
    LandmarkPositionX=-825
    LandmarkPositionY=1350
    LandmarkBaseHeight=FloodWaterHeight+8
    drawSimpleCube(LandmarkPositionX,LandmarkPositionY,LandmarkBaseHeight,300,130,10,(0.76,0.75,0.73))
    MonumentFinInformation=[
        [-150,105,18,92],
        [-112,145,18,130],
        [-74,185,18,170],
        [-38,235,18,225],
        [0,290,20,300],
        [38,235,18,225],
        [74,185,18,170],
        [112,145,18,130],
        [150,105,18,92]
    ]
    for CurrentFin in MonumentFinInformation:
        drawTriangularLandmarkFin(LandmarkPositionX+CurrentFin[0],LandmarkPositionY,LandmarkBaseHeight+5,CurrentFin[1],CurrentFin[2],CurrentFin[3],(0.93,0.93,0.92))
    drawTriangularLandmarkFin(LandmarkPositionX,LandmarkPositionY+2,LandmarkBaseHeight+5,42,20,225,(0.88,0.84,0.84))

# ============================================================
# SHAHEED MINAR
# ============================================================

def drawShaheedMinar():
    LandmarkPositionX=825
    LandmarkPositionY=1350
    drawSimpleCube(LandmarkPositionX,LandmarkPositionY,FloodWaterHeight+8,260,140,16,(0.54,0.28,0.16))
    drawSimpleCube(LandmarkPositionX,LandmarkPositionY,FloodWaterHeight+16,220,100,10,(0.86,0.85,0.84))
    glPushMatrix()
    glTranslatef(LandmarkPositionX,LandmarkPositionY-8,FloodWaterHeight+132)
    glColor3f(0.90,0.10,0.13)
    glScalef(84,10,84)
    gluSphere(gluNewQuadric(),1,18,18)
    glPopMatrix()
    FrameInformation=[[-118,96],[-58,160],[0,210],[58,160],[118,96]]
    for CurrentFrame in FrameInformation:
        FrameOffsetX=CurrentFrame[0]
        FrameHeight=CurrentFrame[1]
        FrameColor=(0.96,0.96,0.95)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX-10,LandmarkPositionY,FloodWaterHeight+16+FrameHeight*0.5,10,18,FrameHeight,FrameColor)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX+10,LandmarkPositionY,FloodWaterHeight+16+FrameHeight*0.5,10,18,FrameHeight,FrameColor)
        drawSimpleCube(LandmarkPositionX+FrameOffsetX,LandmarkPositionY,FloodWaterHeight+16+FrameHeight,36,18,10,FrameColor)

# ============================================================
# LANDMARK SELECTOR
# ============================================================

def drawLandmarkWorldObject(LandmarkInformation):
    if LandmarkInformation["name"]=="National Martyrs' Monument":
        drawNationalMartyrsMonument()
    elif LandmarkInformation["name"]=="Shaheed Minar":
        drawShaheedMinar()

# ============================================================
# PHOTO SPOT
# ============================================================

def drawLandmarkPhotoSpot(LandmarkInformation):
    if LandmarkInformation["taken"]==True:
        PhotoSpotColor=(0.25,0.85,0.30)
    else:
        PhotoSpotColor=(1.0,0.47,0.08)
    drawSimpleCube(LandmarkInformation["photo_x"],LandmarkInformation["photo_y"],FloodWaterHeight+3.5,68,68,7,PhotoSpotColor)

# ============================================================
# PHOTO CHALLENGE HELPERS
# ============================================================

def calculate2DDistance(FirstPositionX,FirstPositionY,SecondPositionX,SecondPositionY):
    DifferenceX=SecondPositionX-FirstPositionX
    DifferenceY=SecondPositionY-FirstPositionY
    return math.sqrt(DifferenceX*DifferenceX+DifferenceY*DifferenceY)

def calculateAngleDifference(FirstAngle,SecondAngle):
    AngleDifference=(FirstAngle-SecondAngle+180)%360-180
    return abs(AngleDifference)

# ============================================================
# FEATURE 2 - LANDMARK PHOTO CHALLENGE
# ============================================================

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
        print("Photo captured:",ClosestLandmark["name"],CompletedPhotoCount,"/",len(LandmarkList))
    else:
        print("Face the landmark, then press P")

def drawPhotoFeedback():
    if PhotoFlashTimer<=0 and PhotoPopupTimer<=0:
        return
    begin2DDrawing()
    if PhotoFlashTimer>2.82:
        draw2DRectangle(0,0,WindowWidth,WindowHeight,(1.0,1.0,1.0))
        draw2DText(WindowWidth*0.5-85,WindowHeight-70,"SNAP! PHOTO TAKEN",(0.10,0.10,0.10))
    if PhotoPopupTimer>0 and PhotoPopupTitle!="":
        draw2DRectangle(355,450,970,765,(0.03,0.05,0.07))
        draw2DRectangle(365,460,960,755,(0.08,0.14,0.18))
        draw2DText(390,718,PhotoPopupTitle,(1.0,0.92,0.45))
        TextPositionY=675
        for CurrentLine in PhotoPopupLines:
            draw2DText(390,TextPositionY,CurrentLine,(0.92,0.96,1.0))
            TextPositionY=TextPositionY-34
        draw2DText(390,492,"Historical landmark photo registered.",(0.55,1.0,0.70))
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

# ============================================================
# FEATURE 3 - FLOOD TRAFFIC SIGNAL
# ============================================================

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
    global TrafficSafeX,TrafficSafeY,BoatPositionX,BoatPositionY,TrafficViolations,TrafficViolationMessageTimer,TrafficWasInside
    BoatInsideTrafficZone=isBoatInsideTrafficZone()
    if BoatInsideTrafficZone==False:
        TrafficSafeX=BoatPositionX
        TrafficSafeY=BoatPositionY
    if BoatInsideTrafficZone==True and TrafficWasInside==False and TrafficState=="RED":
        BoatPositionX=TrafficSafeX
        BoatPositionY=TrafficSafeY
        TrafficViolations=TrafficViolations+1
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
    gluCylinder(gluNewQuadric(),5,4,145,10,8)
    glPopMatrix()
    glPushMatrix()
    glTranslatef(145,-55,FloodWaterHeight+148)
    if TrafficState=="GREEN":
        glColor3f(0.05,1.0,0.15)
    else:
        glColor3f(1.0,0.05,0.05)
    gluSphere(gluNewQuadric(),22,12,10)
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

# ============================================================
# FEATURE 4 - WINDSHIELD WIPER SYSTEM
# ============================================================

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
    InsideBRACURainFreeArea=DistanceFromBRACU<=BRACUHalfSize+40
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
    # Screen-space rain droplets
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
    # Windshield wiper
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

# ============================================================
# FEATURE 5 - CITY BLACKOUT AND POWER RESTORATION
# ============================================================

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
    # Main electrical box
    drawSimpleCube(RepairPositionX,RepairPositionY,FloodWaterHeight+24,36,32,48,(0.20,0.23,0.24))
    # Front control panel
    if IsActiveRepairStation==True:
        PanelColor=(0.85,0.08,0.05)
    else:
        PanelColor=(0.08,0.55,0.15)
    drawSimpleCube(RepairPositionX,RepairPositionY-18,FloodWaterHeight+25,22,5,24,PanelColor)
    # Indicator light
    glPushMatrix()
    glTranslatef(RepairPositionX,RepairPositionY,FloodWaterHeight+53)
    if IsActiveRepairStation==True:
        glColor3f(1.0,0.08,0.04)
    else:
        glColor3f(0.10,0.85,0.20)
    gluSphere(gluNewQuadric(),7,8,8)
    glPopMatrix()

def drawPowerSystemFeedback():
    if PowerOutageActive==True:
        CurrentDistrict=getCurrentPowerDistrict()
        begin2DDrawing()
        draw2DRectangle(18,700,430,785,(0.07,0.03,0.03))
        draw2DRectangle(25,707,423,778,(0.22,0.04,0.04))
        draw2DText(38,750,"POWER OUTAGE - "+CurrentDistrict["name"]+" DISTRICT",(1.0,0.82,0.20))
        draw2DText(38,720,"Find the red repair box and press F",(1.0,1.0,1.0))
        end2DDrawing()
    elif PowerRestoreMessageTimer>0:
        begin2DDrawing()
        draw2DRectangle(18,715,400,780,(0.03,0.12,0.05))
        draw2DRectangle(25,722,393,773,(0.04,0.28,0.09))
        draw2DText(45,746,"POWER RESTORED - "+PowerRestoredDistrictName+" DISTRICT",(0.75,1.0,0.75))
        end2DDrawing()

# ============================================================
# CITY SETUP
# ============================================================

# ============================================================
# BUILDINGS AND CARS
# ============================================================

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
    (0.54,0.55,0.58),
    (0.62,0.53,0.45),
    (0.47,0.55,0.51),
    (0.56,0.48,0.55),
    (0.50,0.48,0.42)
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


# ============================================================
# BASIC HELPERS
# ============================================================

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

    BRACUBlocks=[
        [BRACUPositionX,BRACUPositionY+20,165,102.5,365],
        [BRACUPositionX-185,BRACUPositionY+10,47.5,122.5,315],
        [BRACUPositionX+185,BRACUPositionY+10,47.5,122.5,315],
        [BRACUPositionX,BRACUPositionY-126,72.5,35,122.5]
    ]

    for CurrentBRACUBlock in BRACUBlocks:
        if isRectangleBlockingView(TargetPositionX,TargetPositionY,TargetPositionZ,CurrentBRACUBlock[0],CurrentBRACUBlock[1],CurrentBRACUBlock[2],CurrentBRACUBlock[3],FloodWaterHeight-5,CurrentBRACUBlock[4]+8)==True:
            return True

    return False


def isObjectVisibleFromCamera(TargetPositionX,TargetPositionY,TargetPositionZ):
    return isObjectHiddenByBuilding(TargetPositionX,TargetPositionY,TargetPositionZ)==False


def getCityBlockRanges(RoadPositions,HalfRoadWidth):
    BlockRanges=[]
    PreviousBlockStart=-WorldMapLimit

    for RoadPosition in RoadPositions:
        BlockRanges.append([PreviousBlockStart,RoadPosition-HalfRoadWidth])
        PreviousBlockStart=RoadPosition+HalfRoadWidth

    BlockRanges.append([PreviousBlockStart,WorldMapLimit])
    return BlockRanges


# ============================================================
# FLOODED CITY AND ROADS
# ============================================================

def drawSubmergedCityBlocks():
    CityBlockColor=(0.18,0.38,0.30)
    CityBlockHeight=FloodWaterHeight+0.025
    HalfRoadWidth=RoadWidth/2
    VerticalBlockRanges=getCityBlockRanges(VerticalRoadPositions,HalfRoadWidth)
    HorizontalBlockRanges=getCityBlockRanges(HorizontalRoadPositions,HalfRoadWidth)

    glColor3f(CityBlockColor[0],CityBlockColor[1],CityBlockColor[2])

    for CurrentXRange in VerticalBlockRanges:
        for CurrentYRange in HorizontalBlockRanges:
            glBegin(GL_QUADS)
            glVertex3f(CurrentXRange[0],CurrentYRange[0],CityBlockHeight)
            glVertex3f(CurrentXRange[1],CurrentYRange[0],CityBlockHeight)
            glVertex3f(CurrentXRange[1],CurrentYRange[1],CityBlockHeight)
            glVertex3f(CurrentXRange[0],CurrentYRange[1],CityBlockHeight)
            glEnd()


def drawSubmergedRoadClues():
    HalfRoadWidth=RoadWidth/2
    RoadWaterColor=(0.10,0.35,0.46)
    LaneWaterColor=(0.34,0.50,0.52)
    RoadHeight=FloodWaterHeight+0.035
    LaneHeight=FloodWaterHeight+0.055

    for RoadPositionX in VerticalRoadPositions:
        glColor3f(RoadWaterColor[0],RoadWaterColor[1],RoadWaterColor[2])
        glBegin(GL_QUADS)
        glVertex3f(RoadPositionX-HalfRoadWidth,-WorldMapLimit,RoadHeight)
        glVertex3f(RoadPositionX+HalfRoadWidth,-WorldMapLimit,RoadHeight)
        glVertex3f(RoadPositionX+HalfRoadWidth,WorldMapLimit,RoadHeight)
        glVertex3f(RoadPositionX-HalfRoadWidth,WorldMapLimit,RoadHeight)
        glEnd()

        LanePositionY=-WorldMapLimit+95
        while LanePositionY<WorldMapLimit:
            glColor3f(LaneWaterColor[0],LaneWaterColor[1],LaneWaterColor[2])
            glBegin(GL_QUADS)
            glVertex3f(RoadPositionX-3.2,LanePositionY,LaneHeight)
            glVertex3f(RoadPositionX+3.2,LanePositionY,LaneHeight)
            glVertex3f(RoadPositionX+3.2,LanePositionY+44,LaneHeight)
            glVertex3f(RoadPositionX-3.2,LanePositionY+44,LaneHeight)
            glEnd()
            LanePositionY=LanePositionY+170

    for RoadPositionY in HorizontalRoadPositions:
        glColor3f(RoadWaterColor[0],RoadWaterColor[1],RoadWaterColor[2])
        glBegin(GL_QUADS)
        glVertex3f(-WorldMapLimit,RoadPositionY-HalfRoadWidth,RoadHeight)
        glVertex3f(WorldMapLimit,RoadPositionY-HalfRoadWidth,RoadHeight)
        glVertex3f(WorldMapLimit,RoadPositionY+HalfRoadWidth,RoadHeight)
        glVertex3f(-WorldMapLimit,RoadPositionY+HalfRoadWidth,RoadHeight)
        glEnd()

        LanePositionX=-WorldMapLimit+95
        while LanePositionX<WorldMapLimit:
            glColor3f(LaneWaterColor[0],LaneWaterColor[1],LaneWaterColor[2])
            glBegin(GL_QUADS)
            glVertex3f(LanePositionX,RoadPositionY-3.2,LaneHeight)
            glVertex3f(LanePositionX+44,RoadPositionY-3.2,LaneHeight)
            glVertex3f(LanePositionX+44,RoadPositionY+3.2,LaneHeight)
            glVertex3f(LanePositionX,RoadPositionY+3.2,LaneHeight)
            glEnd()
            LanePositionX=LanePositionX+170


def drawWaterSurfaceReflections():
    ReflectionMovement=math.sin(WaterAnimationPhase)*18

    glPointSize(3)
    glColor3f(0.73,0.90,1.0)
    glBegin(GL_POINTS)

    for RoadPositionX in VerticalRoadPositions:
        ReflectionPositionY=-WorldMapLimit+70
        while ReflectionPositionY<WorldMapLimit:
            glVertex3f(RoadPositionX-RoadWidth*0.32,ReflectionPositionY+ReflectionMovement,FloodWaterHeight+0.16)
            glVertex3f(RoadPositionX+RoadWidth*0.28,ReflectionPositionY+43-ReflectionMovement,FloodWaterHeight+0.16)
            ReflectionPositionY=ReflectionPositionY+190

    for RoadPositionY in HorizontalRoadPositions:
        ReflectionPositionX=-WorldMapLimit+70
        while ReflectionPositionX<WorldMapLimit:
            glVertex3f(ReflectionPositionX+ReflectionMovement,RoadPositionY-RoadWidth*0.30,FloodWaterHeight+0.17)
            glVertex3f(ReflectionPositionX+47-ReflectionMovement,RoadPositionY+RoadWidth*0.27,FloodWaterHeight+0.17)
            ReflectionPositionX=ReflectionPositionX+190

    glEnd()


def drawFloodedRoadEnvironment():
    drawSubmergedCityBlocks()
    drawSubmergedRoadClues()
    drawWaterSurfaceReflections()


# ============================================================
# BUILDINGS
# ============================================================

def drawBuildingFrontWindow(PositionX,PositionY,PositionZ,WindowWidth=28,WindowHeight=22,WindowColor=(0.08,0.16,0.22)):
    drawScaledCube(PositionX,PositionY,PositionZ,WindowWidth,5,WindowHeight,WindowColor[0],WindowColor[1],WindowColor[2])


def drawBuildingSideWindow(PositionX,PositionY,PositionZ,WindowWidth=28,WindowHeight=22,WindowColor=(0.08,0.16,0.22)):
    drawScaledCube(PositionX,PositionY,PositionZ,5,WindowWidth,WindowHeight,WindowColor[0],WindowColor[1],WindowColor[2])


def drawSingleBuilding(BuildingInformation,BuildingColor):
    BuildingPositionX,BuildingPositionY,BuildingHalfWidth,BuildingHalfLength,BuildingHeight=BuildingInformation
    CameraPositionX=CameraPosition[0]
    CameraPositionY=CameraPosition[1]

    if isPositionInsideBlackoutDistrict(BuildingPositionX)==True:
        BuildingWindowColor=(0.015,0.02,0.025)
    else:
        BuildingWindowColor=(0.08,0.16,0.22)

    BuildingBottomHeight=FloodWaterHeight-18
    BuildingBodyHeight=BuildingHeight-BuildingBottomHeight
    BuildingCenterHeight=BuildingBottomHeight+BuildingBodyHeight/2
    drawScaledCube(BuildingPositionX,BuildingPositionY,BuildingCenterHeight,BuildingHalfWidth*2,BuildingHalfLength*2,BuildingBodyHeight,BuildingColor[0],BuildingColor[1],BuildingColor[2])

    if CameraPositionY<=BuildingPositionY:
        WindowFacePositionY=BuildingPositionY-BuildingHalfLength-2
    else:
        WindowFacePositionY=BuildingPositionY+BuildingHalfLength+2

    if CameraPositionX<=BuildingPositionX:
        WindowFacePositionX=BuildingPositionX-BuildingHalfWidth-2
    else:
        WindowFacePositionX=BuildingPositionX+BuildingHalfWidth+2

    NumberOfWindowRows=4
    NumberOfWindowColumns=3

    for WindowRow in range(NumberOfWindowRows):
        WindowPositionZ=45+WindowRow*((BuildingHeight-70)/max(NumberOfWindowRows-1,1))

        for WindowColumn in range(NumberOfWindowColumns):
            FrontWindowOffset=(WindowColumn-1)*(BuildingHalfWidth*0.58)
            SideWindowOffset=(WindowColumn-1)*(BuildingHalfLength*0.58)
            FrontWindowWidth=min(34,BuildingHalfWidth*0.28)
            SideWindowWidth=min(34,BuildingHalfLength*0.28)
            drawBuildingFrontWindow(BuildingPositionX+FrontWindowOffset,WindowFacePositionY,WindowPositionZ,FrontWindowWidth,25,BuildingWindowColor)
            drawBuildingSideWindow(WindowFacePositionX,BuildingPositionY+SideWindowOffset,WindowPositionZ,SideWindowWidth,25,BuildingWindowColor)


# ============================================================
# CARS
# ============================================================

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


def drawSingleSubmergedCar(CarPositionX,CarPositionY,CarRotationAngle):
    CarBodyColor=(0.60,0.60,0.62)
    CarCabinColor=(0.65,0.65,0.67)
    CarWindowColor=(0.18,0.20,0.23)
    CarWheelColor=(0.08,0.08,0.10)
    CarHeadlightColor=(0.92,0.92,0.88)

    glPushMatrix()
    glTranslatef(CarPositionX,CarPositionY,FloodWaterHeight-1)
    glRotatef(CarRotationAngle,0,0,1)

    drawScaledCube(0,0,5,82,34,14,CarBodyColor[0],CarBodyColor[1],CarBodyColor[2])
    drawScaledCube(20,0,10,22,28,6,CarBodyColor[0],CarBodyColor[1],CarBodyColor[2])
    drawScaledCube(-10,0,17,34,28,10,CarCabinColor[0],CarCabinColor[1],CarCabinColor[2])
    drawScaledCube(2,0,18,10,24,2,CarWindowColor[0],CarWindowColor[1],CarWindowColor[2])
    drawScaledCube(-14,0,18,14,24,2,CarWindowColor[0],CarWindowColor[1],CarWindowColor[2])
    drawScaledCube(-27,0,15.5,6,18,2,CarWindowColor[0],CarWindowColor[1],CarWindowColor[2])
    drawScaledCube(41,-8,6,2,4,3,CarHeadlightColor[0],CarHeadlightColor[1],CarHeadlightColor[2])
    drawScaledCube(41,8,6,2,4,3,CarHeadlightColor[0],CarHeadlightColor[1],CarHeadlightColor[2])

    if abs(CarRotationAngle-90)<0.1:
        VisibleCarWheelSide=-16 if BoatPositionX<CarPositionX else 16
    else:
        VisibleCarWheelSide=-16 if BoatPositionY<CarPositionY else 16

    drawScaledCube(-20,VisibleCarWheelSide,2,10,3,5,CarWheelColor[0],CarWheelColor[1],CarWheelColor[2])
    drawScaledCube(20,VisibleCarWheelSide,2,10,3,5,CarWheelColor[0],CarWheelColor[1],CarWheelColor[2])
    glPopMatrix()


# ============================================================
# STREET LIGHTS
# ============================================================

def getStreetLightPositions():
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

    return FilteredStreetLightPositions


def drawStreetLight(PositionX,PositionY):
    glPushMatrix()
    glColor3f(0.22,0.22,0.23)
    glTranslatef(PositionX,PositionY,FloodWaterHeight-7)
    gluCylinder(gluNewQuadric(),3.5,2.5,100,8,8)
    glPopMatrix()

    if isPositionInsideBlackoutDistrict(PositionX)==True:
        StreetLightColor=(0.025,0.025,0.025)
    else:
        StreetLightColor=(1.0,0.82,0.30)

    glPushMatrix()
    glColor3f(StreetLightColor[0],StreetLightColor[1],StreetLightColor[2])
    glTranslatef(PositionX,PositionY,FloodWaterHeight+95)
    gluSphere(gluNewQuadric(),8,8,8)
    glPopMatrix()


# ============================================================
# COMPLETE CITY DRAWING
# ============================================================

def drawCityEnvironment():
    CityDrawingList=[]

    for BuildingNumber in range(len(BuildingList)):
        CurrentBuilding=BuildingList[BuildingNumber]
        CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentBuilding[0],CurrentBuilding[1]),"building",BuildingNumber,CurrentBuilding])

    for CurrentCar in getSubmergedCarPositions():
        CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentCar[0],CurrentCar[1]),"car",0,CurrentCar])

    for CurrentStreetLight in getStreetLightPositions():
        CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentStreetLight[0],CurrentStreetLight[1]),"light",0,CurrentStreetLight])

    for LandmarkNumber in range(len(LandmarkList)):
        CurrentLandmark=LandmarkList[LandmarkNumber]
        CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentLandmark["x"],CurrentLandmark["y"]),"landmark",LandmarkNumber,CurrentLandmark])
        CityDrawingList.append([calculateObjectDistanceFromCamera(CurrentLandmark["photo_x"],CurrentLandmark["photo_y"]),"photo",LandmarkNumber,CurrentLandmark])

    CityDrawingList.append([calculateObjectDistanceFromCamera(145,-55),"traffic",0,None])

    for PowerDistrictNumber in range(len(PowerDistrictList)):
        CurrentPowerDistrict=PowerDistrictList[PowerDistrictNumber]
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
            if isObjectVisibleFromCamera(CarInformation[0],CarInformation[1],FloodWaterHeight+18)==True:
                drawSingleSubmergedCar(CarInformation[0],CarInformation[1],CarInformation[2])

        elif CurrentObjectType=="light":
            StreetLightInformation=CurrentItem[3]
            if isObjectVisibleFromCamera(StreetLightInformation[0],StreetLightInformation[1],FloodWaterHeight+70)==True:
                drawStreetLight(StreetLightInformation[0],StreetLightInformation[1])

        elif CurrentObjectType=="landmark":
            LandmarkInformation=CurrentItem[3]
            if LandmarkInformation["name"]=="National Martyrs' Monument":
                LandmarkVisibilityHeight=FloodWaterHeight+150
            else:
                LandmarkVisibilityHeight=FloodWaterHeight+120

            if isObjectVisibleFromCamera(LandmarkInformation["x"],LandmarkInformation["y"],LandmarkVisibilityHeight)==True:
                drawLandmarkWorldObject(LandmarkInformation)

        elif CurrentObjectType=="photo":
            LandmarkInformation=CurrentItem[3]
            if isObjectVisibleFromCamera(LandmarkInformation["photo_x"],LandmarkInformation["photo_y"],FloodWaterHeight+5)==True:
                drawLandmarkPhotoSpot(LandmarkInformation)

        elif CurrentObjectType=="traffic":
            if isObjectVisibleFromCamera(145,-55,FloodWaterHeight+80)==True:
                drawFloodTrafficSignal()

        elif CurrentObjectType=="powerstation":
            PowerDistrictInformation=CurrentItem[3]
            if isObjectVisibleFromCamera(PowerDistrictInformation["repair_x"],PowerDistrictInformation["repair_y"],FloodWaterHeight+35)==True:
                drawPowerRepairStation(PowerDistrictInformation)


def drawCityBuildings():
    drawCityEnvironment()

# ============================================================
# ============================================================
# MEMBER 2 - NAFISA LUBABA
# STUDENT RIDE SYSTEM
# Features:
#   1) Ride request generation
#   2) Accept / reject and active ride queue
#   3) Independent student deadlines
#   4) Boarding and passenger capacity 
#   5) Delivery and failure resolution at BRACU
# ============================================================
# ============================================================

# Predefined students who may request a ride
StudentNamePool=["Adittya","Nafisa","Usaeed","Rafi","Tania","Sabbir","Mitu","Zayan","Ria","Faiaz","Nusrat","Tanvir","Samin","Oindrila"]

# Predefined pickup locations placed on clear road intersections
RidePickupLocations=[
    {"name":"Mohakhali","x":-1100,"y":-600},
    {"name":"Banani","x":-550,"y":500},
    {"name":"Gulshan","x":0,"y":500},
    {"name":"Badda","x":550,"y":-50},
    {"name":"Rampura","x":1100,"y":-600},
    {"name":"Mirpur","x":-550,"y":-1150},
    {"name":"Uttara","x":550,"y":1050}
]

# Ride system tuning values
RideMaximumOnboard=3
RideMaximumActiveQueue=4
RidePickupRadius=95
RideDeadlineMinimum=55
RideDeadlineMaximum=90
RideOfferDuration=14
RideSpawnInterval=5

# Ride system state
IncomingRideRequest=None
ActiveRideRequests=[]
RideSpawnTimer=0

StudentsDeliveredCount=0
StudentsFailedCount=0

RideMessageText=""
RideMessageColor=(1,1,1)
RideMessageTimer=0


# ============================================================
# RIDE SYSTEM HELPERS
# ============================================================

def getOnboardStudentCount():
    OnboardCount=0
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="onboard":
            OnboardCount=OnboardCount+1
    return OnboardCount

def getUsedPickupNames():
    UsedPickupNames=[]
    for CurrentRequest in ActiveRideRequests:
        UsedPickupNames.append(CurrentRequest["pickup_name"])
    if IncomingRideRequest!=None:
        UsedPickupNames.append(IncomingRideRequest["pickup_name"])
    return UsedPickupNames


# ============================================================
# FEATURE 1 - RIDE REQUEST GENERATION
# ============================================================

def generateNewRideRequest():
    global IncomingRideRequest
    UsedPickupNames=getUsedPickupNames()
    AvailablePickups=[]
    for CurrentPickup in RidePickupLocations:
        if CurrentPickup["name"] not in UsedPickupNames:
            AvailablePickups.append(CurrentPickup)
    if len(AvailablePickups)==0:
        return
    ChosenPickup=random.choice(AvailablePickups)
    ChosenStudentName=random.choice(StudentNamePool)
    ChosenDeadline=random.randint(RideDeadlineMinimum,RideDeadlineMaximum)
    IncomingRideRequest={
        "name":ChosenStudentName,
        "pickup_name":ChosenPickup["name"],
        "pickup_x":ChosenPickup["x"],
        "pickup_y":ChosenPickup["y"],
        "deadline":ChosenDeadline,
        "offer_timer":RideOfferDuration
    }


# ============================================================
# FEATURE 2 - ACCEPT / REJECT AND ACTIVE RIDE QUEUE
# ============================================================

def acceptIncomingRide():
    global IncomingRideRequest,RideMessageText,RideMessageColor,RideMessageTimer
    if IncomingRideRequest==None:
        return
    if len(ActiveRideRequests)>=RideMaximumActiveQueue:
        RideMessageText="Ride queue full ("+str(RideMaximumActiveQueue)+") - deliver students first"
        RideMessageColor=(1.0,0.75,0.20)
        RideMessageTimer=2.5
        return
    NewActiveRequest={
        "name":IncomingRideRequest["name"],
        "pickup_name":IncomingRideRequest["pickup_name"],
        "pickup_x":IncomingRideRequest["pickup_x"],
        "pickup_y":IncomingRideRequest["pickup_y"],
        "state":"waiting",
        "remaining_time":float(IncomingRideRequest["deadline"])
    }
    ActiveRideRequests.append(NewActiveRequest)
    RideMessageText="Accepted "+NewActiveRequest["name"]+" - pickup at "+NewActiveRequest["pickup_name"]
    RideMessageColor=(0.60,1.0,0.70)
    RideMessageTimer=2.5
    IncomingRideRequest=None

def rejectIncomingRide():
    global IncomingRideRequest,RideMessageText,RideMessageColor,RideMessageTimer
    if IncomingRideRequest==None:
        return
    RideMessageText="Rejected ride from "+IncomingRideRequest["pickup_name"]
    RideMessageColor=(1.0,0.70,0.70)
    RideMessageTimer=2.0
    IncomingRideRequest=None


# ============================================================
# RIDE SYSTEM UPDATE (FEATURES 1,2,3,4,5)
# ============================================================

def updateStudentRideSystem(DeltaTime):
    global IncomingRideRequest,RideSpawnTimer,StudentsDeliveredCount,StudentsFailedCount
    global RideMessageText,RideMessageColor,RideMessageTimer

    # Feature 1 - spawn a new incoming request over time when there is room
    if IncomingRideRequest==None and len(ActiveRideRequests)<RideMaximumActiveQueue:
        RideSpawnTimer=RideSpawnTimer+DeltaTime
        if RideSpawnTimer>=RideSpawnInterval:
            RideSpawnTimer=0
            generateNewRideRequest()
    else:
        RideSpawnTimer=0

    # Feature 2 - an ignored incoming offer is withdrawn after a while
    if IncomingRideRequest!=None:
        IncomingRideRequest["offer_timer"]=IncomingRideRequest["offer_timer"]-DeltaTime
        if IncomingRideRequest["offer_timer"]<=0:
            IncomingRideRequest=None

    # Feature 4 - boarding after reaching the pickup, only when space is free
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="waiting":
            DistanceToPickup=calculate2DDistance(BoatPositionX,BoatPositionY,CurrentRequest["pickup_x"],CurrentRequest["pickup_y"])
            if DistanceToPickup<=RidePickupRadius and getOnboardStudentCount()<RideMaximumOnboard:
                CurrentRequest["state"]="onboard"
                RideMessageText=CurrentRequest["name"]+" boarded the boat"
                RideMessageColor=(0.50,0.90,1.0)
                RideMessageTimer=2.5

    # Feature 5 - reaching BRACU delivers every onboard student
    DistanceToBRACU=calculate2DDistance(BoatPositionX,BoatPositionY,BRACUPositionX,BRACUPositionY)
    if DistanceToBRACU<=BRACUHalfSize+120:
        DeliveredThisFrame=0
        for CurrentRequest in ActiveRideRequests:
            if CurrentRequest["state"]=="onboard":
                CurrentRequest["state"]="delivered"
                StudentsDeliveredCount=StudentsDeliveredCount+1
                DeliveredThisFrame=DeliveredThisFrame+1
        if DeliveredThisFrame>0:
            RideMessageText="Delivered "+str(DeliveredThisFrame)+" student(s) to BRACU!"
            RideMessageColor=(0.70,1.0,0.60)
            RideMessageTimer=3.0

    # Feature 3 - each active request counts down independently and can fail
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="waiting" or CurrentRequest["state"]=="onboard":
            CurrentRequest["remaining_time"]=CurrentRequest["remaining_time"]-DeltaTime
            if CurrentRequest["remaining_time"]<=0:
                CurrentRequest["remaining_time"]=0
                CurrentRequest["state"]="failed"
                StudentsFailedCount=StudentsFailedCount+1
                RideMessageText=CurrentRequest["name"]+" missed the deadline!"
                RideMessageColor=(1.0,0.50,0.45)
                RideMessageTimer=3.0

    # Feature 5 - keep only unresolved rides; delivered/failed leave the queue
    RemainingRequests=[]
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="waiting" or CurrentRequest["state"]=="onboard":
            RemainingRequests.append(CurrentRequest)
    ActiveRideRequests[:]=RemainingRequests

    # Fade the transient ride message
    if RideMessageTimer>0:
        RideMessageTimer=RideMessageTimer-DeltaTime
        if RideMessageTimer<0:
            RideMessageTimer=0


# ============================================================
# RIDE SYSTEM WORLD MARKERS (waiting pickups)
# ============================================================

def drawRidePickupMarker(PickupPositionX,PickupPositionY):
    # Floating base pad
    drawSimpleCube(PickupPositionX,PickupPositionY,FloodWaterHeight+4,60,60,6,(0.95,0.80,0.10))
    # Pole
    glPushMatrix()
    glColor3f(0.15,0.15,0.16)
    glTranslatef(PickupPositionX,PickupPositionY,FloodWaterHeight+4)
    gluCylinder(gluNewQuadric(),4,3,90,10,8)
    glPopMatrix()
    # Glowing beacon on top
    glPushMatrix()
    glColor3f(1.0,0.85,0.15)
    glTranslatef(PickupPositionX,PickupPositionY,FloodWaterHeight+96)
    gluSphere(gluNewQuadric(),12,10,10)
    glPopMatrix()
    # Small pickup flag
    drawSimpleCube(PickupPositionX+18,PickupPositionY,FloodWaterHeight+80,30,4,20,(0.90,0.20,0.20))

def drawStudentRidePickups():
    for CurrentRequest in ActiveRideRequests:
        if CurrentRequest["state"]=="waiting":
            drawRidePickupMarker(CurrentRequest["pickup_x"],CurrentRequest["pickup_y"])


# ============================================================
# RIDE SYSTEM HUD (2D overlay)
# ============================================================

def drawStudentRideHUD():
    begin2DDrawing()

    # Incoming ride offer (bottom center)
    if IncomingRideRequest!=None:
        draw2DRectangle(322,92,678,236,(0.03,0.05,0.08))
        draw2DRectangle(330,100,670,228,(0.09,0.16,0.24))
        draw2DText(352,200,"NEW RIDE REQUEST",(1.0,0.90,0.35))
        draw2DText(352,170,"Student: "+IncomingRideRequest["name"],(0.95,0.98,1.0))
        draw2DText(352,144,"Pickup: "+IncomingRideRequest["pickup_name"],(0.80,0.92,1.0))
        draw2DText(352,118,"Deadline: "+str(IncomingRideRequest["deadline"])+"s",(0.80,0.92,1.0))
        draw2DText(520,144,"[Y] Accept",(0.55,1.0,0.60))
        draw2DText(520,118,"[N] Reject",(1.0,0.60,0.55))

    # Active ride queue (left side)
    ListHeaderY=684
    draw2DText(20,ListHeaderY,"ACTIVE RIDES  (Onboard "+str(getOnboardStudentCount())+"/"+str(RideMaximumOnboard)+")",(1.0,0.92,0.55))
    if len(ActiveRideRequests)==0:
        draw2DText(20,ListHeaderY-28,"No active rides - wait for a request",(0.75,0.80,0.85))
    else:
        RowPositionY=ListHeaderY-28
        for CurrentRequest in ActiveRideRequests:
            RemainingSeconds=int(CurrentRequest["remaining_time"])
            if CurrentRequest["state"]=="onboard":
                RowColor=(0.55,0.90,1.0)
                StateLabel="onboard"
            else:
                RowColor=(1.0,0.85,0.55)
                StateLabel="waiting @ "+CurrentRequest["pickup_name"]
            if RemainingSeconds<=10:
                TimeColor=(1.0,0.35,0.30)
            else:
                TimeColor=RowColor
            draw2DText(20,RowPositionY,CurrentRequest["name"]+" - "+StateLabel,RowColor)
            draw2DText(360,RowPositionY,str(RemainingSeconds)+"s",TimeColor)
            RowPositionY=RowPositionY-28

    # Delivered / failed counters (bottom left)
    draw2DText(20,52,"Delivered: "+str(StudentsDeliveredCount),(0.65,1.0,0.65))
    draw2DText(20,26,"Failed: "+str(StudentsFailedCount),(1.0,0.65,0.60))

    # Transient ride message (center)
    if RideMessageTimer>0 and RideMessageText!="":
        draw2DRectangle(250,286,750,326,(0.04,0.06,0.09))
        draw2DText(268,298,RideMessageText,RideMessageColor)

    end2DDrawing()


# ============================================================
# MAIN GAME CONTROLLER
# ============================================================

PreviousFrameTime=time.time()

# ============================================================
# DISPLAY
# ============================================================

def displayGameFrame():
    glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    glViewport(0,0,WindowWidth,WindowHeight)

    setupFirstPersonCamera()
    drawWeatherBackground()
    drawFloodedDhakaWorld()
    drawFloodedRoadEnvironment()
    drawUsaeedFeatures()
    drawWeatherEffects()
    drawSwimmersInWater()
    drawBRACUDestination()
    drawCityEnvironment()
    drawStudentRidePickups()
    drawPlayerBoat()
    drawPlayerHandsAndPaddles()
    drawWindshieldOverlay()
    drawRealTimeMinimap()
    drawPhotoFeedback()
    drawTrafficViolationFeedback()
    drawPowerSystemFeedback()
    drawUsaeedHUD()
    drawStudentRideHUD()
    drawSwimmerHUD()
    glutSwapBuffers()


# ============================================================
# NORMAL KEYBOARD
# ============================================================

def handleKeyboardInput(KeyPressed,MousePositionX,MousePositionY):
    LowerCaseKey=KeyPressed.lower()

    if LowerCaseKey==b'w' or LowerCaseKey==b's':
        MovementDirection=1 if LowerCaseKey==b'w' else -1
        moveBoatForwardOrBackward(MovementDirection)
        startRowingAnimation()
    elif LowerCaseKey==b'a' or LowerCaseKey==b'd':
        TurningDirection=1 if LowerCaseKey==b'a' else -1
        rotateBoatLeftOrRight(TurningDirection)
    elif LowerCaseKey==b'p':
        tryLandmarkPhoto()
    elif LowerCaseKey==b'v':
        startWindshieldWiper()
    elif LowerCaseKey==b'f':
        tryRepairPower()
    elif LowerCaseKey==b'y':
        acceptIncomingRide()
    elif LowerCaseKey==b'n':
        rejectIncomingRide()

    handleUsaeedKeyboardInput(KeyPressed)
    glutPostRedisplay()


# ============================================================
# ARROW KEYS
# ============================================================

def handleSpecialKeyInput(KeyPressed,MousePositionX,MousePositionY):
    if KeyPressed==GLUT_KEY_UP or KeyPressed==GLUT_KEY_DOWN:
        MovementDirection=1 if KeyPressed==GLUT_KEY_UP else -1
        moveBoatForwardOrBackward(MovementDirection)
        startRowingAnimation()
    elif KeyPressed==GLUT_KEY_LEFT or KeyPressed==GLUT_KEY_RIGHT:
        TurningDirection=1 if KeyPressed==GLUT_KEY_LEFT else -1
        rotateBoatLeftOrRight(TurningDirection)

    glutPostRedisplay()


# ============================================================
# MOUSE
# ============================================================

def handleMouseInput(MouseButton,ButtonState,MousePositionX,MousePositionY):
    pass


# ============================================================
# CONTINUOUS UPDATE
# ============================================================

def updateGameContinuously():
    global PreviousFrameTime

    CurrentFrameTime=time.time()
    DeltaTime=CurrentFrameTime-PreviousFrameTime
    PreviousFrameTime=CurrentFrameTime

    if DeltaTime>MaximumDeltaTime:
        DeltaTime=MaximumDeltaTime
    if DeltaTime<0:
        DeltaTime=0

    updateRainDropPositions(DeltaTime)
    updateFloodWaterAnimation(DeltaTime)
    updateRowingAnimation(DeltaTime)
    updateBRACUSunAura(DeltaTime)
    updatePhotoFeedback(DeltaTime)
    updateFloodTrafficSignal(DeltaTime)
    applyFloodTrafficRule()
    updateTrafficViolationFeedback(DeltaTime)
    updateWindshieldWiper(DeltaTime)
    updatePowerOutageSystem(DeltaTime)
    updateUsaeedFeatures(DeltaTime)
    updateStudentRideSystem(DeltaTime)
    updateSwimmerSystem(DeltaTime)
    glutPostRedisplay()


# ============================================================
# START GAME
# ============================================================

def startGame():
    global PreviousFrameTime

    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE|GLUT_RGB|GLUT_DEPTH)
    glutInitWindowSize(WindowWidth,WindowHeight)
    glutInitWindowPosition(0,0)
    glutCreateWindow(b"Majhi Jaben?! - CSE423 GROUP 7 Section 16")

    glutDisplayFunc(displayGameFrame)
    glutKeyboardFunc(handleKeyboardInput)
    glutSpecialFunc(handleSpecialKeyInput)
    glutMouseFunc(handleMouseInput)
    glutIdleFunc(updateGameContinuously)

    PreviousFrameTime=time.time()
    glutMainLoop()




# ============================================================
# USAEED RAHMAN TIBRO 
# ============================================================

# ------------------------------------------------------------
# FEATURE 1 - WATER CURRENT ZONES
# ------------------------------------------------------------

def isBoatInsideCurrentZone(CurrentZone):
    return (CurrentZone["x"] - CurrentZone["half_width"] <= BoatPositionX <= CurrentZone["x"] + CurrentZone["half_width"] and
            CurrentZone["y"] - CurrentZone["half_length"] <= BoatPositionY <= CurrentZone["y"] + CurrentZone["half_length"])

def updateWaterCurrentEffect(DeltaTime):
    global BoatPositionX, BoatPositionY, CurrentPushIndicatorTimer
    for CurrentZone in WaterCurrentZoneList:
        if isBoatInsideCurrentZone(CurrentZone):
            DirectionRadians = math.radians(CurrentZone["direction"])
            PushX = math.cos(DirectionRadians) * CurrentZone["strength"] * DeltaTime
            PushY = math.sin(DirectionRadians) * CurrentZone["strength"] * DeltaTime
            NewX = BoatPositionX + PushX
            NewY = BoatPositionY + PushY
            Margin = 35
            if -WorldMapLimit + Margin <= NewX <= WorldMapLimit - Margin and -WorldMapLimit + Margin <= NewY <= WorldMapLimit - Margin:
                BoatPositionX = NewX
                BoatPositionY = NewY
            CurrentPushIndicatorTimer = 0.15
            break
    if CurrentPushIndicatorTimer > 0:
        CurrentPushIndicatorTimer -= DeltaTime
        if CurrentPushIndicatorTimer < 0:
            CurrentPushIndicatorTimer = 0

def drawWaterCurrentZones():
    for CurrentZone in WaterCurrentZoneList:
        ZoneLeft = CurrentZone["x"] - CurrentZone["half_width"]
        ZoneRight = CurrentZone["x"] + CurrentZone["half_width"]
        ZoneBottom = CurrentZone["y"] - CurrentZone["half_length"]
        ZoneTop = CurrentZone["y"] + CurrentZone["half_length"]
        glColor3f(0.12, 0.42, 0.55)
        glBegin(GL_QUADS)
        glVertex3f(ZoneLeft, ZoneBottom, FloodWaterHeight + 0.08)
        glVertex3f(ZoneRight, ZoneBottom, FloodWaterHeight + 0.08)
        glVertex3f(ZoneRight, ZoneTop, FloodWaterHeight + 0.08)
        glVertex3f(ZoneLeft, ZoneTop, FloodWaterHeight + 0.08)
        glEnd()

        ArrowSpacing = 120
        DirectionRadians = math.radians(CurrentZone["direction"])
        DirX = math.cos(DirectionRadians)
        DirY = math.sin(DirectionRadians)
        PerpX = -DirY
        PerpY = DirX

        for Offset in range(-2, 3):
            CenterX = CurrentZone["x"] + DirX * Offset * ArrowSpacing * 0.6
            CenterY = CurrentZone["y"] + DirY * Offset * ArrowSpacing * 0.6
            if not (ZoneLeft <= CenterX <= ZoneRight and ZoneBottom <= CenterY <= ZoneTop):
                continue
            ArrowLength = 18
            ArrowWidth = 6
            TipX = CenterX + DirX * ArrowLength
            TipY = CenterY + DirY * ArrowLength
            BaseX = CenterX - DirX * ArrowLength * 0.3
            BaseY = CenterY - DirY * ArrowLength * 0.3

            glColor3f(0.35, 0.75, 0.90)
            glBegin(GL_QUADS)
            glVertex3f(BaseX + PerpX * ArrowWidth * 0.5, BaseY + PerpY * ArrowWidth * 0.5, FloodWaterHeight + 0.12)
            glVertex3f(BaseX - PerpX * ArrowWidth * 0.5, BaseY - PerpY * ArrowWidth * 0.5, FloodWaterHeight + 0.12)
            glVertex3f(TipX - PerpX * ArrowWidth * 0.5, TipY - PerpY * ArrowWidth * 0.5, FloodWaterHeight + 0.12)
            glVertex3f(TipX + PerpX * ArrowWidth * 0.5, TipY + PerpY * ArrowWidth * 0.5, FloodWaterHeight + 0.12)
            glEnd()

            HeadBaseX = TipX - DirX * 8
            HeadBaseY = TipY - DirY * 8
            glBegin(GL_QUADS)
            glVertex3f(HeadBaseX + PerpX * ArrowWidth, HeadBaseY + PerpY * ArrowWidth, FloodWaterHeight + 0.12)
            glVertex3f(HeadBaseX - PerpX * ArrowWidth, HeadBaseY - PerpY * ArrowWidth, FloodWaterHeight + 0.12)
            glVertex3f(TipX, TipY, FloodWaterHeight + 0.12)
            glVertex3f(TipX, TipY, FloodWaterHeight + 0.12)
            glEnd()

def drawCurrentPushFeedback():
    if CurrentPushIndicatorTimer <= 0:
        return
    begin2DDrawing()
    draw2DRectangle(340, 280, 660, 330, (0.02, 0.15, 0.22))
    draw2DRectangle(348, 288, 652, 322, (0.05, 0.28, 0.40))
    draw2DText(400, 300, "STRONG CURRENT!", (0.40, 0.85, 1.0))
    end2DDrawing()

# ------------------------------------------------------------
# FEATURE 2 - PADDLE BOOST RESOURCE SYSTEM
# ------------------------------------------------------------

def getCurrentBoatForwardStep():
    if BoostState == "ACTIVE":
        return BoatForwardMovementStep * BoostSpeedMultiplier
    return BoatForwardMovementStep

def activatePaddleBoost():
    global BoostState, BoostActiveTimer
    if BoostState == "IDLE":
        BoostState = "ACTIVE"
        BoostActiveTimer = 0.0
        print("BOOST ACTIVATED")

def updatePaddleBoost(DeltaTime):
    global BoostState, BoostMeter, BoostActiveTimer
    if BoostState == "ACTIVE":
        BoostMeter -= BoostDrainRate * DeltaTime
        BoostActiveTimer += DeltaTime
        if BoostMeter <= 0:
            BoostMeter = 0
            BoostState = "DEPLETED"
            print("BOOST DEPLETED")
    elif BoostState == "DEPLETED":
        BoostActiveTimer += DeltaTime
        if BoostActiveTimer >= 1.0:
            BoostState = "RECHARGING"
            print("BOOST RECHARGING")
    elif BoostState == "RECHARGING":
        BoostMeter += BoostRechargeRate * DeltaTime
        if BoostMeter >= BoostMeterMax:
            BoostMeter = BoostMeterMax
            BoostState = "IDLE"
            print("BOOST READY")

def drawBoostMeterHUD():
    begin2DDrawing()
    MeterLeft = 28
    MeterBottom = 165
    MeterWidth = 220
    MeterHeight = 22
    draw2DRectangle(MeterLeft, MeterBottom, MeterLeft + MeterWidth, MeterBottom + MeterHeight, (0.08, 0.08, 0.10))
    FillWidth = (BoostMeter / BoostMeterMax) * (MeterWidth - 4)
    if BoostState == "ACTIVE":
        FillColor = (1.0, 0.55, 0.10)
    elif BoostState == "DEPLETED":
        FillColor = (0.50, 0.10, 0.10)
    else:
        FillColor = (0.15, 0.75, 0.95)
    if FillWidth > 0:
        draw2DRectangle(MeterLeft + 2, MeterBottom + 2, MeterLeft + 2 + FillWidth, MeterBottom + MeterHeight - 2, FillColor)
    draw2DText(MeterLeft, MeterBottom + 28, "PADDLE BOOST", (0.85, 0.90, 0.95))
    if BoostState == "DEPLETED":
        draw2DText(MeterLeft + MeterWidth + 10, MeterBottom + 4, "COOLDOWN", (1.0, 0.30, 0.30))
    elif BoostState == "RECHARGING":
        draw2DText(MeterLeft + MeterWidth + 10, MeterBottom + 4, "CHARGING", (0.40, 0.80, 1.0))
    elif BoostState == "ACTIVE":
        draw2DText(MeterLeft + MeterWidth + 10, MeterBottom + 4, "ACTIVE", (1.0, 0.70, 0.20))
    end2DDrawing()

# ------------------------------------------------------------
# FEATURE 3 - PRECISION DOCKING
# ------------------------------------------------------------

def isBoatInsidePickupZone(Zone):
    ZoneRadius = 55
    Distance = calculate2DDistance(BoatPositionX, BoatPositionY, Zone["x"], Zone["y"])
    return Distance <= ZoneRadius

def updatePrecisionDocking(DeltaTime):
    global DockingTimer, IsDocked, CurrentDockingZone, DockingJustCompletedTimer
    InsideZone = False
    ActiveZone = None
    for Zone in PickupZoneList:
        if isBoatInsidePickupZone(Zone):
            InsideZone = True
            ActiveZone = Zone
            break
    if InsideZone and ActiveZone == CurrentDockingZone:
        DockingTimer += DeltaTime
        if DockingTimer >= DockingRequiredTime and IsDocked == False:
            IsDocked = True
            DockingJustCompletedTimer = 2.0
            print("DOCKING COMPLETE at", ActiveZone["name"])
    else:
        DockingTimer = 0.0
        IsDocked = False
        CurrentDockingZone = ActiveZone if InsideZone else None
    if DockingJustCompletedTimer > 0:
        DockingJustCompletedTimer -= DeltaTime
        if DockingJustCompletedTimer < 0:
            DockingJustCompletedTimer = 0

def drawPickupZones():
    for Zone in PickupZoneList:
        ZoneX = Zone["x"]
        ZoneY = Zone["y"]
        glColor3f(0.95, 0.75, 0.15)
        glBegin(GL_QUADS)
        Segments = 16
        for i in range(Segments):
            Angle1 = math.radians(i * (360 / Segments))
            Angle2 = math.radians((i + 1) * (360 / Segments))
            InnerR = 42
            OuterR = 48
            glVertex3f(ZoneX + math.cos(Angle1) * InnerR, ZoneY + math.sin(Angle1) * InnerR, FloodWaterHeight + 0.1)
            glVertex3f(ZoneX + math.cos(Angle1) * OuterR, ZoneY + math.sin(Angle1) * OuterR, FloodWaterHeight + 0.1)
            glVertex3f(ZoneX + math.cos(Angle2) * OuterR, ZoneY + math.sin(Angle2) * OuterR, FloodWaterHeight + 0.1)
            glVertex3f(ZoneX + math.cos(Angle2) * InnerR, ZoneY + math.sin(Angle2) * InnerR, FloodWaterHeight + 0.1)
        glEnd()
        glColor3f(1.0, 0.90, 0.25)
        glPointSize(6)
        glBegin(GL_POINTS)
        glVertex3f(ZoneX, ZoneY, FloodWaterHeight + 0.2)
        glEnd()

def drawDockingFeedback():
    begin2DDrawing()
    if IsDocked:
        draw2DRectangle(355, 250, 645, 300, (0.02, 0.18, 0.05))
        draw2DRectangle(363, 258, 637, 292, (0.06, 0.35, 0.10))
        draw2DText(420, 268, "DOCKED - READY FOR BOARDING", (0.50, 1.0, 0.50))
    elif CurrentDockingZone is not None and DockingTimer > 0:
        Progress = min(1.0, DockingTimer / DockingRequiredTime)
        BarWidth = 200
        draw2DRectangle(400 - BarWidth // 2, 255, 400 + BarWidth // 2, 275, (0.10, 0.10, 0.12))
        draw2DRectangle(400 - BarWidth // 2 + 2, 257, 400 - BarWidth // 2 + 2 + int((BarWidth - 4) * Progress), 273, (0.90, 0.70, 0.20))
        draw2DText(420, 280, "HOLD POSITION...", (1.0, 0.90, 0.40))
    end2DDrawing()

# ------------------------------------------------------------
# FEATURE 4 - MOVING FLOATING DEBRIS
# ------------------------------------------------------------

def updateFloatingDebris(DeltaTime):
    global DebrisStunTimer, DebrisCollisionCooldown, BoatPositionX, BoatPositionY, BoatFacingAngle
    for Debris in FloatingDebrisList:
        Debris["x"] += Debris["speed_x"] * DeltaTime
        Debris["y"] += Debris["speed_y"] * DeltaTime
        Debris["rotation"] += 20 * DeltaTime
        if Debris["rotation"] >= 360:
            Debris["rotation"] -= 360
        Margin = 50
        if Debris["x"] < -WorldMapLimit - Margin:
            Debris["x"] = WorldMapLimit + Margin
        elif Debris["x"] > WorldMapLimit + Margin:
            Debris["x"] = -WorldMapLimit - Margin
        if Debris["y"] < -WorldMapLimit - Margin:
            Debris["y"] = WorldMapLimit + Margin
        elif Debris["y"] > WorldMapLimit + Margin:
            Debris["y"] = -WorldMapLimit - Margin
    if DebrisStunTimer > 0:
        DebrisStunTimer -= DeltaTime
        if DebrisStunTimer < 0:
            DebrisStunTimer = 0
    if DebrisCollisionCooldown > 0:
        DebrisCollisionCooldown -= DeltaTime
        if DebrisCollisionCooldown < 0:
            DebrisCollisionCooldown = 0
    if DebrisStunTimer <= 0 and DebrisCollisionCooldown <= 0:
        for Debris in FloatingDebrisList:
            Distance = calculate2DDistance(BoatPositionX, BoatPositionY, Debris["x"], Debris["y"])
            if Distance < (Debris["size"] + 35):
                AngleToDebris = math.atan2(Debris["y"] - BoatPositionY, Debris["x"] - BoatPositionX)
                PushDistance = 60
                BoatPositionX -= math.cos(AngleToDebris) * PushDistance
                BoatPositionY -= math.sin(AngleToDebris) * PushDistance
                DebrisStunTimer = 1.2
                DebrisCollisionCooldown = 2.0
                print("HIT BY DEBRIS!")
                break

def drawFloatingDebris():
    for Debris in FloatingDebrisList:
        glPushMatrix()
        glTranslatef(Debris["x"], Debris["y"], FloodWaterHeight + 4)
        glRotatef(Debris["rotation"], 0, 0, 1)
        if Debris["type"] == "box":
            glColor3f(0.55, 0.40, 0.22)
            glScalef(Debris["size"], Debris["size"] * 0.7, Debris["size"] * 0.5)
            glutSolidCube(1)
        else:
            glColor3f(0.42, 0.30, 0.18)
            glRotatef(90, 0, 1, 0)
            gluCylinder(gluNewQuadric(), Debris["size"] * 0.3, Debris["size"] * 0.25, Debris["size"] * 1.4, 8, 6)
        glPopMatrix()

def drawDebrisStunFeedback():
    if DebrisStunTimer <= 0:
        return
    begin2DDrawing()
    draw2DRectangle(300, 340, 700, 400, (0.22, 0.08, 0.03))
    draw2DRectangle(308, 348, 692, 392, (0.40, 0.15, 0.05))
    draw2DText(380, 360, "DEBRIS COLLISION - BOAT STUNNED", (1.0, 0.60, 0.30))
    end2DDrawing()



# ------------------------------------------------------------
# MODIFIED MOVEMENT (shadows Adittya's original)
# ------------------------------------------------------------

def moveBoatForwardOrBackward(MovementDirection):
    global BoatPositionX, BoatPositionY
    BoatAngleInRadians = math.radians(BoatFacingAngle)
    BoatFacingDirectionX = math.cos(BoatAngleInRadians)
    BoatFacingDirectionY = math.sin(BoatAngleInRadians)
    if MovementDirection == 1:
        BoatMovementDistance = getCurrentBoatForwardStep()
    else:
        BoatMovementDistance = BoatBackwardMovementStep
    NewBoatPositionX = BoatPositionX + (BoatFacingDirectionX * BoatMovementDistance * MovementDirection)
    NewBoatPositionY = BoatPositionY + (BoatFacingDirectionY * BoatMovementDistance * MovementDirection)
    if isBoatPositionValid(NewBoatPositionX, NewBoatPositionY) == True:
        BoatPositionX = NewBoatPositionX
        BoatPositionY = NewBoatPositionY

# ------------------------------------------------------------
# KEYBOARD HOOK
# ------------------------------------------------------------

def handleUsaeedKeyboardInput(KeyPressed):
    LowerCaseKey = KeyPressed.lower()
    if LowerCaseKey == b'b':
        activatePaddleBoost()

# ------------------------------------------------------------
# UPDATE HOOK
# ------------------------------------------------------------

def updateUsaeedFeatures(DeltaTime):
    updateWaterCurrentEffect(DeltaTime)
    updatePaddleBoost(DeltaTime)
    updatePrecisionDocking(DeltaTime)
    updateFloatingDebris(DeltaTime)


# ------------------------------------------------------------
# DRAW HOOKS
# ------------------------------------------------------------

def drawUsaeedFeatures():
    drawWaterCurrentZones()
    drawPickupZones()
    drawFloatingDebris()
    

def drawUsaeedHUD():
    drawBoostMeterHUD()
    drawCurrentPushFeedback()
    drawDockingFeedback()
    drawDebrisStunFeedback()



# ============================================================
# SWIMMER RESCUE SYSTEM - feature 5(Usaeed Rahman Tibro)
# ============================================================

def spawnSwimmer():
    if len([s for s in SwimmerList if s["state"]=="swimming"])>=MaxSwimmersInWorld:
        return
    margin=250
    sx=random.uniform(-WorldMapLimit+margin,WorldMapLimit-margin)
    sy=random.uniform(-WorldMapLimit+margin,WorldMapLimit-margin)
    if isBoatPositionValid(sx,sy)==False:
        return
    if calculate2DDistance(sx,sy,BoatPositionX,BoatPositionY)<200:
        return
    SwimmerList.append({
        "x":sx,"y":sy,
        "state":"swimming",
        "anim_offset":random.uniform(0,6.28),
        "slot":-1
    })


def updateSwimmerSystem(DeltaTime):
    global SwimmerSpawnTimer,RescuedSwimmerCount,SwimmerList,SwimmersDeliveredCount,SwimmerDeliveryMessageTimer,SwimmerDeliveryMessageText

    SwimmerSpawnTimer=SwimmerSpawnTimer+DeltaTime
    if SwimmerSpawnTimer>=SwimmerSpawnInterval:
        SwimmerSpawnTimer=0
        spawnSwimmer()

    boarded_count=len([s for s in SwimmerList if s["state"]=="boarded"])

    for swimmer in SwimmerList:
        if swimmer["state"]=="swimming":
            swimmer["anim_offset"]=swimmer["anim_offset"]+DeltaTime*2.5

            dist=calculate2DDistance(BoatPositionX,BoatPositionY,swimmer["x"],swimmer["y"])
            if dist<=SwimmerBoardingRadius and boarded_count<MaxPassengersOnBoat:
                used_slots=[s["slot"] for s in SwimmerList if s["state"]=="boarded"]
                for slot_idx in range(MaxPassengersOnBoat):
                    if slot_idx not in used_slots:
                        swimmer["state"]="boarded"
                        swimmer["slot"]=slot_idx
                        boarded_count=boarded_count+1
                        RescuedSwimmerCount=RescuedSwimmerCount+1
                        break

        # --- BRACU DROP-OFF ---
    DistanceToBRACU=calculate2DDistance(BoatPositionX,BoatPositionY,BRACUPositionX,BRACUPositionY)
    if DistanceToBRACU<=BRACUHalfSize+120:
        DeliveredCount=0
        RemainingSwimmers=[]
        for swimmer in SwimmerList:
            if swimmer["state"]=="boarded":
                DeliveredCount=DeliveredCount+1
                SwimmersDeliveredCount=SwimmersDeliveredCount+1
            else:
                RemainingSwimmers.append(swimmer)
        if DeliveredCount>0:
            SwimmerList[:]=RemainingSwimmers
            SwimmerDeliveryMessageText="Delivered "+str(DeliveredCount)+" survivor(s) to BRACU!"
            SwimmerDeliveryMessageTimer=3.0

    if SwimmerDeliveryMessageTimer>0:
        SwimmerDeliveryMessageTimer=SwimmerDeliveryMessageTimer-DeltaTime
        if SwimmerDeliveryMessageTimer<0:
            SwimmerDeliveryMessageTimer=0
            SwimmerDeliveryMessageText=""


def drawSwimmerFigure(arm_angle, is_boarded):
    # Head
    glPushMatrix()
    glTranslatef(0,0,12)
    glColor3f(0.88,0.67,0.48)
    gluSphere(gluNewQuadric(),4,8,8)
    glPopMatrix()

    # Body (life vest)
    glPushMatrix()
    glTranslatef(0,0,5)
    glColor3f(0.95,0.45,0.15)
    glScalef(6,4,9)
    glutSolidCube(1)
    glPopMatrix()

    # Left arm
    glPushMatrix()
    glTranslatef(0,-4,7)
    glRotatef(arm_angle,1,0,0)
    glRotatef(90,1,0,0)
    glColor3f(0.88,0.67,0.48)
    gluCylinder(gluNewQuadric(),1.2,1.0,7,6,6)
    glPopMatrix()

    # Right arm
    glPushMatrix()
    glTranslatef(0,4,7)
    glRotatef(-arm_angle,1,0,0)
    glRotatef(90,1,0,0)
    glColor3f(0.88,0.67,0.48)
    gluCylinder(gluNewQuadric(),1.2,1.0,7,6,6)
    glPopMatrix()


def drawSwimmersInWater():
    for swimmer in SwimmerList:
        if swimmer["state"]!="swimming":
            continue

        sx,sy=swimmer["x"],swimmer["y"]
        water_z=FloodWaterHeight+get_wave_height(sx,sy)
        bob=math.sin(swimmer["anim_offset"])*2
        arm_angle=math.sin(swimmer["anim_offset"]*1.5)*35

        glPushMatrix()
        glTranslatef(sx,sy,water_z+bob)
        glScalef(3.0, 3.0, 3.0)
        drawSwimmerFigure(arm_angle,False)
        glPopMatrix()


def drawBoardedPassengers():
    for swimmer in SwimmerList:
        if swimmer["state"]!="boarded":
            continue

        slot=swimmer["slot"]
        if slot==0:
            ox,oy=-30,-12
        elif slot==1:
            ox,oy=-30,12
        elif slot==2:
            ox,oy=-10,-12
        elif slot==3:
            ox,oy=-10,12
        elif slot==4:
            ox,oy=10,-12
        elif slot==5:
            ox,oy=10,12
        elif slot==6:
            ox,oy=30,-12
        elif slot==7:
            ox,oy=30,12
        elif slot==8:
            ox,oy=50,-12
        else:
            ox,oy=50,12

        glPushMatrix()
        glTranslatef(ox,oy,10)
        drawSwimmerFigure(0,True)
        glPopMatrix()


def drawSwimmerHUD():
    begin2DDrawing()
    boarded=len([s for s in SwimmerList if s["state"]=="boarded"])
    draw2DText(20,135,"Passengers: "+str(boarded)+"/"+str(MaxPassengersOnBoat),(0.90,0.95,1.0))
    draw2DText(20,110,"Rescued: "+str(RescuedSwimmerCount),(0.55,1.0,0.65))
    draw2DText(20,85,"Delivered to BRACU: "+str(SwimmersDeliveredCount),(0.70,1.0,0.75))

    if SwimmerDeliveryMessageTimer>0 and SwimmerDeliveryMessageText!="":
        draw2DRectangle(250,210,750,250,(0.02,0.18,0.05))
        draw2DRectangle(258,218,742,242,(0.06,0.35,0.10))
        draw2DText(320,225,SwimmerDeliveryMessageText,(0.50,1.0,0.50))

    # Boarding prompt
    for swimmer in SwimmerList:
        if swimmer["state"]=="swimming":
            dist=calculate2DDistance(BoatPositionX,BoatPositionY,swimmer["x"],swimmer["y"])
            if dist<=SwimmerBoardingRadius+40 and boarded<MaxPassengersOnBoat:
                draw2DRectangle(340,245,660,285,(0.02,0.12,0.18))
                draw2DRectangle(348,253,652,277,(0.05,0.25,0.38))
                draw2DText(390,260,"SURVIVOR NEARBY - SLOW DOWN TO RESCUE",(0.40,0.90,1.0))
                break

    end2DDrawing()


if __name__=="__main__":
    startGame()