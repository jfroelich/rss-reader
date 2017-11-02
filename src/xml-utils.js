'use strict';

// import net/mime.js

// NOTE: ideally this would be XMLDocument with methods, but XMLDocument is a
// builtin object, and I don't want to deal with the complexity
class XMLUtils {

  static toString(doc) {
    console.assert(doc instanceof Document);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  static toBlob(doc) {
    console.assert(doc instanceof Document);
    const xml = XMLUtils.toString(doc);
    const partsArray = [xml];
    const options = {'type': MIME_TYPE_XML};
    return new Blob(partsArray, options);
  }
}
