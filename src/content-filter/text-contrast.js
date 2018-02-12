import '/third-party/tinycolor-min.js';

// TODO: consider color blindness
// TODO: consider hidden-green-preference or whatever the vision stuff said
// TODO: consider font-size-based threshold variation
// TODO: This ignores blending of partially-transparent backgrounds. The correct
// way would be to find all the colors in the ancestry and blend them. That
// would be even slower, and more complex, so not bothering with it for now

// Elements with contrast ratios below this threshold are inperceptible. I use a
// value that is lower than the recommendation but distinguishes red/green
// better. It screws up dark gray on black. 4.5 is recommended.
const default_min_contrast_ratio = 1.2;

const default_text_tinycolor = tinycolor('#000');
const default_background_tinycolor = tinycolor('#fff');

// Analyzes a node for color perceptibility. If the node, based on its
// containing element, has an explicit text color and background color, and the
// contrast ratio between those two colors is too low, then the node is deemed
// not perceptible. Return true if perceptible, false if not perceptible,
// undefined on error or ambiguity. Throws if not called on a text node.
export function text_node_is_color_perceptible(node, min_contrast_ratio) {
  if (!(node instanceof Node)) {
    throw new TypeError('node is not a Node');
  }

  if (node.nodeType !== Node.TEXT_NODE) {
    throw new TypeError('node is not a text node');
  }

  if (isNaN(min_contrast_ratio)) {
    min_contrast_ratio = default_min_contrast_ratio;
  }

  const element = node.parentNode;
  if (element) {
    const text_color = element_derive_text_color(element);
    const background_color = element_derive_background_color(element);
    const contrast_ratio = tinycolor.readability(text_color, background_color);
    return contrast_ratio > min_contrast_ratio;
  }
}

export function element_derive_text_color(element) {
  // Unlike background color, it is important to use computed style
  const style = getComputedStyle(element);
  if (style) {
    const color = tinycolor(style.color);
    if (color.isValid()) {
      return color;
    }
  }

  return default_text_tinycolor;
}

// Returns the effective background color of an element as a tinycolor object
// Not much point to getComputedStyle if bg color is not actually 'inherited' in
// the sense I originally thought. element.style is faster because it only
// examines explicitly set inline style. Note that not all elements have a style
// (e.g. math).  Note that browser returns default value of either
// 'transparent', or rgba with alpha channel 0 (indicating transparent).
export function element_derive_background_color(element) {
  // Walk upwards, starting from and including the input element, and find the
  // first element that has a non-transparent background.
  let node = element;
  while (node) {
    const style = node.style;
    if (style) {
      const color = style.backgroundColor;
      if (color) {
        const tc = tinycolor(color);
        if (tc.isValid() && tc.getAlpha() !== 0) {
          return tc;
        }
      }
    }

    node = node.parentNode;
  }

  // If we reached the document root without finding a non-transparent
  // background color then fall back to returning the default background color
  return default_background_tinycolor;
}
