struct Vector3 {x, y, z};
struct Vector2 {x, y};

# NOTE: THESE ARE MACROS!
# Pass plain variables, not expensive expressions, or you pay for it three times over.

### constructors / constants
%define VEC3(a, b, c) Vector3{x: a, y: b, z: c}
%define VEC3_ZERO Vector3{x: 0, y: 0, z: 0}
%define VEC3_AXIS_X Vector3{x: 1, y: 0, z: 0}
%define VEC3_AXIS_Y Vector3{x: 0, y: 1, z: 0}
%define VEC3_AXIS_Z Vector3{x: 0, y: 0, z: 1}

### magnitude
%define VEC3_MAG(vec) sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)
%define VEC3_MAG2(vec) (vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)
%define VEC3_FLAT_MAG2(vec) (vec.x * vec.x + vec.z * vec.z)

### arithmetic
%define VEC3_ADD(vec1, vec2) (Vector3{x: vec1.x + vec2.x, y: vec1.y + vec2.y, z: vec1.z + vec2.z})
%define VEC3_SUB(vec1, vec2) (Vector3{x: vec1.x - vec2.x, y: vec1.y - vec2.y, z: vec1.z - vec2.z})
%define VEC3_MUL(vec1, vec2) (Vector3{x: vec1.x * vec2.x, y: vec1.y * vec2.y, z: vec1.z * vec2.z})
%define VEC3_SCALE(vec, num) (Vector3{x: vec.x * num, y: vec.y * num, z: vec.z * num})
%define VEC3_DIV(vec, num) (Vector3{x: vec.x / num, y: vec.y / num, z: vec.z / num})
%define VEC3_NEG(vec) (Vector3{x: -1 * vec.x, y: -1 * vec.y, z: -1 * vec.z})
%define VEC3_ABS(vec) (Vector3{x: abs(vec.x), y: abs(vec.y), z: abs(vec.z)})
# vec1 + vec2 * num, in one go
%define VEC3_ADD_SCALED(vec1, vec2, num) (Vector3{x: vec1.x + vec2.x * num, y: vec1.y + vec2.y * num, z: vec1.z + vec2.z * num})

### products
%define VEC3_DOT(vec1, vec2) ((vec1.x * vec2.x) + (vec1.y * vec2.y) + (vec1.z * vec2.z))
%define VEC3_CROSS(vec1, vec2) (Vector3{x: vec1.y * vec2.z - vec1.z * vec2.y, y: vec1.z * vec2.x - vec1.x * vec2.z, z: vec1.x * vec2.y - vec1.y * vec2.x})
# cross(unit axis, vec), with the zeros folded out
%define VEC3_CROSS_X(vec) (Vector3{x: 0, y: -1 * vec.z, z: vec.y})
%define VEC3_CROSS_Y(vec) (Vector3{x: vec.z, y: 0, z: -1 * vec.x})
%define VEC3_CROSS_Z(vec) (Vector3{x: -1 * vec.y, y: vec.x, z: 0})

### interpolation / combination
# vec1 + (vec2 - vec1) * num
%define VEC3_LERP(vec1, vec2, num) (Vector3{x: vec1.x + (vec2.x - vec1.x) * num, y: vec1.y + (vec2.y - vec1.y) * num, z: vec1.z + (vec2.z - vec1.z) * num})
# vec1 * num1 + vec2 * num2
%define VEC3_LINCOMB2(vec1, num1, vec2, num2) (Vector3{x: vec1.x * num1 + vec2.x * num2, y: vec1.y * num1 + vec2.y * num2, z: vec1.z * num1 + vec2.z * num2})
%define VEC3_CENTROID(vec1, vec2, vec3) (Vector3{x: (vec1.x + vec2.x + vec3.x) / 3, y: (vec1.y + vec2.y + vec3.y) / 3, z: (vec1.z + vec2.z + vec3.z) / 3})

### misc
%define VEC3_FLAT(vec) (Vector3{x: vec.x, y: 0, z: vec.z})
%define VEC3_NORMALIZE(vec) local magnitude = VEC3_MAG(vec); vec = Vector3{x: vec.x / magnitude, y: vec.y / magnitude, z: vec.z / magnitude}

### aabb helpers, for lo/hi corner pairs
%define VEC3_BOX_CENTER(lo, hi) (Vector3{x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2})
%define VEC3_BOX_HALF(lo, hi) (Vector3{x: (hi.x - lo.x) / 2, y: (hi.y - lo.y) / 2, z: (hi.z - lo.z) / 2})

### Vector2
%define VEC2(a, b) Vector2{x: a, y: b}
%define VEC2_ZERO Vector2{x: 0, y: 0}

%define VEC2_MAG(vec) sqrt(vec.x * vec.x + vec.y * vec.y)
%define VEC2_MAG2(vec) (vec.x * vec.x + vec.y * vec.y)
%define VEC2_DIST(vec1, vec2) sqrt((vec1.x - vec2.x) * (vec1.x - vec2.x) + (vec1.y - vec2.y) * (vec1.y - vec2.y))

%define VEC2_ADD(vec1, vec2) (Vector2{x: vec1.x + vec2.x, y: vec1.y + vec2.y})
%define VEC2_SUB(vec1, vec2) (Vector2{x: vec1.x - vec2.x, y: vec1.y - vec2.y})
%define VEC2_MUL(vec1, vec2) (Vector2{x: vec1.x * vec2.x, y: vec1.y * vec2.y})
%define VEC2_SCALE(vec, num) (Vector2{x: vec.x * num, y: vec.y * num})
%define VEC2_DIV(vec, num) (Vector2{x: vec.x / num, y: vec.y / num})
%define VEC2_NEG(vec) (Vector2{x: -1 * vec.x, y: -1 * vec.y})
%define VEC2_ADD_SCALED(vec1, vec2, num) (Vector2{x: vec1.x + vec2.x * num, y: vec1.y + vec2.y * num})

%define VEC2_DOT(vec1, vec2) ((vec1.x * vec2.x) + (vec1.y * vec2.y))
%define VEC2_CROSS(vec1, vec2) (vec1.x * vec2.y - vec1.y * vec2.x)
%define VEC2_LERP(vec1, vec2, num) (Vector2{x: vec1.x + (vec2.x - vec1.x) * num, y: vec1.y + (vec2.y - vec1.y) * num})