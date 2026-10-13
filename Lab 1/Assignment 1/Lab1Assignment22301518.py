#RAIN: make a list like [(start, end),(start, end), (start, end), etc]
#for downwards decrease y value
#for leftwards decrease x value
#for rightwards increase x value
import random
from OpenGL.GL import *      
from OpenGL.GLUT import *    
from OpenGL.GLU import *    

LALrong=0.0 #these three help background so raat ar din color change possible.
SHOBUJrong=0.0
NILrong=0.0

rainFallingRandomListValue=[] #protek rainfall er x,y position save koro.
for rainfaller in range(139): #135 alada raindrops
    xPositionOfRain= int(random.random()*1000) #random 0 theke 1 porjonto value nei and we multiply it by 1000 so 0 to 999 value pai
    yPositionOfRain= int(random.random()*500)
    rainFallingRandomListValue.append([xPositionOfRain, yPositionOfRain])

SpeedOfTheRainFalling= 0.65 #y coordinate decrease amount jokhon animation kaj hoy
LengthOfTheRainFalling= 17
BendingOfTheRainFalling= 0 # 0 maneh niche direct, - value maneh leftward brishti ar + maneh rightward rain.


# ===== Set up 2D coordinate system =====
def setup_projection():
    glViewport(0, 0, 1000, 500)  #(x,y,width,height) Physical window coordinates. The lower left corner of the viewport rectangle, in pixels.
        #screen origin is top left corner (0,0) and window origin is bottom left corner (0,0).
    glMatrixMode(GL_PROJECTION)    # Switch to the projection matrix jeita scene coordinates map kore window teh.
    glLoadIdentity()               # Reset the projection matrix so ager projection setting accumalate nah hoy
    glOrtho(0.0, 1000, 0.0, 500, 0, 1)
        #glOrtho (xMin, xMax, yMin, yMax, zMin, zMax) bottom left corner is (0,0)
        #  and top right corner is (1000,500)
    glMatrixMode(GL_MODELVIEW)     # Switch back to the modelview matrix


def rainFallingEffect():
    glLineWidth(1) 
    glBegin(GL_LINES)
    for rainfalling in rainFallingRandomListValue: #use the list of brishti we made earlier
        glColor3f(0.5, 0.5, 1)
        xPositionOfRain= rainfalling[0] #Index 0 tah current x coordinate handle kore ([This],)
        yPositionOfRain= rainfalling[1] #Index 1 tah current y coordinate handle kore (,[This])
        glVertex2d(xPositionOfRain, yPositionOfRain) #original value tah
        glVertex2d(xPositionOfRain+BendingOfTheRainFalling, yPositionOfRain-LengthOfTheRainFalling)
        # So bend korle upore x shathe bend amount tah add kori or substract kori and length of rain depends on amra ki set kori.
    glEnd()

def landInTheBackgroundOne():
    glBegin(GL_TRIANGLES)
    glColor3f(0.29, 0.13, 0.03)
    glVertex2d(0, 0) #aita bottom left
    glVertex2d(1000, 0) #aita bottom right
    glVertex2d(1000, 310) #aita top right

    glColor3f(0.28, 0.12, 0.02)
    glVertex2d(0, 0) #aita bottom left
    glVertex2d(1000, 310) #aita top right
    glVertex2d(0, 310) #aita top left

    glEnd()

def treesInTheBackgroundMultiple():
    glBegin(GL_TRIANGLES)
    for trees in range(-30,1000,75):
        glColor3f(0.4,0.38,0.08)
        glVertex2d(trees, 250) #aita bottom left #0
        glVertex2d(trees + 80, 250) #aita bottom right #80 so 80 adds on
        glColor3f(0.22,0.72,0.18)
        glVertex2d(trees + 80/2, 399) #aita middle point top cause triangle. 
    glEnd()

def houseBodyOnTopOfLandOne():
    glBegin(GL_TRIANGLES)

    glColor3f(0.92, 0.82, 0.66)
    glVertex2d(287, 128) #bottom left aita
    glVertex2d(643, 128) #bottom right aita
    glVertex2d(643, 307) #top right aita

    glColor3f(0.92, 0.82, 0.66)
    glVertex2d(287, 128) #bottom left aita
    glVertex2d(643, 307) #top right aita
    glVertex2d(287, 307) #top left aita
    glEnd()

