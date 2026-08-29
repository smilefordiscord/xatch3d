costumes "assets/2x2.svg";
%include std/math
%include libs/vector.gs

list Vector3 bsp_view  = []; # bsp_verts transformed into eye space, per frame

%define RESOLUTION 2
%define ACCURACY 1

var Vector3 smoothCamPos;
var Vector2 prevMousePos;

# view matrix rows
var Vector3 vm_r;
var Vector3 vm_u;
var Vector3 vm_b;

# frustum planes in world space
var Vector3 fr_l; # left
var Vector3 fr_r; # right
var Vector3 fr_t; # top
var Vector3 fr_b; # bottom
var Vector3 fr_f; # forward, for near/far
var fr_vis = 0;

# light direction, in view space
var Vector3 lt;

var FOV = 90;
var FOCAL = 240;
%define NEAR 1

### far culling/fog/skybox
%define FAR 1800
%define FOG_START 900
%define SKY_R 200
%define SKY_G 225
%define SKY_B 255
%define SKY_COLOR Vector3{x: SKY_R, y: SKY_G, z: SKY_B}
### shading
%define AMBIENT 0.4
%define LIGHT_DIR Vector3{x: 0.4, y: 0.8, z: 0.45}

%define LOOK_SPEED PI

var mouseLocked = false;

var resizeDelay = 0;

proc build_view_matrix {
    local cy = cos(DEG(cam_yaw));
    local sy = sin(DEG(cam_yaw));
    local cp = cos(DEG(cam_pitch));
    local sp = sin(DEG(cam_pitch));

    vm_r = VEC3(cy, 0, -sy);
    vm_u = VEC3(sy * sp, cp, cy * sp);
    vm_b = VEC3(sy * cp, -sp, cy * cp);

    # world light direction projected onto the view basis
    local Vector3 lightDir = LIGHT_DIR;
    lt = VEC3(VEC3_DOT(vm_r, lightDir), VEC3_DOT(vm_u, lightDir), VEC3_DOT(vm_b, lightDir));
}

#frustum culling
proc build_frustum {
    local kx = 1 / sqrt(FOCAL * FOCAL + ScreenSizeHalf.x * ScreenSizeHalf.x);
    local ky = 1 / sqrt(FOCAL * FOCAL + ScreenSizeHalf.y * ScreenSizeHalf.y);

    local ax = FOCAL * kx;             # +-x component of the side planes
    local az = -1 * ScreenSizeHalf.x * kx; # z component, shared by left/right
    local ay = FOCAL * ky;
    local bz = -1 * ScreenSizeHalf.y * ky; # z component, shared by top/bottom
    local nax = -1 * ax;
    local nay = -1 * ay;

    # each plane is its view-space normal rotated back into world space,
    # i.e. normal.x * R + normal.y * U + normal.z * B with the zero term dropped
    fr_l = VEC3_LINCOMB2(vm_r, ax,  vm_b, az);  # view normal ( ax,   0, az)
    fr_r = VEC3_LINCOMB2(vm_r, nax, vm_b, az);  # view normal (-ax,   0, az)
    fr_t = VEC3_LINCOMB2(vm_u, nay, vm_b, bz);  # view normal (  0, -ay, bz)
    fr_b = VEC3_LINCOMB2(vm_u, ay,  vm_b, bz);  # view normal (  0,  ay, bz)

    # forward is -B, since the camera looks down -z in view space
    fr_f = VEC3_NEG(vm_b);
}

proc sphere_visible Vector3 c, r {
    local Vector3 d = VEC3_SUB($c, smoothCamPos);
    fr_vis = 0;

    local f = VEC3_DOT(d, fr_f);
    if f < NEAR - $r { stop_this_script; }
    if f > FAR + $r { stop_this_script; }

    local nr = -1 * $r;
    if VEC3_DOT(d, fr_l) < nr { stop_this_script; }
    if VEC3_DOT(d, fr_r) < nr { stop_this_script; }
    if VEC3_DOT(d, fr_t) < nr { stop_this_script; }
    if VEC3_DOT(d, fr_b) < nr { stop_this_script; }

    fr_vis = 1;
}

var Vector3 toViewReturn;
proc to_view Vector3 p {
    local Vector3 d = VEC3_SUB($p, smoothCamPos);
    toViewReturn = Vector3 {
        x: VEC3_DOT(d, vm_r),
        y: VEC3_DOT(d, vm_u),
        z: VEC3_DOT(d, vm_b)
    };
}

