import assert from "/src/assert.js";

// @param file {File}
// @returns {Promise}
export default function readFileAsText(file) {
  return new Promise(function executor(resolve, reject) {
    assert(file instanceof File);
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}
