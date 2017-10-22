'use strict';

// Returns a promise that resolves to the text of the file
function file_read_as_text(file) {
  console.assert(file instanceof File);

  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}
