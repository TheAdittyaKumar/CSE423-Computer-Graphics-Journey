from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *

import random
import time

janalaWidth=535    #amader window size
janalaHeight=749
DhorarTopWdith=59 #the catcher width
DhorarNicherWidth=43
DhorarNicherY=27 #catcher er height
DhorarTopY=48
HiraKotoWidth=11 #diamond er half width ar h
HiraKotoHeight=16
HiraShuruY=663 #start koi diamond

DhorabeRaftar=428 #catcher movement speed tah by units
ShuruHiraDour=107 #diamond movement initial speed by units
HiraAccel=5.35 # unit per second square 

CheatingKorar=1.5 #Catcher extra speed 
ShorbochoChangingTime=0.05 #Changing delta time, aita chara diamond could jump a large dist quickly

DhorarX= janalaWidth/2 #catcher initial location center e
HiraX= janalaWidth/2
HiraY=HiraShuruY #initially center e Hira but later on random (NotunHiraAshtese())
HiraKotoSpeed=ShuruHiraDour #Diamond speed
HiraRong = (1,1,1) #white color

KotoScore=0 #score at start

Thamo=False #game pause
GameShesh=False #game running or nah
CholoCheatKori=False #cheat mode ki on?

AgerShomoiKoto=time.time() #animation time like 15454548.315s
AgerKeySpecialTime= time.time() #current time - prev #catcher movement related

def amaderZoneTahKonta(ProthomX, ProthomY, SecondX, SecondY): #zone identification
    ChangingValueOfTheX=SecondX-ProthomX
    ChangingValueOfTheY=SecondY-ProthomY
    #dx>dy
    if abs(ChangingValueOfTheX)>=abs(ChangingValueOfTheY):
        if ChangingValueOfTheX>=0 and ChangingValueOfTheY>=0:
            return 0
        elif ChangingValueOfTheX<0 and ChangingValueOfTheY>=0:
            return 3
        elif ChangingValueOfTheX<0 and ChangingValueOfTheY<0:
            return 4
        else:
            return 7
        #dy>dx
    else:
        if ChangingValueOfTheX>=0 and ChangingValueOfTheY>=0:
            return 1
        elif ChangingValueOfTheX<0 and ChangingValueOfTheY>=0:
            return 2
        elif ChangingValueOfTheX<0 and ChangingValueOfTheY<0:
            return 5
        else:
            return 6

def Zone0TehConvertKori(XTahKi, YTahki, ZoneTahKi): #Zone Convertion
    if ZoneTahKi==0:
        return (XTahKi, YTahki) #x,y
    elif ZoneTahKi==1:
        return (YTahki, XTahKi) #y,x
    elif ZoneTahKi==2:
        return (YTahki, -XTahKi) #y,-x
    elif ZoneTahKi==3:
        return (-XTahKi, YTahki) #-x,y
    elif ZoneTahKi==4:
        return (-XTahKi, -YTahki) #-x,-y
    elif ZoneTahKi==5:
        return (-YTahki, -XTahKi) #-y,-x
    elif ZoneTahKi==6:
        return (-YTahki, XTahKi) #-y,x
    else:
        return (XTahKi, -YTahki) #x,-y

def Zone0ThekeConvertKori(XTahKi, YTahki, ZoneTahKi): #convert zone 0 to original zone
    if ZoneTahKi==0:
        return (XTahKi, YTahki)
    elif ZoneTahKi==1:
        return (YTahki, XTahKi)
    elif ZoneTahKi==2:
        return (-YTahki, XTahKi)
    elif ZoneTahKi==3:
        return (-XTahKi, YTahki)
    elif ZoneTahKi==4:
        return (-XTahKi, -YTahki)
    elif ZoneTahKi==5:
        return (-YTahki, -XTahKi)
    elif ZoneTahKi==6:
        return (YTahki, -XTahKi)
    else:
        return (XTahKi, -YTahki)

