import assert from "/src/utils/assert.js";

// @param file {File}
// @returns {Promise}
export default function readFileAsText(file) {
  assert(file instanceof File);
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}
