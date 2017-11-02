'use strict';

class FileUtils {

  static readAsText(file) {
    // TODO: this should be a strong assertion
    console.assert(file instanceof File);
    return new Promise(function executor(resolve, reject) {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
    });
  }
}
