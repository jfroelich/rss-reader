// See license.md

'use strict';

function parse_xml(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'application/xml');
  if(!doc)
    throw new Error('Missing document');
  if(!doc.documentElement)
    throw new Error('Missing documentElement');
  const error = doc.querySelector('parsererror');
  if(error)
    throw new Error(error.textContent);
  return doc;
}
