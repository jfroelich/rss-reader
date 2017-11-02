'use strict';

// Returns a promise that resolves to the text of the file
function fileReadAsText(file) {
  console.assert(file instanceof File);
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}
