
export class HTMLParser2 {
  static parse(html) {
    // Adapted from https://stackoverflow.com/questions/10585029
    const template = document.createElement('template');
    template.innerHTML = html;
    console.dir(template);
    return template.content.cloneNode(true);
  }
}

/*

This works exactly as I would want:

HTMLParser2.parse('<table><td>Hey</td></table>');

But this does not at all work like what I want:

HTMLParser2.parse('<html><body><td>Hey</td></body></html>');

Because it yields "Hey" without anything else. No tags. A document fragment with
a single text node child.

NOTE: further tests, basically it looks like only the tags for html and body
are filtered. The other tags pass through.

So, I could do something along the lines of:

parse(html) {
  if(is_document) {
    doc = parse_document(html);
  } else {
    frag = parse_fragment(html);
  }
}

But I am not entirely sure what that accomplishes. Instead, I could also just have two html parsing
functions, one for fragments and one for documents? With some warnings about trying to parse a
document as a fragment? But then what do I do when that happens?


TODO: is script evaluated?

HTMLParser2.parse('<script type="application/javascript">console.log("drats");</script>');

I do not see any output. So I think it works like how I want. Unless the warning is secretly
swallowed.

TODO: are images fetched?
HTMLParser2.parse('<img src="https://i.stack.imgur.com/DqQca.jpg?s=64&g=1">');
Seems to work like I want. I did not see any network requests go out.

TODO: is style evaluated? HTMLParser2.parse('<style>html{font-size:60px;}</style>');

Seems to work like I want. live dom was not affected.

So, the fragment is inert. That's good. Like the document.

But, how do I deal with parsing documents? I have a feeling like
parseHTMLFragment and parseHTMLDocument should be two functions?

*/
