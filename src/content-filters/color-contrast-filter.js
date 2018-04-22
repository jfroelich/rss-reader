import * as color from '/src/lib/color.js';
import * as css_color from '/src/lib/css-color.js';

export const DEFAULT_MIN_CONTRAST_RATIO = 1.2;
export const DEFAULT_MATTE = color.WHITE;

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

export function element_is_perceptible(
    element, matte = color.WHITE,
    min_contrast_ratio = DEFAULT_MIN_CONTRAST_RATIO) {
  const fore = element_derive_text_color(element);
  const back = element_derive_background_color(element, matte);
  return color.get_contrast(fore, back) > min_contrast_ratio;
}

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

export function element_derive_background_color(element, matte) {
  const include_self = true;
  const layers = element_ancestors(element, include_self);
  const colors = layers.map(element_derive_background_color_inline);
  return color.blend(colors.reverse(), matte);
}

export function element_derive_background_color_inline(element) {
  // TODO: if opacity is not a channel in the color, then should this not also
  // consider the opacity css property?

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

export function element_ancestors(element, include_self) {
  const layers = [];
  let node = include_self ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}
