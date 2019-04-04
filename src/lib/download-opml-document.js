// TODO: I would eventually like to rename this module to something else. I am
// not sure at the moment to what. Something more generic than opml, because
// this really is not strongly tied to opml. For now, I am just moving this
// general feature to a more proper location than its previous location.

// Given an opml document, converts it into a file and then triggers the
// download of that file in the browser.
export default function download_opml_document(
    opml_document, file_name = 'untitled.xml') {
  // Generate a file. Files implement the Blob interface so we really just
  // generate a blob.
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  const blob = new Blob([xml_string], {type: 'application/xml'});

  // Download the blob file by simulating an anchor click
  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name);
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}
