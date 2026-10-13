from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
import math
import time
import random

PositionOfTheCamera=(0,500,500) #Camera
fieldOfViewY=120
LengthOfTheGrid=600
RadiusOfTheCam=500 #Third Person view
CameraGhuranoAngle=90
CameraUchu=500
CameraJehGhurbeStep=5
CameraUchuStep=20
firstPersonMode=False #1st person view var
firstPersonUchu=95
firstPersonkototukLookDist=300
firstPersonPichoneGap=10
firstpersonErCameraAngle=0
firstpersonErFieldOfView=90
KhelowarXvalue=0 #Khelowar er variables
KhelowarYvalue=0
KhelowarErAngle=0
KhelowarErLifeKoto=5
KhelowarKiShuyeAche=False
KhelaKiShesh=False #game er variables
KhelaOrjon=0
BulletsKoitaMiss=0
CheatingKorteso=False
cheatingVision=False
SpeedOfCheatingRotation=180
FireRateWhileCheating=0.25
SheshCheatGuliShomoy=0
CheatLineExtra=5 #cheating Var
GhorSizeKi=100 #floor var
ShimanaUchuKoto=100
MatiNichuKoto=0
KhelowarFootstep=20
KhelowarRotation=5
KhelowarShimanaGap=35 #Khelowar movement var
KhelowarCollisionErRadius=30 #collision
BulletQuantity=[]
GuliSpeed=500
GuliSizeTahki=12
GuliUchuKoto=77
GuliShuruThekeGapkoto=55 #bullet er var
Ager_shomoy=time.time()
ShotruKoita=5 #enemy var
ShotruQuantity=[]
ShotruBodyRadiusKi=25
ShotruMatharRadiusKi=10
ShotruBodyKotoUchu=25
ShotruMathaKotoUchu=48
ShotruSpawnMargin=80
ShotruSpeed=45
ShotruChotoScale=0.75
ShotruBoroScale=1.25
ShotruPeriodicGoti=0.60
BulletShotruCollisionExtra=12

def draw_text(x,y,text,font=GLUT_BITMAP_HELVETICA_18):
    glColor3f(1,1,1)
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    gluOrtho2D(0,1000,0,800)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()
    glRasterPos2f(x,y)
    for character in text:
        glutBitmapCharacter(font, ord(character))
    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)

def drawingTheCubeInGame(KotoWidth, KotoLength, KotoHeight):
    glPushMatrix()
    glScalef(KotoWidth,KotoLength,KotoHeight)
    glutSolidCube(1)
    glPopMatrix()

def drawingTheKhelowarInGame():
    glPushMatrix()
    glTranslatef(KhelowarXvalue,KhelowarYvalue,0)
    glRotatef(KhelowarErAngle,0,0,1)
    if KhelowarKiShuyeAche==True: #lies down
        glTranslatef(0,0,20)
        glRotatef(90,1,0,0)
    glPushMatrix() #body
    glColor3f(0.30,0.40,0.15)
    glTranslatef(0,0,58)
    drawingTheCubeInGame(30,22,55)
    glPopMatrix()
    glPushMatrix() #matha
    glColor3f(0,0,0)
    glTranslatef(0,0,100)
    gluSphere(gluNewQuadric(),15,10,10)
    glPopMatrix()
    glPushMatrix() #bam paa
    glColor3f(0,0,1)
    glTranslatef(0,-10,33)
    glRotatef(180,1,0,0)
    gluCylinder(gluNewQuadric(),8,5,38,10,10)
    glPopMatrix()
    glPushMatrix() #daan paa
    glColor3f(0,0,1)
    glTranslatef(0,10,33)
    glRotatef(180,1,0,0)
    gluCylinder(gluNewQuadric(),8,5,38,10,10)
    glPopMatrix()
    glPushMatrix() #bam hath
    glColor3f(1,0.75,0.50)
    glTranslatef(5,-16,76)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),6,5,34,10,10)
    glPopMatrix()
    glPushMatrix() #right hath
    glColor3f(1,0.75,0.50)
    glTranslatef(5,16,76)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),6,5,34,10,10)
    glPopMatrix()
    glPushMatrix() #GUN
    glColor3f(0.75,0.75,0.75)
    glTranslatef(40,0,77)
    drawingTheCubeInGame(60,10,10)
    glPopMatrix()
    glPushMatrix() #Gun er barrel
    glColor3f(0.65,0.65,0.65)
    glTranslatef(68,0,77)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),4,3,35,10,10)
    glPopMatrix()
    glPopMatrix()

