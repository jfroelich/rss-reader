'use strict';

// import base/errors.js
// import xml.js

class OPMLParser {

  // @param xml {String}
  // @returns {Array} returns an array of status code and document
  static parse(xml) {
    let [status, doc] = xmlParseFromString(xml);
    if(status !== RDR_OK) {
      console.debug('xml parse error');
      return [status];
    }

    const name = doc.documentElement.localName.toLowerCase();
    if(name !== 'opml') {
      console.debug('documentElement not opml:', name);
      return [RDR_ERR_DOM];
    }

    return [RDR_OK, doc];
  }
}
