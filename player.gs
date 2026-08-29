costumes "assets/blank.svg";
hide;
%include std/math
%include libs/vector.gs

##colision
%define BIG 1000000000
%define TINY 0.000001

%define pl_radius 16
var pl_height = 72;
%define pl_eyeoffset -8

%define MARGIN 0.01
%define SLIDE_PASSES 4
%define QUERY_PAD 1
%define GROUND_NY 0.7
%define STEP_HEIGHT 18

var pl_maxspeed = 286;
var pl_movespeed = 250;
var pl_stopspeed = 80;
var pl_friction = 5.2;
var pl_accelerate = 5.5;
var pl_airaccelerate = 150;
var pl_jump_impulse = 301.993;
var pl_gravity = 800;
var pl_deadstrafe = 0.25;

var jumpHeight = 0;
var isJumping = false;
var jumpStart = 0;

var sm_blocked = 0;
var wasOnGround = 0;
var onGround = 0;
var noclip = 0;

### movement physics
proc clip_velocity Vector3 normal {
	local backoff = VEC3_DOT(velocity, $normal);

	local Vector3 change = VEC3_SCALE($normal, backoff);
	local Vector3 outVec = VEC3_SUB(velocity, change);

	local adjust = VEC3_DOT(outVec, $normal);
	if adjust < 0 {
		adjust = MAX(adjust, -0.001);
		outVec = VEC3_SUB(outVec, VEC3_SCALE($normal, adjust));
	}

	velocity = outVec;
}

proc apply_friction {
	local speed = VEC3_MAG(velocity);
	if speed < 0 {
		stop_this_script;
	}

	local control = speed;
	if speed < pl_stopspeed {
		control = pl_stopspeed;
	}

	local drop = control * pl_friction * tickrate;

	local newspeed = speed - drop;
	if newspeed < 0 {
		newspeed = 0;
	}

	if newspeed != speed {
		newspeed /= speed;
		velocity = VEC3_SCALE(velocity, newspeed);
	}
}

proc accelerate Vector3 wishdir, wishspeed, accel {
	local currentspeed = VEC3_DOT(velocity, $wishdir);

	local addspeed = $wishspeed - currentspeed;
	if addspeed <= 0 {
		stop_this_script;
	}

	local accelspeed = $accel * $wishspeed * tickrate;
	if accelspeed > addspeed {
		accelspeed = addspeed;
	}

	velocity.x += accelspeed * $wishdir.x;
	velocity.z += accelspeed * $wishdir.z;
}

proc air_accelerate Vector3 wishdir, wishspeed, accel {
	local wishspd = $wishspeed;
	if wishspd > 30 {
		wishspd = 30;
	}

	local currentspeed = VEC3_DOT(velocity, $wishdir);

	local addspeed = wishspd - currentspeed;
	if addspeed <= 0 {
		stop_this_script;
	}

	local accelspeed = $accel * $wishspeed * tickrate;
	if accelspeed > addspeed {
		accelspeed = addspeed;
	}

	velocity.x += accelspeed * $wishdir.x;
	velocity.z += accelspeed * $wishdir.z;
}

### broadphase
# triangle indices into bsp_tris
list cand = [];

# query box, lo/hi corners
var Vector3 q_lo;
var Vector3 q_hi;

list qstack = [];
var q_sp = 0;

proc push_q v {
    q_sp++;
    if q_sp > length(qstack) {
        add $v to qstack;
    } else {
        qstack[q_sp] = $v;
    }
}

