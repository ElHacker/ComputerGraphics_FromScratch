
// ======================================================================
//  Low-level canvas access.
// ======================================================================
let canvas = document.getElementById('canvas');
let canvas_context = canvas.getContext('2d');
let canvas_buffer = canvas_context.getImageData(0, 0, canvas.width, canvas.height);
let canvas_pitch = canvas_buffer.width * 4;


let PutPixel = (x, y, color) => {
  x = canvas.width / 2 + x;
  y = canvas.height / 2 - y - 1;

  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
    return;
  }

  let offset = 4 * x + canvas_pitch * y;
  canvas_buffer.data[offset++] = color[0];
  canvas_buffer.data[offset++] = color[1];
  canvas_buffer.data[offset++] = color[2];
  canvas_buffer.data[offset++] = 255; // Alpha = 255 (full opacity)
}


// Displays the contents of the offscreen buffer into the canvas.
let UpdateCanvas = () => {
  canvas_context.putImageData(canvas_buffer, 0, 0);
}


// ======================================================================
//  Linear algebra and helpers.
// ======================================================================

// Conceptually, an "infinitesimaly small" real number.
const EPSILON = 0.001;

// Dot product of two 3D vectors.
let DotProduct = (v1, v2) => {
  return (v1[0] * v2[0]) + (v1[1] * v2[1]) + (v1[2] * v2[2]);
}

// Computes v1 - v2.
let Subtract = (v1, v2) => {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}

// Length of a vector.
let Length = (vec) => {
  return Math.sqrt(DotProduct(vec, vec));
}

// Multiplies scalar and a vector.
let MultiplySV = (k, vec) => {
  return [k * vec[0], k * vec[1], k * vec[2]];
}

// Multiplies a matrix and a vector.
let MultiplyMV = function(mat, vec) {
  let result = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result[i] += vec[j] * mat[i][j];
    }
  }
  return result;
}

// Computes v1 + v2.
var Add = (v1, v2) => {
  return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
}

// Clamps a color to the canonical color range.
var Clamp = (vec) => {
  return [Math.min(255, Math.max(0, vec[0])),
	  Math.min(255, Math.max(0, vec[1])),
	  Math.min(255, Math.max(0, vec[2]))];
}

// ======================================================================
//  A raytracer with diffuse and specular illumination, shadows, and reflections.
//  Also with arbitrary camera position and ration.
// ======================================================================

let Sphere = function(center, radius, color, specular, reflective) {
  this.center = center;
  this.radius = radius;
  this.color = color;
  this.specular = specular;
  this.reflective = reflective;
}

let Light = function(type, intensity, position) {
  this.type = type;
  this.intensity = intensity;
  this.position = position;
}

Light.AMBIENT = 0;
Light.POINT = 1;
Light.DIRECTIONAL = 2;

// Scene setup.
let viewport_size = 1;
let projection_plane_z = 1;
let camera_position = [3, 0, 1];
let camera_rotation = [[0.7071, 0, -0.7071],
            		       [     0, 1,       0],
            		       [0.7071, 0,  0.7071]];
let background_color = [0, 0, 0];
let spheres = [new Sphere([0, -1, 3], 1, [255, 0, 0], 500, 0.2),
	       new Sphere([2, 0, 4], 1, [0, 0, 255], 500, 0.3),
	       new Sphere([-2, 0, 4], 1, [0, 255, 0], 10, 0.4),
         new Sphere([0, -5001, 0], 5000, [255, 255, 0], 1000, 0.5)];

let lights = [
  new Light(Light.AMBIENT, 0.2),
  new Light(Light.POINT, 0.6, [2, 1, 0]),
  new Light(Light.DIRECTIONAL, 0.2, [1, 4, 4])
];

const recursion_depth = 3;

// Converts 2D canvas coordinates to 3D viewport coordinates.
let CanvasToViewport = (p2d) => {
  return [p2d[0] * viewport_size / canvas.width,
          p2d[1] * viewport_size / canvas.height,
          projection_plane_z];
}


// Computes the intersection of a ray and a sphere. Returns the values
// of t for the intersections.
let IntersectRaySphere = (origin, direction, sphere) => {
  const oc = Subtract(origin, sphere.center);

  const k1 = DotProduct(direction, direction);
  const k2 = 2 * DotProduct(oc, direction);
  const k3 = DotProduct(oc, oc) - sphere.radius * sphere.radius;

  const discriminant = k2 * k2 - 4 * k1 * k3;
  if (discriminant < 0) {
    return [Infinity, Infinity];
  }

  t1 = (-k2 + Math.sqrt(discriminant)) / (2 * k1)
  t2 = (-k2 - Math.sqrt(discriminant)) / (2 * k1)
  return [t1, t2];
}

