
import {check} from "/src/errors.js";
import parseXML from "/src/parse-xml.js";

// TODO: the class is dumb now with modules, just export a function

export class OPMLParser {

  // @param xml {String}
  // @returns {Document} document
  static parse(xml) {
    const doc = parseXML(xml);
    const name = doc.documentElement.localName.toLowerCase();

    // TODO: use a more specific error
    // TODO: use better wording
    // TODO: do not use unnamed parameter
    check(name === 'opml', undefined, 'document element is not "opml", it is ' + name);

    return doc;
  }
}