proc gather_tris {
    delete cand;
    if length(nodes) == 0 { stop_this_script; }

    local Vector3 qc = VEC3_BOX_CENTER(q_lo, q_hi);
    local Vector3 qh = VEC3_BOX_HALF(q_lo, q_hi);

    q_sp = 0;
    push_q 1;

    until q_sp <= 0 {
        local n = qstack[q_sp];
        q_sp--;
        local Node nd = nodes[n];

        # subtree bounding sphere vs query box. r < 0 means the whole subtree is empty (finalize_bounds already merged children up).
        if nd.r >= 0 {
            local Vector3 d = VEC3_ZERO;
            if nd.cx < q_lo.x { d.x = q_lo.x - nd.cx; } elif nd.cx > q_hi.x { d.x = nd.cx - q_hi.x; }
            if nd.cy < q_lo.y { d.y = q_lo.y - nd.cy; } elif nd.cy > q_hi.y { d.y = nd.cy - q_hi.y; }
            if nd.cz < q_lo.z { d.z = q_lo.z - nd.cz; } elif nd.cz > q_hi.z { d.z = nd.cz - q_hi.z; }

            if VEC3_MAG2(d) <= nd.r * nd.r {
                # coplanar triangles of this node
                local i = nd.first;
                repeat nd.count {
                    local Tri t = bsp_tris[i];
                    local Vector3 va = bsp_verts[t.a];
                    local Vector3 vb = bsp_verts[t.b];
                    local Vector3 vc = bsp_verts[t.c];

                    # triangle aabb, refined one axis at a time so we can bail early
                    local ok = 1;
                    local Vector3 tlo = va;
                    local Vector3 thi = va;

                    if vb.x < tlo.x { tlo.x = vb.x; }
                    if vb.x > thi.x { thi.x = vb.x; }
                    if vc.x < tlo.x { tlo.x = vc.x; }
                    if vc.x > thi.x { thi.x = vc.x; }
                    if tlo.x > q_hi.x or thi.x < q_lo.x { ok = 0; }

                    if ok == 1 {
                        if vb.y < tlo.y { tlo.y = vb.y; }
                        if vb.y > thi.y { thi.y = vb.y; }
                        if vc.y < tlo.y { tlo.y = vc.y; }
                        if vc.y > thi.y { thi.y = vc.y; }
                        if tlo.y > q_hi.y or thi.y < q_lo.y { ok = 0; }
                    }
                    if ok == 1 {
                        if vb.z < tlo.z { tlo.z = vb.z; }
                        if vb.z > thi.z { thi.z = vb.z; }
                        if vc.z < tlo.z { tlo.z = vc.z; }
                        if vc.z > thi.z { thi.z = vc.z; }
                        if tlo.z > q_hi.z or thi.z < q_lo.z { ok = 0; }
                    }
                    if ok == 1 { add i to cand; }
                    i++;
                }

                # descend into whichever half-spaces the box actually touches
                local s = nd.nx * qc.x + nd.ny * qc.y + nd.nz * qc.z - nd.d;
                local e = abs(nd.nx) * qh.x + abs(nd.ny) * qh.y + abs(nd.nz) * qh.z;
                if nd.front > 0 and s + e > 0 { push_q nd.front; }
                if nd.back  > 0 and s - e < 0 { push_q nd.back; }
            }
        }
    }
}

### SAT swept AABB vs triangle
var Vector3 box_c; # box centre
var Vector3 box_h; # box half extents
var Vector3 box_v; # box displacement this step

var Vector3 tv0;   # triangle, relative to box_c
var Vector3 tv1;
var Vector3 tv2;

var sat_fail = 0;
var en_t = 0; var ex_t = 0; var en_set = 0;
var Vector3 en_n;

var sw_hit = 0; var sw_t = 1; var sw_tri = 0;
var Vector3 sw_n;

proc sat_axis Vector3 l {
    if sat_fail == 1 { stop_this_script; }
    local l2 = VEC3_MAG2($l);
    if l2 < TINY * TINY { stop_this_script; }   # degenerate axis, ignore

    local r = abs($l.x) * box_h.x + abs($l.y) * box_h.y + abs($l.z) * box_h.z;

    local p0 = VEC3_DOT($l, tv0);
    local p1 = VEC3_DOT($l, tv1);
    local p2 = VEC3_DOT($l, tv2);
    local lo = p0; local hi = p0;
    if p1 < lo { lo = p1; }
    if p1 > hi { hi = p1; }
    if p2 < lo { lo = p2; }
    if p2 > hi { hi = p2; }

    # box projects to [-r, r] + s*t, triangle to [lo, hi]
    local s = VEC3_DOT($l, box_v);
    local a = lo - r;
    local b = hi + r;

    if s == 0 {
        if a > 0 or b < 0 { sat_fail = 1; }
        stop_this_script; # axis never constrains t
    }

    local tin = 0;
    local tout = 0;
    if s > 0 {
        tin = a / s; tout = b / s;
    } else {
        tin = b / s; tout = a / s;
    }

    if en_set == 0 or tin > en_t {
        en_set = 1;
        en_t = tin;
        # normal points from the triangle towards the box
        local inv = 1 / sqrt(l2);
        if s > 0 { inv = -1 * inv; }
        en_n = VEC3_SCALE($l, inv);
    }
    if tout < ex_t { ex_t = tout; }
    if en_set == 1 and en_t > ex_t { sat_fail = 1; }
}

