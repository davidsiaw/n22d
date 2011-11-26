// A UI for rotating objects in any number of dimensions
function UI(div) {
    assert(!div.children().length);

    this.div = div;
    this.table = $('<div class="table"></div>');
    this.div.append(this.table);
    
    this.n = 0;
}

UI.prototype.set_n = function(n) {
    this.n = n;
    this.table.children().remove();
    var rotations = [];
    for (var i = 1; i <= n; i++) {
        var row = $('<div></div>');
        this.table.append(row);
        for (var j = 1; j <= n; j++) {
            var cell = $('<div></div>');
            row.append(cell);
            if (i < j) {
                var rotation = new Rotation(i, j);
                rotations.push(rotation);
                var angle_control = new MiniRange(cell, _.bind(function(r, d) {
                    r.angle += d * Math.PI / 100;
                }, null, rotation));
                var speed_control = new MiniRange(cell, _.bind(function(r, d) {
                    r.velocity += d * Math.PI / 100;
                }, null, rotation));
            }
        }
    }
    // break circular references
    row = cell = angle_control = speed_control = null;
    return rotations;
};

function MiniRange(div, callback) {
    this.div = div;
    this.callback = callback;
    this.range = $('<input type="range" min=0 max=0></input>');
    this.range.css('width', '1em');
    this.div.append(this.range);
    this._set_handlers();
}

MiniRange.prototype._set_handlers = function() {
    var dragging = false;
    var drag_x = 0;
    var callback = this.callback; // no circular reference

    this.range.mousedown(function(ev) {
        dragging = true;
        drag_x = ev.clientX;
    });

    this.range.mouseup(function(ev) {
        dragging = false;
    });

    this.range.mousemove(function(ev) {
        if (!dragging)
            return;
        callback(ev.clientX - drag_x);
        drag_x = ev.clientX;
    });
}
