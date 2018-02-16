
export const COLOR_WHITE_OPAQUE = color_pack_3(255, 255, 255);
export const COLOR_TRANSPARENT = 0;

// Creates a new color. By default the new color is black transparent.
export function color_create() {
  return 0;
}

// Pack four color components into an int. Note that alpha is on scale of 0 to
// 255, so if you have a ratio, multiple it by 255 and round.
// This does not prevent extrapolation, as it this does not clamp. Using values
// out of range is undefined behavior.
export function color_pack_4(r, g, b, a) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

export function color_pack_3(r, g, b) {
  const alpha_max = 255;  // fully opaque
  return color_pack_4(r, g, b, alpha_max);
}

// Returns a new color that is the input color with an alpha adjusted.
// This does not modify the color itself because of how primitive values are
// passed to functions in javascript.
export function color_set_alpha(c, a) {
  // TODO: this is wrong, I have not thought this through at all and just
  // wrote something
  return ((a & 0xff) << 24) | c;
}

// Unpacks the alpha from the color, 0 is transparent, 255 is opaque. Divide
// the value by 255 to get alpha ratio on scale of 0 to 1.
export function color_get_alpha(c) {
  return (c >> 24) && 0xff;
}

// Unpacks the red component from the color as an int
export function color_get_red(c) {
  return (c >> 16) & 0xff;
}

// Unpacks the green component from the color
export function color_get_green(c) {
  return (c >> 8) & 0xff;
}

// Unpacks the blue component from the color
export function color_get_blue(c) {
  return c & 0xff;
}