def MPLTahAki(XprothomTah,YprothomTah,XsecondTah,YsecondTah, RongTahKi): #first, second endpont
    #color tuple
    XprothomTah=round(XprothomTah) #to avoid floating numbers. Delta time like HiraY gives a val
    YprothomTah=round(YprothomTah) # HiraY=423.21654 but OpenGl to pixel discrete location toh int imp
    XsecondTah=round(XsecondTah)
    YsecondTah=round(YsecondTah)
    Zone=amaderZoneTahKonta(XprothomTah, YprothomTah, XsecondTah, YsecondTah) #get zone
    ProthomXZone0, ProthomYZone0=Zone0TehConvertKori(XprothomTah, YprothomTah, Zone) #endpoint1
    DitioXZone0, DitioYZone0=Zone0TehConvertKori(XsecondTah, YsecondTah, Zone) #endpoint2
    if ProthomXZone0>DitioXZone0: 
        ProthomXZone0, DitioXZone0=DitioXZone0, ProthomXZone0
        ProthomYZone0, DitioYZone0=DitioYZone0, ProthomYZone0
    ChangingX=DitioXZone0-ProthomXZone0
    ChangingY=DitioYZone0-ProthomYZone0 #dy=y2-y1
    AmaderDecisionVal=2*ChangingY-ChangingX #d= 2*dy-dx so NE or E
    PurboIncre=2*ChangingY #E=2dy
    UttorPurboIncre=2*(ChangingY-ChangingX) #NE=2dy-2dx
    AkhonX=ProthomXZone0 #whats the current midpoint pixel var
    AkhonY=ProthomYZone0
    glColor3f(RongTahKi[0], RongTahKi[1], RongTahKi[2]) #(1,0,0) current midpoint pixel
    glPointSize(2)
    glBegin(GL_POINTS)
    while AkhonX<=DitioXZone0: #limit cause we go from start to end
        AsholX, AsholY=Zone0ThekeConvertKori(AkhonX, AkhonY, Zone) #convert from zone 0 to original
        glVertex2d(AsholX, AsholY) #opengl gets original zone pixel
        if AmaderDecisionVal>0: #NE
            AkhonY=AkhonY+1 #y+=1
            AmaderDecisionVal=AmaderDecisionVal+UttorPurboIncre  #d=d+NE increment val
        else: #E
            AmaderDecisionVal=AmaderDecisionVal+PurboIncre  #d=d+E increment val
        AkhonX=AkhonX+1 #x always increases by 1
    glEnd()

def HiraTahAkki():
    UporX=HiraX #top part
    UporY=HiraY+HiraKotoHeight #HiraY+15
    Xrightwards=HiraX+HiraKotoWidth # rightside e +10
    Yrightwards=HiraY
    NicheX=HiraX
    NicheY=HiraY-HiraKotoHeight #niche -15
    Xleftwards=HiraX-HiraKotoWidth #left -10
    Yleftwards=HiraY

    MPLTahAki(UporX, UporY, Xrightwards, Yrightwards, HiraRong) #draw top to right edge
    MPLTahAki(Xrightwards, Yrightwards, NicheX, NicheY, HiraRong) #right to bottom edge
    MPLTahAki(NicheX, NicheY, Xleftwards, Yleftwards, HiraRong) #bottom to left edge
    MPLTahAki(Xleftwards, Yleftwards, UporX, UporY, HiraRong) #left to top edge

def DhorarBatiTahAkki():
    if GameShesh==True: #Game shesh then red color catcher
        DhorarRong=(1, 0, 0)
    else:
        DhorarRong=(1,1,1) #white otherwise
    UporBamX=DhorarX-DhorarTopWdith 
    UporBamY=DhorarTopY #dhoreX-55, 45
    UporDanX=DhorarX+DhorarTopWdith
    UporDanY=DhorarTopY #dhoreX+55, 45
    NicherDanX=DhorarX+DhorarNicherWidth
    NicherDanY=DhorarNicherY #dhoreX+40, 25
    NicherBamX=DhorarX-DhorarNicherWidth
    NicherBamY=DhorarNicherY  #dhoreX-40, 25
    MPLTahAki(UporBamX, UporBamY, UporDanX, UporDanY, DhorarRong) # top horizontal line
    MPLTahAki(UporDanX, UporDanY, NicherDanX, NicherDanY, DhorarRong) #right slant line
    MPLTahAki(NicherDanX, NicherDanY, NicherBamX, NicherBamY, DhorarRong) #bottom slant line
    MPLTahAki(NicherBamX, NicherBamY, UporBamX, UporBamY, DhorarRong) #left slant line

def RestartButtonTahAkki():
    MPLTahAki(37,717,80,717,(0,1,1)) #cyan color horizontal line
    MPLTahAki(37,717,56,735,(0,1,1)) #diagonal slant up
    MPLTahAki(37,717,56,699,(0,1,1)) #diagonal slant down