def drawingFirstPersonGunInGame():
    glPushMatrix()
    glTranslatef(KhelowarXvalue,KhelowarYvalue,0)
    glRotatef(KhelowarErAngle,0,0,1)
    glPushMatrix() #bam hath
    glColor3f(1,0.75,0.50)
    glTranslatef(22,-15,68)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),8,6,58,10,10)
    glPopMatrix()
    glPushMatrix() #daan hath
    glColor3f(1,0.75,0.50)
    glTranslatef(22,15,68)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),8,6,58,10,10)
    glPopMatrix()
    glPushMatrix() #1st person gun
    glColor3f(0.75,0.75,0.75)
    glTranslatef(65,0,73)
    drawingTheCubeInGame(80,14,14)
    glPopMatrix()
    glPushMatrix() #gun er barrel
    glColor3f(0.65,0.65,0.65)
    glTranslatef(100,0,73)
    glRotatef(90,0,1,0)
    gluCylinder(gluNewQuadric(),5,3,55,10,10)
    glPopMatrix()
    glPopMatrix()

def drawingTheFloorInGame():
    MotGhorKoita=int((LengthOfTheGrid*2)/GhorSizeKi)
    for RowNumber in range(MotGhorKoita):
        for ColumnNumber in range(MotGhorKoita):
            CurrentXvalue=(-LengthOfTheGrid+RowNumber*GhorSizeKi)
            CurrentYvalue=(-LengthOfTheGrid+ColumnNumber*GhorSizeKi)
            if (RowNumber+ColumnNumber)%2==0:
                glColor3f(1,1,1)
            else:
                glColor3f(0.70,0.50,0.95)
            glBegin(GL_QUADS)
            glVertex3f(CurrentXvalue,CurrentYvalue,MatiNichuKoto)
            glVertex3f(CurrentXvalue+GhorSizeKi,CurrentYvalue,MatiNichuKoto)
            glVertex3f(CurrentXvalue+GhorSizeKi,CurrentYvalue+GhorSizeKi,MatiNichuKoto)
            glVertex3f(CurrentXvalue,CurrentYvalue+GhorSizeKi,MatiNichuKoto)
            glEnd()

def drawingTheBoundaryWallsInGame():
    glColor3f(0,1,0)
    glBegin(GL_QUADS)
    glVertex3f(-LengthOfTheGrid,-LengthOfTheGrid,0)
    glVertex3f(-LengthOfTheGrid,LengthOfTheGrid,0)
    glVertex3f(-LengthOfTheGrid,LengthOfTheGrid,ShimanaUchuKoto)
    glVertex3f(-LengthOfTheGrid,-LengthOfTheGrid,ShimanaUchuKoto)
    glEnd()
    glColor3f(0,0,1)
    glBegin(GL_QUADS)
    glVertex3f(LengthOfTheGrid,-LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,LengthOfTheGrid,ShimanaUchuKoto)
    glVertex3f(LengthOfTheGrid,-LengthOfTheGrid,ShimanaUchuKoto)
    glEnd()
    glColor3f(0,1,1)
    glBegin(GL_QUADS)
    glVertex3f(-LengthOfTheGrid,-LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,-LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,-LengthOfTheGrid,ShimanaUchuKoto)
    glVertex3f(-LengthOfTheGrid,-LengthOfTheGrid,ShimanaUchuKoto)
    glEnd()
    glColor3f(1,1,1)
    glBegin(GL_QUADS)
    glVertex3f(-LengthOfTheGrid,LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,LengthOfTheGrid,0)
    glVertex3f(LengthOfTheGrid,LengthOfTheGrid,ShimanaUchuKoto)
    glVertex3f(-LengthOfTheGrid,LengthOfTheGrid,ShimanaUchuKoto)
    glEnd()

