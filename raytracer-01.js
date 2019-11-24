
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
// Dot product of two 3D vectors.
let DotProduct = (v1, v2) => {
  return (v1[0] * v2[0]) + (v1[1] * v2[1]) + (v1[2] * v2[2]);
}
// Computes v1 - v2.
let Subtract = (v1, v2) => {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
}


// ======================================================================
//  A very basic raytracer.
// ======================================================================

let Sphere = function(center, radius, color) {
  this.center = center;
  this.radius = radius;
  this.color = color;
}

// Scene setup.
let viewport_size = 1;
let projection_plane_z = 1;
let camera_position = [0, 0, 0];
let background_color = [255, 255, 255];
let spheres = [new Sphere([0, -1, 3], 1, [255, 0, 0]),
	       new Sphere([2, 0, 4], 1, [0, 0, 255]),
	       new Sphere([-2, 0, 4], 1, [0, 255, 0])];



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

// Traces a ray against the set of spheres in the scene.
let TraceRay = (origin, direction, min_t, max_t) => {
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
  if (closest_sphere == null) {
    return background_color;
  }
  return closest_sphere.color;
}


//
// Main loop.
//
for (let x = -canvas.width/2; x < canvas.width/2; x++) {
  for (let y = -canvas.height/2; y < canvas.height/2; y++) {
    let direction = CanvasToViewport([x, y])
    let color = TraceRay(camera_position, direction, 1, Infinity);
    PutPixel(x, y, color);
  }
}
UpdateCanvas();
