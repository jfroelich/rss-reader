import '/third-party/tinycolor-min.js';

export const COLOR_WHITE = color_pack(255, 255, 255);
export const COLOR_BLACK = color_pack(0, 0, 0);
export const COLOR_TRANSPARENT = 0;

// Elements with contrast ratios below this threshold are inperceptible. I use a
// default value that is lower than the recommendation of 4.5, but distinguishes
// red/green better. It screws up dark gray on black. The difference in contrast
// ratios is basically because I am making unreliable approximations and because
// the immediate audience is a content-filter, not a person.
export const default_min_contrast_ratio = 1.2;


// Removes text nodes with a text-color-to-background-color contrast ratio that
// is less than or equal to the given minimum contrast ratio. If no contrast
// ratio is given then a default contrast ratio is used.
//
// The idea is that the code makes another pass over the content of an article,
// during pre-processing, that looks at each element and makes a determination
// as to whether an element is faint. If any element is faint, then it is a sign
// of a malicious SEO optimization, and that the content of that element is
// undesirable and should be filtered.
//
// While I would prefer to design a pure function that returns a new document,
// that is too heavyweight. Therefore this mutates the document input in place
// in an irreversible, lossy manner.
//
// This filter is very naive. The filter has no knowledge of what other filters
// have been applied, or will be applied. This filter completely ignores other
// aspects of whether content is visible, such as elements with css display =
// none. The filter naively analyzes every text node, including ones that are
// basically whitespace. The filter uses an approximation when determining
// colors because it is not possible to know color without doing a full
// composite pass, which is prohibitively expensive and error-prone, and because
// the accuracy difference is marginal.
//
// The filter is restricted to enumerating text nodes within body content,
// because nodes outside of body are presumed hidden. However, the color
// analysis may consider ancestor elements above the body element during
// alpha-blending. Also, browsers tolerate malformed html and may include text
// nodes outside of body within the body anyway, so this does not mirror the
// browser's behavior.
//
// This has no knowledge of image backgrounds and the hundreds of other ways
// that content is rendered like negative margins, non-rectangular shaped
// elements, inverted z-indices, custom blend modes, etc. Again, this is an
// extremely naive approximation. This views the dom as a simple hierarchy of
// overlapping colored boxes, with text leaves, and with most of the boxes being
// transparent, and imputes a default white background with default black text
// for missing values.
//
// This completely ignores dhtml. The document is analyzed in phase0, the time
// the document is loaded, before animations occur and such.
//
// This currently scans text nodes in document order, removing nodes as the
// iterator advances. The iterator is smart enough to deal with mutation
// during iteration. I do not currently know of a better way to iterate text
// nodes.
//
// I decided to scan text nodes, as opposed to all elements, because those are
// really the only data points we are concerned with. There isn't much value
// in filtering other elements.
// @param document {Document}
// @param min_contrast_ratio {Number} optional
export function color_contrast_filter(document, min_contrast_ratio) {
  if (document.body) {
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    while (node) {
      if (!element_is_perceptible(node.parentNode, min_contrast_ratio)) {
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
// TODO: WAG spec says to also pay attention to shadow. If a text has a
// contrasting shadow then it does contrast. If text does not have a shadow then
// look at background. This seems doable. See
// https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
// Note 5: When there is a border around the letter, the border can add contrast
// and would be used in calculating the contrast between the letter and its
// background. A narrow border around the letter would be used as the letter. A
// wide border around the letter that fills in the inner details of the letters
// acts as a halo and would be considered background.
export function element_is_perceptible(
    element, min_contrast_ratio = default_min_contrast_ratio) {
  return color_contrast(
             element_derive_text_color(element),
             element_derive_background_color(element)) > min_contrast_ratio;
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
// simple alpha blend of the ancestor elements, from shallowest to deepest.
export function element_derive_background_color(element) {
  const layers = element_ancestors(element, /* include_self */ true);
  const colors = layers.map(element_derive_background_color_inline);
  return color_blend(colors.reverse(), COLOR_WHITE);
}

// Returns the contrast ratio between the fore color and the back color
// http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
export function color_contrast(fore_color, back_color = COLOR_WHITE) {
  // The spec states that "the ratio is (L1 + 0.05) / (L2 + 0.05), where L1 is
  // the relative luminance of the lighter of the colors, and L2 is the relative
  // luminance of the darker of the colors." Luminance is on a scale of [0..1],
  // where 0 is darkest black and 1 is lightest white. Therefore, a higher
  // luminance value means a 'lighter' value.

  // Note that we can add 0.05 before the inequality test because it does not
  // matter if the addition is done before or after the test, the result of the
  // inequality does not change (the operations are commutative). Also note that
  // if the two luminances are equal the result is 1 regardless of which
  // luminance value is the numerator or denominator in the contrast ratio, so
  // there is no need to differentiate the values-equal case from the l1 < l2
  // case.

  // I am not entirely sure why the spec says to add 0.05. My guess is that it
  // is an effecient way to avoid the divide-by-zero error if either luminance
  // is 0 when it is the denominator.

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
export function color_to_css(color) {
  return 'rgba(' + color_red(color) + ', ' + color_green(color) + ', ' +
      color_blue(color) + ', ' + color_alpha(color) / 255 + ')';
}

// Blend two rgba colors (via linear interpolation) to produce a blended color
export function color_lerp(c1, c2) {
  const c3 = COLOR_TRANSPARENT;

  // TODO: this is what I need to review most. I don't think I got it right on
  // the first pass.

  // I am not totally certain about this, but my current understanding is that
  // I want to use the alpha of the higher layer, and somewhat ignore the
  // alpha of the lower layer except for setting the alpha of the output. This
  // could be wrong. lerp expects an amount [0..1] but alpha is [0..255]
  const alpha = color_alpha(c2) / 255;

  const r = Math.round(lerp(color_red(c1), color_red(c2), alpha));
  const g = Math.round(lerp(color_green(c1), color_green(c2), alpha));
  const b = Math.round(lerp(color_blue(c1), color_blue(c2), alpha));

  // Rather than 'pre-multiply' I guess I want to maintain the alpha component
  // in the output? Really uncertain.
  let a = lerp(color_alpha(c1) / 255, color_alpha(c2) / 255, alpha);
  // round output alpha to 2 precision
  a = Math.round(a * 100) / 100;

  // pack expects alpha in [0..255], so convert it from [0..1] by multiplying
  // by the upper bound of 255
  return color_pack(r, g, b, a * 255);
}

// Given an array of colors, return the composed color. The array should be
// ordered from bottom color layer to top color layer. The base color
// represents the default background color behind the colors in the array. If
// the array is empty the base color is output. The default base is opaque white
export function color_blend(colors, base_color = COLOR_WHITE) {
  let output = base_color;
  for (const color of colors) {
    output = color_lerp(output, color);
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

// Get the relative luminance (brightness) of a color, normalized to 0 for
// darkest black and 1 for lightest white. Based on the spec, which provides the
// formula. http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
// Calculating luminance is needed to calculate contrast.
export function color_luminance(color) {
  // TODO: does luminance ignore the alpha? Or am I supposed to pre-multiply
  // each component by the alpha? Right now this ignores the alpha and assumes
  // the color is opaque. I think I did not play close enough attention to the
  // term "sRGB" in the spec. My instinct is that this is wrong. On the other
  // hand, testing with tinycolor shows that its getLuminance output does
  // not change when changing alpha suggesting it ignores alpha.

  const rr = color_red(color) / 255;
  const rg = color_green(color) / 255;
  const rb = color_blue(color) / 255;
  const r = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
  const g = rg <= 0.03928 ? rg / 12.92 : Math.pow((rg + 0.055) / 1.055, 2.4);
  const b = rb <= 0.03928 ? rb / 12.92 : Math.pow((rb + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
