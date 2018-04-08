import {rdr_create_conn} from '/src/ops/rdr-create-conn.js';
import {rdr_export_opml} from '/src/ops/rdr-export-opml.js';

// Abstracts away all of the operations involved in generating and downloading
// an opml xml file into a simple api call for the slideshow page. Also hides
// the helper functions in module scope

export async function export_opml(title, filename, console) {
  const conn = await rdr_create_conn();
  const opml_document = await rdr_export_opml(conn, title, console);
  conn.close();

  download_blob_using_chrome_api(
      opml_document_to_blob(opml_document), filename);

  if (console) {
    console.log('Export completed');
  }
}

function opml_document_to_blob(opml_document) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  return new Blob([xml_string], {type: 'application/xml'});
}

function download_blob_using_anchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', filename);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL();
}

// An alternative to download_blob_using_anchor that avoids the issue introduced
// in Chrome 65 with cross-origin download urls (see Issue #532)
function download_blob_using_chrome_api(blob, filename) {
  const url = URL.createObjectURL(blob);
  const options = {url: url, filename: filename};
  chrome.downloads.download(options);
  URL.revokeObjectURL(url);
}
