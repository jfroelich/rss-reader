
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

# Try and improve table unwrapping algorithm

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
