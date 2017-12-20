import assert from "/src/assert/assert.js";
import unwrap from "/src/utils/dom/unwrap-element.js";


// Unwraps anchor elements containing href attribute values that are javascript

export default function filterDocument(document) {
  assert(document instanceof Document);
  if(!document.body) {
    return;
  }

  const anchors = document.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(hasScriptProtocol(anchor.getAttribute('href'))) {
      unwrap(anchor);
    }
  }
}

// For a url string to have the script protocol it must be longer than this
const JS_PREFIX_LEN = 'javascript:'.length;

// Returns true if the url has the 'javascript:' protocol. Does not throw in the case of bad input.
// Tolerates leading whitespace
function hasScriptProtocol(urlString) {
  // The type check is done to allow for bad inputs for caller convenience. The length check is an
  // attempt to reduce the number of regex calls.
  return typeof urlString === 'string' &&
    urlString.length > JS_PREFIX_LEN &&
    /^\s*javascript:/i.test(urlString);
}
