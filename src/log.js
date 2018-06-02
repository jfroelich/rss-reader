// logging helpers

export function log(...args) {
  if (localStorage.debug) {
    console.log(...args);
  }
}

export function warn(...args) {
  if (localStorage.debug) {
    console.warn(...args);
  }
}
