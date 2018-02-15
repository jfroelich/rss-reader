import '/third-party/tinycolor-min.js';

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

  if (isNaN(min_contrast_ratio) || !isFinite(min_contrast_ratio) ||
      min_contrast_ratio < 0) {
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

// Returns an approximate background color of an element as a tinycolor object.
// This is an approximation because full compositing is cost-prohibitive.
// Pretty surprising how difficult or impossible this actually is
export function element_derive_background_color(element) {
  // Walk upwards, starting from the input element, and find the first element
  // that has a valid, non-transparent background.
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

  return default_background_tinycolor;
}