def firingTheBulletInGame():
    global BulletQuantity
    AngleInRadian=math.radians(KhelowarErAngle)
    BulletDirectionX=math.cos(AngleInRadian)
    BulletDirectionY=math.sin(AngleInRadian)
    BulletStartingX=(KhelowarXvalue+BulletDirectionX*GuliShuruThekeGapkoto)
    BulletStartingY=(KhelowarYvalue+BulletDirectionY*GuliShuruThekeGapkoto)
    NewBulletInfo=[BulletStartingX, BulletStartingY,GuliUchuKoto,BulletDirectionX,BulletDirectionY]
    BulletQuantity.append(NewBulletInfo)

def drawingAllBulletsInGame():
    glColor3f(1,0,0)
    for BulletIndex in range(len(BulletQuantity)):
        glPushMatrix()
        glTranslatef(BulletQuantity[BulletIndex][0],BulletQuantity[BulletIndex][1],BulletQuantity[BulletIndex][2])
        glutSolidCube(GuliSizeTahki)
        glPopMatrix()

def movingTheBulletsInGame(DeltaTime):
    global BulletQuantity
    global BulletsKoitaMiss
    BulletsStillInsideGame=[]
    for BulletIndex in range(len(BulletQuantity)):
        BulletQuantity[BulletIndex][0]=(BulletQuantity[BulletIndex][0]+BulletQuantity[BulletIndex][3]*GuliSpeed*DeltaTime)
        BulletQuantity[BulletIndex][1]=(BulletQuantity[BulletIndex][1]+BulletQuantity[BulletIndex][4]*GuliSpeed*DeltaTime)
        if (-LengthOfTheGrid<= BulletQuantity[BulletIndex][0] <= LengthOfTheGrid) and (-LengthOfTheGrid<= BulletQuantity[BulletIndex][1] <= LengthOfTheGrid):
            BulletsStillInsideGame.append(BulletQuantity[BulletIndex])
        else:
            BulletsKoitaMiss=(BulletsKoitaMiss+1)
    BulletQuantity=BulletsStillInsideGame

def creatingOneRandomShotru():
    ShotruXvalue=random.uniform(-LengthOfTheGrid+ShotruSpawnMargin, LengthOfTheGrid-ShotruSpawnMargin)
    ShotruYvalue=random.uniform(-LengthOfTheGrid+ShotruSpawnMargin, LengthOfTheGrid-ShotruSpawnMargin)
    ShotruCurrentScale=1
    ShotruScaleDirection=1
    return [ShotruXvalue, ShotruYvalue, ShotruCurrentScale, ShotruScaleDirection]

def creatingInitialShotruInGame():
    global ShotruQuantity
    ShotruQuantity=[]
    for ShotruIndex in range(ShotruKoita):
        ShotruQuantity.append(creatingOneRandomShotru())

def drawingOneShotruInGame(OneShotruInfo):
    glPushMatrix()
    glTranslatef(OneShotruInfo[0], OneShotruInfo[1],0)
    glScalef(OneShotruInfo[2],OneShotruInfo[2],OneShotruInfo[2])
    glPushMatrix() #lal body main
    glColor3f(1,0,0)
    glTranslatef(0,0,ShotruBodyKotoUchu)
    gluSphere(gluNewQuadric(),ShotruBodyRadiusKi,10,10)
    glPopMatrix()
    glPushMatrix() #kala matha small
    glColor3f(0,0,0)
    glTranslatef(0,0,ShotruMathaKotoUchu)
    gluSphere(gluNewQuadric(),ShotruMatharRadiusKi,10,10)
    glPopMatrix()
    glPopMatrix()

