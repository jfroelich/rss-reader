import '/third-party/tinycolor-min.js';
import * as color from '/lib/color.js';

// Scans the document content for text that has poor legibility because of poor color contrast
// between the text's foreground color and the text's background color. Poorly contrasted text is
// removed.
//
// This filter is inexact. It is difficult to get the precise color in the absence of
// getComputedStyle, which is unavailable because this makes no assumption about whether the
// document is live or inert, and because of browser security which intentionally makes it difficult
// to determine an element's color.
//
// This does not currently consider text shadow when calculating contrast. This also does not
// consider font size (unlike the accessibility standard).
//
// The matte is an optional base background color to use when determining an element's background
// color. It defaults to white.
//
// The minContrastRatio is an optional minimum contrast threshold below which text is considered
// poorly contrasted. The calculation of contrast itself is a ratio between the foreground color and
// the background color of text, and this minimum is compared against that ratio. This defaults to a
// very conservative 1.2 threshold, which is extremely low in comparison to the recommended
// accessibility standard of 4.5. The low value targets only the worst contrast offenders, and
// gives some leeway in case the contrast is inaccurate, because it is more important to preserve
// good content than it is to remove some bad content.
export default function filter(document, matte = color.WHITE, minContrastRatio = 1.2) {
  const nodeIterator = document.createNodeIterator(document.documentElement, NodeFilter.SHOW_TEXT);
  let textNode = nodeIterator.nextNode();
  while (textNode) {
    const element = textNode.parentNode;
    const foregroundColor = deriveElementTextColor(element);
    const backgroundColor = deriveElementBackgroundColor(element, matte);
    const contrastRatio = color.getContrast(foregroundColor, backgroundColor);
    if (contrastRatio < minContrastRatio) {
      textNode.remove();
    }
    textNode = nodeIterator.nextNode();
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
  let backgroundColor = color.TRANSPARENT;
  const { style } = element;
  if (style && style.backgroundColor) {
    const parsedColor = parseCSSColorValue(style.backgroundColor);
    if (typeof parsedColor !== 'undefined') {
      backgroundColor = parsedColor;
    }
  }

  return backgroundColor;
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
      const rgba = tinycolorObject.toRgb();
      return color.pack(rgba.r, rgba.g, rgba.b, (rgba.a * 255) | 0);
    }
  }

  return undefined;
}
