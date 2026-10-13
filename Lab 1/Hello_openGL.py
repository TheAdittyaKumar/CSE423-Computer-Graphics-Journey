# ===== OpenGL 2D Point Drawing Example =====
# This program displays a single yellow point using PyOpenGL + GLUT.

from OpenGL.GL import *     # Core OpenGL functions (drawing, colors, etc.)
from OpenGL.GLUT import *   # GLUT library (window creation, display, loop)
from OpenGL.GLU import *    # OpenGL Utility Library (projection utilities)
import random #python library so we can use if we want. We can use many python functions.
# --- Global coordinates of the point ---
x, y = 250, 250


# ===== Function to draw a single point =====
def draw_points(x, y):
    glPointSize(15)          # Set pixel size of the point (default = 1)
    glBegin(GL_POINTS)      # Start drawing points
    glVertex2f(x, y)        # Specify the (x, y) coordinate of the point
    glVertex2f(100,100)        # Specify the (x, y) coordinate of the point
    glColor3f(0.0, 1.0, 0.0)  # Set color to yellow (R, G, B)
    glVertex2f(100,100)
    glEnd()                 # Finish drawing

    #line
    glBegin(GL_LINES)
    glVertex2f(300, 400)
    glColor3f(0.0, 1.0, 1.0)
    glVertex2f(50, 20)
    glEnd()

    #triangle
    glBegin(GL_TRIANGLES)
    glVertex2f(100, 100)
    glColor3f(0.0, 1.0, 0.0)
    glVertex2f(200, 100)
    glColor3f(0.0, 1.0, 1.0)
    glVertex2f(150, 200)
    glEnd()

    #quad
    glBegin(GL_QUADS)
    glVertex2f(0, 0) #clockwise or anticlockwise is important.
    glColor3f(random.random(), 1.0, 0.0)
    glVertex2f(200, 0)
    glColor3f(0.0, 1.0, 1.0)
    glVertex2f(200, 200)
    glColor3f(1.0, 0.0, 0.0)
    glVertex2f(0, 200)
    glEnd()

# ===== Set up 2D coordinate system =====
def setup_projection():
    glViewport(0, 0, 500, 500)     # Define the portion of the window to render to
    glMatrixMode(GL_PROJECTION)    # Switch to the projection matrix
    glLoadIdentity()               # Reset the projection matrix
    glOrtho(0.0, 500, 0.0, 500, 0.0, 1.0)  # Define a 2D orthographic projection
    glMatrixMode(GL_MODELVIEW)     # Switch back to the modelview matrix


# ===== Display callback =====
def display():
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)  # Clear screen and depth buffer
    glLoadIdentity()                                    # Reset transformations
    setup_projection()                                  # Set up coordinate system
    glColor3f(1.0, 1.0, 0.0)                            # Set color (R, G, B) → Yellow
    draw_points(x, y)                                   # Draw the point
    glutSwapBuffers()                                   # Swap buffers (double buffering)


# ===== Main entry point =====
def main():
    glutInit()                               # Initialize GLUT
    glutInitDisplayMode(GLUT_RGBA)           # Set display mode: RGBA color
    glutInitWindowSize(500, 500)             # Set window size (width, height)
    glutInitWindowPosition(0, 0)             # Set window position (top-left corner)
    glutCreateWindow(b"OpenGL 2D Point")     # Create window with a title
    glutDisplayFunc(display)                 # Register display callback
    glutMainLoop()                           # Start the main event-processing loop


# ===== Run the program =====
if __name__ == "__main__":
    main()
