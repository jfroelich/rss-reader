import {unwrap_element} from '/src/dom-utils/unwrap-element.js';

// For a url string to have the script protocol it must be longer than this
// 'javascript:'.length
// Javascript does not have const-expr so it is worth pre-computing despite the
// risk of inconsistency.
const js_protocol_len = 11;

// This pattern is compared against an href attribute value. If it matches then
// the function concludes the anchor is a script anchor. Leading whitespace is
// allowed. However, whitespace preceding the colon is not allowed. I believe
// this matches browser behavior.
// TODO: write a test that explicitly checks matching of browser behavior
const pattern = /^\s*javascript:/i;

// Unwraps anchor elements containing href attribute values that are javascript
// If document is undefined or otherwise not a document this throws an error.
// Returns undefined. This unwraps rather than removes to avoid data loss.
// Unwrapping the element achieves the desired result of disabling the
// javascript. Generally any anchor that is a script anchor serves no other
// purpose than providing a click handler.
//
// Also note that this does not deal with onclick attributes or anything of that
// sort. This is restricted to analyzing the href attribute. Onclick and friends
// are a concern for another filter.
//
// This is not concerned with ripple effects of removing content, such as
// the result of adjacent text nodes, the visible decrease in whitespace
// delimiting displayed content, etc. Some of this concern is addressed by
// how unwrap is implemented, but there can be other side effects.
export function anchor_script_filter(document) {
  // This makes no assumption the document is well-formed, as in, has an html
  // body tag. Analysis is restricted to body. If no body then nothing to do. I
  // assume that an anchor outside of the body is not displayed. This actually
  // might be inaccurate if the browser does things like shift in-body-only
  // elements that are located outside of body into body.
  if (!document.body) {
    return;
  }

  // TODO: is there a way to write a css selector that imposes a minimum length
  // requirement on an attribute value? This would helpfully reduce the number
  // of anchors matched and move more processing to native. Using a minimum
  // length check would not run into the same problems that a starts-with style
  // check encounters (which is why this does not use starts-with).

  // Using a selector that includes the attribute qualifier matches fewer
  // anchors then the general anchor selector. An anchor without an href is of
  // no concern here. Doing the has-href check here is substantially faster
  // than calling getAttribute. getAttribute is remarkably slow.
  const anchor_selector = 'a[href]';
  const anchors = document.body.querySelectorAll(anchor_selector);

  // TODO: if the selector guarantees the attribute is present, then is the href
  // attribute value guaranteed defined? Such as for <a href>foo</a>? If so,
  // then there is no need for the href boolean condition here. It will be
  // implicit in the length test.

  // The href test avoids the case of a no-value attribute and empty string
  // The length check is superfluous but it reduces the calls to regex.test,
  // which is quite slow.
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (href && href.length > js_protocol_len && pattern.test(href)) {
      unwrap_element(anchor);
    }
  }
}
