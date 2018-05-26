// Replaces html entities with equivalent characters. An entity is an encoded
// form of a value. The character is the decoded form. Transitioning from
// encoded to decoded is 'decoding', hence the function name.
//
// For example, the html entity string '&lt;' becomes the character string '<'.
//
// Returns a new string. Obviously, strings in js are immutable so this cannot
// modify its input. It is a pure function superficially. Note that due to the
// current implementation this function is technically very impure, due to side
// effects on the dom. For example, if the document is live (not inert), calling
// this function may trigger dom-changed event listeners.
//
// This tolerates undefined or non-string values. If the input is not a string,
// this returns the input as is. In other words, this is not a 'fail-fast'
// approach. Ordinarily, functions should by convention throw an error
// immediately if the input is null, but here I prefer the convenience of the
// caller not having to check if the value is a string before calling the
// function. This is comment-worthy because most of my other functions are fail-
// fast.
//
// Adapted from https://stackoverflow.com/questions/1912501
//
// TODO: security issue. This function currently sets element.innerHTML, where
// element is a detached element that is owned by the same document as the
// document that included the module. This is extremely unsafe.
// TODO: do not use the dom for entity encoding. I'd eventually like to not
// involve the dom but for now just get something working
// TODO: benchmarking
// TODO: tests

// The actual translation work is delegated to the native dom. Note this sticks
// around permanently in memory. This is better for performance than creating
// an element per function call.
const UNSAFE_PERSISTENT_WORKER_ELEMENT = document.createElement('div');

// Used to match named or numbered entities in the string
const entity_pattern = /&[#0-9A-Za-z]+;/g;

export function decode_entities(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(entity_pattern, decode_entity);
}

// Given an input string that should represent a entity matched by the pattern,
// return the equivalent decoded string for the entity. Note this is tailored
// to match the function signature of the second argument to
// String.prototype.replace.
function decode_entity(entity_string) {
  // Delegate the decoding work to the dom. By setting innerHTML (and not text!)
  // the string gets decoded into a node value. It will be a child text node of
  // the worker element.
  // TODO: I wonder if I should just create a text node? Would that involve
  // less overhead than setting innerHTML? Probably. Wait until unit testing is
  // implemented.
  UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = entity_string;

  // Then get the string back out, by accessing the node's text value. We could
  // also access innerHTML here, because setting innerHTML is lossy. The DOM
  // doesn't guarantee it actually stores the original input. In fact it does
  // already store the decoded equivalent. Because it does decoding as a part of
  // the innerHTML setter, which basically calls
  // DOMParser.prototype.parseFromString.

  // TODO: why innerText? probably should just use textContent? Wait until I
  // implement a testing lib to change. I think this is residue from relying on
  // 3rd party code without thinking through it.
  const text = UNSAFE_PERSISTENT_WORKER_ELEMENT.innerText;

  // Cleanup after ourselves in an attempt at faking purity and to avoid
  // leaving things in the dom indefinitely (basically a memory leak).
  UNSAFE_PERSISTENT_WORKER_ELEMENT.innerHTML = '';

  return text;
}
