
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
//  Rasterization code.
// ======================================================================
let DrawLineBroken = function(x0, y0, x1, y1, color) {
  const a = (y1 - y0) / (x1 - x0);
  let y = y0;
  for (let x = x0; x <= x1; x++) {
    PutPixel(x, y, color);
    y += a;
  }
}

DrawLineBroken(-200, -100, 240, 120, [0, 0, 0]);
DrawLineBroken(-50, -200, 60, 240, [0, 0, 0]);

UpdateCanvas();
