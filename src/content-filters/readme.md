
# About

Content filters deal with an HTML DOM document. Filters are focused on removing
various content from the document, for a variety of reasons, such as whether the
content is not-informative, invisible, or hard to see. Other filters are focused
on security, or reducing document size, or cleaning up bad formatting.

Most of the filters are located in content-filters.js, with some of the more
complicated filters in separate files.


# todo for emphasis filter

* change max length input to be max length per emphasis type, have separate maxes for bold, italics. then also add a new max length for block quotes and also limit the size of block quotes (e.g. when it is almost the entire page that is too much).
* consider looking at css of all tags and not just tag name
