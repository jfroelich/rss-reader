// TODO: consider inlining iframes somehow, or at least having the option to do
// so.
// TODO: consider interaction with youtube support
// Removes iframe elements
export function filter_iframes(document) {
  if (document.body) {
    const frames = document.body.querySelectorAll('iframe');
    for (const frame of frames) {
      frame.remove();
    }
  }
}
