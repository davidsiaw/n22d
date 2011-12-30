// stores state for a mouse drag
function Dragger(el, callback, shiftKey) {
    this.shiftKey = shiftKey || false;
    this.callback = callback;

    this.dragging = false;
    this.x_first = 0;
    this.y_first = 0;
    this.x_prev = 0;
    this.y_prev = 0;
    this.x = 0;
    this.y = 0;

    // don't store el to avoid circular references
    el = $(el)
    el.mousedown(_.bind(this._mousedown_cb, this));
    el.mouseup(_.bind(this._mouseup_cb, this));
    el.mousemove(_.bind(this._mousemove_cb, this));
}

Dragger.prototype._mousedown_cb = function(ev) {
    if (ev.shiftKey != this.shiftKey)
        return;
    this.dragging = true;
    this.x_first = this.x_prev = this.x = ev.clientX;
    this.y_first = this.y_prev = this.y = ev.clientY;
};

Dragger.prototype._mouseup_cb = function(ev) {
    if (ev.shiftKey != this.shiftKey)
        return;
    this.dragging = false;
};

Dragger.prototype._mousemove_cb = function(ev) {
    if (!this.dragging)
        return;
    this.x_prev = this.x;
    this.y_prev = this.y;
    this.x = ev.clientX;
    this.y = ev.clientY;
    this.callback(this);
};

Dragger.prototype.changed = function() {
    return this.x_prev != this.x || this.y_prev != this.y;
};
