// XML utilities module

// TODO: the class is stupid, this should just be two functions, but wait till after working
// transition to modules
// TODO: I don't think toString even needs to be exported?
import assert from "/src/assert.js";
import {mime} from "/src/mime.js";

export class XMLUtils {
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
