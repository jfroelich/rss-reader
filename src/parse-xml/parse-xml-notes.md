# TODO

* maybe needs better api, like xml.parse
* this should throw if input not a string. does it?
* test whether doc is guaranteed defined regardless of input

# Notes on throwing parser errors

Instead of throwing an exception, parseFromString embeds a parse error as
an element in the document. Not sure why. So turn the parsing error back
into an actual error.

I have no simple way of detecting whether parsererror was included
by the parser, or was already in the document.

As tempting as it is to show the parsererror text, this is untrusted
user input, so throw a generic error message.

One thing I could do if it became a priority would be to parse the error message
for certain information such as line number, column number, then build a simple
string from that using a template.
