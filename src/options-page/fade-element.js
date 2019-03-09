export function fade_element(element, duration_secs, delay_secs) {
  return new Promise((resolve, reject) => {
    if (!element) {
      return reject(new Error('Invalid element ' + element));
    }

    if (!element.style) {
      return reject(new Error('Cannot fade element without a style property'));
    }

    duration_secs = isNaN(duration_secs) ? 1 : duration_secs;
    delay_secs = isNaN(delay_secs) ? 0 : delay_secs;

    const style = element.style;
    if (style.display === 'none') {
      // If the element is hidden, it may not have an opacity set. When fading
      // in the element by setting opacity to 1, it has to change from 0 to
      // work.
      style.opacity = '0';

      // If the element is hidden, and its opacity is 0, make it eventually
      // visible
      style.display = 'block';
    } else {
      // If the element is visible, and we plan to hide it by setting its
      // opacity to 0, it has to change from opacity 1 for fade to work
      style.opacity = '1';
    }

    element.addEventListener('webkitTransitionEnd', resolve, {once: true});
    style.transition = `opacity ${duration_secs}s ease ${delay_secs}s`;
    style.opacity = style.opacity === '1' ? '0' : '1';
  });
}