proc sweep_tri i {
    local Tri t = bsp_tris[$i];
    local Vector3 va = bsp_verts[t.a];
    local Vector3 vb = bsp_verts[t.b];
    local Vector3 vc = bsp_verts[t.c];

    tv0 = VEC3_SUB(va, box_c);
    tv1 = VEC3_SUB(vb, box_c);
    tv2 = VEC3_SUB(vc, box_c);

    local Vector3 f0 = VEC3_SUB(tv1, tv0);
    local Vector3 f1 = VEC3_SUB(tv2, tv1);
    local Vector3 f2 = VEC3_SUB(tv0, tv2);

    sat_fail = 0;
    en_set = 0;
    en_t = 0;
    ex_t = BIG;

    # box face normals first, they reject the most
    sat_axis VEC3_AXIS_X;
    sat_axis VEC3_AXIS_Y;
    sat_axis VEC3_AXIS_Z;

    if sat_fail == 0 {
        # triangle face normal
        local Vector3 fn = VEC3_CROSS(f0, f1);
        sat_axis fn;
    }

    if sat_fail == 0 {
        # 9 edge-edge axes: box axis cross triangle edge
        sat_axis VEC3_CROSS_X(f0);
        sat_axis VEC3_CROSS_X(f1);
        sat_axis VEC3_CROSS_X(f2);
        sat_axis VEC3_CROSS_Y(f0);
        sat_axis VEC3_CROSS_Y(f1);
        sat_axis VEC3_CROSS_Y(f2);
        sat_axis VEC3_CROSS_Z(f0);
        sat_axis VEC3_CROSS_Z(f1);
        sat_axis VEC3_CROSS_Z(f2);
    }

    if sat_fail == 0 and en_set == 1 and ex_t > 0 and en_t <= 1 {
        local toi = en_t;
        if toi < 0 { toi = 0; } # started already touching
        if toi < sw_t {
            sw_t = toi;
            sw_hit = 1;
            sw_tri = $i;
            sw_n = en_n;
        }
    }
}

# swept player box against the current `cand` set.
# results land in sw_hit / sw_t / sw_n
proc trace_box Vector3 p, Vector3 d {
    box_h = Vector3{x: pl_radius, y: (pl_height * 0.5), z: pl_radius};
    box_c = $p;
    box_v = $d;
    sw_hit = 0;
    sw_t = 1;

    local k = 0;
    repeat length cand {
        k++;
        sweep_tri cand[k];
    }
}

proc slide_move {
    sm_blocked = 0;
    local time_left = tickrate;

    repeat SLIDE_PASSES {
        local Vector3 step = VEC3_SCALE(velocity, time_left);

        if abs(step.x) < TINY and abs(step.y) < TINY and abs(step.z) < TINY {
            stop_this_script;
        }

        trace_box playerPos, step;

        if sw_hit == 0 {
            playerPos = VEC3_ADD(playerPos, step);
            stop_this_script;
        }

        sm_blocked = 1;

        playerPos = VEC3_ADD_SCALED(playerPos, step, sw_t);
        playerPos = VEC3_ADD_SCALED(playerPos, sw_n, MARGIN);

        if sw_n.y > GROUND_NY { onGround = 1; }

        time_left -= time_left * sw_t;

        clip_velocity sw_n;

        if time_left <= 0 { stop_this_script; }
    }
}

