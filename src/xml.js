// See license.md

'use strict';

var rdr = rdr || {};
rdr.xml = {};

// Parses the given xml string into a Document object. Throws an exception if a
// parsing error occurs
rdr.xml.parse = function(inputString) {

  if(typeof inputString !== 'string') {
    throw new Error('invalid inputString param: ' + inputString);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(inputString, 'application/xml');

  if(!doc) {
    throw new Error('parseFromString did not produce a document');
  }

  if(!doc.documentElement) {
    throw new Error('doc is missing documentElement');
  }

  const error = doc.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent);
  }

  return doc;
};
