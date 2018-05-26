const UNSAFE_PERSISTENT_WORKER_ELEMENT = document.createElement('div');
const entity_pattern = /&[#0-9A-Za-z]+;/g;

// Given an input value, if it is a string, then creates and returns a new
// string where html entities have been decoded into corresponding values. For
// example, '&lt;' becomes '<'.
//
// Adapted from https://stackoverflow.com/questions/1912501
//
// TODO: the current implementation is too difficult to read
// TODO: security issue. This function currently sets element.innerHTML, where
// element is a detached element that is owned by the same document as the
// document that included the module. This is extremely unsafe.
// TODO: why innerText? probably should just use textContent? Wait until I
// implement a testing lib to change.
// TODO: do not use the dom for entity encoding. I'd eventually like to not
// involve the dom but for now just get something working

export function decode_entities(value) {
  return typeof value === 'string' ?
      value.replace(
          entity_pattern,
          function replacer(entity) {
            UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = entity;
            const text = UNSAFE_PERSISTENT_WORKER_ELEMENT.innerText;
            UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = '';
            return text;
          }) :
      value;
}
