// File utilities

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
