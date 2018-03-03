import * as color from '/src/color/color.js';
import * as css_color from '/src/css-color/css-color.js';

export const DEFAULT_MIN_CONTRAST_RATIO = 1.2;
export const DEFAULT_MATTE = color.WHITE;

// Filters inperceptible text nodes from a document
// @param document {Document}
// @param matte {Number} optional, the base color to use for composition
// @param min_contrast_ratio {Number} optional, the minimum contrast above which
// content is perceptible
export function color_contrast_filter(
    document, matte = DEFAULT_MATTE,
    min_contrast_ratio = DEFAULT_MIN_CONTRAST_RATIO) {
  if (document.body) {
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    while (node) {
      if (!element_is_perceptible(
              node.parentNode, DEFAULT_MATTE, min_contrast_ratio)) {
        node.remove();
      }
      node = it.nextNode();
    }
  }
}

// Analyzes an element for color perceptibility based on the element's
// foreground and background colors. Return true if perceptible, false if not
// perceptible. Ratio is on scale of 1 to 21, with 21 being maximum contrast.
export function element_is_perceptible(
    element, matte = color.WHITE,
    min_contrast_ratio = DEFAULT_MIN_CONTRAST_RATIO) {
  const fore = element_derive_text_color(element);
  const back = element_derive_background_color(element, matte);
  return color.get_contrast(fore, back) > min_contrast_ratio;
}

// Get the foreground color of an element, defaulting to black
export function element_derive_text_color(element) {
  const style = getComputedStyle(element);
  if (style) {
    const color_value = css_color.parse(style.color);
    if (typeof color_value !== 'undefined') {
      return color_value;
    }
  }
  return color.BLACK;
}

// Approximate the effective background color of an element
// @param matte {Number} the base color, typically opaque white
export function element_derive_background_color(element, matte) {
  const layers = element_ancestors(element, /* include_self */ true);
  const colors = layers.map(element_derive_background_color_inline);
  return color.blend(colors.reverse(), matte);
}

// Get the background color of an element, defaulting to transparent
export function element_derive_background_color_inline(element) {
  const style = element.style;
  if (style) {
    const css_bgcolor = style.backgroundColor;
    if (css_bgcolor) {
      const color_value = css_color.parse(css_bgcolor);
      if (color_value) {
        return color_value;
      }
    }
  }
  return color.TRANSPARENT;
}

// Returns an array of references to the element's ancestor elements, ordered
// from deepest to shallowest. If include_self is true then the element itself
// is included at the start of the array. If the element has no parent then
// an empty array is returned.
export function element_ancestors(element, include_self) {
  const layers = [];
  let node = include_self ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}
