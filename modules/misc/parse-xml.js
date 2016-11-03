// See license.md

'use strict';

// TODO: look into ways of speeding this up, unfortunately it is the slowest
// part of polling, it is called from fetch-feed
// Ultimately I just need to get a Document object within fetch feed, maybe
// there is some shortcut to that when using the fetch api other than getting
// all text then parsing

function parse_xml(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'application/xml');
  if(!doc || !doc.documentElement)
    throw new Error();
  const error = doc.querySelector('parsererror');
  if(error)
    throw new Error(error.textContent);
  return doc;
}
