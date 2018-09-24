# About is_hidden_inline
This function is designed to work for both inert and live documents. In an inert document, element.offsetWidth and element.offsetHeight are unavailable (they are set to a sentinel value of 0 because they are basically not initialized as a result of parsing), so the faster method of checking only those properties cannot be used.

## Todos
* reconsider using computed style, or have a parameter that decides
* add support for non-css attributes that hide an element, such as
&lt;input type="hidden">
* maybe reconsider the helper functions and instead inline the helpers, this will reduce the number of function calls. The correct thing to do however would be to wait until this is profiled.
