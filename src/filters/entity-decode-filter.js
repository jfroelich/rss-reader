'use strict';

function entity_decode_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

/*
Old todo copied from another file:

Preprocess all entities like nbsp, and convert each one into its numeric
equivalent. On average the numeric entities use fewer characters. And possibly
go further given that it is utf8 encoding, do things like convert copy into
actual copyright utf character. Also consider the option to use whichever has
fewer characters, the named encoding or the numeric encoding. Also consider
working with a TextEncoder/Decoder api if appropriate. Also see
https://github.com/mathiasbynens/he for ideas. Also, there is an issue with
the fact that condense takes a document but this would be maybe be easier on
raw text? See also https://github.com/kangax/html-minifier with its option
to use unicode char when possible
*/


/*
TODO: Replace entities with single unicode character where possible in order
to shrink document size

Part of the challenge is how to get entities when
node.nodeValue auto decodes

See https://stackoverflow.com/questions/17582168

So this leads me to believe that there is no point in doing this filter
if I continue to unmarshall html into Document and pass around a
document instance.

Well, that's not quite right. Technically element.innerHTML I think still
has the encoded entity. which means it is still there.

but i cannot use innerhtml because that also gets tags and does serialization
and is very high cost.

Perhaps what is best is if this filter runs prior to parsing the html? When
it works directly on the string itself?

I'd have to write my own parser i think?

*/
}
