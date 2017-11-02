'use strict';

// import base/errors.js
// import xml.js

class OPMLParser {

  // @param xml {String}
  // @returns {Array} returns an array of status code and document
  static parse(xml) {
    let [status, doc] = xml_parse_from_string(xml);
    if(status !== RDR_OK) {
      console.log('xml parse error');
      return [status];
    }

    const name = doc.documentElement.localName.toLowerCase();
    if(name !== 'opml') {
      console.log('documentElement not opml:', name);
      return [RDR_ERR_DOM];
    }

    return [RDR_OK, doc];
  }
}