proc transform_vertices {
    delete bsp_view;
    local i = 0;
    repeat length bsp_verts {
        i++;
        to_view bsp_verts[i];
        add toViewReturn to bsp_view;
    }
}

%define project(vec) (Vector2 {x: vec.x * FOCAL / -vec.z, y: vec.y * FOCAL / -vec.z})

var Vector3 clipLerpReturn;
proc clip_lerp Vector3 a, Vector3 b {
    local t = (-NEAR - $a.z) / ($b.z - $a.z);
    clipLerpReturn = Vector3 {
        x: $a.x + ($b.x - $a.x) * t,
        y: $a.y + ($b.y - $a.y) * t,
        z: -NEAR
    };
}

proc draw_tri_view Vector3 a, Vector3 b, Vector3 c {
    local inside = 0;
    if $a.z <= -NEAR { inside++; }
    if $b.z <= -NEAR { inside++; }
    if $c.z <= -NEAR { inside++; }

    if inside == 3 {
        draw_tri_clipped project($a), project($b), project($c);
    } elif inside == 1 {
        local Vector3 i0 = $a;
        local Vector3 o0 = $b;
        local Vector3 o1 = $c;
        if $b.z <= -NEAR {
            i0 = $b; o0 = $c; o1 = $a;
        } elif $c.z <= -NEAR {
            i0 = $c; o0 = $a; o1 = $b;
        }
        clip_lerp i0, o0;
        local Vector3 v1 = clipLerpReturn;
        clip_lerp i0, o1;
        draw_tri_clipped project(i0), project(v1), project(clipLerpReturn);
    } elif inside == 2 {
        local Vector3 o0 = $a;
        local Vector3 i0 = $b;
        local Vector3 i1 = $c;
        if $b.z > -NEAR {
            o0 = $b; i0 = $c; i1 = $a;
        } elif $c.z > -NEAR {
            o0 = $c; i0 = $a; i1 = $b;
        }
        clip_lerp i0, o0;
        local Vector3 v1 = clipLerpReturn;
        clip_lerp i1, o0;
        draw_tri_clipped project(v1), project(i0), project(i1);
        draw_tri_clipped project(v1), project(i1), project(clipLerpReturn);
    }
}

### screen-space clipping
proc clip_half use_x, sign, limit {
    local n = length(clip_poly);
    if n == 0 { stop_this_script; }

    delete clip_tmp;
    local Vector2 prev = clip_poly[n];
    local dprev = 0;
    if $use_x == 1 {
        dprev = $sign * prev.x - $limit;
    } else {
        dprev = $sign * prev.y - $limit;
    }

    local i = 0;
    repeat n {
        i++;
        local Vector2 cur = clip_poly[i];
        local dcur = 0;
        if $use_x == 1 {
            dcur = $sign * cur.x - $limit;
        } else {
            dcur = $sign * cur.y - $limit;
        }

        if dcur <= 0 {
            if dprev > 0 {
                local Vector2 cut = VEC2_LERP(prev, cur, dprev / (dprev - dcur));
                add cut to clip_tmp;
            }
            add cur to clip_tmp;
        } elif dprev <= 0 {
            local Vector2 cut = VEC2_LERP(prev, cur, dprev / (dprev - dcur));
            add cut to clip_tmp;
        }

        prev = cur;
        dprev = dcur;
    }

    delete clip_poly;
    local k = 0;
    repeat length clip_tmp {
        k++;
        add clip_tmp[k] to clip_poly;
    }
}

proc draw_tri_clipped Vector2 p1, Vector2 p2, Vector2 p3 {
    if abs($p1.x) <= ScreenSizeHalf.x and abs($p2.x) <= ScreenSizeHalf.x and abs($p3.x) <= ScreenSizeHalf.x
       and abs($p1.y) <= ScreenSizeHalf.y and abs($p2.y) <= ScreenSizeHalf.y and abs($p3.y) <= ScreenSizeHalf.y {
        draw_tri $p1, $p2, $p3;
        stop_this_script;
    }

    delete clip_poly;
    add $p1 to clip_poly;
    add $p2 to clip_poly;
    add $p3 to clip_poly;

    clip_half 1, -1, ScreenSizeHalf.x;
    clip_half 1,  1, ScreenSizeHalf.x;
    clip_half 0, -1, ScreenSizeHalf.y;
    clip_half 0,  1, ScreenSizeHalf.y;

    if length(clip_poly) < 3 { stop_this_script; }

    local Vector2 anchor = clip_poly[1];
    local i = 2;
    repeat length(clip_poly) - 2 {
        draw_tri anchor, clip_poly[i], clip_poly[i + 1];
        i++;
    }
}

