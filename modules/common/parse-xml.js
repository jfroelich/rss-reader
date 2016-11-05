// See license.md

'use strict';

// TODO: look into ways of speeding this up, unfortunately it is the slowest
// part of polling

function parse_xml(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'application/xml');
  const error = doc.querySelector('parsererror');
  if(error)
    throw new Error(error.textContent);
  return doc;
}