def drawingAllShotruInGame():
    for ShotruIndex in range(len(ShotruQuantity)):
        drawingOneShotruInGame(ShotruQuantity[ShotruIndex])

def movingAllShotruTowardsKhelowar(DeltaTime):
    for ShotruIndex in range(len(ShotruQuantity)):
        DistanceInX=(KhelowarXvalue-ShotruQuantity[ShotruIndex][0])
        DistanceInY=(KhelowarYvalue-ShotruQuantity[ShotruIndex][1])
        TotalDistance= math.sqrt(DistanceInX*DistanceInX+DistanceInY*DistanceInY)
        if TotalDistance>0.001:
            ShotruDirectionX=(DistanceInX/TotalDistance)
            ShotruDirectionY=(DistanceInY/TotalDistance)
            ShotruMovementAmount=(ShotruSpeed*DeltaTime)
            ShotruQuantity[ShotruIndex][0]=(ShotruQuantity[ShotruIndex][0]+ShotruDirectionX*ShotruMovementAmount)
            ShotruQuantity[ShotruIndex][1]=(ShotruQuantity[ShotruIndex][1]+ShotruDirectionY*ShotruMovementAmount)

def changingShotruSizeContinuously(DeltaTime):
    for ShotruIndex in range(len(ShotruQuantity)):
        ScaleChangeAmount=(ShotruPeriodicGoti*ShotruQuantity[ShotruIndex][3]*DeltaTime)
        ShotruQuantity[ShotruIndex][2]=(ShotruQuantity[ShotruIndex][2]+ScaleChangeAmount)
        if ShotruQuantity[ShotruIndex][2]>= ShotruBoroScale:
            ShotruQuantity[ShotruIndex][2]=ShotruBoroScale
            ShotruQuantity[ShotruIndex][3]=-1
        elif ShotruQuantity[ShotruIndex][2]<= ShotruChotoScale:
            ShotruQuantity[ShotruIndex][2]=ShotruChotoScale
            ShotruQuantity[ShotruIndex][3]=1

def checkingBulletShotruCollision():
    global BulletQuantity
    global KhelaOrjon
    BulletsThatDidNotHit=[]
    for BulletIndex in range(len(BulletQuantity)):
        BulletHitShotru=False
        for ShotruIndex in range(len(ShotruQuantity)):
            BulletShotruDistanceX=(BulletQuantity[BulletIndex][0]-ShotruQuantity[ShotruIndex][0])
            BulletShotruDistanceY=(BulletQuantity[BulletIndex][1]-ShotruQuantity[ShotruIndex][1])
            BulletShotruTotalDistance=math.sqrt(BulletShotruDistanceX*BulletShotruDistanceX+BulletShotruDistanceY*BulletShotruDistanceY)
            CurrentShotruRadius=(ShotruBodyRadiusKi*ShotruQuantity[ShotruIndex][2])
            CollisionDistanceLimit=(CurrentShotruRadius+GuliSizeTahki/2+BulletShotruCollisionExtra)
            if BulletShotruTotalDistance<=CollisionDistanceLimit:
                BulletHitShotru=True
                KhelaOrjon=(KhelaOrjon+1)
                ShotruQuantity[ShotruIndex]=(creatingOneRandomShotru())
                break
        if BulletHitShotru==False:
            BulletsThatDidNotHit.append(BulletQuantity[BulletIndex])
    BulletQuantity=BulletsThatDidNotHit

