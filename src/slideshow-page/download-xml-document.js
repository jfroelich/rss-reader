// Given an opml document, converts it into a file and then triggers the
// download of that file in the browser.
export default function download_xml_document(xml_document, file_name) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(xml_document);
  const blob = new Blob([xml_string], {type: 'application/xml'});

  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name || '');
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}
