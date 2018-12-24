# import-opml

## A note about the File object
A `File` implements the `Blob` interface. This is not well documented for some reason and is surprisingly confusing.

## TODOs
* break apart into two layers, a UI layer and a lower controller layer. The controller layer should work without a UI and it is what should be tested
* test multiple files
* test multiple feeds per file
* test dup handling
