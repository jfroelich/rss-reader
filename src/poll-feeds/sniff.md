`classify` classifies a resource as binary, text, or unknown. The function
returns unknown when it is not confident in the results. The function guesses
the class of the resource purely by looking at its url, without actually
performing any I/O operations or investigating the bytes of the resource.
Internally, the function attempts to find the file name's extension in the
url path, find its mime type, and determine class based on mime type.

* Internal note: the text protocols list is not exhaustive, it only includes
some typical protocols off the top of my head
* Internal note: the application super type exceptions is not exhaustive, it
only lists typical mime types with which this app is concerned
* Internal note: the extension to mime type map is not exhaustive and not
necessarily canonical (normative), I've only done basic research and hobbled
together a list from online resources
