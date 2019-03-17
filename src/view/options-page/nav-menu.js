export function NavMenu() {
  this.onclick = undefined;
  this.current_item = undefined;
}

NavMenu.prototype.init = function(parent) {
  // TODO: use single listener on the menu itself
  const menu_items = document.querySelectorAll('#navigation-menu li');
  for (const item of menu_items) {
    item.onclick = this.itemOnclick.bind(this);
  }
};

NavMenu.prototype.itemOnclick = function(event) {
  // The listener is attached to the item, but that may not be what triggered
  // the click event of event.target, so use currentTarget to get the element
  // where the listener is attached
  this.onclick(event.currentTarget);
};
