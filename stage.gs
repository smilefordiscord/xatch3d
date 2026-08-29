costumes "assets/blank.svg";
hide;
%include std/math
%include libs/vector.gs

struct Node {nx, ny, nz, d, front, back, first, count, cx, cy, cz, r};
struct Tri  {a, b, c}; # indices into bsp_verts

var FPS = 0;
var FPSC = 0;
var FPST = 0;
var lastTime = 0;
var deltaTime = 0.0333;
var renderedTris = 0;
var frac = 0;

var tickrate = 0.015625;
var accumulator = 0;

var Vector2 ScreenSize = VEC2(0, 0);
var Vector2 ScreenSizeHalf = VEC2(0, 0);

list Map "./assets/models/dust2.obj";
var mapLoaded = false;

var cam_yaw = 0;        # radians. 0 looks down -Z. positive turns left.
var cam_pitch = 0;      # radians. positive looks up.
var Vector3 prevCamPos;
var Vector3 camPos = VEC3_ZERO;
var Vector3 playerPos = VEC3_ZERO;
var Vector3 velocity;
var velocityText = 0;

#bsp
list Node nodes = [];          # node 1 is the root. index 0 means "no child".
list Vector3 bsp_verts = [];   # world space, grows as splits create vertices
list Tri bsp_tris = [];        # final tris, grouped contiguously by node
list Vector3 tri_cols = [];    # parallel to bsp_tris. flat rgb, 0..255.
list trav= [];                 # traversal stack (see trav_sp)

list Vector2 clip_poly = [];
list Vector2 clip_tmp = [];

onflag {
    erase_all;
    broadcast "render-text";
    broadcast_and_wait "build_bsp";

    FPSC = 0;
    FPST = 0;
    lastTime = 0;

    playerPos = Vector3{x: 0, y: 0, z: 0};
    cam_pitch = 0;
    cam_yaw = 0;
    prevCamPos = playerPos;
    velocity = Vector3{x: 0, y: 0, z: 0};

    forever {
        deltaTime = timer() - lastTime;
        if deltaTime > 1 {
            deltaTime = 1;
        }
        FPST += deltaTime;
        lastTime = timer();
        FPSC += 1;
        if FPST > 1 {
            FPS = round(FPSC / FPST);
            FPST = 0;
            FPSC = 0;
        }

        #fix your timestep!
        accumulator += deltaTime;
        if accumulator > tickrate  {
            until accumulator < tickrate {
                accumulator -= tickrate;
                broadcast_and_wait "tick";
            }
        }
        frac = CLAMP(accumulator / tickrate, 0, 1);
        broadcast "render";
        broadcast "render-text";
    }
}