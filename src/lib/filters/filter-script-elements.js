// This filter is a primary security concern. It could occur later but doing
// it earlier means later filters visit fewer elements.
// Removes script elements from document content
// Not restricted to <body> descendants
export function filter_script_elements(document) {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    script.remove();
  }
}
