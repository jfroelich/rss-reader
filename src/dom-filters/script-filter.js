export function script_filter(document) {
  transform_noscript_elements(document);

  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}

// NOTE: currently this removes, but in the future this might be smarter and
// instead do some kind of unwrap, hence the abstracted name
function transform_noscript_elements(document) {
  if (document.body) {
    const noscripts = document.body.querySelectorAll('noscript');
    for (const noscript of noscripts) {
      noscript.remove();
    }
  }
}