def PauseButtonTahAkki():
    if Thamo==True:
        MPLTahAki(257,696,257,736,(1,0.7,0)) #Game pause then triangle tah draw
        MPLTahAki(257,736,291,716,(1,0.7,0))
        MPLTahAki(291,716,257,696,(1,0.7,0))
    else:
        MPLTahAki(264,696,264,736,(1,0.7,0)) #pause symbol cause game running
        MPLTahAki(276,696,276,736,(1,0.7,0))

def ExitButtonTahAkki():
    MPLTahAki(460,696,503,738,(1,0,0)) #red cross
    MPLTahAki(460,738,503,696,(1,0,0))

def ShobButtonTahAkki(): #makes it easier to call all functions instead of separately in display()
    RestartButtonTahAkki()
    PauseButtonTahAkki()
    ExitButtonTahAkki()
      
def RandomRongBright():
    LalRong=random.uniform(0.5,1) #random value from 0.5 to 1 cause dark chachi nah
    ShobujRong=random.uniform(0.5,1)
    NilRong=random.uniform(0.5,1)
    KonRongBeshiBright= random.randint(0,2) # random 0/1/2
    if KonRongBeshiBright==0: #atleast one color brightest
        LalRong=1
    elif KonRongBeshiBright==1:
        ShobujRong=1
    else:
        NilRong=1
    return (LalRong, ShobujRong, NilRong)

def NotunHiraAshtese(): #Catch korle then reset diamond position
    global HiraX #ager existing var e use korte chai
    global HiraY
    global HiraRong
    ShobcheyeBamerX=HiraKotoWidth+16 #leftmost koto center position 10+15=25
    ShobcheyeDanerX=janalaWidth-HiraKotoWidth-16 #rightmost koto center position max =500-10-15=475
    HiraX=random.randint(ShobcheyeBamerX, ShobcheyeDanerX) #choose a random position between these
    HiraY=HiraShuruY #same top
    HiraRong=RandomRongBright() #color assign

def EkkhonAABBCollisionHoise(): #diamond ar catcher ki overlapping?
    HiraBam=HiraX-HiraKotoWidth #Diamond left and right
    HiraDan=HiraX+HiraKotoWidth
    HiraNiche=HiraY-HiraKotoHeight #diamond top and bottom boundary
    HiraUpore=HiraY+HiraKotoHeight
    DhorarBam=DhorarX-DhorarTopWdith #box tah catcher er left and right top
    DhorarDan=DhorarX+DhorarTopWdith
    DhorarNiche=DhorarNicherY # box tah up and down boundary
    DhorarUpore=DhorarTopY
    XOverlapHoise=(HiraBam<DhorarDan and HiraDan>DhorarBam)
    YOverlapHoise=(HiraNiche<DhorarUpore and HiraUpore>DhorarNiche)
    return XOverlapHoise and YOverlapHoise
    
 # diamond and catcher has to overlap
def CholarPotheCollisionHoise(AgerHiraY): #diamond passes through the catcher check between frames
    #if above catcher prev frame and below catcher current frame tai
    HiraBam=HiraX-HiraKotoWidth #diamond horizontal boundary
    HiraDan=HiraX+HiraKotoWidth
    DhorarBam=DhorarX-DhorarTopWdith #catcher boundary horizontal
    DhorarDan=DhorarX+DhorarTopWdith
    XOverlapHoise=(HiraBam<DhorarDan and HiraDan>DhorarBam) #check horizontal overlap cause diamond
    #vertical move kortese
    if XOverlapHoise==False: #no overlap
        return False
    AgerHiraUpore= AgerHiraY+HiraKotoHeight #diamond top and bottom prev frame
    AgerHiraNiche= AgerHiraY-HiraKotoHeight
    EkhonHiraUpore= HiraY+HiraKotoHeight #diamond top and bottom current frame
    EkhonHiraNiche= HiraY-HiraKotoHeight
    PotherShobcheyeUpore=max(AgerHiraUpore, EkhonHiraUpore) #find the highest vertical point by diamond
    PotherShobcheyeNiche=min(AgerHiraNiche, EkhonHiraNiche) #find lowest vertical point by diamond
    verticalPathOverlapHoise=(PotherShobcheyeNiche<DhorarTopY and PotherShobcheyeUpore>DhorarNicherY)
    return verticalPathOverlapHoise
    #diamond vertical path and catcher vertical range overlap?
