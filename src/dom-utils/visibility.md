# visibility
`is_hidden_inline` is designed to work for both inert and live documents. In an inert document, `offsetWidth` and `offsetHeight` are unavailable. They are set to a sentinel value of 0 because they are basically not initialized as a result of parsing. So the faster method of checking only those properties cannot be used.

## Todos
* reconsider using computed style, or have a parameter that decides
* add support for non-css attributes that hide an element
* I need to also add a test that verifies this condition (in both the true and false cases) for input type hidden check
* reconsider aria hints
