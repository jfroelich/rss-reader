// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/string.js

// TODO: there are several callers of string_truncate in other files where the
// text may contain html entities. Those call sites should be
// modified to use html_truncate instead so that entities are handled properly.

// TODO: test malformed html
// TODO: research side issuue of malformed html with multi-body elements,
// either adjacent or nested. How is document.body resolved? Is it simply the
// first body in document order as defined by the spec (as in, querySelectorAll
// traversal order)?
// TODO: test some basic XSS attacks
// TODO: rather than decode and encode, maybe it would be better to implement
// a truncation function that properly handles and counts encoded length,
// without any conversion done. This would avoid some of the unwanted behavior
// such as losing &nbsp; or implicitly switching from &#32; to &nbsp; or space
// or whatever. It would also avoid the use of the dummy encoder element which
// feels too heavyweight. However, I would also have to deal with the behavior
// of how to react to invalid characters, for example, &nbsp with no semicolon.
// I would have to match the browser's behavior.
// TODO: I would rather not deal with all the <html><body> issues that arise
// from setting innerHTML. Think of an alternative.

// NOTE: regarding terminology, a text node's nodeValue is said to be in
// encoded form, meaning that it contains entities such as &nbsp;. Decoding
// means to replace such entities with their single character equivalent.
// Encoding means to replace certain single characters with their
// NOTE: if the input string contains a document and/or body element, those
// are removed from the output. Only child nodes of the body are considered
// and returned.
// NOTE: text that is hidden by html (for any number of reasons) still
// contributes toward the length of the input string.
// NOTE: if given an input string containing a document element and a body
// element, text outside of the body element is ignored; out-of-body text does
// not contribute toward the length of the input string; out-of-body text is
// not included in the return value.
// NOTE: due to how html character entity decoding and encoding is implemented,
// certain entities such as &nbsp; are not retained in the output. The problem
// is that once &nbsp; is converted to space, it will not be converted back
// to an entity. Only certain characters are guaranteed converted back, such as
// < and >. Similarly, the encoding may change from using characters to using
// numerical entity codes, or from using numerical entity codes to using
// character-based entity codes. For example, &nbsp; and &#32;.
// NOTE: this assumes inputString is a defined string
// NOTE: this assumes position is a defined integer greater than 0
// NOTE: extensionString is optional. However, if defined, it should be a
// string. It should be in encoded form (it shouldn't contain unencoded values
// like <, &, >, etc.). This does not validate or check whether it is encoded.


function html_truncate(inputString, position, extensionString) {
  'use strict';

  let truncatedDecodedValue = null;
  let decodedValue = null;
  let reencodedValue = null;

  // This is a fast path check. Before dealing with html, check if we have
  // input that does not contain any elements. If there are no elements, then
  // we only have to deal with entities and can avoid the heavier processing
  // that occurs later.
  const firstCarotPosition = inputString.indexOf('<');
  if(firstCarotPosition === -1) {
    decodedValue = html_truncate_decode_entities_unsafe(inputString);
    truncatedDecodedValue = string_truncate(decodedValue, position,
      extensionString);
    reencodedValue = html_truncate_encode_entities(truncatedDecodedValue);
    return reencodedValue;
  }

  // NOTE: I use createHTMLDocument because it generates an inert document
  // context. We cannot use a live document context such as the document
  // containing this script, because that will cause the browser to do things
  // like eagerly pre-fetch images, evaluate scripts, etc. That is why this
  // does the heavyweight call to createHTMLDocument. The only alternative
  // seems to be to build a lexer which would probably be even slower and
  // probably subject to exploits and probably not mirror the browser's own
  // parsing behavior.

  // NOTE: createHTMLDocument will supply its own <html> document element if
  // it is not present in the input string. It will also supply its own
  // body element if not present in the input string. If the input string
  // contains an html document element, that will replace the one supplied
  // by createHTMLDocument. If the input string contains a body element, that
  // will replace the one supplied by createHTMLDocument.

  const doc = document.implementation.createHTMLDocument();
  const docElement = doc.documentElement;

  // Parse the html.
  docElement.innerHTML = inputString;

  // This must occur AFTER innerHTML is set. Setting the document element's
  // innerHTML in the previous line implicitly detaches the prior body element
  // that was implicitly created by createHTMLDocument. Storing a handle to the
  // old body element means that the body element would not contain any nodes
  // at all.
  const bodyElement = doc.body;

  // Iterate over only the nodes within the body element.
  const textNodeIterator = doc.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);

  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let value = null;
  let valueLength = null;
  let node = textNodeIterator.nextNode();

  while(node) {

    if(!acceptingAdditionalTextNodes) {
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    // Get the raw value, which is encoded (has entities present)
    value = node.nodeValue;
    // Get the decoded value, where entities were replaced with chars
    decodedValue = html_truncate_decode_entities_unsafe(value);
    // Get the length of the decoded value
    valueLength = decodedValue.length;

    if(accumulatedLength + valueLength > position) {

      // At the current text node, the length has reached or passed the
      // position. Truncate this value, and also state that all later nodes
      // should be deleted.

      acceptingAdditionalTextNodes = false;

      // Truncate the decoded value. By truncating the decoded value, this
      // counts character entities as only contributing one towards the
      // length of the value instead of between 4-6, and also avoids truncation
      // in the midst of a character entity.
      truncatedDecodedValue = string_truncate(decodedValue,
        position - accumulatedLength, extensionString);

      // Re-encode the value.
      reencodedValue = html_truncate_encode_entities(truncatedDecodedValue);

      // Update node value to the re-encoded value. Note that I prefer this
      // method to something like createTextNode and parentNode.replaceChild
      // because that just makes the node iterator do more work keeping track
      // of its cursor position over text nodes, and seems more confusing as
      // to whether the cursor position would be off track as a result of a
      // node swap. However I am not sure which method performs better and I
      // would prefer the faster method.
      node.nodeValue = reencodedValue;

    } else {
      accumulatedLength = accumulatedLength + valueLength;
    }

    node = textNodeIterator.nextNode();
  }

  // Return the truncated output html
  // NOTE: this is from within the body only. If the input had a body element,
  // that element is gone. So are any other nodes not under the body.
  return bodyElement.innerHTML;
}

