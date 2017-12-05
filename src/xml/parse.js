import assert from "/src/assert/assert.js";
import {ParseError} from "/src/operations/parse-operation.js";
import condenseWhitespace from "/src/utils/condense-whitespace.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// XML parsing module. The purpose of this module is to abstract the process of parsing a string of
// xml into a document.

// Reformat an error message show that it is nicer looking when printed to console
const prettifyErrorMessage = condenseWhitespace;

// TODO: profiling shows this is one of the slowest functions in the entire app. Perhaps writing
// a custom parser would speed it up, but I doubt it because the parser is native code, and custom
// parsing brings with it a ton of complexity. Another thing to consider is a streaming parser,
// e.g. SAX-style, perhaps that would be faster?

// This is an extremely expensive operation. Calling code should try and defer or avoid calling.

// This function warrants that the document produced is defined.
// If the input xml string is not a string, then an unchecked assertion error is thrown.
// If there is a syntax error in the input xml string, then a checked parse error is thrown.
// Partial xml will be converted into a full xml document, and some default template of elements
// may be included.

export default function parse(xmlString) {
  // Although DOMParser.prototype.parseFromString tolerates non-string input without exception and
  // simply produces a document with an embedded error object, I prefer to treat passing of a
  // non-string type as a programming error. This should never happen, and if it does, the caller
  // made a serious mistake, equivalent to a syntax error in the code.
  assert(typeof xmlString === 'string');

  const parser = new DOMParser();

  // Use an explicit content type for xml to avoid any gimmicks that parseFromString does internally
  // when it tries to dynamically determine the type of the content it is parsing. DOMParser is
  // also used to parse html, and particularly sloppy html, and I want to signal a stricter mode.
  const document = parser.parseFromString(xmlString, MimeUtils.MIME_TYPE_XML);

  // DOMParser.prototype.parseFromString pretty much always creates a document regardless of the
  // validity of the input. This is an extra defensive check to explicitly warrant that the document
  // produced by this function is defined and is of type Document. While I have reservations about
  // doing such a paranoid check, currently I think it is worth it because this is calling out to
  // a builtin function, and it could also be a quirk specific to the platform on which I've tested
  // this so far, which is only Chrome.
  assert(document instanceof Document);

  // Counterintuitively, if DOMParser.prototype.parseFromString encounters some type of error when
  // parsing the string, it does not throw. Instead, it creates a document, includes the content
  // up to the point of where the parsing error occurred, and then embeds a custom element named
  // <parsererror> that contains some html-formatted error message. In some older browsers this is
  // the exact error that is displayed when visiting a page that contains malformed content.
  // Unfortunately the consequence of that design is that it creates an ambiguity between valid
  // content and invalid content.
  //
  // This module wants to avoid that ambiguity. Therefore, it looks for the embedded error and
  // throws an error instead of returning a document. This enables the caller to rely on the
  // warrant that the produced document is valid, and to distinguish between invalid and valid
  // content.
  //
  // Unfortunately, DOMParser.prototype.parseFromString's design creates an additional issue. There
  // is no simple mechanism for distinguishing between documents that have an xml syntax error,
  // and documents that do not have a syntax error but for whatever reason have a custom element
  // with the name <parsererror>. Rather than struggle with trying to correctly find the location
  // of a <parsererror> in the input string manually, which effectively requires double parsing,
  // I've chosen to treat the occurrence of parsererror as always an indication that DOMParser
  // found a syntax error during parsing. The consequence is that this module cannot correctly
  // parse any xml string containing a valid <parsererror> element.

  const errorElement = document.querySelector('parsererror');
  if(errorElement) {
    const errorMessage = prettifyErrorMessage(errorElement.textContent);
    throw new ParseError(errorMessage);
  }

  return document;
}
