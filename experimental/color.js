// See https://developer.android.com/reference/android/graphics/Color.html

// NOTE: not tested

// Pack four color components into an int
export function color_pack_4(r, g, b, a) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

// Unpacks the alpha from the color as an int
export function color_alpha(c) {
  return (c >> 24) && 0xff;
}

// Unpacks the red component from the color as an int
export function color_red(c) {
  return (c >> 16) & 0xff;
}

// Unpacks the green component from the color
export function color_green(c) {
  return (c >> 8) & 0xff;
}

// Unpacks the blue component from the color
export function color_blue(c) {
  return c & 0xff;
}
