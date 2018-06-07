// The color module provides basic color utilities and a simple color data type.
// This is a rudimentary and informal explanation, just trying to write stuff
// down even if it is a little off.

// This uses the ARGB8888 color format. The A is short for alpha, r for red, g
// for green, b for blue. Each 8 means 8 bits, there are 4 sequences of 8 bits.
// This distinguishes the format from other formats that do things like use a
// fewer number of bits.

// ARGB is pretty much equivalent to RGBA. The significance is that in one
// format the A is stored in the upper bits, and in the other format the A is
// stored in the lower bits.

// For 8 bits you can have 256 values. As values start from 0, this means 0
// through 255. At any point in time, a valid color will store a value in the
// interval [0..255] in each component.

// For RGB, each component can have 256 different values

// For A, or alpha, which is meant as a ratio of how transparent the color is,
// we still use 0-255 values and not 0 or 1, we just say that the value is
// numerator in x/255. So if a contains 255, then that means that alpha is
// really the value of 1, because it is 255/255. 1 means 100%. 100% means the
// color is opaque and has no transparency. A color is transparent when its
// alpha is 0. A color is partially- transparent when its alpha value is
// somewhere between 0 and 255, excluding the end points, but sometimes this is
// still referred to as transparent.

// Javascript uses 64 bit numbers, but when working with bitwise operators,
// those operators convert operands to 32bit signed values. See
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators

// What this all basically means is that a color is represented by a 32 bit
// integer. A color is basically a vector of four items. A vector's items are
// called components. This is why, when referring to red or blue parts of a
// color, they are sometimes called components.

// The use of 32 bits restricts the detail of the color. Components are rounded
// to whole numbers (integers). There are more detailed color spaces, but that
// is currently outside the scope. There is also the psychological factor, that
// people can only perceive so much color detail. There is a limit to the
// benefit of being more specific. But really, it is just the rounding. By
// working with integers this affords the module several things, chiefly that it
// can pack all four components into a 4 byte integer, and does not so quickly
// need to use an object.

// I went with integer because I think it is more efficient. Note that this is a
// premature opt. Primitives are copied by value as arguments so there is
// entirely the possibility this hurts performance. But I am fascinated by the
// idea of avoiding the numerous object/array allocations that would otherwise
// occur, and I don't find the downsides of having to use function accessors to
// be a big deal, so I am sticking with this opinionated choice for now. This
// way has been done before, and is still pretty simple. I also like continually
// testing my knowledge of bit operations, with which I continue to struggle.

// Note that MDN suggests avoiding bit packing as it is not as intuitive as just
// using an array of booleans or something like that. I do not fully agree.

// I could do bit manip but boxed, where I have a `Color` object with an integer
// value property, but I still think I am going to stick with prims.

// The truth is really that this is an exercise of me doing bit operations, and
// to learn about how computers typically work with colors.

// # About math_lerp

// Linear interpolation. Basically, given two points get a point between them
// based on the amount. We get the distance between the two points, we get a
// percentage of that distance based on amount, then add it to the starting
// point. This is only exported for testing, as it should otherwise be a private
// helper.

// # About lerp


// Blend two rgba colors to produce a blended color. This does not validate
// input.
// @param c1 {Number} start from this color
// @param c2 {Number} end at this color
// @param amount {Number} some number between 0 and 1, defaults to 1 (assumes
// the intent is to go the full distance), represents how far to traverse along
// the distance between the two colors, this is usually the opacity of the
// second color, or in other words, the alpha component of the second color
// @return {Number} the resulting color

// Early exits. When the upper color is opaque, there is no point in blending,
// it occludes the background, so return the upper color. When the upper color
// is transparent, there is similarly no point in blending, so return the
// lower color.

// | 0 is generally equivalent to Math.round

// # About blend

// Given an array of colors, return the composed color. The array should be
// ordered from bottom color layer to top color layer. The base color
// represents the default background color behind the colors in the array. If
// the array is empty the base color is output. The default base is opaque white

// # About the contrast calculation

// http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef

// The spec states that "the ratio is (L1 + 0.05) / (L2 + 0.05), where L1 is the
// relative luminance of the lighter of the colors, and L2 is the relative
// luminance of the darker of the colors." Luminance is on a scale of [0..1],
// where 0 is darkest black and 1 is lightest white. Therefore, a higher
// luminance value means a 'lighter' value.

// Note that we can add 0.05 before the inequality test because it does not
// matter if the addition is done before or after the test, the result of the
// inequality does not change (the operations are commutative). Also note that
// if the two luminances are equal the result is 1 regardless of which luminance
// value is the numerator or denominator in the contrast ratio, so there is no
// need to differentiate the values-equal case from the l1 < l2 case.

// I am not entirely sure why the spec says to add 0.05. My guess is that it is
// an efficient way to avoid the divide-by-zero error if either luminance is 0
// when it is the denominator.

export const WHITE = pack(255, 255, 255, 255);
export const BLACK = pack(0, 0, 0, 255);
export const TRANSPARENT = 0;

export function math_lerp(start, stop, amount) {
  return amount * (stop - start) + start;
}

export function lerp(c1, c2, amount = 1.0) {
  if (amount === 1) {
    return c2;
  } else if (amount === 0) {
    return c1;
  }

  const r = math_lerp(get_red(c1), get_red(c2), amount) | 0;
  const g = math_lerp(get_green(c1), get_green(c2), amount) | 0;
  const b = math_lerp(get_blue(c1), get_blue(c2), amount) | 0;
  const a = math_lerp(get_alpha(c1), get_alpha(c2), amount) | 0;
  return pack(r, g, b, a);
}

export function blend(colors, base_color = WHITE) {
  let output = base_color;
  for (const color of colors) {
    const amount = get_alpha(color) / 255;
    output = lerp(output, color, amount);
  }
  return output;
}

export function pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

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


// Based on the spec, which provides the formula.
// http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
// Calculating luminance is needed to calculate contrast.
export function get_luminance(color) {
  const rr = get_red(color) / 255;
  const rg = get_green(color) / 255;
  const rb = get_blue(color) / 255;

  // Experimenting with infix notation
  // Using ** operator instead of Math.pow call
  // ** is supported in at least Chrome 66, maybe earlier, not sure
  // At the moment I have mixed feelings. I dunno maybe I will warm up to it
  // const r = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
  // const g = rg <= 0.03928 ? rg / 12.92 : Math.pow((rg + 0.055) / 1.055, 2.4);
  // const b = rb <= 0.03928 ? rb / 12.92 : Math.pow((rb + 0.055) / 1.055, 2.4);
  // TODO: are the extra parentheses necessary? What is the operator precedence?
  const r = rr <= 0.03928 ? rr / 12.92 : ((rr + 0.055) / 1.055) ** 2.4;
  const g = rg <= 0.03928 ? rg / 12.92 : ((rg + 0.055) / 1.055) ** 2.4;
  const b = rb <= 0.03928 ? rb / 12.92 : ((rb + 0.055) / 1.055) ** 2.4;

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