### rasterization
proc draw_tri Vector2 p1, Vector2 p2, Vector2 p3 {
    local tri_a = VEC2_DIST($p2, $p3);
    local tri_b = VEC2_DIST($p3, $p1);
    local tri_c = VEC2_DIST($p2, $p1);
    local tri_p = tri_a + tri_b + tri_c;
    if tri_p == 0 { stop_this_script; }
    goto (tri_a * $p1.x + tri_b * $p2.x + tri_c * $p3.x) / tri_p, (tri_a * $p1.y + tri_b * $p2.y + tri_c * $p3.y) / tri_p;

    # incentre -> corner offsets, sampled after the goto so Scratch's clamping is included
    local Vector2 here = VEC2(x_position(), y_position());
    local Vector2 d1 = VEC2_SUB(here, $p1);
    local Vector2 d2 = VEC2_SUB(here, $p2);
    local Vector2 d3 = VEC2_SUB(here, $p3);

    local inr = (tri_p - tri_a * 2) * (tri_p - tri_b * 2) * (tri_p - tri_c * 2) / tri_p;
    if not (inr > 0.00000001) { stop_this_script; }
    inr = sqrt(inr);

    if tri_a < tri_b and tri_a < tri_c {
        tri_a = 0.5 - inr / (4 * VEC2_MAG(d1));
    } elif tri_b < tri_c {
        tri_a = 0.5 - inr / (4 * VEC2_MAG(d2));
    } else {
        tri_a = 0.5 - inr / (4 * VEC2_MAG(d3));
    }
    set_pen_size inr;
    pen_down;
    tri_b = tri_a;
    repeat floor(ln((RESOLUTION / inr) / (ACCURACY + 1)) / ln(tri_b)) {
        set_pen_size tri_a * inr + RESOLUTION;
        goto $p1.x + tri_a * d1.x, $p1.y + tri_a * d1.y;
        goto $p2.x + tri_a * d2.x, $p2.y + tri_a * d2.y;
        goto $p3.x + tri_a * d3.x, $p3.y + tri_a * d3.y;
        goto $p1.x + tri_a * d1.x, $p1.y + tri_a * d1.y;
        tri_a = tri_a * tri_b;
    }

    set_pen_size RESOLUTION;
    goto $p1.x, $p1.y;
    goto $p2.x, $p2.y;
    goto $p3.x, $p3.y;
    goto $p1.x, $p1.y;
    pen_up;

    renderedTris += 1;
}

proc set_pen_rgb Vector3 col {
    set_pen_color floor($col.x) * 65536 + floor($col.y) * 256 + floor($col.z);
}

proc push_trav v {
    trav_sp++;
    if trav_sp > length(trav) {
        add $v to trav;
    } else {
        trav[trav_sp] = $v;
    }
}

proc draw_node n {
    local Node nd = nodes[$n];
    local i = nd.first;
    repeat nd.count {
        local Tri t = bsp_tris[i];
        local Vector3 va = bsp_view[t.a];
        local Vector3 vb = bsp_view[t.b];
        local Vector3 vc = bsp_view[t.c];

        if va.z <= -NEAR or vb.z <= -NEAR or vc.z <= -NEAR {
            local Vector3 e1 = VEC3_SUB(vb, va);
            local Vector3 e2 = VEC3_SUB(vc, va);
            local Vector3 nrm = VEC3_CROSS(e1, e2);

            if VEC3_DOT(nrm, va) < 0 {
                # eye is at the origin in view space, so centroid is the radial distance.
                # backface cull first so we only pay for triangles that could actually be drawn.
                local Vector3 mid = VEC3_CENTROID(va, vb, vc);
                local d2 = VEC3_MAG2(mid);

                if d2 <= FAR * FAR {
                    local nlen = VEC3_MAG(nrm);
                    if nlen == 0 { nlen = 1; }
                    local lambert = VEC3_DOT(nrm, lt) / nlen;
                    if lambert < 0 { lambert = 0; }
                    local shade = AMBIENT + (1 - AMBIENT) * lambert;

                    # tri_cols is index-parallel with bsp_tris
                    local Vector3 col = tri_cols[i];
                    col = VEC3_SCALE(col, shade);

                    local fg = CLAMP((sqrt(d2) - FOG_START) / (FAR - FOG_START), 0, 1);
                    if fg > 0 {
                        local Vector3 sky = SKY_COLOR;
                        col = VEC3_LERP(col, sky, fg);
                    }

                    set_pen_rgb col;
                    draw_tri_view va, vb, vc;
                }
            }
        }
        i++;
    }
}

