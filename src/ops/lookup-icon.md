Lookup the favicon url for a url. Returns a promise that resolves to the url (string).

### Params
* url {URL} the location to investigate
* document {Document} the pre-fetched document, optional
* skip_fetch {Boolean} whether to attempt to fetch the full text of the resource, and if it is html, search for a url within the html, before continuing to check other places.
