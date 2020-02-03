
// ======================================================================
//  Low-level canvas access.
// ======================================================================
let canvas = document.getElementById('canvas');
let canvas_context = canvas.getContext('2d');
let canvas_buffer = canvas_context.getImageData(0, 0, canvas.width, canvas.height);
let canvas_pitch = canvas_buffer.width * 4;


let PutPixel = (x, y, color) => {
  x = canvas.width / 2 + Math.floor(x);
  y = canvas.height / 2 - Math.floor(y) - 1;

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

// Computes scalar by vector multiplication
let Multiply = function(k, vec) {
  return Vertex(k*vec.x, k*vec.y, k*vec.z);
}

// Computes v1 + v2.
let Add = function(v1, v2) {
  return Vertex(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z);
}

// Makes a transform matrix for a rotation around the OY axis.
let MakeOYRotationMatrix = function(degrees) {
  let cos = Math.cos(degrees*Math.PI/180.0);
  let sin = Math.sin(degrees*Math.PI/180.0);

  return Mat4x4([[cos, 0, -sin, 0],
                 [  0, 1,    0, 0],
                 [sin, 0,  cos, 0],
                 [  0, 0,    0, 1]])
}


// Makes a transform matrix for a translation.
let MakeTranslationMatrix = function(translation) {
  return Mat4x4([[1, 0, 0, translation.x],
                 [0, 1, 0, translation.y],
                 [0, 0, 1, translation.z],
                 [0, 0, 0,             1]]);
}


// Makes a transform matrix for a scaling.
let MakeScalingMatrix = function(scale) {
  return Mat4x4([[scale,     0,     0, 0],
                 [    0, scale,     0, 0],
                 [    0,     0, scale, 0],
                 [    0,     0,     0, 1]]);
}


// Multiplies a 4x4 matrix and a 4D vector.
let MultiplyMV = function(mat4x4, vec4) {
  let result = [0, 0, 0, 0];
  let vec = [vec4.x, vec4.y, vec4.z, vec4.w];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i] += mat4x4.data[i][j]*vec[j];
    }
  }

  return Vertex4(result[0], result[1], result[2], result[3]);
}


// Multiplies two 4x4 matrices.
let MultiplyMM4 = function(matA, matB) {
  let result = Mat4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result.data[i][j] += matA.data[i][k]*matB.data[k][j];
      }
    }
  }

  return result;
}


// Transposes a 4x4 matrix.
let Transposed = function(mat) {
  let result = Mat4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result.data[i][j] = mat.data[j][i];
    }
  }
  return result;
}

// ======================================================================
//  Rasterization code.
// ======================================================================

// Scene setup.
const viewport_size = 1;
const projection_plane_z = 1;

// A Point representation.
let Pt = function(x, y, h) {
  if (!(this instanceof Pt)) {
    return new Pt(x, y, h);
  }

  this.x = x;
  this.y = y;
  this.h = h;
}

// A 3D vertex
let Vertex = function(x, y, z) {
  if (!(this instanceof Vertex)) {
    return new Vertex(x, y, z);
  }

  this.x = x;
  this.y = y;
  this.z = z;
}

// A 4D vertex (a 3D Vertex in homogeneous coordinates)
let Vertex4 = function(x, y, z, w) {
  if (!(this instanceof Vertex4)) { return new Vertex4(x, y, z, w); }

  this.x = x;
  this.y = y;
  this.z = z;
  this.w = w;
}

// A 4x4 matrix.
let Mat4x4 = function(data) {
  if (!(this instanceof Mat4x4)) { return new Mat4x4(data); }

  this.data = data;
}

const Identity4x4 = Mat4x4([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);

// A Triangle.
let Triangle = function(v0, v1, v2, color) {
  if (!(this instanceof Triangle)) { return new Triangle(v0, v1, v2, color); }

  this.v0 = v0;
  this.v1 = v1;
  this.v2 = v2;
  this.color = color;
}

// A Model.
let Model = function(name, vertexes, triangles) {
  if (!(this instanceof Model)) { return new Model(name, vertexes, triangles); }

  this.name = name;
  this.vertexes = vertexes;
  this.triangles = triangles;
}

// An Instance.
let Instance = function(model, position, orientation, scale) {
  if (!(this instanceof Instance)) { return new Instance(model, position, orientation, scale); }

  this.model = model;
  this.position = position;
  this.orientation = orientation || Identity4x4;
  this.scale = scale || 1.0;

  this.transform = MultiplyMM4(MakeTranslationMatrix(this.position), MultiplyMM4(this.orientation, MakeScalingMatrix(this.scale)));
}

// The Camera.
let Camera = function(position, orientation) {
  if (!(this instanceof Camera)) { return new Camera(position, orientation); }

  this.position = position;
  this.orientation = orientation;
}

let Interpolate = (i0, d0, i1, d1) => {
  if (i0 == i1) {
    return [d0];
  }

  let values = [];
  const a = (d1 - d0) / (i1 - i0);
  let d = d0;
  for (let i = i0; i <= i1; i++) {
    values.push(d);
    d += a;
  }

  return values;
}

let DrawLine = (p0, p1, color) => {
  let dx = p1.x - p0.x;
  let dy = p1.y - p0.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // The line is horizontal-ish. Make sure it's left to right.
    if (dx < 0) {
      [p0, p1] = [p1, p0];
    }

    // Compute the Y values and draw.
    let ys = Interpolate(p0.x, p0.y, p1.x, p1.y);
    for (let x = p0.x; x <= p1.x; x++) {
      // Using bitwise "or" | operator with 0 here is to remove the fractional part of the index.
      PutPixel(x, ys[(x - p0.x) | 0], color);
    }
  } else {
    // The line is vertical-ish. Make sure it's bottom to top.
    if (dy < 0) {
      [p0, p1] = [p1, p0];
    }

    // Compute the X values and draw.
    let xs = Interpolate(p0.y, p0.x, p1.y, p1.x);
    for (let y = p0.y; y <= p1.y; y++) {
      // Using bitwise "or" | operator with 0 here is to remove the fractional part of the index.
      PutPixel(xs[(y - p0.y) | 0], y, color);
    }
  }
}