def checkingKhelowarShotruCollision():
    global KhelowarErLifeKoto
    if KhelowarErLifeKoto<=0:
        return
    for ShotruIndex in range(len(ShotruQuantity)):
        KhelowarShotruDistanceX=(KhelowarXvalue-ShotruQuantity[ShotruIndex][0])
        KhelowarShotruDistanceY=(KhelowarYvalue-ShotruQuantity[ShotruIndex][1])
        KhelowarShotruTotalDistance=math.sqrt(KhelowarShotruDistanceX*KhelowarShotruDistanceX+KhelowarShotruDistanceY*KhelowarShotruDistanceY)
        CurrentShotruRadius=(ShotruBodyRadiusKi*ShotruQuantity[ShotruIndex][2])
        khelowarShotruCollisionLimit=(KhelowarCollisionErRadius+CurrentShotruRadius)
        if KhelowarShotruTotalDistance<=khelowarShotruCollisionLimit:
            KhelowarErLifeKoto=(KhelowarErLifeKoto-1)
            if KhelowarErLifeKoto<0:
                KhelowarErLifeKoto=0
            ShotruQuantity[ShotruIndex]=(creatingOneRandomShotru())
            break

def checkingShotruInGunLine(OneShotruInfo):
    AngleInRadian=math.radians(KhelowarErAngle)
    GunDirectionX=math.cos(AngleInRadian)
    GunDirectionY=math.sin(AngleInRadian)
    ShotruFromKhelowarX=(OneShotruInfo[0]-KhelowarXvalue)
    ShotruFromKhelowarY=(OneShotruInfo[1]-KhelowarYvalue)
    DistanceInFront=(ShotruFromKhelowarX*GunDirectionX+ShotruFromKhelowarY*GunDirectionY)
    if DistanceInFront<=0:
        return False
    DistanceFromGunLine=abs(ShotruFromKhelowarX*GunDirectionY-ShotruFromKhelowarY*GunDirectionX)
    CurrentShotruRadius= (ShotruBodyRadiusKi*OneShotruInfo[2])
    GunLineLimit=(CurrentShotruRadius+CheatLineExtra)
    if DistanceFromGunLine<=GunLineLimit:
        return True
    return False


def runningCheatMode(DeltaTime, CurrentTime):
    global KhelowarErAngle
    global SheshCheatGuliShomoy
    if CheatingKorteso==False:
        return
    KhelowarErAngle=(KhelowarErAngle+SpeedOfCheatingRotation*DeltaTime)
    KhelowarErAngle=(KhelowarErAngle%360)
    for ShotruIndex in range(len(ShotruQuantity)):
        if checkingShotruInGunLine(ShotruQuantity[ShotruIndex])==True:
            if (CurrentTime-SheshCheatGuliShomoy>=FireRateWhileCheating):
                firingTheBulletInGame()
                SheshCheatGuliShomoy=(CurrentTime)
            break

def checkingIfGameIsOver():
    global KhelaKiShesh
    global KhelowarKiShuyeAche
    global firstPersonMode
    global CheatingKorteso
    global cheatingVision
    if (KhelowarErLifeKoto<=0 or BulletsKoitaMiss>=10):
        KhelaKiShesh=True
        KhelowarKiShuyeAche=True
        firstPersonMode=False
        CheatingKorteso=False
        cheatingVision=False

def restartingTheGame():
    global KhelaOrjon
    global KhelowarXvalue
    global KhelowarYvalue
    global KhelowarErAngle
    global KhelowarErLifeKoto
    global KhelowarKiShuyeAche
    global KhelaKiShesh
    global BulletsKoitaMiss
    global BulletQuantity
    global Ager_shomoy
    global firstPersonMode
    global firstpersonErCameraAngle
    global CheatingKorteso
    global cheatingVision
    global SheshCheatGuliShomoy

    KhelowarXvalue=0
    KhelowarYvalue=0
    KhelowarErAngle=0
    KhelowarErLifeKoto=5
    KhelowarKiShuyeAche=False
    KhelaOrjon=0
    BulletsKoitaMiss=0
    BulletQuantity=[]
    creatingInitialShotruInGame()
    firstPersonMode=False
    firstpersonErCameraAngle=0
    CheatingKorteso=False
    cheatingVision=False
    SheshCheatGuliShomoy=0
    KhelaKiShesh=False
    Ager_shomoy=time.time()

