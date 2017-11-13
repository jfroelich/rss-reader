
import parseXML from "/src/parse-xml.js";

// TODO: the class is dumb now with modules, just export a function

export class OPMLParser {

  // @param xml {String}
  // @returns {Document} document
  static parse(xml) {
    const doc = parseXML(xml);
    const name = doc.documentElement.localName.toLowerCase();
    if(name !== 'opml') {
      // TODO: use a more specific error
      throw new Error('documentElement not opml: ' + name);
    }

    return doc;
  }
}