proc move_player {
    wasOnGround = onGround;
    onGround = 0;

    local speed = VEC3_MAG(velocity);
    if speed < TINY { stop_this_script; }

    local mlen = speed * tickrate;

    # pad the query box vertically by a step so the up/down traces
    # can reuse the same candidate list
    local Vector3 pad = Vector3 {
        x: pl_radius + mlen + QUERY_PAD,
        y: (pl_height * 0.5) + mlen + STEP_HEIGHT + QUERY_PAD,
        z: pl_radius + mlen + QUERY_PAD
    };
    q_lo = VEC3_SUB(playerPos, pad);
    q_hi = VEC3_ADD(playerPos, pad);
    gather_tris;

    local Vector3 startPos = playerPos;
    local Vector3 startVel = velocity;

    ### attempt 1: plain slide
    slide_move;

    if sm_blocked == 0 { stop_this_script; }   # never touched anything
    if wasOnGround == 0 { stop_this_script; }  # no stepping in the air

    local Vector3 downPos = playerPos;
    local Vector3 downVel = velocity;
    local downGround = onGround;

    ### attempt 2: up a step, slide, back down
    playerPos = startPos;
    velocity = startVel;
    onGround = 0;

    local Vector3 stepUp = Vector3 {x: 0, y: STEP_HEIGHT + MARGIN, z: 0};
    trace_box startPos, stepUp;
    local up = (STEP_HEIGHT + MARGIN) * sw_t;
    if sw_hit == 1 {
        up -= MARGIN;
        if up < 0 { up = 0; }
    }
    playerPos.y += up;

    slide_move;

    local Vector3 stepDown = Vector3 {x: 0, y: -1 * (STEP_HEIGHT + MARGIN), z: 0};
    trace_box playerPos, stepDown;

    if sw_hit == 0 or sw_n.y < GROUND_NY {
        # nothing standable up there, keep the plain result
        playerPos = downPos;
        velocity = downVel;
        onGround = downGround;
        stop_this_script;
    }

    playerPos.y -= (STEP_HEIGHT + MARGIN) * sw_t;
    playerPos = VEC3_ADD_SCALED(playerPos, sw_n, MARGIN);

    # keep whichever attempt got further horizontally
    local Vector3 downDelta = VEC3_SUB(downPos, startPos);
    local Vector3 upDelta = VEC3_SUB(playerPos, startPos);

    if VEC3_FLAT_MAG2(downDelta) > VEC3_FLAT_MAG2(upDelta) {
        playerPos = downPos;
        velocity = downVel;
        onGround = downGround;
    } else {
        velocity.y = downVel.y;
        onGround = 1;
    }
}

### optional: probe straight down without moving, for coyote-time / gravity
proc ground_probe dist {
    local Vector3 pad = Vector3 {x: pl_radius + QUERY_PAD, y: (pl_height * 0.5) + QUERY_PAD, z: pl_radius + QUERY_PAD};
    q_lo = VEC3_SUB(playerPos, pad);
    q_hi = VEC3_ADD(playerPos, pad);
    q_lo.y -= $dist;
    gather_tris;

    local Vector3 down = Vector3 {x: 0, y: -1 * $dist, z: 0};
    trace_box playerPos, down;

    if sw_hit == 1 and sw_n.y > GROUND_NY { onGround = 1; }
}

proc stay_on_ground {
    local Vector3 pad = Vector3 {x: pl_radius + QUERY_PAD, y: (pl_height * 0.5) + QUERY_PAD, z: pl_radius + QUERY_PAD};
    q_lo = VEC3_SUB(playerPos, pad);
    q_hi = VEC3_ADD(playerPos, pad);
    q_lo.y -= STEP_HEIGHT;
    q_hi.y += 2;
    gather_tris;

    # lift 2 units first so we aren't starting flush against the floor
    local Vector3 lift = Vector3 {x: 0, y: 2, z: 0};
    trace_box playerPos, lift;

    local Vector3 upPos = playerPos;
    upPos.y += 2 * sw_t;
    local dist = upPos.y - playerPos.y + STEP_HEIGHT;

    local Vector3 drop = Vector3 {x: 0, y: -1 * dist, z: 0};
    trace_box upPos, drop;

    if sw_hit == 1 and sw_t > 0 and sw_t < 1 and sw_n.y >= GROUND_NY {
        playerPos.y = upPos.y - dist * sw_t + MARGIN;
        onGround = 1;
    }
}

