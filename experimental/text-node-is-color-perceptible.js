import '/third-party/tinycolor-min.js';

// TODO: consider color blindness
// TODO: consider hidden-green-preference or whatever the vision stuff said
// TODO: consider font-size-based threshold variation
// TODO: clean up the defaults, do not re-parse per call
// TODO: consider element_get_text_color helper

// Eh, it is lower than the recommendation but distinguishes red/green
// better. It screws up dark gray on black. 4.5 is recommended.
const default_min_contrast_ratio = 1.2;

const default_text_color = 'black';
const default_background_color = 'white';

// Analyzes a node for color perceptibility. If the node, based on its
// containing element, has an explicit text color and background color, and the
// contrast ratio between those two colors is too low, then the node is deemed
// not perceptible. Return true if perceptible, false is not perceptible,
// undefined on error or ambiguity. Throws if not called on a text node.
export function text_node_is_color_perceptible(node, min_contrast_ratio) {
  if (!(node instanceof Node)) {
    throw new TypeError('Input must be a node: ' + node);
  }

  if (node.nodeType !== Node.TEXT_NODE) {
    throw new TypeError('Input must be a text node: ' + node);
  }

  if (isNaN(min_contrast_ratio)) {
    min_contrast_ratio = default_min_contrast_ratio;
  }

  const element = node.parentNode;
  if (!element) {
    return;
  }

  // text color is inherited unlike background color
  const style = getComputedStyle(element);
  if (!style) {
    return true;
  }

  let text_color = tinycolor(style.color || default_text_color);
  if (!text_color.isValid()) {
    text_color = tinycolor(default_text_color);
  }

  let background_color = element_derive_background_color(element) ||
      tinycolor(default_background_color);
  if (!background_color.isValid()) {
    background_color = tinycolor(default_background_color);
  }

  const contrast = tinycolor.readability(text_color, background_color);
  return contrast > min_contrast_ratio;
}

// Returns the effective background color of an element as a tinycolor object
// Some notes:
// * Not much point to getComputedStyle if bg color is not actually
// 'inherited' in the sense I originally thought. element.style is faster
// because it only examines explicitly set inline style.
// * Not all elements have a style (e.g. math)
// * Browser returns default value of either transparent, or rgba with alpha
// channel 0 (indicating transparent). If element is transparent, walk upward.
// * This ignores blending of partially-transparent backgrounds. The correct
// way would be to find all the colors in the ancestry and blend them. That
// would be even slower, and more complex, so not bothering with it for now
function element_derive_background_color(element) {
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
}
