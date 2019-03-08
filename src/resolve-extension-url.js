export function resolve_extension_url_string(url_string) {
  return chrome.extension.getURL(url_string);
}