def keyboardListener(key,x,y):
    global KhelowarXvalue
    global KhelowarYvalue
    global KhelowarErAngle
    global CheatingKorteso
    global cheatingVision
    global firstpersonErCameraAngle

    if (key==b'r' and KhelaKiShesh==True):
        restartingTheGame()
        return

    if KhelaKiShesh==True:
        return
    if key== b'c':
        if CheatingKorteso==False:
            CheatingKorteso=True
            cheatingVision=False
            firstpersonErCameraAngle=KhelowarErAngle
        else:
            CheatingKorteso=False
            cheatingVision=False
            firstpersonErCameraAngle=(KhelowarErAngle)
        return
    if key==b'v':
        if CheatingKorteso==True:
            if cheatingVision==False:
                cheatingVision=True
            else:
                cheatingVision=False
                firstpersonErCameraAngle=(KhelowarErAngle)
        return

    AngleInRadian= math.radians(KhelowarErAngle)
    ForwardDirectionX=math.cos(AngleInRadian)
    ForwardDirectionY=math.sin(AngleInRadian)
    if key==b'w':
        NewKhelowarX=(KhelowarXvalue+ForwardDirectionX*KhelowarFootstep)
        NewKhelowarY=(KhelowarYvalue+ForwardDirectionY*KhelowarFootstep)
        if (-LengthOfTheGrid+KhelowarShimanaGap<=NewKhelowarX<=LengthOfTheGrid-KhelowarShimanaGap and -LengthOfTheGrid+KhelowarShimanaGap<= NewKhelowarY <= LengthOfTheGrid-KhelowarShimanaGap):
            KhelowarXvalue=NewKhelowarX
            KhelowarYvalue=NewKhelowarY
    if key==b's':
        NewKhelowarX=(KhelowarXvalue-ForwardDirectionX*KhelowarFootstep)
        NewKhelowarY=(KhelowarYvalue-ForwardDirectionY*KhelowarFootstep)
        if (-LengthOfTheGrid+KhelowarShimanaGap<=NewKhelowarX<=LengthOfTheGrid-KhelowarShimanaGap and -LengthOfTheGrid + KhelowarShimanaGap <= NewKhelowarY<= LengthOfTheGrid-KhelowarShimanaGap):
            KhelowarXvalue=NewKhelowarX
            KhelowarYvalue=NewKhelowarY

    if key==b'a':
        KhelowarErAngle=(KhelowarErAngle+KhelowarRotation)
    if key==b"d":
        KhelowarErAngle=(KhelowarErAngle-KhelowarRotation)
    KhelowarErAngle=KhelowarErAngle%360

def specialKeyListener(key,x,y):
    global PositionOfTheCamera
    global CameraGhuranoAngle
    global CameraUchu

    if firstPersonMode==True:
        return
    if key==GLUT_KEY_UP:
        CameraUchu=(CameraUchu+CameraUchuStep)
    if key==GLUT_KEY_DOWN:
        CameraUchu=(CameraUchu-CameraUchuStep)
        if CameraUchu<100:
            CameraUchu=100
    if key==GLUT_KEY_LEFT:
        CameraGhuranoAngle=(CameraGhuranoAngle+CameraJehGhurbeStep)
    if key==GLUT_KEY_RIGHT:
        CameraGhuranoAngle=(CameraGhuranoAngle-CameraJehGhurbeStep)
    CameraGhuranoAngle=(CameraGhuranoAngle%360)
    CameraAngleInRadian=math.radians(CameraGhuranoAngle)
    CameraXvalue=(RadiusOfTheCam*math.cos(CameraAngleInRadian))
    CameraYvalue=(RadiusOfTheCam*math.sin(CameraAngleInRadian))
    PositionOfTheCamera=(CameraXvalue,CameraYvalue,CameraUchu)

