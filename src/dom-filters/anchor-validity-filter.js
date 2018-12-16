export function anchor_validity_filter(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a');
    for (const anchor of anchors) {
      if (anchor_is_invalid(anchor)) {
        anchor.remove();
      }
    }
  }
}

function anchor_is_invalid(anchor) {
  const href_value = anchor.getAttribute('href');
  return href_value && /^\s*https?:\/\/#/i.test(href_value);
}
