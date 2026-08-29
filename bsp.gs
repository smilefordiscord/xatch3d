costumes "assets/blank.svg";
hide;
%include std/math
%include libs/vector.gs

struct Face {a, b, c};

# BSP data types
struct Tri  {a, b, c}; # indices into bsp_verts
# plane + children + coplanar range + subtree bounding sphere.
# goboscript has no nested structs, so the plane normal and sphere centre
# have to stay as loose fields here.
struct Node {nx, ny, nz, d, front, back, first, count, cx, cy, cz, r};
struct Job  {start, count, parent, side}; # pending partition

### BSP
%define PLANE_EPS 0.01
%define SPLIT_CANDIDATES 5
%define SPLIT_WEIGHT 8
%define MAX_NODES 200000
%define BB_INF 999999999

list Vector3 vertices = [];
list Vector3 vertexColors = [];   # x/y/z reused as r/g/b, source scale
list Face faces = [];

# BSP storage
list Vector3 bsp_cols  = [];   # parallel to bsp_verts. build time only.
list Tri soup     = [];        # working triangle pool during build
list Tri back_buf = [];        # scratch: back-set of the node being partitioned
list Job jobs     = [];
list poly_f = [];              # front polygon from a split (vertex indices)
list poly_b = [];              # back polygon from a split

# per-node AABB, build time only. collapsed into Node.cx/cy/cz/r and freed.
list Vector3 nb_lo = [];
list Vector3 nb_hi = [];

# splitter plane
var Vector3 pl_n; var pl_d = 0; var pl_ok = 0;
var cd_a = 0; var cd_b = 0; var cd_c = 0; var cls = 0;
var trav_sp = 0;
# aabb accumulator for the node being built
var Vector3 bb_lo;
var Vector3 bb_hi;

### simple .obj loader
proc process_model {
    delete faces;
    delete vertices;
    delete vertexColors;
    local i = 0;
    repeat length Map {
        i++;
        local item = Map[i];
        if item[1] == "v" and item[2] == " " {
            local Vector3 v = Vector3 {x: "", y: "", z: ""};
            local j = 3;
            until item[j] == " " { #x
                v.x &= item[j];
                j++;
            }
            j++;
            until item[j] == " " { #y
                v.y &= item[j];
                j++;
            }
            j++;
            until item[j] == " " or j > length(item) { #z
                v.z &= item[j];
                j++;
            }
            add v to vertices;

            #read vertex colors
            local Vector3 col = Vector3 {x: "", y: "", z: ""};
            if not (j > length(item)) {
                j++;
                until item[j] == " " { #red
                    col.x &= item[j];
                    j++;
                }
                j++;
                until item[j] == " " { #green
                    col.y &= item[j];
                    j++;
                }
                j++;
                until item[j] == " " or j > length(item) { #blue
                    col.z &= item[j];
                    j++;
                }
            }
            if col.x == "" or col.y == "" or col.z == "" {
                add Vector3 {x: 1, y: 1, z: 1} to vertexColors;
            } else {
                add col to vertexColors;
            }
        } elif item[1] == "f" {
            local Face f = Face {a: "", b: "", c: ""};
            local j = 3;
            until item[j] == " " or item[j] == "/" {
                f.a &= item[j];
                j++;
            }
            until item[j] == " " { j++; }
            j++;
            until item[j] == " " or item[j] == "/" {
                f.b &= item[j];
                j++;
            }
            until item[j] == " " { j++; }
            j++;
            until item[j] == " " or item[j] == "/" or j > length(item) {
                f.c &= item[j];
                j++;
            }
            add f to faces;
        }
    }
}

proc plane_from_tri Tri t {
    local Vector3 a = bsp_verts[$t.a];
    local Vector3 b = bsp_verts[$t.b];
    local Vector3 c = bsp_verts[$t.c];

    local Vector3 e1 = VEC3_SUB(b, a);
    local Vector3 e2 = VEC3_SUB(c, a);
    local Vector3 n = VEC3_CROSS(e1, e2);

    local nl = VEC3_MAG(n);
    if nl < 0.000001 {
        pl_ok = 0;           # degenerate triangle, unusable as a splitter
        stop_this_script;
    }
    pl_ok = 1;
    pl_n = VEC3_DIV(n, nl);
    pl_d = VEC3_DOT(pl_n, a);
}

proc classify_tri Tri t {
    local Vector3 a = bsp_verts[$t.a];
    local Vector3 b = bsp_verts[$t.b];
    local Vector3 c = bsp_verts[$t.c];
    cd_a = VEC3_DOT(a, pl_n) - pl_d;
    cd_b = VEC3_DOT(b, pl_n) - pl_d;
    cd_c = VEC3_DOT(c, pl_n) - pl_d;
    if abs(cd_a) < PLANE_EPS { cd_a = 0; }
    if abs(cd_b) < PLANE_EPS { cd_b = 0; }
    if abs(cd_c) < PLANE_EPS { cd_c = 0; }

    local nf = 0;
    local nb = 0;
    if cd_a > 0 { nf++; } elif cd_a < 0 { nb++; }
    if cd_b > 0 { nf++; } elif cd_b < 0 { nb++; }
    if cd_c > 0 { nf++; } elif cd_c < 0 { nb++; }

    if nf > 0 and nb > 0 {
        cls = 3;
    } elif nf > 0 {
        cls = 1;
    } elif nb > 0 {
        cls = 2;
    } else {
        cls = 0;
    }
}

