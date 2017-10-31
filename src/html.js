'use strict';

// import base/errors.js
// import net/mime.js

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
// TODO: maybe allow some tags to stay but others not, like a whitelist
// TODO: write tests
// TODO: make lossless. right now entities are sometimes lost.
// TODO: once tokenize_html is settled, migrate to tokenizer approach instead
// of using html_parse_from_string, due to the lossy transform issue
function html_replace_tags(input_string, replacement_string) {
  // The caller is responsible for calling this function with a defined string
  console.assert(typeof input_string === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!input_string) {
    return input_string;
  }

  const [status, doc] = html_parse_from_string(input_string);
  if(status !== RDR_OK) {
    console.log('failed to parse html when replacing tags');
    // Brick wall the input due to XSS vulnerability
    return 'Unsafe HTML redacted';
  }

  // If there is no replacement_string, then use the built in serialization
  // functionality of the textContent property getter. This is faster than
  // a non-native solution, although it is opaque and therefore may have
  // different behavior.
  if(!replacement_string) {
    return doc.body.textContent;
  }

  // Shove the text nodes into an array and then join by replacement
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  const node_values = [];
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node_values.push(node.nodeValue);
  }

  return node_values.join(replacement_string);
}

/*
TODO: move notes to github issues
* I do not like how I have to do a regex test at the end of the function, this
is yet another pass over the input. I would prefer a single pass algorithm.
* I do not like how using the native parser at all is basically an XSS issue.
It feels like there is a better approach that avoids XSS issues.
* Using let/const caused deopt warnings about "unsupported phi use of const" in
Chrome 55. This may no longer be an issue and I would prefer to use a consistent
declaration style.
* Double check the behavior of setting nodeValue or reading nodeValue. Clearly
understand how it encodes or decodes implicitly.
* There is an issue with truncation when the input string contains entities
because of the implicit decoding that occurs. The truncation position is
inaccurate. This currently truncates the decoded position, which is different
than the nearest legal position in the encoded raw input.
* If tokenize_html is implemented, this should probably switch to that and
avoid using native parsing. This avoids the lossy issue, and possibly avoids
the inaccurate position issue.
* Write tests
*/

// Accepts an html input string and returns a truncated version of the input,
// while maintaining a higher level of well-formedness over a naive truncation.
// This is currently a lossy transformation because certain entities that are
// decoded while processing are not properly re-encoded.
function html_truncate(html_string, position, extension_string) {
  console.assert(Number.isInteger(position));
  console.assert(position >= 0);

  if(!html_string) {
    return '';
  }

  const ellipsis = '\u2026';
  const extension = typeof extension_string === 'string' ?
    extension_string : ellipsis;

  let is_past_position = false;
  let total_length = 0;

  // TODO: use html_parse_from_string

  // Parse the html into a Document object
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html_string;

  // Create an iterator for iterating over text nodes
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(is_past_position) {
      node.remove();
      continue;
    }

    const value = node.nodeValue;
    const value_length = value.length;
    if(total_length + value_length >= position) {
      is_past_position = true;
      const remaining_length = position - total_length;
      node.nodeValue = value.substr(0, remaining_length) + extension;
    } else {
      total_length += value_length;
    }
  }

  return /<html/i.test(html_string) ?
    doc.documentElement.outerHTML : doc.body.innerHTML;
}



// When html_string is a fragment, it will be inserted into a new document
// using a default template provided by the browser, that includes a document
// element and usually a body. If not a fragment, then it is merged into a
// document with a default template.
//
// This does not throw when there is a syntax error, only when there is a
// violation of an invariant condition. So unless there is a need to absolutely
// guarantee trapping of exceptions, there is no need to enclose a call to this
// function in a try/catch.
// In the event of a parsing error, this returns undefined.
function html_parse_from_string(html_string) {

  // The caller is responsible for always calling this with a defined string
  console.assert(typeof html_string === 'string');

  const parser = new DOMParser();

  // BUG: the following message appeared in the console:
  //[Violation] Added non-passive event listener to a scroll-blocking
  // 'touchstart' event. Consider marking event handler as 'passive' to make
  // the page more responsive. See
  // https://www.chromestatus.com/feature/5745543795965952
  // This should never appear because the DOM is not live.


  // doc is guaranteed defined regardless of the validity of html_string
  const doc = parser.parseFromString(html_string, MIME_TYPE_HTML);

  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    const unsafe_message = error_element.textContent;
    console.log(unsafe_message);
    return [RDR_ERR_PARSE];
  }

  // TODO: is this check appropriate? can an html document exist and be valid
  // if this is ever not the case, under the terms of this app?
  const lc_root_name = doc.documentElement.localName;
  if(lc_root_name !== 'html') {
    const unsafe_message = 'html parsing error: ' + lc_root_name +
      ' is not html';
    console.log(unsafe_message);
    return [RDR_ERR_PARSE];
  }

  return [RDR_OK, doc];
}