def houseRoofOnTopOfLandOne():
    glBegin(GL_TRIANGLES)
    glColor3f(0.53, 0.13, 0.06)
    glVertex2d(267, 307) #left corner tah
    glVertex2d(663, 307)  #right corner tah
    glVertex2d(465, 400) #top
    glEnd()

def windowOnHouseBodyOne():
    glBegin(GL_TRIANGLES)
    glColor3f(0, 0, 0.5) #left side window aigula
    glVertex2d(332, 207) #bottom left
    glVertex2d(408, 207) #bottom right
    glVertex2d(408, 263) #top right aita

    glColor3f(0, 0, 0.6)
    glVertex2d(332, 207) #bottom left
    glVertex2d(408, 263) #top right aita
    glVertex2d(332, 263) # top left
    

    glColor3f(0, 0, 0.6)  #right side window aigula
    glVertex2d(521, 207)  #bottomleft aita
    glVertex2d(597, 263) #top right aita
    glVertex2d(521, 263) #top left aita

    glColor3f(0, 0, 0.5)
    glVertex2d(521, 207) #bottom left aita
    glVertex2d(597, 207) #bottom right side aita
    glVertex2d(597, 263) #top right side aita
    glEnd()

def lineOntheWindows():
    glLineWidth(3)
    glBegin(GL_LINES)
    glColor3f(0.8, 0.9, 0.8)
    glVertex2d(370, 207) #vertical lines ageh
    glVertex2d(370, 263) 

    glVertex2d(559, 263) #right window
    glVertex2d(559, 207)

    glVertex2d(332, 235) #Horizontal lines aikhan theke
    glVertex2d(408, 235)

    glVertex2d(521, 235) #right window
    glVertex2d(597, 235) 

    glEnd()

def doorOnTheHouseBody():
    glBegin(GL_TRIANGLES)
    glColor3f(0.12, 0.28, 0.48)
    glVertex2d(430, 128) #bottom left aita
    glVertex2d(500, 128) #bottom right aita
    glVertex2d(500, 250) #top right aita

    glVertex2d(430, 128) #Aita bottom left
    glVertex2d(500, 250) #aita top right
    glVertex2d(430, 250) #aita top left
    glEnd()

def doorKnobOnTheHouseBody():
    glPointSize(7)
    glBegin(GL_POINTS)
    glColor3f(0.92, 0.65, 0.12)
    glVertex2f(485, 200)
    glEnd()

# ===== Display callback =====
def display():
    global LALrong, SHOBUJrong, NILrong 
    glClearColor(LALrong, SHOBUJrong, NILrong, 1.0) #rgb ar alpha
    glLoadIdentity() # Reset transformations   
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)  # Before drawing it clears screen and depth buffer  
    setup_projection()                                 
    landInTheBackgroundOne()
    treesInTheBackgroundMultiple()
    houseBodyOnTopOfLandOne()
    houseRoofOnTopOfLandOne()
    windowOnHouseBodyOne()
    lineOntheWindows()
    doorOnTheHouseBody()
    doorKnobOnTheHouseBody()
    rainFallingEffect()
    glutSwapBuffers() #complete frame ke display kore window teh

def animate():
    for rainfalling in rainFallingRandomListValue: #protek raindrop ke process koro
        rainfalling[1]=(rainfalling[1]-SpeedOfTheRainFalling) #0.65 kore y coordinate decrease koro so nichei porbe brishti since y decrease
        rainfalling[0]=(rainfalling[0]+BendingOfTheRainFalling*0.03) #bend 0 niche, negative maneh left and positive maneh right
        if rainfalling[1]<-LengthOfTheRainFalling: #y judi y=0 niche then new positions lagbe 1.Horizontal [0] and 2. Vertical [1]
            # y tah 500 theke beshi so akki row teh reset nah hoy
            rainfalling[0]=int(random.random()*1000)
            rainfalling[1]= 500+ int(random.random()*80)

        if rainfalling[0]<-LengthOfTheRainFalling: #left side diye exit? then y same rakho but right e move koro
            rainfalling[0]= rainfalling[0] + 1000 + 2*LengthOfTheRainFalling 

        elif rainfalling[0]>1000+LengthOfTheRainFalling: #right side diye exit? then y same rakho but left e move koro
            rainfalling[0]= rainfalling[0]-1000 - 2*LengthOfTheRainFalling
    glutPostRedisplay()