### raycasting - unused
var Vector3 ray_o;
var Vector3 ray_d;
var ray_hit = 0; var ray_t = 0; var ray_tri = 0;
var Vector3 ray_n;

list rs_node = []; list rs_lo = []; list rs_hi = [];
var r_sp = 0;

proc push_ray n, lo, hi {
    r_sp++;
    if r_sp > length(rs_node) {
        add $n to rs_node;
        add $lo to rs_lo;
        add $hi to rs_hi;
    } else {
        rs_node[r_sp] = $n;
        rs_lo[r_sp] = $lo;
        rs_hi[r_sp] = $hi;
    }
}

proc ray_tri_test i {
    local Tri t = bsp_tris[$i];
    local Vector3 va = bsp_verts[t.a];
    local Vector3 vb = bsp_verts[t.b];
    local Vector3 vc = bsp_verts[t.c];

    local Vector3 e1 = VEC3_SUB(vb, va);
    local Vector3 e2 = VEC3_SUB(vc, va);

    local Vector3 pv = VEC3_CROSS(ray_d, e2);
    local det = VEC3_DOT(e1, pv);
    if abs(det) < TINY { stop_this_script; }
    local inv = 1 / det;

    local Vector3 sv = VEC3_SUB(ray_o, va);
    local u = VEC3_DOT(sv, pv) * inv;
    if u < 0 or u > 1 { stop_this_script; }

    local Vector3 qv = VEC3_CROSS(sv, e1);
    local v = VEC3_DOT(ray_d, qv) * inv;
    if v < 0 or u + v > 1 { stop_this_script; }

    local tt = VEC3_DOT(e2, qv) * inv;
    if tt < 0.0001 or tt >= ray_t { stop_this_script; }

    ray_t = tt;
    ray_hit = 1;
    ray_tri = $i;

    local Vector3 nv = VEC3_CROSS(e1, e2);
    local nl = VEC3_MAG(nv);
    if nl == 0 { nl = 1; }
    if VEC3_DOT(nv, ray_d) > 0 { nl = -1 * nl; }
    ray_n = VEC3_DIV(nv, nl);
}

proc node_tris n, lo, hi {
    local Node nd = nodes[$n];
    local i = nd.first;
    repeat nd.count {
        ray_tri_test i;
        i++;
    }
}

proc raycast Vector3 o, Vector3 d, maxd {
    ray_hit = 0;
    ray_tri = 0;
    ray_t = $maxd;

    local dl = VEC3_MAG($d);
    if dl < TINY { stop_this_script; }
    ray_o = $o;
    ray_d = VEC3_DIV($d, dl);

    if length(nodes) == 0 { stop_this_script; }
    r_sp = 0;
    push_ray 1, 0, $maxd;

    until r_sp <= 0 {
        local n = rs_node[r_sp];
        local lo = rs_lo[r_sp];
        local hi = rs_hi[r_sp];
        r_sp--;

        # a closer hit already exists
        if lo <= ray_t {
            local Node nd = nodes[n];
            local dn = nd.nx * ray_d.x + nd.ny * ray_d.y + nd.nz * ray_d.z;
            local so = nd.nx * ray_o.x + nd.ny * ray_o.y + nd.nz * ray_o.z - nd.d;

            if abs(dn) < TINY {
                # parallel to the plane, the segment stays on one side
                if so >= 0 {
                    if nd.front > 0 { push_ray nd.front, lo, hi; }
                } else {
                    if nd.back > 0 { push_ray nd.back, lo, hi; }
                }
            } else {
                local th = -1 * so / dn;
                if th <= lo or th >= hi {
                    local sm = so + dn * (lo + hi) / 2;
                    if sm >= 0 {
                        if nd.front > 0 { push_ray nd.front, lo, hi; }
                    } else {
                        if nd.back > 0 { push_ray nd.back, lo, hi; }
                    }
                } else {
                    # crossing inside the segment: coplanar tris are hit at th
                    if nd.count > 0 { node_tris n, lo, hi; }
                    # push far side first so the near side pops and runs first
                    if so > 0 {
                        if nd.back > 0 { push_ray nd.back, th, hi; }
                        if nd.front > 0 { push_ray nd.front, lo, th; }
                    } else {
                        if nd.front > 0 { push_ray nd.front, th, hi; }
                        if nd.back > 0 { push_ray nd.back, lo, th; }
                    }
                }
            }
        }
    }
}

