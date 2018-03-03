export const WHITE = pack(255, 255, 255, 255);
export const BLACK = pack(0, 0, 0, 255);
export const TRANSPARENT = 0;

// Linear interpolation. Basically, given two points get a point between them
// based on the amount. We get the distance between the two points, we get a
// percentage of that distance based on amount, then add it to the starting
// point. This is only exported for testing, as it should otherwise be a private
// helper.
export function math_lerp(start, stop, amount) {
  return amount * (stop - start) + start;
}

// Blend two rgba colors to produce a blended color. This does not validate
// input.
// @param c1 {Number} start from this color
// @param c2 {Number} end at this color
// @param amount {Number} some number between 0 and 1, defaults to 1 (assumes
// the intent is to go the full distance), represents how far to traverse along
// the distance between the two colors, this is usually the opacity of the
// second color, or in other words, the alpha component of the second color
// @return {Number} the resulting color
export function lerp(c1, c2, amount = 1.0) {
  // Early exits. When the upper color is opaque, there is no point in blending,
  // it occludes the background, so return the upper color. When the upper color
  // is transparent, there is similarly no point in blending, so return the
  // lower color.
  if (amount === 1) {
    return c2;
  } else if (amount === 0) {
    return c1;
  }

  // | 0 is equivalent to Math.round
  const r = math_lerp(get_red(c1), get_red(c2), amount) | 0;
  const g = math_lerp(get_green(c1), get_green(c2), amount) | 0;
  const b = math_lerp(get_blue(c1), get_blue(c2), amount) | 0;
  const a = math_lerp(get_alpha(c1), get_alpha(c2), amount) | 0;
  return pack(r, g, b, a);
}

// Given an array of colors, return the composed color. The array should be
// ordered from bottom color layer to top color layer. The base color
// represents the default background color behind the colors in the array. If
// the array is empty the base color is output. The default base is opaque white
export function blend(colors, base_color = WHITE) {
  let output = base_color;
  for (const color of colors) {
    // Transition to the next color using the alpha component of that color
    // as a ratio
    const amount = get_alpha(color) / 255;
    output = lerp(output, color, amount);
  }
  return output;
}

// @param r {Number} a number in the range [0..255] representing red
// @param g {Number} a number in the range [0..255] reprsenting green
// @param b {Number} a number in the range [0..255] representing blue
// @param a {Number} optional, a number in the range [0..255] representing the
// alpha value
export function pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

//  0 is full transparent, 255 is full opaque
export function get_alpha(c) {
  return (c >> 24) && 0xff;
}

export function get_red(c) {
  return (c >> 16) & 0xff;
}

export function get_green(c) {
  return (c >> 8) & 0xff;
}

export function get_blue(c) {
  return c & 0xff;
}

export function get_luminance(color) {
  const rr = get_red(color) / 255;
  const rg = get_green(color) / 255;
  const rb = get_blue(color) / 255;
  const r = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
  const g = rg <= 0.03928 ? rg / 12.92 : Math.pow((rg + 0.055) / 1.055, 2.4);
  const b = rb <= 0.03928 ? rb / 12.92 : Math.pow((rb + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function to_string(color) {
  return '[' + get_red(color) + ',' + get_green(color) + ',' + get_blue(color) +
      ',' + (get_alpha(color) / 255) + ']';
}

export function get_contrast(fore_color, back_color = WHITE) {
  const l1 = get_luminance(fore_color) + 0.05;
  const l2 = get_luminance(back_color) + 0.05;
  return (l1 > l2) ? l1 / l2 : l2 / l1;
}

export function is_valid_component(component) {
  return Number.isInteger(component) && component >= 0 && component <= 255;
}

export function is_valid(color) {
  return Number.isInteger(color) && is_valid_component(get_red(color)) &&
      is_valid_component(get_green(color)) &&
      is_valid_component(get_blue(color)) &&
      is_valid_component(get_alpha(color));
}