def HiraDhorteParsi(AgerHiraY):
    if EkkhonAABBCollisionHoise()==True: #combined the normal and above collision condition
        return True
    return CholarPotheCollisionHoise(AgerHiraY)

def DhorarBatiJanalarModdhe(): #catcher within our window
    global DhorarX
    ShobcheyeBamerPosition=DhorarTopWdith #catcher 55 niche jaite parbe nah
    ShobcheyeDanerPosition=janalaWidth-DhorarTopWdith #max center 500-45=445
    if DhorarX<ShobcheyeBamerPosition:
        DhorarX=ShobcheyeBamerPosition #too left than left limit e atkao
    elif DhorarX>ShobcheyeDanerPosition:
        DhorarX=ShobcheyeDanerPosition

def CheatKoreDhorarBatiChalai(ChangingTime): #cheating mode
    global DhorarX
    HiraKotoDure=HiraX-DhorarX #calc + then diamond rightward, - leftward and center then under diamond
    AbsoluteDistance=abs(HiraKotoDure) #- sign handled
    DistanceOfTheVertical=(HiraY-HiraKotoHeight-DhorarTopY) #vertical distance between catcher top and bottom diamond
    if DistanceOfTheVertical>0: #diamond above catcher
        CatcherPorjontoShomoi=(DistanceOfTheVertical/max(HiraKotoSpeed, 1)) #t=d/s but 0 divide handled by max 1
    else:
        CatcherPorjontoShomoi=ChangingTime #if diamond has reacher catcher height then remaining
        #time is treated as one frame.
    CatcherPorjontoShomoi=max(CatcherPorjontoShomoi, ChangingTime, 0.001) #time never 0 or -
    ProyojonJotoSpeed=(AbsoluteDistance/CatcherPorjontoShomoi) #ReqSpeed=horiDis/remainTime
    AutomaticSpeed=max(DhorabeRaftar, ProyojonJotoSpeed*CheatingKorar,HiraKotoSpeed*2)
    #largest speed possible normal catcher speed, req speed*1.5, diamond speed 2x
    EiFrameECholbe=AutomaticSpeed*ChangingTime #how far the catcher may move during current frame
    if AbsoluteDistance<=EiFrameECholbe: #if catcher can reach the target then stop exactly 
        #at diamond horizontal cordinate
        DhorarX=HiraX
    elif HiraKotoDure>0: #diamond right e then move right
        DhorarX=DhorarX+EiFrameECholbe
    elif HiraKotoDure<0:
        DhorarX=DhorarX-EiFrameECholbe
    DhorarBatiJanalarModdhe() #window baire nah toh?

def GameTahShesh():
    global GameShesh
    global Thamo
    GameShesh=True #animate(), display() stops drawing, arrow bondho, catcher lal
    Thamo=False
    print("Game Over! Score:", KotoScore)

def GameTahRestartKori(): #restart
    global DhorarX
    global HiraKotoSpeed
    global KotoScore
    global Thamo
    global GameShesh
    global CholoCheatKori
    global AgerShomoiKoto
    global AgerKeySpecialTime

    DhorarX=janalaWidth/2 #catcher back to center
    HiraKotoSpeed=ShuruHiraDour #diamond speed back to 100
    KotoScore=0
    Thamo=False #restarted game is not paused
    GameShesh=False
    CholoCheatKori=False #cheat mode stops
    AgerShomoiKoto=time.time()
    AgerKeySpecialTime=time.time() #time before and current
    NotunHiraAshtese() #large change in time hotat nah hoy tai aita
    print("Starting Over")

def keyboard_listener(key, x, y): #x ar y mouse position when key pressed
    global CholoCheatKori
    if key == b'c' or key == b'C': #cheat mode
        CholoCheatKori= not CholoCheatKori # f becomes t, t becomes f
        if CholoCheatKori==True:
            print("Cheat Mode: ON")
        else:
            print("Cheat Mode: OFF")
    glutPostRedisplay()

