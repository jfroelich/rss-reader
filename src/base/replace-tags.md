# replace_tags

## Todos
* Change how the html replace tags function deals with entities, Currently the function is "lossy" in that it is does not correctly deal with entities and therefore does maintain the fidelity of the input. This is ultimately bad. It is not horrible at the moment but it is ultimately a misleading transformation that leads to unexpected results. The issue is that I am using the native parsing, which encodes entities during parsing. When serializing back to a string, some decoded entities are not properly encoded. For example, &32; is converted to space when parsing, but the space is not converted back to an entity. Side note: once tokenizeHTML is settled, migrate to tokenizer approach instead of using htmlParseFromString. tokenize would not encode entities, and I don't actually need to fully parse, just tokenize.
* HTML replace tags improvements, maybe allow some tags to stay but others not, like a whitelist
write tests