def keyboard_listener(key, x, y):
    global LALrong, SHOBUJrong, NILrong #day night er jonne lagbe variable gula
    if key == b'7': 
        LALrong= LALrong+0.018
        SHOBUJrong= SHOBUJrong+0.018
        NILrong= NILrong+0.018
        if LALrong>=1.0: #1 er upore jeno nah jai cause 1 maneh white
            LALrong=1.0
            SHOBUJrong=1.0
            NILrong=1.0
        print("Din hocche slowly")
    elif key == b'1': 
        LALrong= LALrong-0.018
        SHOBUJrong= SHOBUJrong-0.018
        NILrong= NILrong-0.018
        if LALrong<=0.0: #0 niche jeno nah jai cause black
            LALrong=0.0
            SHOBUJrong=0.0
            NILrong=0.0
        print("Raat hocche slowly")
    glutPostRedisplay() #update request koro

def special_key_listener(key, x, y):
    global BendingOfTheRainFalling #varaible lagbe cause brishti effect animation
    if key == GLUT_KEY_LEFT:
        BendingOfTheRainFalling=(BendingOfTheRainFalling-1) #decrease x but till limit
        if BendingOfTheRainFalling<-12:
            BendingOfTheRainFalling= -12
        print("Look rain is bending left")
    elif key == GLUT_KEY_RIGHT:
        BendingOfTheRainFalling=(BendingOfTheRainFalling+1) #increase x but BendingOfTheRainFalling er limit
        if BendingOfTheRainFalling>16:
            BendingOfTheRainFalling=16
        print("Look rain is bending right")
    glutPostRedisplay()

def main():
    glutInit()                               
    glutInitDisplayMode(GLUT_RGBA)                                           
    glutInitWindowSize(1000, 500)             
    glutInitWindowPosition(500, 250)             
    glutCreateWindow(b"Task 1 CODED for Assignment one")                              
    glutDisplayFunc(display)                 
    glutIdleFunc(animate)
    glutKeyboardFunc(keyboard_listener)
    glutSpecialFunc(special_key_listener)
    glutMainLoop() 

if __name__ == "__main__":
    main()








#-----------------------------------------------------------------------------------------------------------------------------



# TASK 2 BEGINS FROM HERE SIR

#x and y both increase like 1,1 right ward so point tah move kore 45 degree.
#x jokhon decrease kore and y increases then point moves left and 135 degrees.
#x jokhon decrease kore and y decrease kore then point moves left and down at 225
#x increase korlo and y decrease korlo then point goes right and around 315.
#[(-1,1),(1,1),(-1,-1),(1,-1)] choose one at random and then increase or decrease x and y accordingly.
#bouncing against wall can be executed by using above list carefully.
#colour blink python time.py pause chara
#space diye freeze

import random
import time 
from OpenGL.GL import *      
from OpenGL.GLUT import *    
from OpenGL.GLU import *  

WidthofTheWindowOfThis=1000
HeightofTheWindowOfThis=500
LeftBoundarybox=0
rightBoundarybox=WidthofTheWindowOfThis
BottomBoundarybox=0
TopOfBox=HeightofTheWindowOfThis

LeastSpeedPossible= 0 #Speed 0 niche jeno nah jai
PointsAreBlinking= False #Original color show korte thakbe #true blink
StartingBlinkingTimerPoints= 0 #Left click korle blinking korar time save kore
HalfBlinkCycleTimer= 0.5 # requirement chilo within a second blink toh 0.5s real colour then 0.5s black
ShobFrozen= False #False logic shob normal #True hoile FREEZE
TimeJokhonFreezeShuru=0    # Spacebar click korar exact time

ListPointsToMoveAbout=[] #Protek point er info ai list e save hoy
MovingPointsSizesAmount= 6
MovingPointsSpeedAmount= 0.12 #koto distance move korbe protek animation e
DirectionsToChooseFrom= [(-1,1),(1,1),(-1,-1),(1,-1)] #135 45 225 315

