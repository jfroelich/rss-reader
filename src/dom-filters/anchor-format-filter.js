import {unwrap_element} from '/src/dom-utils/unwrap-element.js';

// Removes anchor elements that play a formatting role instead of a functional
// inter-linking role. Essentially, any anchor that is missing an href attribute
// is non-functional and is presumed to be used for some other purpose.
//
// When rendering a document in an embedded context where several pieces of
// information have been removed, the roles of various elements change, such
// that there is no longer a need to retain some elements, because after
// applying a series of other filters, those elements devolve in meaning into
// basic containers. Kind of like a useless span. In that sense, this filter is
// essentially just a special case of the set of filters that are concerned
// with removing useless elements. I special-cased this pass over the content
// because of the peculiarity regarding anchor href values.
//
// Watch out for filter order when using this filter in combination with other
// filters that affect href values. For example, the filter that removes anchors
// that contain the javascript: protocol in the href attribute value. If that
// other filter is designed to only empty out the href value or remove the
// attribute but retain the element, then filter order matters, and this filter
// should occur after that filter.
//
// @param document {Document} the document to mutate
export function anchor_format_filter(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (!anchor.hasAttribute('href')) {
        unwrap_element(anchor);
      }
    }
  }
}
