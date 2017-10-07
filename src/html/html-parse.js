
// TODO: move into html.js ?

// This does not throw when there is a syntax error, only when there is a
// violation of an invariant condition. So unless there is a need to absolutely
// guarantee trapping of exceptions, there is no need to enclose a call to this
// function in a try/catch.
// In the event of a parsing error, this returns undefined.
// TODO: clarify behavior in event of html fragment instead of full doc input
// TODO: rename to html_parse_from_string
function parse_html(html_string) {
  'use strict';

  // This implicitly also checks that the parameter is defined
  // TODO: is this needed?
  ASSERT(typeof html_string === 'string');

  const parser = new DOMParser();
  // TODO: how does this react to null/undefined/notstring input?
  const doc = parser.parseFromString(html_string, 'text/html');

  // TODO: is this needed?
  ASSERT(doc);

  const error_element = doc.querySelector('parsererror');
  if(error_element) {
    DEBUG(error_element.textContent);
    return;
  }

  // TODO: is this check appropriate? can an html document exist and be valid
  // if this is ever not the case, under the terms of this app?
  const lc_root_name = doc.documentElement.localName;
  if(lc_root_name !== 'html') {
    DEBUG('html parsing error: ' + lc_root_name + ' is not html');
    return;
  }

  return doc;
}
