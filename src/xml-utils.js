'use strict';

// import rbl.js
// import mime.js

// NOTE: ideally this would be XMLDocument with methods, but XMLDocument is a
// builtin object, and I don't want to deal with the complexity
class XMLUtils {
  static toString(doc) {
    assert(doc instanceof Document);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  static toBlob(doc) {
    assert(doc instanceof Document);
    const xml = XMLUtils.toString(doc);
    const partsArray = [xml];
    //const options = {type: mime.XML + ';charset=utf-8'};
    const options = {type: mime.XML};
    return new Blob(partsArray, options);
  }
}