def special_key_listener(key, x, y):
    global DhorarX
    global AgerKeySpecialTime
    if Thamo==True:
        return 
    if GameShesh==True:
        return
    if CholoCheatKori==True:
        return
    #manual movement off when game paused, over, cheating
    EkhonShomoi=time.time() #current time
    ChangingTime=EkhonShomoi-AgerKeySpecialTime #koto time gese since last press
    AgerKeySpecialTime=EkhonShomoi
    if ChangingTime>ShorbochoChangingTime: #limit elapsed time to 0.05
        ChangingTime=ShorbochoChangingTime
    if ChangingTime<=0:
        ChangingTime=0.01
    EiBarKotoCholbe=DhorabeRaftar*ChangingTime #calc movement d=400*changeT
    if key == GLUT_KEY_LEFT:
        DhorarX=DhorarX-EiBarKotoCholbe
    elif key == GLUT_KEY_RIGHT:
        DhorarX=DhorarX+EiBarKotoCholbe
    DhorarBatiJanalarModdhe() #window bhitore toh?
    glutPostRedisplay()

def convert_coordinate(x,y): #for mouse cause GLUT and OpenGL use dif y direction.
    #glut top y=0 and y increase down but OpenGL ulta bottom y=0 y increase upward
    OpenGLX=x
    OpenGLY=janalaHeight-y
    return (OpenGLX, OpenGLY)

def mouse_listener(button, state, x, y):
    global Thamo
    global AgerShomoiKoto
    global AgerKeySpecialTime

    if button==GLUT_LEFT_BUTTON and state==GLUT_DOWN:
        MouseX, MouseY=convert_coordinate(x,y)
        if (21<=MouseX<=96 and 685<=MouseY<=749): #restart button range
            GameTahRestartKori()
        elif (230<=MouseX<=316 and 685<=MouseY<=749): #play or pause area
            if GameShesh==False:
                Thamo=not Thamo
                AgerShomoiKoto=time.time()
                AgerKeySpecialTime=time.time()
                if Thamo==True:
                    print("Game Paused")
                else:
                    print("Game Resumed")
        elif(439<=MouseX<=524 and 685<=MouseY<=749): #exit area
            print("Goodbye! Score:", KotoScore)
            glutLeaveMainLoop()
            return
    glutPostRedisplay()

def animate():
    global AgerShomoiKoto
    global HiraY
    global HiraKotoSpeed
    global KotoScore

    EkhonShomoi= time.time() #current time
    ChangingTime=EkhonShomoi-AgerShomoiKoto 
    AgerShomoiKoto=EkhonShomoi
    if ChangingTime>ShorbochoChangingTime: #large change in time limited to 0.05
        ChangingTime=ShorbochoChangingTime
    if ChangingTime<0: #neg time dif not allowed
        ChangingTime=0
    if Thamo==False and GameShesh==False: #game only updates when these arent happening.
        if CholoCheatKori==True:
            CheatKoreDhorarBatiChalai(ChangingTime) #cheat mode update catcher before moving diamond
        AgerHiraY=HiraY #prev y position of diamond
        HiraKotoSpeed=(HiraKotoSpeed+HiraAccel*ChangingTime) #v new= v old +a*change in time
        HiraY=(HiraY-HiraKotoSpeed*ChangingTime) #aita diamond niche namai
        if HiraDhorteParsi(AgerHiraY)==True: #score update if diamond caught
            KotoScore=KotoScore+1
            print("Score:", KotoScore)
            NotunHiraAshtese()
        elif HiraY-HiraKotoHeight<=0: #check diamond has hit the bottom
            GameTahShesh()
    glutPostRedisplay()

def setup_projection():
    glViewport(0,0,janalaWidth,janalaHeight)
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    glOrtho(0,janalaWidth,0,janalaHeight,0,1)
    glMatrixMode(GL_MODELVIEW)

def display():
    """Main display callback for rendering each frame."""
    glClearColor(0,0,0,0)
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    setup_projection()
    ShobButtonTahAkki() #draw the buttons
    DhorarBatiTahAkki() #draw the catcher
    if GameShesh==False: #draw if game not over
        HiraTahAkki()
    glutSwapBuffers()

def main():
    global AgerShomoiKoto
    global AgerKeySpecialTime
    glutInit()
    glutInitDisplayMode(GLUT_RGBA)
    glutInitWindowSize(janalaWidth, janalaHeight)
    glutInitWindowPosition(100, 50)
    glutCreateWindow(b"Catch the Diamonds!")

    # Register callback functions
    glutDisplayFunc(display)
    glutIdleFunc(animate)
    glutKeyboardFunc(keyboard_listener)
    glutSpecialFunc(special_key_listener)
    glutMouseFunc(mouse_listener)
    AgerShomoiKoto=time.time()
    AgerKeySpecialTime=time.time()
    NotunHiraAshtese()
    glutMainLoop()


# ===== Entry Point =====
if __name__ == "__main__":
    main()