def mouseListener(button, state, x, y):
    global firstPersonMode
    global firstpersonErCameraAngle
    if KhelaKiShesh==True:
        return
    if (button==GLUT_LEFT_BUTTON and state==GLUT_DOWN):
        firingTheBulletInGame()
    if (button==GLUT_RIGHT_BUTTON and state==GLUT_DOWN):
        if firstPersonMode==False:
            firstPersonMode=True
            if (CheatingKorteso)==True and cheatingVision==False:
                firstpersonErCameraAngle=(KhelowarErAngle)
        else:
            firstPersonMode=False

def setupCamera():
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    if firstPersonMode==True:
        gluPerspective(firstpersonErFieldOfView,1.25,0.1,1500)
    else:
        gluPerspective(fieldOfViewY,1.25,0.1,1500)
    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()
    if firstPersonMode==True:
        if (CheatingKorteso==True and cheatingVision==False):
            CameraLookingAngle=(firstpersonErCameraAngle)
        else:
            CameraLookingAngle=(KhelowarErAngle)
        AngleInRadian=math.radians(CameraLookingAngle)
        ForwardDirectionX=math.cos(AngleInRadian)
        ForwardDirectionY=math.sin(AngleInRadian)
        FirstPersonCameraX=(KhelowarXvalue-ForwardDirectionX*firstPersonPichoneGap)
        FirstPersonCameraY=(KhelowarYvalue-ForwardDirectionY*firstPersonPichoneGap)
        FirstPersonCameraZ=firstPersonUchu
        CameraTargetX=(KhelowarXvalue+ForwardDirectionX*firstPersonkototukLookDist)
        CameraTargetY=(KhelowarYvalue+ForwardDirectionY*firstPersonkototukLookDist)
        CameraTargetZ=65
        gluLookAt(FirstPersonCameraX,FirstPersonCameraY,FirstPersonCameraZ, CameraTargetX,CameraTargetY,CameraTargetZ,0,0,1)
    else:
        CameraXvalue, CameraYvalue, CameraZvalue=PositionOfTheCamera
        gluLookAt(CameraXvalue,CameraYvalue,CameraZvalue,0,0,40,0,0,1)

def idle():
    global Ager_shomoy
    CurrentTime=time.time()
    DeltaTime=(CurrentTime-Ager_shomoy)
    Ager_shomoy=CurrentTime
    if KhelaKiShesh==False:
        runningCheatMode(DeltaTime,CurrentTime)
        movingTheBulletsInGame(DeltaTime)
        movingAllShotruTowardsKhelowar(DeltaTime)
        changingShotruSizeContinuously(DeltaTime)
        checkingBulletShotruCollision()
        checkingKhelowarShotruCollision()
        checkingIfGameIsOver()
    glutPostRedisplay()

def showScreen():
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity() 
    glViewport(0, 0, 600, 480)  
    setupCamera() 
    drawingTheFloorInGame()
    drawingTheBoundaryWallsInGame()
    drawingAllShotruInGame()
    if firstPersonMode==True:
        drawingFirstPersonGunInGame()
    else:
        drawingTheKhelowarInGame()
    drawingAllBulletsInGame()
    draw_text(10,770,f"Player Life Remaining: {KhelowarErLifeKoto}")
    draw_text(10,740,f"Game Score: {KhelaOrjon}")
    draw_text(10,710,f"Player Bullet Missed: {BulletsKoitaMiss}")
    glutSwapBuffers()

def main():
    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH)  # Double buffering, RGB color, depth test
    glutInitWindowSize(600, 480)  # Window size
    glutInitWindowPosition(0, 0)  # Window position
    wind = glutCreateWindow(b"Bullet Frenzy")  # Create the window

    glutDisplayFunc(showScreen)  # Register display function
    glutKeyboardFunc(keyboardListener)  # Register keyboard listener
    glutSpecialFunc(specialKeyListener)
    glutMouseFunc(mouseListener)
    glutIdleFunc(idle)  # Register the idle function to move the bullet automatically
    creatingInitialShotruInGame()
    glutMainLoop()  # Enter the GLUT main loop

if __name__ == "__main__":
    main()