export const COLOR_WHITE = color_pack(255, 255, 255, 255);
export const COLOR_BLACK = color_pack(0, 0, 0, 255);
export const COLOR_TRANSPARENT = 0;

// Linear interpolation. Basically, given two points get a point between them
// based on the amount. We get the distance between the two points, we get a
// percentage of that distance based on amount, then add it to the starting
// point. This is only exported for testing, as it should otherwise be a private
// helper.
export function lerp(start, stop, amount) {
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
export function color_lerp(c1, c2, amount = 1.0) {
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
  const r = lerp(color_red(c1), color_red(c2), amount) | 0;
  const g = lerp(color_green(c1), color_green(c2), amount) | 0;
  const b = lerp(color_blue(c1), color_blue(c2), amount) | 0;
  const a = lerp(color_alpha(c1), color_alpha(c2), amount) | 0;
  return color_pack(r, g, b, a);
}

// Given an array of colors, return the composed color. The array should be
// ordered from bottom color layer to top color layer. The base color
// represents the default background color behind the colors in the array. If
// the array is empty the base color is output. The default base is opaque white
export function color_blend(colors, base_color = COLOR_WHITE) {
  let output = base_color;
  for (const color of colors) {
    // Transition to the next color using the alpha component of that color
    // as a ratio
    const amount = color_alpha(color) / 255;
    output = color_lerp(output, color, amount);
  }
  return output;
}

// Pack four color components into an int. Note that alpha is on scale of
// [0..255], so if you have a ratio in the [0..1] interval, multiple it by 255
// and round to nearest int.
//
// Using values out of range is undefined behavior. This does no input
// validation for speed.
//
// @param r {Number} a number in the range [0..255] representing red
// @param g {Number} a number in the range [0..255] reprsenting green
// @param b {Number} a number in the range [0..255] representing blue
// @param a {Number} optional, a number in the range [0..255] representing the
// alpha value, also known as opacity. Defaults to 255.
export function color_pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

// Unpacks the alpha from the color, 0 is transparent, 255 is opaque. Divide
// the return value by 255 to get alpha ratio on scale of 0 to 1.
export function color_alpha(c) {
  return (c >> 24) && 0xff;
}

// Unpacks the red component from the color as an int in interval [0..255]
export function color_red(c) {
  return (c >> 16) & 0xff;
}

// Unpacks the green component from the color in interval [0..255]
export function color_green(c) {
  return (c >> 8) & 0xff;
}

// Unpacks the blue component from the color in interval [0..255]
export function color_blue(c) {
  return c & 0xff;
}

// Get the relative luminance of a color
export function color_luminance(color) {
  if (color_alpha(color) !== 255) {
    console.warn('Not opaque', color_to_string(color));
  }

  const rr = color_red(color) / 255;
  const rg = color_green(color) / 255;
  const rb = color_blue(color) / 255;
  const r = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
  const g = rg <= 0.03928 ? rg / 12.92 : Math.pow((rg + 0.055) / 1.055, 2.4);
  const b = rb <= 0.03928 ? rb / 12.92 : Math.pow((rb + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Returns a string in the form [r,g,b,a], with a as ratio. Mostly just for
// debugging, not for css-usage
export function color_to_string(color) {
  return '[' + color_red(color) + ',' + color_green(color) + ',' +
      color_blue(color) + ',' + (color_alpha(color) / 255) + ']';
}

// Returns the W3C contrast ratio between the fore color and the back color
export function color_contrast(fore_color, back_color = COLOR_WHITE) {
  const l1 = color_luminance(fore_color) + 0.05;
  const l2 = color_luminance(back_color) + 0.05;
  return (l1 > l2) ? l1 / l2 : l2 / l1;
}

// Return true if the component value is a valid color component
export function color_valid_component(component) {
  return Number.isInteger(component) && component >= 0 && component <= 255;
}

// Return true if color is a valid color value
export function color_is_valid(color) {
  return Number.isInteger(color) && color_valid_component(color_red(color)) &&
      color_valid_component(color_green(color)) &&
      color_valid_component(color_blue(color)) &&
      color_valid_component(color_alpha(color));
}
