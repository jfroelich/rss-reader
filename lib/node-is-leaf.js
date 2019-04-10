// Returns whether the input node is a leaf node. A leaf node is basically an
// element that has no child nodes, or whose child nodes are only leaves, or a
// whitespace text node, or a comment node. This is a recursive function.
export default function node_is_leaf(node) {
  const exception_names = [
    'area', 'audio',  'base', 'col',      'command', 'br',    'canvas', 'col',
    'hr',   'iframe', 'img',  'input',    'keygen',  'meta',  'nobr',   'param',
    'path', 'source', 'sbg',  'textarea', 'track',   'video', 'wbr'
  ];

  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      if (exception_names.includes(node.localName)) {
        return false;
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (!node_is_leaf(child)) {
          return false;
        }
      }

      break;
    }
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
}