### crouching
%define pl_standheight 72
%define pl_crouchheight 54
%define DUCK_MID 63
%define DUCK_RATE 110
%define DUCK_SHIFT 9

var pl_standspeed = 250;
var pl_crouchspeed = 85;

var smoothHeight = 72;
var ducking = false;
var crouchBlocked = 0;

proc can_stand shift {
    #gather tris
    local Vector3 pad = Vector3 {
        x: pl_radius + QUERY_PAD,
        y: pl_standheight + QUERY_PAD,
        z: pl_radius + QUERY_PAD
    };
    q_lo = VEC3_SUB(playerPos, pad);
    q_hi = VEC3_ADD(playerPos, pad);
    gather_tris;

    local Vector3 tryPos = playerPos;
    tryPos.y += $shift;
    
    #hull test
    box_h = Vector3{x: pl_radius, y: (pl_standheight * 0.5), z: pl_radius};
    box_c = tryPos;
    box_v = Vector3{x: 0, y: MARGIN, z: 0};
    sw_hit = 0;
    sw_t = 1;

    local k = 0;
    repeat length cand {
        k++;
        sweep_tri cand[k];
    }
    crouchBlocked = sw_hit;
}

proc update_duck {
    local target = pl_standheight;
    if key_pressed("c") {
        target = pl_crouchheight;
    }

    # only matters while actually crouched and asking to come back up
    if ducking and target == pl_standheight {
        if wasOnGround {
            can_stand DUCK_SHIFT;
        } else {
            can_stand 0;
        }
        if crouchBlocked {
            target = pl_crouchheight;
        }
    } else {
        crouchBlocked = false;
    }
    
    if wasOnGround {
        if target == pl_crouchheight {
            smoothHeight -= DUCK_RATE * tickrate;
        } else {
            smoothHeight += DUCK_RATE * tickrate;
        }
        if smoothHeight < pl_crouchheight {
            smoothHeight = pl_crouchheight;
        } elif smoothHeight > pl_standheight {
            smoothHeight = pl_standheight;
        }

        if smoothHeight < (pl_crouchheight + pl_standheight) * 0.5 {
            if not ducking {
                playerPos.y -= 9;
                ducking = true;
            }
        } else {
            if ducking {
                playerPos.y += 9;
                ducking = false; 
            }
        }
    } else {
        smoothHeight = target;

        if smoothHeight < (pl_crouchheight + pl_standheight) * 0.5 {
            ducking = true;
        } else {
            ducking = false;
        }
    }

    if ducking {
        pl_height = pl_crouchheight;
    } else {
        pl_height = pl_standheight;
    }

    if smoothHeight < 70 {
        pl_movespeed = pl_crouchspeed;
    } else {
        pl_movespeed = pl_standspeed;
    }
}