proc split_edge i, j, di, dj {
    if $di >= 0 { add $i to poly_f; }
    if $di <= 0 { add $i to poly_b; }
    if ($di > 0 and $dj < 0) or ($di < 0 and $dj > 0) {
        local t = $di / ($di - $dj);

        local Vector3 va = bsp_verts[$i];
        local Vector3 vb = bsp_verts[$j];
        local Vector3 vmid = VEC3_LERP(va, vb, t);
        add vmid to bsp_verts;

        local Vector3 ka = bsp_cols[$i];
        local Vector3 kb = bsp_cols[$j];
        local Vector3 kmid = VEC3_LERP(ka, kb, t);
        add kmid to bsp_cols;

        add length(bsp_verts) to poly_f;
        add length(bsp_verts) to poly_b;
    }
}

proc split_tri Tri t {
    delete poly_f;
    delete poly_b;
    split_edge $t.a, $t.b, cd_a, cd_b;
    split_edge $t.b, $t.c, cd_b, cd_c;
    split_edge $t.c, $t.a, cd_c, cd_a;
}

proc fan_front {
    local n = length(poly_f);
    if n < 3 { stop_this_script; }
    local i = 2;
    repeat n - 2 {
        add Tri {a: poly_f[1], b: poly_f[i], c: poly_f[i + 1]} to soup;
        i++;
    }
}

proc fan_back {
    local n = length(poly_b);
    if n < 3 { stop_this_script; }
    local i = 2;
    repeat n - 2 {
        add Tri {a: poly_b[1], b: poly_b[i], c: poly_b[i + 1]} to back_buf;
        i++;
    }
}

proc expand_bounds Vector3 p {
    if $p.x < bb_lo.x { bb_lo.x = $p.x; }
    if $p.y < bb_lo.y { bb_lo.y = $p.y; }
    if $p.z < bb_lo.z { bb_lo.z = $p.z; }
    if $p.x > bb_hi.x { bb_hi.x = $p.x; }
    if $p.y > bb_hi.y { bb_hi.y = $p.y; }
    if $p.z > bb_hi.z { bb_hi.z = $p.z; }
}

proc expand_bounds_tri Tri t {
    local Vector3 a = bsp_verts[$t.a];
    local Vector3 b = bsp_verts[$t.b];
    local Vector3 c = bsp_verts[$t.c];
    expand_bounds a;
    expand_bounds b;
    expand_bounds c;
}

proc build_node start, count, parent, side {
    if $count <= 0 { stop_this_script; }
    if length(nodes) >= MAX_NODES { stop_this_script; }

    ### pick a splitter
    local cand_n = SPLIT_CANDIDATES;
    if cand_n > $count { cand_n = $count; }
    local best = 0;
    local best_score = -1;
    local k = 0;
    repeat cand_n {
        local idx = $start + floor(k * $count / cand_n);
        k++;
        local Tri ct = soup[idx];
        plane_from_tri ct;
        if pl_ok == 1 {
            local nf = 0;
            local nb = 0;
            local ns = 0;
            local j = $start;
            repeat $count {
                local Tri jt = soup[j];
                classify_tri jt;
                if cls == 3 { ns++; } elif cls == 1 { nf++; } elif cls == 2 { nb++; }
                j++;
            }
            local score = ns * SPLIT_WEIGHT + abs(nf - nb);
            if best_score < 0 or score < best_score {
                best_score = score;
                best = idx;
            }
        }
    }
    if best == 0 { best = $start; }   # every candidate was degenerate

    local Tri bt = soup[best];
    plane_from_tri bt;
    if pl_ok == 0 { stop_this_script; }

    ### create the node
    add Node {
        nx: pl_n.x, ny: pl_n.y, nz: pl_n.z, d: pl_d,
        front: 0, back: 0,
        first: length(bsp_tris) + 1, count: 0,
        cx: 0, cy: 0, cz: 0, r: 0
    } to nodes;
    local me = length(nodes);

    if $parent > 0 {
        local Node pn = nodes[$parent];
        if $side == 1 { pn.front = me; } else { pn.back = me; }
        nodes[$parent] = pn;
    }

    ### partition
    delete back_buf;
    bb_lo = Vector3 {x: BB_INF, y: BB_INF, z: BB_INF};
    bb_hi = Vector3 {x: -1 * BB_INF, y: -1 * BB_INF, z: -1 * BB_INF};

    local fstart = length(soup) + 1;
    local cop = 0;
    local j = $start;
    repeat $count {
        local Tri t = soup[j];
        if j == best {
            # Force the splitter into its own coplanar list rather than
            # trusting the epsilon. This is what guarantees the recursion
            # shrinks: every node consumes at least one triangle.
            add t to bsp_tris;
            expand_bounds_tri t;
            cop++;
        } else {
            classify_tri t;
            if cls == 0 {
                add t to bsp_tris;
                expand_bounds_tri t;
                cop++;
            } elif cls == 1 {
                add t to soup;
            } elif cls == 2 {
                add t to back_buf;
            } else {
                split_tri t;
                fan_front;
                fan_back;
            }
        }
        j++;
    }
    local fcount = length(soup) - fstart + 1;

    local bstart = length(soup) + 1;
    local bcount = length(back_buf);
    local m = 0;
    repeat bcount {
        m++;
        add back_buf[m] to soup;
    }

    local Node nd = nodes[me];
    nd.count = cop;
    nodes[me] = nd;

    # index me, since no other node can have been created inside this call
    add bb_lo to nb_lo;
    add bb_hi to nb_hi;

    if fcount > 0 { add Job {start: fstart, count: fcount, parent: me, side: 1} to jobs; }
    if bcount > 0 { add Job {start: bstart, count: bcount, parent: me, side: 2} to jobs; }
}

