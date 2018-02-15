// References:
// https://en.wikipedia.org/wiki/Painter%27s_algorithm
// https://en.wikipedia.org/wiki/Linear_interpolation
// https://en.wikipedia.org/wiki/Alpha_compositing#Alpha_blending
// Processing.js lerpColor

// Represents a color
export function rgba(r, g, b, a) {
  this.r = isNaN(r) ? 0 : r;
  this.g = isNaN(g) ? 0 : g;
  this.b = isNaN(b) ? 0 : b;
  this.a = isNaN(a) ? 1 : a;  // infer opaque
}

export function rgba_to_string(rgba) {
  return 'rgba(' + rgba.r + ', ' + rgba.g + ', ' + rgba.b + ', ' + rgba.a + ')';
}

export function lerp(start, stop, amount) {
  return amount * (stop - start) + start;
}

// Blend two rgba colors (via linear interpolation)
export function rgba_lerp(c1, c2) {
  const c3 = new rgba(0, 0, 0, 0);
  const alpha = c2.a;
  c3.r = Math.round(lerp(c1.r, c2.r, alpha));
  c3.g = Math.round(lerp(c1.g, c2.g, alpha));
  c3.b = Math.round(lerp(c1.b, c2.b, alpha));
  c3.a = lerp(c1.a, c2.a, alpha);
  // round output alpha to 2 precision
  c3.a = Math.round(c3.a * 100) / 100;
  return c3;
}

const RGBA_WHITE_OPAQUE = new rgba(255, 255, 255, 1);

// Given an array of colors, return the composed color. The array should be
// ordered from bottom color layer to top color layer. The default rgba
// represents the default background color behind the colors in the array. Use
// rgba(0,0,0,0) which is black transparent to indicate no background.
export function rgba_composite(rgba_array, default_rgba = RGBA_WHITE_OPAQUE) {
  let output = default_rgba;
  for (const color of rgba_array) {
    output = rgba_lerp(output, color);
  }
  return output;
}
