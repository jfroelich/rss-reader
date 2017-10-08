// File utilities

// Dependencies
// assert.js

// Returns a promise that resolves to the text of the file
function file_read_as_text(file) {
  'use strict';
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

// Returns true if the file has an xml mime type
// TODO: this should be better implemented as something like
// file_type_is_supported with param file, and param that is array of strings
// of mime types. That way a single function is used instead of several for
// every mime type
function file_is_xml_type(file) {
  'use strict';
  ASSERT(file);
  const file_type = file.type;
  let normal_type = file_type || '';
  normal_type = normal_type.trim().toLowerCase();
  const supported_types = ['application/xml', 'text/xml'];
  return supported_types.includes(normal_type);
}
