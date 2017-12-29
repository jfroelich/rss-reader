import "/third-party/parse-srcset.js";

// Returns an array of descriptor objects. If the input is bad, or an error occurs, returns an
// empty array.
// @param srcset {Any} preferably a string, the value of a srcset attribute of an element
export function parseSrcsetWrapper(srcset) {
  const fallbackOutput = [];

  // Tolerate bad input for convenience
  if(typeof srcset !== 'string') {
    return fallbackOutput;
  }

  // Avoid parsing empty string
  if(!srcset) {
    return fallbackOutput;
  }

  // parseSrcset doesn't throw in the ordinary case, but avoid surprises
  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    console.warn('Error parsing srcset ignored: ' + srcset);
    return fallbackOutput;
  }

  if(!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}
