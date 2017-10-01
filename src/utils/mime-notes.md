
SEe the following

https://chromium.googlesource.com/chromium/src/+/master/net/base/mime_util.cc

go back to using a mime module, this utility should just be a function of the
one place it is used and the majority of its code should belong in the mime
module, wrapping it all up might have been a mistake
