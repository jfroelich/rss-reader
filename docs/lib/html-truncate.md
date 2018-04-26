# html-truncate

Similar to string truncation, but takes care not to truncate a string within the middle of an html tag or entity.

The position is the position within the string in which to truncate. This position is based on the pure text offset (as if no tags existed), not the actual offset in the html string.

May be an issue with how offset relates to entities, forgot what I did there.

This is currently a very expensive operation. The document is parsed fully into a DOM, then the DOM is manipulated and then serialized back into an html string.

Due to using DOMParser, this has no great way of knowing whether the original input html string was a fragment or a full document, so it uses a hack by looking for the substring "<html". This could turn out to be wrong sometimes.

Eventually I would like to implement a pure text parser that avoids the DOM entirely. This is at conflict with the goal of using as much native functionality as possible because native functionality is extremely fast, and it guarantees the logic mirrors the browser's own input processing behavior.

### TODOS
* consider renaming to `truncate_html`