proc get_screen_size {
    goto 1/0, 1/0;
    if x_position() == "Infinity" and y_position() == "Infinity" {
        goto 0, 0;
        until touching_edge() {
            change_x 1;
        }
        ScreenSizeHalf.x = x_position();
        set_x 0;
        until touching_edge() {
            change_y 1;
        }
    } else {
        ScreenSizeHalf.x = x_position();
    }
    ScreenSizeHalf.y = y_position();
    ScreenSize.x = ScreenSizeHalf.x * 2;
    ScreenSize.y = ScreenSizeHalf.y * 2;
}

proc render {
    smoothCamPos = VEC3_LERP(prevCamPos, camPos, frac);

    local fovScale = (FOV / 90);

    if mouseLocked {
        cam_yaw -= RAD(mouse_x()) * 0.4 * fovScale;
        cam_pitch += RAD(mouse_y()) * 0.4 * fovScale;
    } else {
        local Vector2 mousePos = Vector2 {x: mouse_x(), y: mouse_y()};
        if mouse_down() {
            local Vector2 mouseDelta = VEC2_SUB(prevMousePos, mousePos);
            cam_yaw += RAD(mouseDelta.x) * 0.4 * fovScale;
            cam_pitch -= RAD(mouseDelta.y) * 0.4 * fovScale;
        }
    }
    prevMousePos = mousePos;

    if key_pressed("left arrow")  { cam_yaw   += LOOK_SPEED * deltaTime * fovScale; }
    if key_pressed("right arrow") { cam_yaw   -= LOOK_SPEED * deltaTime * fovScale; }
    if key_pressed("up arrow")    { cam_pitch += LOOK_SPEED * deltaTime * fovScale; }
    if key_pressed("down arrow")  { cam_pitch -= LOOK_SPEED * deltaTime * fovScale; }

    if cam_pitch >  RAD(89.9) { cam_pitch =  RAD(89.9); }
    if cam_pitch < -RAD(89.9) { cam_pitch = -RAD(89.9); }

    erase_all;

    #calc screen size
    resizeDelay--;
    if resizeDelay < 0 {
        resizeDelay = 16;
        get_screen_size;
    }
    
    FOCAL = (21600 / FOV) * (ScreenSize.y / 360);

    build_view_matrix;
    build_frustum;

    #skybox
    goto 0, 0;
    local Vector3 sky = SKY_COLOR;
    set_pen_rgb sky;
    set_pen_size VEC2_MAG(ScreenSize);
    pen_down;
    pen_up;

    transform_vertices;

    renderedTris = 0;
    trav_sp = 0;
    if length(nodes) == 0 { stop_this_script; }
    push_trav 1;

    until trav_sp <= 0 {
        local t = trav[trav_sp];
        trav_sp--;

        if t < 0 {
            draw_node -1 * t;
        } else {
            local Node nd = nodes[t];
            # Node can't hold a Vector3 (goboscript has no nested structs), so repack here
            local Vector3 nc = VEC3(nd.cx, nd.cy, nd.cz);
            sphere_visible nc, nd.r;
            if fr_vis == 1 {
                local side = nd.nx * smoothCamPos.x + nd.ny * smoothCamPos.y + nd.nz * smoothCamPos.z - nd.d;
                if side > 0 {
                    if nd.front > 0 { push_trav nd.front; }
                    if nd.count > 0 { push_trav -1 * t; }
                    if nd.back > 0 and side <= FAR { push_trav nd.back; }
                } else {
                    if nd.back > 0 { push_trav nd.back; }
                    if nd.count > 0 { push_trav -1 * t; }
                    if nd.front > 0 and side >= -1 * FAR { push_trav nd.front; }
                }
            }
        }
    }
}

on "render" {
    render;
}

onkey "m" {
    mouseLocked = not mouseLocked;
}

onflag {
    get_screen_size;
}