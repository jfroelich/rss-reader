import * as color from '/src/lib/color.js';
import * as css_color from '/src/lib/css-color/css-color.js';

// Elements with contrast ratios below this threshold are not perceptible. I use
// a default value that is lower than the recommendation of 4.5, but
// distinguishes red/green better. It screws up dark gray on black. The
// difference in contrast ratios is basically because I am making unreliable
// approximations and because the immediate audience is a content-filter, not a
// person.
export const DEFAULT_MIN_CONTRAST_RATIO = 1.2;
export const DEFAULT_MATTE = color.WHITE;

// Filters inperceptible text nodes from a document
// The color contrast filter removes text nodes with a text-color to
// background-color contrast ratio that is less than or equal to the given
// minimum contrast ratio. If no contrast ratio is given then a default contrast
// ratio is used.

// The idea is that the code makes another pass over the content of an article,
// during pre-processing, that looks at each element and makes a determination
// as to whether an element is faint. If any element is faint, then it is a sign
// of a malicious SEO optimization, and that the content of that element is
// undesirable and should be filtered.

// While I would prefer to design a pure function that returns a new document,
// that is too heavyweight. Therefore this mutates the document input in place
// in an irreversible, lossy manner.

// This filter is very naive. The filter has no knowledge of what other filters
// have been applied, or will be applied. This filter completely ignores other
// aspects of whether content is visible, such as elements with css display =
// none. The filter naively analyzes every text node, including ones that are
// basically whitespace. The filter uses an approximation when determining
// colors because it is not possible to know color without doing a full
// composite pass, which is prohibitively expensive and error-prone, and because
// the accuracy difference is marginal.

// The filter is restricted to enumerating text nodes within body content,
// because nodes outside of body are presumed hidden. However, the color
// analysis may consider ancestor elements above the body element during
// alpha-blending. Also, browsers tolerate malformed html and may include text
// nodes outside of body within the body anyway, so this does not mirror the
// browser's behavior.

// This has no knowledge of image backgrounds and the hundreds of other ways
// that content is rendered like negative margins, non-rectangular shaped
// elements, inverted z-indices, custom blend modes, etc. Again, this is an
// extremely naive approximation. This views the dom as a simple hierarchy of
// overlapping colored boxes, with text leaves, and with most of the boxes being
// transparent, and imputes a default white background with default black text
// for missing values.

// This completely ignores dhtml. The document is analyzed in phase0, the time
// the document is loaded, before animations occur and such.

// This currently scans text nodes in document order, removing nodes as the
// iterator advances. The iterator is smart enough to deal with mutation during
// iteration. I do not currently know of a better way to iterate text nodes.

// I decided to scan text nodes, as opposed to all elements, because those are
// really the only data points we are concerned with. There isn't much value in
// filtering other elements.

// I read somewhere the reason this is so difficult and hard, and the reason
// there is no built in eye-dropper-style api call that just gives me an
// element's color, is due to security concerns over being able to see user
// passwords or something. I eventually want to look into that.

// ### Params
// * document {Document}
// * matte {Number} optional, the base color to use for composition
// * min_contrast_ratio {Number} optional, the minimum contrast above which
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
