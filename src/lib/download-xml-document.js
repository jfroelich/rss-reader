// Given an opml document, converts it into a file and then triggers the download of that file in
// the browser.
export default function downloadXMLDocument(xmlDocument, fileName) {
  const serializer = new XMLSerializer();
  const xmlString = serializer.serializeToString(xmlDocument);
  const blob = new Blob([xmlString], { type: 'application/xml' });

  const anchor = document.createElement('a');
  anchor.setAttribute('download', fileName || '');
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}
