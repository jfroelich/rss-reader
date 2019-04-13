import '/third-party/tinycolor-min.js';
import * as color from '/lib/color.js';

// TODO: also analyze an element's css opacity when calculating contrast

// Scans |doc| for difficult to read text (due to poor color contrast) and
// removes it. |matte| is an optional base background color used for alpha
// blending that defaults to white. |minContrast| is an optional minimum ratio
// determine whether contrast is too low, defaults to a conservative threshold
// of 1.2. The recommended accessibility standard is about 4.5.
export default function colorContrastFilter(doc, matte = color.WHITE, minContrast = 1.2) {
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while (node) {
    const element = node.parentNode;
    const fore = elementDeriveTextColor(element);
    const back = elementDeriveBgColor(element, matte);
    const contrast = color.getContrast(fore, back);
    if (contrast < minContrast) {
      node.remove();
    }
    node = it.nextNode();
  }
}

function elementAncestors(element, includeSelf) {
  const layers = [];
  let node = includeSelf ? element : element.parentNode;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }
  return layers;
}

function elementDeriveBgColor(element, matte) {
  const includeSelf = true;
  const layers = elementAncestors(element, includeSelf);
  const colors = layers.map(elementDeriveBgColorInline);
  return color.blend(colors.reverse(), matte);
}

function elementDeriveBgColorInline(element) {
  const { style } = element;
  if (style && style.backgroundColor) {
    const colorValue = cssColorParse(style.backgroundColor);
    if (typeof colorValue !== 'undefined') {
      return colorValue;
    }
  }
  return color.TRANSPARENT;
}

function elementDeriveTextColor(element) {
  const { style } = element;
  if (style && style.color) {
    const colorValue = cssColorParse(style.color);
    if (typeof colorValue !== 'undefined') {
      return colorValue;
    }
  }
  return color.BLACK;
}

function cssColorParse(value) {
  /* global tinycolor */
  if (typeof value === 'string' && value.length) {
    // eslint-disable-next-line new-cap
    const tc = new tinycolor(value);
    if (tc.isValid()) {
      const o = tc.toRgb();
      return color.pack(o.r, o.g, o.b, (o.a * 255) | 0);
    }
  }

  return undefined;
}
