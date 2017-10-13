// File utilities
'use strict';

// Dependencies
// assert.js

// Returns a promise that resolves to the text of the file
function file_read_as_text(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

// Returns true if the file has an xml mime type
// TODO: rename to file_is_type_xml
function file_is_xml_type(file) {
  ASSERT(file);

  const file_type = file.type;

  // TODO: actually the rest of this should defer to a function in
  // mime.js. Also, that function should tolerate other mime types,
  // like feed mime types

  let normal_type = file_type || '';
  normal_type = normal_type.trim().toLowerCase();
  const supported_types = ['application/xml', 'text/xml'];
  return supported_types.includes(normal_type);
}
