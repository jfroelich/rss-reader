import {slideshow_export_opml} from '/src/slideshow-page/slideshow-export-opml.js';

// TODO: merge the helper module into here, this is sole caller I think?

// TODO: make click handler async again

// TODO: visual feedback on completion
// TODO: show an error message on error
export function export_menu_option_handle_click(event) {
  const title = 'Subscriptions';
  const filename = 'subscriptions.xml';
  slideshow_export_opml(title, filename).catch(log);
}