let DrawWireframeTriangle = (p0, p1, p2, color) => {
  DrawLine(p0, p1, color);
  DrawLine(p1, p2, color);
  DrawLine(p0, p2, color);
}

// Converts 2D viewport coordinates to 2D canvas coordinates.
let ViewportToCanvas = (p2d) => {
  return Pt(
    (p2d.x * canvas.width / viewport_size) | 0,
    (p2d.y * canvas.height / viewport_size) | 0
  );
}

let ProjectVertex = (v) => {
  return ViewportToCanvas(Pt(v.x * projection_plane_z / v.z,
                             v.y * projection_plane_z / v.z));
}

let RenderObject = (vertexes, triangles) => {
  let projected = [];
  for (let i = 0; i < vertexes.length; i++) {
    projected.push(ProjectVertex(vertexes[i]));
  }
  for (let i = 0; i < triangles.length; i++) {
    RenderTriangle(triangles[i], projected);
  }
}

let RenderTriangle = (triangle, projected) => {
  DrawWireframeTriangle(
    projected[triangle.v0],
    projected[triangle.v1],
    projected[triangle.v2],
    triangle.color,
  );
}

let RenderScene = (camera, instances) => {
  let cameraMatrix = MultiplyMM4(Transposed(camera.orientation), MakeTranslationMatrix(Multiply(-1, camera.position)));

   for (let i = 0; i < instances.length; i++) {
     let transform = MultiplyMM4(cameraMatrix, instances[i].transform);
     RenderModel(instances[i].model, transform);
   }
}

let RenderModel = function(model, transform) {
  let projected = [];
  for (let i = 0; i < model.vertexes.length; i++) {
    let vertex = model.vertexes[i]
    let vertexH = Vertex4(vertex.x, vertex.y, vertex.z, 1)
    projected.push(ProjectVertex(MultiplyMV(transform, vertexH)));
  }
  for (let i = 0; i < model.triangles.length; i++) {
    RenderTriangle(model.triangles[i], projected);
  }
}

let RenderInstance = (instance) => {
  let projected = [];
  let model = instance.model;
  for (let i = 0; i < model.vertexes.length; i++) {
    projected.push(ProjectVertex(Add(instance.position, model.vertexes[i])));
  }
  for (let i = 0; i < model.triangles.length; i++) {
    RenderTriangle(model.triangles[i], projected);
  }
}

let vertexes = [
  Vertex(1, 1, 1),
  Vertex(-1, 1, 1),
  Vertex(-1, -1, 1),
  Vertex(1, -1, 1),
  Vertex(1, 1, -1),
  Vertex(-1, 1, -1),
  Vertex(-1, -1, -1),
  Vertex(1, -1, -1)
];

let RED = [255, 0, 0];
let GREEN = [0, 255, 0];
let BLUE = [0, 0, 255];
let YELLOW = [255, 255, 0];
let PURPLE = [255, 0, 255];
let CYAN = [0, 255, 255];

let triangles = [
  Triangle(0, 1, 2, RED),
  Triangle(0, 2, 3, RED),
  Triangle(4, 0, 3, GREEN),
  Triangle(4, 3, 7, GREEN),
  Triangle(5, 4, 7, BLUE),
  Triangle(5, 7, 6, BLUE),
  Triangle(1, 5, 6, YELLOW),
  Triangle(1, 6, 2, YELLOW),
  Triangle(4, 5, 1, PURPLE),
  Triangle(4, 1, 0, PURPLE),
  Triangle(2, 6, 7, CYAN),
  Triangle(2, 7, 3, CYAN)
];

const cube = Model('cube', vertexes, triangles);

let instances = [
  Instance(cube, Vertex(-1.5, 0, 7), Identity4x4, 0.75),
  Instance(cube, Vertex(1.25, 2.5, 7.5), MakeOYRotationMatrix(195)),
];

let camera = Camera(Vertex(-3, 1, 2), MakeOYRotationMatrix(-30));

RenderScene(camera, instances);

UpdateCanvas();
