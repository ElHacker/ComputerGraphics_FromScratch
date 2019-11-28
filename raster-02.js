
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
//  Rasterization code.
// ======================================================================

// A Point representation.
let Pt = function(x, y) {
  if (!(this instanceof Pt)) {
    return new Pt(x, y);
  }

  this.x = x;
  this.y = y;
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
      let swap = p0;
      p0 = p1;
      p1 = swap;
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
      let swap = p0;
      p0 = p1;
      p1 = swap;
    }

    // Compute the X values and draw.
    let xs = Interpolate(p0.y, p0.x, p1.y, p1.x);
    for (let y = p0.y; y <= p1.y; y++) {
      // Using bitwise "or" | operator with 0 here is to remove the fractional part of the index.
      PutPixel(xs[(y - p0.y) | 0], y, color);
    }
  }
}

DrawLine(Pt(-200, -100), Pt(240, 120), [0, 0, 0]);
DrawLine(Pt(-50, -200), Pt(60, 240), [0, 0, 0]);

UpdateCanvas();
