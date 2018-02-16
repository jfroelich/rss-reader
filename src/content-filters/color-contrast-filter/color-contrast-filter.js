import {text_node_is_color_perceptible} from '/src/content-filters/color-contrast-filter/text-contrast.js';

// TODO: I want to refactor text-contrast.js to use color.js. It is possible I
// should just merge it into here. So what I think would be wise is that I
// basically create the new approach here as local helper functions, then once
// it is ready, decouple text-contrast.js (and delete it). I am still tempted
// to encapsulate some of the helpers in an independent library, but honestly,
// it feels like I could write several other libraries. Instead I should just
// keep in mind the scope of the task, and tune the approach to go after it and
// not more.


// @brief low contrast filter pass

// Removes text nodes with a text-color-to-background-color contrast ratio that
// is less than or equal to the given minimum contrast ratio. If no contrast
// ratio is given then a default contrast ratio is used.

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
// iterator advances. The iterator is smart enough to deal with mutation
// during iteration. I do not currently know of a better way to iterate text
// nodes.

// I decided to scan text nodes, as opposed to all elements, because those are
// really the only data points we are concerned with. There isn't much value
// to other elements.

// The perception check returns true if high contrast, false if low contrast,
// or undefined when uncertain or there is some error. This intentionally
// treats nodes with uncertain visibility as visible by strictly comparing
// the output to false. This is not just a matter of using more verbose syntax
// for clarity, so resist the urge to refactor to using
// !text_node_is_color_perceptible.

export function color_contrast_filter(document, min_contrast_ratio) {
  if (document.body) {
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    while (node) {
      if (text_node_is_color_perceptible(node, min_contrast_ratio) === false) {
        node.remove();
      }
      node = it.nextNode();
    }
  }
}