def coordinatesToConvertTo(ValueOfX, yValue): #Mouse coordinate origin window er top left corner e
                                            #OpenGL coordinate origin window bottom left corner
    XConvertedTo=ValueOfX
    YConvertedTo = HeightofTheWindowOfThis-yValue #So y tah change kora lage to OpenGL
    return XConvertedTo, YConvertedTo

def setup_projection():
   
    glViewport(0, 0, WidthofTheWindowOfThis, HeightofTheWindowOfThis) #pura 1000 width ar 500 height window drawing area use korbo
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    glOrtho(0, WidthofTheWindowOfThis, 0, HeightofTheWindowOfThis, 0, 1) #bottom left 0,0 ar top right 1000, 500
    glMatrixMode(GL_MODELVIEW)

def display():
    
    glClearColor(0,0,0,1) #window background black korlam
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    setup_projection()

    MovingPointsDrawingTime() #list e points jah save korechi oitai draw korbo

    glutSwapBuffers()

def MovingPointsDrawingTime():
    glPointSize(MovingPointsSizesAmount)
    glBegin(GL_POINTS)
    for PointThatisMoving in ListPointsToMoveAbout: #list er protek point ke alada draw kortesi
        PositionOfXValue = PointThatisMoving[0] #index 0 akhon x position
        PositionOfYValue = PointThatisMoving[1] #index 0 y position tah akhon
        ColourLalrong= PointThatisMoving[4] #random RGB 
        ColourShobujrong= PointThatisMoving[5]
        ColourNilrong= PointThatisMoving[6]

        if PointsAreBlinking==True: #left click diye blinking active thakle
            if ShobFrozen==True: #Freezed? Then time start fixed current time, current time continuously change hobena
                CurrentTimeBlinkKorbeJeh=TimeJokhonFreezeShuru
            else:
                CurrentTimeBlinkKorbeJeh=time.time() #Freeze nai be normal then

            TimePassedSinceBlinkingStarted=(CurrentTimeBlinkKorbeJeh-StartingBlinkingTimerPoints) #blinking start theke koto time passes
            CurrentBlinkPart=int(TimePassedSinceBlinkingStarted/HalfBlinkCycleTimer)%2 #mod cause 0 or 1 value ashbe answer. 0.5s time divide kore
            if CurrentBlinkPart==1: #blink e black color
                glColor3f(0,0,0)
            else: #back to original colors
                glColor3f(ColourLalrong,ColourShobujrong,ColourNilrong)
        else: #original colors 
            glColor3f(ColourLalrong,ColourShobujrong,ColourNilrong)
        glVertex2f(PositionOfXValue,PositionOfYValue) #current x ar y position onujai draw
    glEnd()

def mouse_listener(button, state, x, y):
    global PointsAreBlinking
    global StartingBlinkingTimerPoints

    if ShobFrozen==True: #freeze thakle cant use the mouse
        return

    if button == GLUT_RIGHT_BUTTON and state == GLUT_DOWN: #create point
        convertedXValue, convertedYValue = coordinatesToConvertTo(x,y) #Mouse to opengl coordinate
        RandomDirectionDeciderPosition= int(random.random()*4) #random toh 0-1 answer dibe int ar 3 helps bring index 0,1,2,3
        DirectionThatsChosen= DirectionsToChooseFrom[RandomDirectionDeciderPosition] #choose a random direction from random index
        YDirection=DirectionThatsChosen[1] #random direction pailam oitar Y value direction
        XDirection=DirectionThatsChosen[0] #random direction pailam oitar X value direction
        RandomColourLalEdition= random.random() #Randomly RGB dao points er
        RandomColourShobujEdition= random.random()
        RandomColourNilEdition= random.random()
        # new point jah banalam oitar position, direction and colour akta list e save korlam.
        NewPointThatWillMove= [convertedXValue,convertedYValue,XDirection,YDirection,RandomColourLalEdition,RandomColourShobujEdition,RandomColourNilEdition]
        ListPointsToMoveAbout.append(NewPointThatWillMove) #add the new point to thiss main list of points
        print("New point made! At this: ", convertedXValue,convertedYValue, "The direction is:",XDirection,YDirection)

    elif button == GLUT_LEFT_BUTTON and state == GLUT_DOWN: #BLINKING!
        if PointsAreBlinking== False: #Blinking off chilo and pressing it will turn it on
            PointsAreBlinking = True
            StartingBlinkingTimerPoints=time.time() #Blinking start korsi oitar time tah save koro.
            print("Look points are blinking!")
        else: #OFF
            PointsAreBlinking = False
            print("Oh no they stopped blinking.")
    glutPostRedisplay() #update request dite thako

