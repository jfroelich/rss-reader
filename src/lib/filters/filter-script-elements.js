// TODO: add console parameter

// Removes script elements from document content
// Not restricted to <body> descendants
export function filter_script_elements(document) {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}