proc merge_child p, c {
    local Vector3 plo = nb_lo[$p];
    local Vector3 phi = nb_hi[$p];
    local Vector3 clo = nb_lo[$c];
    local Vector3 chi = nb_hi[$c];

    if clo.x < plo.x { plo.x = clo.x; }
    if clo.y < plo.y { plo.y = clo.y; }
    if clo.z < plo.z { plo.z = clo.z; }
    if chi.x > phi.x { phi.x = chi.x; }
    if chi.y > phi.y { phi.y = chi.y; }
    if chi.z > phi.z { phi.z = chi.z; }

    nb_lo[$p] = plo;
    nb_hi[$p] = phi;
}

proc finalize_bounds {
    local i = length(nodes);
    repeat length nodes {
        local Node nd = nodes[i];
        if nd.front > 0 { merge_child i, nd.front; }
        if nd.back > 0  { merge_child i, nd.back; }

        local Vector3 lo = nb_lo[i];
        local Vector3 hi = nb_hi[i];

        if hi.x < lo.x {
            nd.cx = 0; nd.cy = 0; nd.cz = 0; nd.r = -1;   # empty, always culls
        } else {
            local Vector3 mid = VEC3_BOX_CENTER(lo, hi);
            local Vector3 ext = VEC3_SUB(hi, lo);
            nd.cx = mid.x;
            nd.cy = mid.y;
            nd.cz = mid.z;
            nd.r = VEC3_MAG(ext) / 2;   # half the diagonal
        }
        nodes[i] = nd;
        i--;
    }

    delete nb_lo;
    delete nb_hi;
}

proc build_tri_colors {
    delete tri_cols;
    local i = 0;
    repeat length bsp_tris {
        i++;
        local Tri t = bsp_tris[i];
        local Vector3 ka = bsp_cols[t.a];
        local Vector3 kb = bsp_cols[t.b];
        local Vector3 kc = bsp_cols[t.c];
        local Vector3 avg = VEC3_CENTROID(ka, kb, kc);
        add Vector3 {
            x: CLAMP(avg.x * 255, 0, 255),
            y: CLAMP(avg.y * 255, 0, 255),
            z: CLAMP(avg.z * 255, 0, 255)
        } to tri_cols;
    }
    delete bsp_cols; # per-vertex colour has done its job
}

proc build_bsp {
    delete bsp_verts;
    delete bsp_cols;
    delete bsp_tris;
    delete tri_cols;
    delete nodes;
    delete soup;
    delete jobs;
    delete nb_lo;
    delete nb_hi;

    local i = 0;
    repeat length vertices {
        i++;
        add vertices[i] to bsp_verts;
        add vertexColors[i] to bsp_cols;
    }
    i = 0;
    repeat length faces {
        i++;
        local Face f = faces[i];
        add Tri {a: f.a, b: f.b, c: f.c} to soup;
    }

    add Job {start: 1, count: length(soup), parent: 0, side: 0} to jobs;

    local jp = 0;
    until jp >= length(jobs) {
        jp++;
        local Job job = jobs[jp];
        build_node job.start, job.count, job.parent, job.side;
    }

    finalize_bounds;
    build_tri_colors;

    delete vertices;
    delete vertexColors;
    delete faces;
    delete soup;
    delete back_buf;
    delete jobs;
    delete poly_f;
    delete poly_b;
}

on "build_bsp" {
    if mapLoaded {
        stop_this_script;
    }
    process_model;
    build_bsp;
    mapLoaded = true;
}