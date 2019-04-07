import assert from '/src/lib/assert.js';
import {is_assert_error} from '/src/lib/assert.js';
import parse_html from '/src/lib/parse-html.js';

// Return a new string consisting of the input string less any html tags. Note
// that certain entities remain, and certain entities are decoded. If the html
// is not well-formed, this returns a string with an error message (and none of
// the input).
export default function remove_html(html) {
  assert(typeof html === 'string');

  let doc;
  try {
    doc = parse_html(html);
  } catch (error) {
    if (is_assert_error(error)) {
      throw error;
    }

    return 'Unsafe html';
  }

  // NOTE: parse-html will automatically create a body if one does not exist,
  // so we restrict to body.

  // NOTE: this will strip <html><body>...</body</html> if it is present, but
  // the difference in behavior between handling a fragment of html and a full
  // document does not matter because we are removing everything.

  // Minor caveat, however, is that text outside of the html and body will be
  // discarded. And, depending on the nature of parse-html (which is opaque),
  // some text is moved inside the body and some is not (and the rules are very
  // unclear here).

  // For example: some floating text here <html><body>inner text</body></html>,
  // the issue is the "some floating text here" text. It is highly unclear
  // whether the parser magically moves this to within body, or discards it.

  // parse-html relies on browser dom parsing for security, to ensure it 100%
  // mimics how the browser interprets html, and because it is fast, and because
  // it handles the thousands of awkward cases present in parsing html, which
  // is surprisingly complicated. The alternative is to use regexps or some kind
  // of custom parser (or one day maybe even a tokenizer in web assembly!), and
  // this would completely avoid all the problems present in this current
  // implementation.

  // Separate caveat: certain entities are decoded and the decoded form is
  // produced in the output, so this is lossy.

  return doc.body.textContent;
}
