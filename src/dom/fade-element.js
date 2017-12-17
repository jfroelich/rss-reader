import assert from "/src/assert/assert.js";

export default function fadeElement(element, durationSecs, delaySecs) {
  return new Promise(function executor(resolve, reject) {
    assert(element instanceof Element);
    const style = element.style;
    // This should only be called on elements that have a style
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