// This is created once sits forever in memory. In theory this means that
// the encode/decode functions will perform faster.
// TODO: look closer into maximum text node length and maximum string value
// lengths for possible issues.
const HTML_TRUNCATE_DUMMY_ELEMENT = document.createElement('p');

// Clear the contents of HTML_TRUNCATE_DUMMY_ELEMENT so its contents are not
// sitting around in memory forever, which would be bad for very large strings,
// and so that it does not expose sensitive data.
function html_truncate_clear_dummy_element() {
  'use strict';

  // TODO: is HTML_TRUNCATE_DUMMY_ELEMENT.textContent = '' faster or is
  // removing all child nodes faster?
  //const el = HTML_TRUNCATE_DUMMY_ELEMENT;
  //for(let node = el.firstChild; node; node = el.firstChild) {
  //  node.remove();
  //}

  HTML_TRUNCATE_DUMMY_ELEMENT.textContent = '';
}

// TODO: look into a simpler way of doing this that doesn't involve using a
// dummy element.
// TODO: if these become sophisticated enough, I should probably have an
// html-encoding library and these do not belong here, this should become
// a dependency.

// Simple helper to take a raw node value that contains entities such as
// '&amp;' or '&nbsp;' and replaces them with their character equivalents.
// For example, converts 'a&amp;b' to 'a&b'
// DO NOT USE decodeEntities ON ANYTHING OTHER THAN KNOWN TEXT NODE VALUE OR
// RISK XSS. This sets a live element's innerHTML to decode the entities,
// so if <script> tags or similar are present this can be exploited.
function html_truncate_decode_entities_unsafe(encodedStringWithoutHTMLTags) {
  'use strict';
  HTML_TRUNCATE_DUMMY_ELEMENT.innerHTML = encodedStringWithoutHTMLTags;
  const decoded = HTML_TRUNCATE_DUMMY_ELEMENT.textContent;
  html_truncate_clear_dummy_element();
  return decoded;
}

// Simple helper that accepts an unencoded string and encodes it, replacing
// characters with entity code equivalents when necessary.
// For example, converts 'a&b' to 'a&amp;b' or 'a<b' to 'a&lt;b'.
// NOTE: Once &nbsp; converts to space in decode, this will not convert the
// space back to &nbsp;.
// NOTE: may lose original form, e.g. &nbsp; could be swapped with &#32;, it
// isn't clear. The browser decides whether to use numerical or character based
// code forms. I think the browser generally uses character based. So basically
// if the input has &1234; and goes through decode/encode it may end up in the
// output as &abcd;.
// NOTE: could lose left-zero padding. If decode encode cycle maintains
// the numerical code, there is still issue of optional leading zeros, and
// those may be implicitly chopped. &0001; could become &1;.
function html_truncate_encode_entities(decodedHTMLString) {
  'use strict';
  HTML_TRUNCATE_DUMMY_ELEMENT.textContent = decodedHTMLString;
  const encoded = HTML_TRUNCATE_DUMMY_ELEMENT.innerHTML;
  html_truncate_clear_dummy_element();
  return encoded;
}
