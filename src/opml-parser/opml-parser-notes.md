TODO:

* should this function be namespaced? Like opml.parse, or something like
(new OPMLParser()).parse() ?
* design wise, would it be better to just return the xml document
and not directly couple this function to the OPMLDocument impl?
That allows for more flexibility and less coupling. The tradeoff I suppose
is that the caller has more boilerplate for linking together the
components, and has to know how to properly link OPMLDocument with the
document produced by parse_opml. For now leaving as is.
A second issue I have with this is that it has to have knowledge of the
structure of OPMLDocument which feels like a violation of some OOP
principle, perhaps the law of demeter, cannot recall exactly.