proc tick {
    prevCamPos = camPos;

    local yawSin = sin(DEG(cam_yaw));
    local yawCos = cos(DEG(cam_yaw));

    local Vector3 moveDir = VEC3_ZERO;

    if noclip {
        local Vector3 lookVec = Vector3{
            x: cos(DEG(cam_pitch)) * sin(DEG(cam_yaw)),
            y: sin(-DEG(cam_pitch)),
            z: cos(DEG(cam_pitch)) * cos(DEG(cam_yaw))
        };
        local Vector3 rightVec = VEC3_CROSS(lookVec, (VEC3_AXIS_Y));
        VEC3_NORMALIZE(rightVec);

        if key_pressed("w") {
            moveDir = VEC3_SUB(moveDir, lookVec);
        }
        if key_pressed("s") {
            moveDir = VEC3_ADD(moveDir, lookVec);
        }
        if key_pressed("a") {
            moveDir = VEC3_ADD(moveDir, rightVec);
        }
        if key_pressed("d") {
            moveDir = VEC3_SUB(moveDir, rightVec);
        }
        if key_pressed("e") {
            moveDir.y += 1;
        }
        if key_pressed("q") {
            moveDir.y -= 1;
        }

        if VEC3_MAG2(moveDir) > 0 {
            VEC3_NORMALIZE(moveDir);
        }

        velocity = VEC3_SCALE(moveDir, 400);
        playerPos.x += velocity.x * tickrate;
        playerPos.y += velocity.y * tickrate;
        playerPos.z += velocity.z * tickrate;
    } else {
        update_duck;

        if key_pressed("w") {
            moveDir.x -= yawSin;
            moveDir.z -= yawCos;
        }
        if key_pressed("s") {
            moveDir.x += yawSin;
            moveDir.z += yawCos;
        }
        if key_pressed("d") {
            moveDir.x += yawCos;
            moveDir.z -= yawSin;
        }
        if key_pressed("a") {
            moveDir.x -= yawCos;
            moveDir.z += yawSin;
        }

        if abs(moveDir.x) > 0 or abs(moveDir.y) > 0 or abs(moveDir.z) > 0 {
            local magnitude = VEC3_MAG(moveDir);
            moveDir = VEC3_DIV(moveDir, magnitude);
        }

        if onGround {
            # CSGO style velocity clamp
            # local Vector3 flatVel = VEC3_FLAT(velocity);
            # local magnitude = VEC3_MAG(flatVel);
            # if magnitude > pl_maxspeed {
            #     flatVel = VEC3_DIV(flatVel, magnitude);
            #     flatVel = VEC3_SCALE(flatVel, pl_maxspeed);
            #     velocity = flatVel;
            # }
            if key_pressed("space") {
                jumpStart = playerPos.y - pl_height;
                jumpHeight = 0;
                isJumping = true;
                velocity.y = pl_jump_impulse;
                if smoothHeight < pl_standheight {
                    velocity.y *= 1.01058;
                }
                onGround = false;
                wasOnGround = false;
            }
        }

        if onGround {
            apply_friction;
            accelerate moveDir, MAX(pl_movespeed, 100), pl_accelerate;

            local Vector3 flatVel = VEC3_FLAT(velocity);
            local magnitude = VEC3_MAG(flatVel);
            if magnitude > pl_movespeed {
                flatVel = VEC3_DIV(flatVel, magnitude);
                flatVel = VEC3_SCALE(flatVel, pl_movespeed);
                velocity = flatVel;
            }

            velocity.y = 0;
        } else {
            #CSGO style deadstrafe
            if velocity.y > 0 and velocity.y < 140 {
                air_accelerate moveDir, pl_movespeed, pl_airaccelerate * pl_deadstrafe;
            } else {
                air_accelerate moveDir, pl_movespeed, pl_airaccelerate;
            }
            velocity.y -= pl_gravity * tickrate;
        }

        move_player;
        if wasOnGround == 1 and velocity.y <= 0 {
            stay_on_ground;
        } elif onGround == 0 and velocity.y <= 0 {
            ground_probe 0.5;
        }
    }

    camPos.x = playerPos.x;
    camPos.y = playerPos.y - (pl_height * 0.5) + smoothHeight + pl_eyeoffset;
    camPos.z = playerPos.z;

    if isJumping {
        if (playerPos.y - pl_height) - jumpStart > jumpHeight {
            jumpHeight = (playerPos.y - pl_height) - jumpStart;
        }
        if velocity.y <= 0 {
            isJumping = false;
        }
    }

    velocityText = round(sqrt(VEC3_FLAT_MAG2(velocity)));
}

onkey "v" {
    noclip = not noclip;
}

on "tick" {
    tick;
}