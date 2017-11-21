// File utilities module

// TODO: this file only includes one function. Rename the file to read-file-as-text.js or something
// similar, and export the function as default

import assert from "/src/utils/assert.js";

// @param file {File}
// @returns {Promise}
export function readAsText(file) {
  assert(file instanceof File);
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}
