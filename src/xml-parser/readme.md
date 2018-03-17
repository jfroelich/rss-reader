# TODO

* Make exceptionless. One idea is that this just wraps domparser call, and provides a separate helper method that accepts a document and returns whether the document has a parsererror element. The caller can avoid using try/catch. The caller can ignore errors by not calling the helper. Or the caller can check for errors by calling the helper. The helper would return boolean.
