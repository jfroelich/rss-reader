import '/third-party/tinycolor-min.js';

export const COLOR_WHITE = color_pack(255, 255, 255);
export const COLOR_BLACK = color_pack(0, 0, 0);
export const COLOR_TRANSPARENT = 0;
export const default_min_contrast_ratio = 1.2;
export const default_matte = COLOR_WHITE;

// Filters inperceptible text nodes from a document
// @param document {Document}
// @param min_contrast_ratio {Number} optional, the minimum contrast above which
// content is perceptible
export function color_contrast_filter(document, min_contrast_ratio) {
  if (document.body) {
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    while (node) {
      if (!element_is_perceptible(
              node.parentNode, default_matte, min_contrast_ratio)) {
        node.remove();
      }
      node = it.nextNode();
    }
  }
}

// Analyzes an element for color perceptibility. If the element has an explicit
// text color and background color and the contrast ratio between those two
// colors is too low, then the node is deemed not perceptible. Return true if
// perceptible, false if not perceptible. Ratio is on scale of 1 to 21, with 21
// being maximum contrast (e.g. pure black opaque on pure white opaque)
export function element_is_perceptible(
    element, matte = COLOR_WHITE,
    min_contrast_ratio = default_min_contrast_ratio) {
  const fore = element_derive_text_color(element);
  const back = element_derive_background_color(element, matte);
  return color_contrast(fore, back) > min_contrast_ratio;
}

// Get the foreground color (aka the text color) of an element
// TODO: use getComputedStyle based on the document containing the element,
// not this script's document? I think I saw the note on mdn, getComputedStyle
// is basically a shortcut for document. My fear is that by using the shortcut,
// it is using the script document, adopting the element, then doing the
// calculation. I'd rather not force cross-document adoption.
export function element_derive_text_color(element) {
  const style = getComputedStyle(element);
  if (style) {
    const color = css_color_parse(style.color);
    if (typeof color !== 'undefined') {
      return color;
    }
  }
  return COLOR_BLACK;
}

// Get the background color of an element. This is not the effective color, just
// the color based on the element's own style information. If there is any
// problem getting the color this returns the default transparent color.
export function element_derive_background_color_inline(element) {
  // TODO: it is possible I should still use getComputedStyle due to the
  // use of css values such as inherit? Or maybe it doesn't matter since I plan
  // to blend. Or maybe it does because I should not assume that is the only way
  // this function is used

  const style = element.style;
  if (style) {
    const css_bgcolor = style.backgroundColor;
    if (css_bgcolor) {
      const color = css_color_parse(css_bgcolor);
      if (color) {
        return color;
      }
    }
  }
  return COLOR_TRANSPARENT;
}

// Returns an array of references to the element's ancestor elements, ordered
// from deepest to shallowest. If include_self is true then the element itself
// is included at the start of the array. If the element has no parent then
// an empty array is returned. Does not stop at document.body.
export function element_ancestors(element, include_self) {
  const layers = [];
  let node = include_self ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}

// Get the effective background color of an element. This works by doing a
// simple alpha blend of the ancestor elements. This function is extremely
// naive. The output is an approximation.
// @param matte {Number} the base color, typically opaque white
export function element_derive_background_color(element, matte) {
  const layers = element_ancestors(element, /* include_self */ true);
  const colors = layers.map(element_derive_background_color_inline);
  return color_blend(colors.reverse(), matte);
}

// Returns the contrast ratio between the fore color and the back color
export function color_contrast(fore_color, back_color = COLOR_WHITE) {
  const l1 = color_luminance(fore_color) + 0.05;
  const l2 = color_luminance(back_color) + 0.05;
  return (l1 > l2) ? l1 / l2 : l2 / l1;
}

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

// Linear interpolation. Basically, given two points get a point between them
// based on the amount. We get the distance between the two points, we get a
// percentage of that distance based on amount, then add it to the starting
// point.
export function lerp(start, stop, amount) {
  return amount * (stop - start) + start;
}

// Get color as a css string value
export function color_format(color) {
  return 'rgba(' + color_red(color) + ', ' + color_green(color) + ', ' +
      color_blue(color) + ', ' + color_alpha(color) / 255 + ')';
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
// [0..255], so if you have a ratio, multiple it by 255 and round to nearest
// int. Using values out of range is undefined behavior.
// @param a {Number} optional, the alpha channel, defaults to max opacity
export function color_pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

// Unpacks the alpha from the color, 0 is transparent, 255 is opaque. Divide
// the value by 255 to get alpha ratio on scale of 0 to 1.
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

// Get the relative luminance of a color, normalized to 0 for darkest black and
// 1 for lightest white. Based on the spec, which provides the formula.
// http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
// Calculating luminance is needed to calculate contrast.
export function color_luminance(color) {
  // This accepts a color, which is rgba, but the calculation is done on rgb,
  // which does not have an alpha component, which means that alpha must be
  // 'applied' to any rgba color before calling this function (the rgba color
  // value must be converted to rgb). Applying alpha means that rgba will have a
  // 100% alpha (a value of 255), so if this detects that is not the case, warn
  // TODO: eventually remove this warning once I sanity check things
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
