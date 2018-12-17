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

export function anchor_script_filter(document) {
  // This makes no assumption the document is well-formed, as in, has an html
  // body tag. Analysis is restricted to body. If no body then nothing to do. I
  // assume that an anchor outside of the body is not displayed. This actually
  // might be inaccurate if the browser does things like shift in-body-only
  // elements that are located outside of body into body.
  if (!document.body) {
    return;
  }

  // Using a selector that includes the attribute qualifier matches fewer
  // anchors then the general anchor selector. An anchor without an href is of
  // no concern here. Doing the has-href check here is substantially faster
  // than calling getAttribute. getAttribute is remarkably slow.
  const anchor_selector = 'a[href]';
  const anchors = document.body.querySelectorAll(anchor_selector);

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
