// TODO: do not tie to platform. Review and articulate clearly the original
// problems and genesis of this module.

// Open a url in a new browser tab
export default function open_tab(url_string, active) {
  return chrome.tabs.create({active: active, url: url_string});
}
