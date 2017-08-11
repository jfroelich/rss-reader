
# TODO

* Replace entities with single unicode character where possible in order
to shrink document size? Part of the challenge is how to get entities when
node.nodeValue auto encodes
* Are there other elements with abbreviated versions like strong/em?
* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text
* Remove processing instructions and doc type stuff
* Can shrink some attribute values, like for image width change 100px to 100,
because units are implied in many places
* Can reduce the size of attribute values by trimming them
* Can remove attributes that do not have values that are non-unary attributes
* Can remove attributes that equal the default values
* Preprocess all entities like nbsp, and convert each one into its numeric
equivalent. On average the numeric entities use fewer characters. And possibly
go further given that it is utf8 encoding, do things like convert copy into
actual copyright utf character. Also consider the option to use whichever has
fewer characters, the named encoding or the numeric encoding. Also consider
working with a TextEncoder/Decoder api if appropriate. Also see https://github.com/mathiasbynens/he for ideas. Also, there is an issue with
the fact that condense takes a document but this would be maybe be easier on
raw text? See also https://github.com/kangax/html-minifier with its option
to use unicode char when possible
* If an image is a known square with equal attribute values, can maybe remove
one of the dimensions?
* actually, just take a look at https://github.com/kangax/html-minifier and
think about some similar options

# TODO: Try and improve the table unwrapping algorithm

It seems to be missing hacker news blog comments section. It might be that the
first column is not empty, and only later becomes empty because of other
sanitization. But I feel like I should somehow be picking this up in the
general case and unwrapping such a table. See
https://news.ycombinator.com/item?id=14942570 as an example of the failure.

Specifically I think it is not counting the following as an empty cell:

&lt;table&gt;
&lt;tr&gt;
  &lt;td class="ind"&gt;&lt;img src="s.gif" height="1" width="0"&gt;&lt;/td&gt;
  &lt;td&gt;asdf content&lt;/td&gt;
&lt;/tr&gt;
&lt;/table&gt;

The image gets filtered later, which is why I am seeing the empty cell. This is
from before that image gets filtered. It would be nice if the is empty could
also pick up the spacer image and still treat it as empty.

This may just get fixed if i fix the remove tiny images stuff
