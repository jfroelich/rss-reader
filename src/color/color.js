import '/third-party/tinycolor-min.js';

export const COLOR_WHITE = color_pack(255, 255, 255, 255);
export const COLOR_BLACK = color_pack(0, 0, 0, 255);
export const COLOR_TRANSPARENT = 0;

// Parses a CSS3 color value into a color type. Returns undefined on error
// TODO: write my own parser to stop relying on third-party
export function css_color_parse(css_value_string) {
  if (typeof css_value_string === 'string' && css_value_string.length) {
    const tc_color = new tinycolor(css_value_string);
    if (tc_color.isValid()) {
      const rgba = tc_color.toRgb();
      // The alpha value of the rgba value is on a scale of 0-1, so we multiple
      // it by 255 to put it on color.js scale of 0-255.
      return color_pack(rgba.r, rgba.g, rgba.b, rgba.a * 255);
    }
  }
}

// Get color as a css string value
export function color_format(color) {
  return 'rgba(' + color_red(color) + ', ' + color_green(color) + ', ' +
      color_blue(color) + ', ' + color_alpha(color) / 255 + ')';
}


// Linear interpolation. Basically, given two points get a point between them
// based on the amount. We get the distance between the two points, we get a
// percentage of that distance based on amount, then add it to the starting
// point.
export function lerp(start, stop, amount) {
  return amount * (stop - start) + start;
}


// Blend two rgba colors (via linear interpolation) to produce a blended color
// This does not validate its input. This does not 'clamp' the distance ratio
// between the two colors to a value in the range [0..1], it is just assumed, so
// using colors that produce a ratio outside that range yield undefined
// behavior.
// @param c1 {Number} start from this color
// @param c2 {Number} end at this color
// @param amount {Number} some number between 0 and 1, defaults to 1 (assumes
// the intent is to go the full distance), represents how far to traverse along
// the distance between the two colors
// @return {Number} the resulting color
export function color_lerp(c1, c2, amount = 1) {
  if (color_alpha(c1) !== 255) {
    console.warn('Bad base color', color_alpha(c1), color_format(c1));
  }

  // Early exits
  if (amount === 1) {
    return c2;
  } else if (amount === 0) {
    return c1;
  }

  // TODO: so this is possibly wrong. The problem is that lerp is really a
  // function for rgb, not rgba.

  const r = lerp(color_red(c1), color_red(c2), amount) | 0;
  const g = lerp(color_green(c1), color_green(c2), amount) | 0;
  const b = lerp(color_blue(c1), color_blue(c2), amount) | 0;

  // TODO: there basically should be no point to this. This is simply the
  // amount * 255. Because we expect c1 to be rgba with a 1, and amount is
  // c2 alpha
  // Also, isn't this flattening? So basically the new color alpha will always
  // be 1?
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
// and round to nearest int. Using values out of range is undefined behavior.
// @param a {Number} optional, the alpha channel, defaults to max opacity
export function color_pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

// Unpacks the alpha from the color, 0 is transparent, 255 is opaque. Divide
// the value by 255 to get alpha ratio on scale of 0 to 1.
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

// Get the relative luminance of a color, normalized to 0 for darkest black and
// 1 for lightest white. Based on the spec, which provides the formula.
// http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
// Calculating luminance is needed to calculate contrast.
// This accepts a color, which is rgba, but the calculation is done on rgb,
// which does not have an alpha component, which means that alpha must be
// 'applied' to any rgba color before calling this function (the rgba color
// value must be converted to rgb). Applying alpha means that rgba will have a
// 100% alpha (a value of 255), so if this detects that is not the case, warn
// TODO: eventually remove the alpha check warning because it is overhead
export function color_luminance(color) {
  if (color_alpha(color) !== 255) {
    console.warn(
        'Calculating luminance on non-opaque color (undefined behavior)',
        color_alpha(color), color_format(color));
  }

  const rr = color_red(color) / 255;
  const rg = color_green(color) / 255;
  const rb = color_blue(color) / 255;
  const r = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
  const g = rg <= 0.03928 ? rg / 12.92 : Math.pow((rg + 0.055) / 1.055, 2.4);
  const b = rb <= 0.03928 ? rb / 12.92 : Math.pow((rb + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}


// Returns the contrast ratio between the fore color and the back color
export function color_contrast(fore_color, back_color = COLOR_WHITE) {
  const l1 = color_luminance(fore_color) + 0.05;
  const l2 = color_luminance(back_color) + 0.05;
  return (l1 > l2) ? l1 / l2 : l2 / l1;
}
