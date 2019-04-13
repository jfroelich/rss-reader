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
    const fore = deriveElementTextColor(element);
    const back = deriveElementBackgroundColor(element, matte);
    const contrast = color.getContrast(fore, back);
    if (contrast < minContrast) {
      node.remove();
    }
    node = it.nextNode();
  }
}

// Return an array of the element's ancestors, ordered from the element up to the root node. If
// includeSelf is true then the element itself is included in the output array.
function getElementAncestors(element, includeSelf) {
  const ancestors = [];
  let node = includeSelf ? element : element.parentNode;
  while (node) {
    ancestors.push(node);
    node = node.parentNode;
  }
  return ancestors;
}

// Get an element's effective background color according to the Painter's algorithm. The matte is
// the base color used for alpha blending.
function deriveElementBackgroundColor(element, matte) {
  const includeSelf = true;
  const ancestors = getElementAncestors(element, includeSelf);
  const colors = ancestors.map(deriveElementBackgroundColorInline);
  return color.blend(colors.reverse(), matte);
}

// Get an element's non-computed background color, based solely on the element's own style
// information, where no color information from overlapping elements is considered. If no style
// information is present then the element is assumed to have a transparent background color.
function deriveElementBackgroundColorInline(element) {
  let inlineBackgroundColor = color.TRANSPARENT;
  const { style } = element;
  if (style && style.backgroundColor) {
    const parsedColor = parseCSSColorValue(style.backgroundColor);
    if (typeof parsedColor !== 'undefined') {
      inlineBackgroundColor = parsedColor;
    }
  }

  return inlineBackgroundColor;
}

function deriveElementTextColor(element) {
  const { style } = element;
  if (style && style.color) {
    const colorValue = parseCSSColorValue(style.color);
    if (typeof colorValue !== 'undefined') {
      return colorValue;
    }
  }
  return color.BLACK;
}

function parseCSSColorValue(value) {
  if (typeof value === 'string' && value) {
    // eslint-disable-next-line new-cap, no-undef
    const tinycolorObject = new tinycolor(value);
    if (tinycolorObject.isValid()) {
      const o = tinycolorObject.toRgb();
      return color.pack(o.r, o.g, o.b, (o.a * 255) | 0);
    }
  }

  return undefined;
}