let ComputeLighting = (point, normal, view, specular) => {
  let intensity = 0;
  const length_n = Length(normal); // Since this is a normal vector, the length should be 1.0 always.
  const length_v = Length(view);
  let max_t = 0;
  for (let i = 0; i < lights.length; i++) {
    let light = lights[i];
    if (light.type === Light.AMBIENT) {
      intensity += light.intensity;
    } else {
      let vec_l;
      if (light.type === Light.POINT) {
        vec_l = Subtract(light.position, point);
        max_t = 1;
      } else if (light.type === Light.DIRECTIONAL) {
        vec_l = light.position;
        max_t = Infinity;
      }

      // Shadow check
      const blocker = ClosestIntersection(point, vec_l, EPSILON, max_t);
      if (blocker) {
        continue
      }

      // Diffuse
      const n_dot_1 = DotProduct(normal, vec_l);
      if (n_dot_1 > 0) {
        intensity += light.intensity * n_dot_1 / (length_n * Length(vec_l));
      }

      // Specular
      if (specular != -1) {
        let vec_r = Subtract(MultiplySV(2.0 * DotProduct(normal, vec_l), normal), vec_l);
        let r_dot_v = DotProduct(vec_r, view);
        if (r_dot_v > 0) {
          intensity += light.intensity *  Math.pow(r_dot_v / (Length(vec_r) * length_v), specular);
        }
      }
    }
}
  return intensity;
}

// Find the closest intersection between a ray and the spheres in the scene.
let ClosestIntersection = (origin, direction, min_t, max_t) => {
  let closest_t = Infinity;
  let closest_sphere = null;
  for (let i = 0; i < spheres.length; i++) {
    const sphere = spheres[i]
    tValues = IntersectRaySphere(origin, direction, sphere);
    const t1 = tValues[0];
    const t2 = tValues[1];
    if (t1 > min_t && t1 < max_t && t1 < closest_t) {
      closest_t = t1;
      closest_sphere = sphere;
    }
    if (t2 > min_t && t2 < max_t && t2 < closest_t) {
      closest_t = t2;
      closest_sphere = sphere;
    }
  }
  if (closest_sphere) {
    return [closest_sphere, closest_t];
  }
  return null;
}

// Computes the reflection of v1 respect to v2.
var ReflectRay = function(v1, v2) {
  return Subtract(MultiplySV(2 * DotProduct(v1, v2), v2), v1);
}

// Traces a ray against the set of spheres in the scene.
let TraceRay = (origin, direction, min_t, max_t, depth) => {
  const intersection = ClosestIntersection(origin, direction, min_t, max_t);
  if (!intersection) {
    return background_color;
  }
  const closest_sphere = intersection[0];
  const closest_t = intersection[1];

  // Compute local color:
  // Compute intersection
  const point = Add(origin, MultiplySV(closest_t, direction));
  // Compute normal at intersection.
  let normal = Subtract(point, closest_sphere.center);
  normal = MultiplySV(1.0 / Length(normal), normal);
  const view = MultiplySV(-1, direction);
  const lighting = ComputeLighting(point, normal, view, closest_sphere.specular);
  const local_color = MultiplySV(lighting, closest_sphere.color)

  // If we hit the recursion limit or the object is not reflective, we're done
  if (depth <= 0 || closest_sphere.reflective <= 0) {
    return local_color;
  }

  // Compute the reflected color.
  const reflected_ray = ReflectRay(view, normal);
  const reflected_color = TraceRay(point, reflected_ray, EPSILON, Infinity, depth - 1);

  return Add(MultiplySV(1 - closest_sphere.reflective, local_color),
             MultiplySV(closest_sphere.reflective, reflected_color));
}


//
// Main loop.
//
for (let x = -canvas.width/2; x < canvas.width/2; x++) {
  for (let y = -canvas.height/2; y < canvas.height/2; y++) {
    let direction = MultiplyMV(camera_rotation, CanvasToViewport([x, y]));
    let color = TraceRay(camera_position, direction, 1, Infinity, recursion_depth);
    PutPixel(x, y, Clamp(color));
  }
}
UpdateCanvas();
