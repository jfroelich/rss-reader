'use strict';

// import base/assert.js

class FileUtils {
  static readAsText(file) {
    assert(file instanceof File);
    return new Promise(function executor(resolve, reject) {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
    });
  }
}
