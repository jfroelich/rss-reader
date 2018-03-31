import {rdr_conn_close, rdr_conn_create} from '/src/objects/rdr-conn.js';
import {rdr_export_opml} from '/src/operations/rdr-export-opml.js';

// Abstracts away all of the operations involved in generating and downloading
// an opml xml file into a simple api call for the slideshow page. Also hides
// the helper functions in module scope

export async function export_opml(title, filename, console) {
  const conn = await rdr_conn_create();
  const opml_document = await rdr_export_opml(conn, title, console);
  rdr_conn_close(conn);

  download_blob(opml_document_to_blob(opml_document), filename);

  if (console) {
    console.log('Export completed');
  }
}

function opml_document_to_blob(opml_document) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  return new Blob([xml_string], {type: 'application/xml'});
}

function download_blob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const options = {url: url, filename: filename};
  chrome.downloads.download(options);
  URL.revokeObjectURL(url);
}
