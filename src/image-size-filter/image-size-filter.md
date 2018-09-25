# What does this module do?
Scans the image elements in an html document, and sets the width and height dimensions for images where the width or height are unknown.

# Why does this module exist?
Not all images have a known size after parsing. However, some other functionality really wants to have such information in order to apply more accurate heuristics. For example, the boilerplate analysis filter uses image size as a factor in classifying content as boilerplate.

# Todos
* Avoid repeatedly fetching the same image. An image can appear multiple times in a document. Right now this does a fetch per occurrence. This is not the end of the world because I assume that images are cached and that the stuff underlying fetch calls is smart enough to use the cache. However, I need a list of unique images with each having a list of its occurrences. However this is problematic, because what about varying dimensions of the same image, along with the goal of using those to avoid fetches. I think what I want is two passes. The first pass processes those images that can be processed without network requests. It builds a list of those images where it cannot process them locally. Then the second step does the network requests and does it based off a set of distinct urls instead of the full occurrences array.
* Write tests
* find_url_dimensions todos
* TODO: support "filename.w500.h500.jpg"
* TODO: support "foo-730x420-bar.jpg"
* TODO: support both - and _ delimiters
* TODO: always return dimensions, just return 0s on failure, so that caller no longer cares if defined or not
