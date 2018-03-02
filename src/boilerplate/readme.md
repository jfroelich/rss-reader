
The boilerplate filter module analyzes the contents of a document and classifies content as boilerplate. Boilerplate content is then pruned.

The input document is modified in place because it is too expensive to copy the document.

The boilerplate filter is naive regarding other content filters. For example, it is not aware that text may be hidden, or barely visible.

# TODO: Change how annotation works

Rather than passing in a boolean option, it would be probably be better if the boilerplate filter was split into two components. One component would do annotation, and the other component would do pruning.

* It would be slower. But now the caller can simply not call prune to achieve annotation.
* I want to do something similar with the color contrast filter
* I could defer pruning until post-render and allow the caller to dynamically make content appear or disappear based on boilerplate score (presented as content-utility score)
