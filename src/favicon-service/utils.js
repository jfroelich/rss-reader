

export function assert(value, message) {
  if(!value) {
    throw new Error(message || 'Assertion error');
  }
}

export function resolveURLString(url, baseURL) {
  assert(baseURL instanceof URL);
  if(typeof url === 'string' && url.trim()) {
    try {
      return new URL(url, baseURL);
    } catch(error) {
      // ignore
    }
  }
}

export function parseHTML(text) {
  assert(typeof text === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(text, 'text/html');
  const error = document.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent);
  }
  return document;
}