def animate(): 
    if ShobFrozen==False: #no freeze then work korbe
        for PointThatisMoving in ListPointsToMoveAbout: #list er protek point update korbo
            PointThatisMoving[0]=(PointThatisMoving[0]+PointThatisMoving[2]*MovingPointsSpeedAmount) 
            #New x position depends on old x, x direction and speed.
            PointThatisMoving[1]=(PointThatisMoving[1]+PointThatisMoving[3]*MovingPointsSpeedAmount) 
            #New y position depends on old y, y direction and speed.
            if PointThatisMoving[0]<=LeftBoundarybox: #Left boundary cross korle. Then x direction sign reverse koro so right e move kore.
                PointThatisMoving[0]=LeftBoundarybox
                PointThatisMoving[2]=-PointThatisMoving[2]
            elif PointThatisMoving[0]>=rightBoundarybox: #right boundary cross korle. x er sign abar reverse koro.
                PointThatisMoving[0]=rightBoundarybox
                PointThatisMoving[2]=-PointThatisMoving[2]
            if PointThatisMoving[1]<=BottomBoundarybox: #bottom boundary cross korle then y direction reverse koro.
                PointThatisMoving[1]=BottomBoundarybox
                PointThatisMoving[3]=-PointThatisMoving[3]
            elif PointThatisMoving[1]>=TopOfBox: #Top boundary cross korle y ke reverse koro so 1 turns to -1
                PointThatisMoving[1]=TopOfBox
                PointThatisMoving[3]=-PointThatisMoving[3]
    glutPostRedisplay() #update frames request

def special_key_listener(key, x, y): 
    global MovingPointsSpeedAmount
    global LeastSpeedPossible
    if ShobFrozen==True: #freeze thakle kaj korbe nah
        return
    if key == GLUT_KEY_UP:
        MovingPointsSpeedAmount=round(MovingPointsSpeedAmount+0.03,2) #floating point tah extra decimal remove korte help korbe
        print("Speed has been increased to:", MovingPointsSpeedAmount)
    elif key == GLUT_KEY_DOWN:
        if MovingPointsSpeedAmount-0.03<=LeastSpeedPossible: #0 limit speed
            MovingPointsSpeedAmount=LeastSpeedPossible
        else:
            MovingPointsSpeedAmount=round(MovingPointsSpeedAmount-0.03,2) #speed decrease koro
        print("Speed has been decreased to:", MovingPointsSpeedAmount)
    glutPostRedisplay()

def keyboard_listener(key, x, y):
    global ShobFrozen
    global TimeJokhonFreezeShuru
    global StartingBlinkingTimerPoints
    if key == b' ': #aita spacebar
        if ShobFrozen==False: #First space freeze
            ShobFrozen=True
            TimeJokhonFreezeShuru=time.time() #save current time freeze start howar
            print("Oh! Time has been FREEZED!")
        else:  #unfreeze when pressed again
            TimeThatsSpentFrozed=(time.time()-TimeJokhonFreezeShuru)
            ShobFrozen=False
            if PointsAreBlinking==True: #blinking active thakle adjust timer for that
                StartingBlinkingTimerPoints=(StartingBlinkingTimerPoints+TimeThatsSpentFrozed) #frozen time starting timer er shathe add korle
                #blinking same phase theke abar continue korbe.
            print("UNFREEZE!")
    glutPostRedisplay()

    # ===== Main Function =====
def main():
    glutInit()
    glutInitDisplayMode(GLUT_RGBA)
    glutInitWindowSize(WidthofTheWindowOfThis, HeightofTheWindowOfThis)
    glutInitWindowPosition(100, 100)
    glutCreateWindow(b"Task 2 CODED for Assignment one")

    # Register callback functions
    glutDisplayFunc(display)
    glutIdleFunc(animate)
    glutMouseFunc(mouse_listener)
    glutSpecialFunc(special_key_listener)
    glutKeyboardFunc(keyboard_listener)
    glutMainLoop()


# ===== Entry Point =====
if __name__ == "__main__":
    main()
