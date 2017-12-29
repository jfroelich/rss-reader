import assert from "/src/common/assert.js";

// Duration and delay can be integer or floats and are required.
export default function fadeElement(element, durationSecs, delaySecs) {
  return new Promise(function executor(resolve, reject) {
    assert(element instanceof Element);
    assert(element.style instanceof CSSStyleDeclaration);
    assert(typeof durationSecs === 'number');
    assert(typeof delaySecs === 'number');

    const style = element.style;
    if(style.display === 'none') {
      // If the element is hidden, it may not have an opacity set. When fading in the element
      // by setting opacity to 1, it has to change from 0 to work.
      style.opacity = '0';

      // If the element is hidden, and its opacity is 0, make it eventually visible
      style.display = 'block';
    } else {
      // If the element is visible, and we plan to hide it by setting its opacity to 0, it has
      // to change from opacity 1 for fade to work
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {'once': true});

    // property duration function delay
    style.transition = `opacity ${durationSecs}s ease ${delaySecs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}
