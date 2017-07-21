
TODO: allow html comments in script text

TODO: allow arbitrary whitespace in closing tags after name
TODO: can - or _ be in tag name? what characters can be in tag name?
https://www.w3.org/TR/REC-html40/interact/scripts.html#h-18.3.2
TODO: maybe improve performance by use charCodeAt instead of charAt and then
doing comparisons using numbers, or is v8 using interning strings?

TODO: allow for re-entrance
--- means probably need to return multiple things, including end state
--- means not throwing if not in text state at end

TODO: regarding whitespace in tag body, maybe it would make more sense to
return a structured object (e.g. tag name property and attributes map
property) instead of the whole tag name, because whitespace should be
ignored. This involves some basic input normalization, maybe it is best to
do it here.

TODO: alternate script syntax like visual basic?

TODO: fix bugs with regular expression literals

TODO: maybe add an onToken callback instead of array, and pass in two params,
one for token type, this simplifies handling. I don't like how the caller
has to 'reparse' the string to determine the type. Also, it is kind of
ambiguous like <script><!--, where <!-- leads off the script text token but
is not a tag. Also, it makes it easier to tell start vs close because I
could emit a token type along with the token value. also, I dont like the
idea of this controlling the buffering, by using a callback i let the caller
decide how long to hold on to previous tokens, instead of this demanding to
hold onto the entire thing.

TODO: maybe provide conditional verbose param that if set provides detailed
logging to console?

TODO: is this kind of brittle? Maybe a scanner generator tool would be
better. Would need to research.

TODO: isn't there a fundamental issue where if this differs from native
handling of html, then that is a massive security risk.

NOTE: https://chromium.googlesource.com/chromium/blink.git/+/master/Source/core/html/parser/HTMLTokenizer.cpp
NOTE: https://html.spec.whatwg.org/#tokenization


TODO: better handling of strings?

From https://github.com/lydell/js-tokens, "JavaScript strings cannot contain
(unescaped) newlines, so unterminated strings simply end at the end of the line.
Unterminated template strings can contain unescaped newlines, though, so they
go on to the end of input."

regular expression ambiguity:

* https://stackoverflow.com/questions/5519596
The division operator must follow an expression, and a regular expression
literal can't follow an expression, so in all other cases you can safely assume
you're looking at a regular expression literal.

A few places have mentioned JSLint doing js lexing and dealing with this issue
in a certain way so check that out.

Oh god: https://github.com/douglascrockford/JSLint/blob/master/jslint.js

This ambiguity basically means I need a more intelligent parser. Not sure if
it is worth it. So this ultimately means a massive security hole and the only
way to fix it is to defer to the browser.

Maybe I am over thinking it and there isn't as much of a risk to
to closing tag of script.
