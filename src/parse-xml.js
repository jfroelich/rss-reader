// See license.md

'use strict';

function parseXML(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'application/xml');

  if(!doc) {
    throw new Error('parseFromString did not produce a document');
  }

  if(!doc.documentElement) {
    throw new Error('Missing documentElement');
  }

  const error = doc.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent);
  }

  return doc;
}
