import assert from "/src/assert.js";

// TODO: this could use some cleanup or at least some clarifying comments
export default function fadeElement(element, durationSecs, delaySecs) {

  assert(element instanceof Element);

  return new Promise(function executor(resolve, reject) {
    const style = element.style;

    // Not all elements have style. This should only be called on elements that can.
    assert(style);

    if(style.display === 'none') {
      style.opacity = '0';
      style.display = 'block';
    } else {
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${durationSecs}s ease ${delaySecs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}
