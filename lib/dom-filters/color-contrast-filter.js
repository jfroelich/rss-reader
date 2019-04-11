import '/third-party/tinycolor-min.js';
import * as color from '/lib/color.js';

// TODO: also analyze an element's css opacity when calculating contrast

// Scans |doc| for difficult to read text (due to poor color contrast) and
// removes it. |matte| is an optional base background color used for alpha
// blending that defaults to white. |min_contrast| is an optional minimum ratio
// determine whether contrast is too low, defaults to a conservative threshold
// of 1.2. The recommended accessibility standard is about 4.5.
export function color_contrast_filter(
    doc, matte = color.WHITE, min_contrast = 1.2) {
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const element = node.parentNode;
    const fore = element_derive_text_color(element);
    const back = element_derive_bgcolor(element, matte);
    const contrast = color.get_contrast(fore, back);
    if (contrast < min_contrast) {
      node.remove();
    }
    node = it.nextNode();
  }
}

function element_ancestors(element, include_self) {
  const layers = [];
  let node = include_self ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}

function element_derive_bgcolor(element, matte) {
  const include_self = true;
  const layers = element_ancestors(element, include_self);
  const colors = layers.map(element_derive_bgcolor_inline);
  return color.blend(colors.reverse(), matte);
}

function element_derive_bgcolor_inline(element) {
  const style = element.style;
  if (style && style.backgroundColor) {
    const color_value = css_color_parse(style.backgroundColor);
    if (typeof color_value !== 'undefined') {
      return color_value;
    }
  }
  return color.TRANSPARENT;
}

function element_derive_text_color(element) {
  const style = element.style;
  if (style && style.color) {
    const color_value = css_color_parse(style.color);
    if (typeof color_value !== 'undefined') {
      return color_value;
    }
  }
  return color.BLACK;
}

function css_color_parse(value) {
  if (typeof value === 'string' && value.length) {
    const tc = new tinycolor(value);
    if (tc.isValid()) {
      const o = tc.toRgb();
      return color.pack(o.r, o.g, o.b, (o.a * 255) | 0);
    }
  }
}
