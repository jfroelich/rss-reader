'use strict';

// import base/errors.js
// import net/mime-utils.js

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
// TODO: maybe allow some tags to stay but others not, like a whitelist
// TODO: write tests
// TODO: make lossless. right now entities are sometimes lost.
// TODO: once tokenize_html is settled, migrate to tokenizer approach instead
// of using htmlParseFromString, due to the lossy transform issue
function htmlReplaceTags(inputString, replacementString) {
  // The caller is responsible for calling this function with a defined string
  console.assert(typeof inputString === 'string');

  // Fast case for empty strings
  // Because of the above assert this basically only checks 0 length
  if(!inputString) {
    return inputString;
  }

  const [status, doc] = htmlParseFromString(inputString);
  if(status !== RDR_OK) {
    console.log('failed to parse html when replacing tags');
    // Brick wall the input due to XSS vulnerability
    return 'Unsafe HTML redacted';
  }

  // If there is no replacementString, then use the built in serialization
  // functionality of the textContent property getter. This is faster than
  // a non-native solution, although it is opaque and therefore may have
  // different behavior.
  if(!replacementString) {
    return doc.body.textContent;
  }

  // Shove the text nodes into an array and then join by replacement
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  const nodeValues = [];
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    nodeValues.push(node.nodeValue);
  }

  return nodeValues.join(replacementString);
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
function htmlTruncate(htmlString, position, extensionString) {
  console.assert(Number.isInteger(position));
  console.assert(position >= 0);

  if(!htmlString) {
    return '';
  }

  const ellipsis = '\u2026';
  const extension = typeof extensionString === 'string' ?
    extensionString : ellipsis;

  let isPastPosition = false;
  let totalLength = 0;

  // TODO: use htmlParseFromString

  // Parse the html into a Document object
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = htmlString;

  // Create an iterator for iterating over text nodes
  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(isPastPosition) {
      node.remove();
      continue;
    }

    const value = node.nodeValue;
    const valueLength = value.length;
    if(totalLength + valueLength >= position) {
      isPastPosition = true;
      const remainingLength = position - totalLength;
      node.nodeValue = value.substr(0, remainingLength) + extension;
    } else {
      totalLength += valueLength;
    }
  }

  return /<html/i.test(htmlString) ?
    doc.documentElement.outerHTML : doc.body.innerHTML;
}

// When htmlString is a fragment, it will be inserted into a new document
// using a default template provided by the browser, that includes a document
// element and usually a body. If not a fragment, then it is merged into a
// document with a default template.
//
// This does not throw when there is a syntax error, only when there is a
// violation of an invariant condition. So unless there is a need to absolutely
// guarantee trapping of exceptions, there is no need to enclose a call to this
// function in a try/catch.
// In the event of a parsing error, this returns undefined.
function htmlParseFromString(htmlString) {

  // The caller is responsible for always calling this with a defined string
  console.assert(typeof htmlString === 'string');

  const parser = new DOMParser();

  // BUG: the following message appeared in the console:
  //[Violation] Added non-passive event listener to a scroll-blocking
  // 'touchstart' event. Consider marking event handler as 'passive' to make
  // the page more responsive. See
  // https://www.chromestatus.com/feature/5745543795965952
  // This should never appear because the DOM is not live.

  // doc is guaranteed defined regardless of the validity of htmlString
  const doc = parser.parseFromString(htmlString, MIMEUtils.HTML);

  const parserErrorElement = doc.querySelector('parsererror');
  if(parserErrorElement) {
    console.log(parserErrorElement.textContent);
    return [RDR_ERR_PARSE];
  }

  // TODO: is this check appropriate? can an html document exist and be valid
  // if this is ever not the case, under the terms of this app?
  const lcRootName = doc.documentElement.localName;
  if(lcRootName !== 'html') {
    console.log(unsafeMessage = 'html parsing error: ' + lcRootName +
      ' is not html');
    return [RDR_ERR_PARSE];
  }

  return [RDR_OK, doc];
}
