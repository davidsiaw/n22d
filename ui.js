function LinkableUI(ui) {
    this.ui = ui;
    ui.change(_.bind(this.update_url, this));
}

LinkableUI.prototype.update_url = function() {
    var l = window.location;
    var new_href = [
        l.origin, l.pathname, l.search, '#', JSON.stringify(ui.get_state())
    ].join('');
    window.location.replace(new_href);
};

LinkableUI.prototype.load = function(defaults) {
    var json = window.location.hash.slice(1);
    if (json)
        this.ui.set_state(JSON.parse(json));
    else
        this.ui.set_state(defaults);
};

// A UI for rotating objects in any number of dimensions
function RotationUI(div) {
    assert(!div.children().length);

    this.div = div;
    this.table = $('<div class="table"></div>');
    this.div.append(this.table);
    this.change_cb = _.identity;

    this.set_n(0);
}

RotationUI.prototype.set_n = function(n) {
    var change_cb = this.change_cb;
    this.n = n;
    this.table.children().remove();
    this.transforms = new TransformChain();
    for (var i = 1; i <= n; i++) {
        var row = $('<div></div>');
        this.table.append(row);
        for (var j = 1; j <= n; j++) {
            var cell = $('<div></div>');
            row.append(cell);
            if (i < j) {
                var rotation = new Rotation(i, j);
                this.transforms.a.push(rotation);
                var angle_control = new MiniRange(cell, _.bind(function(r, d) {
                    r.angle += d * Math.PI / 100;
                    r.velocity = 0;
                    change_cb();
                }, null, rotation));
                var speed_control = new MiniRange(cell, _.bind(function(r, d) {
                    r.velocity += d * Math.PI / 100;
                    change_cb();
                }, null, rotation));
            }
        }
    }
    // break circular references
    row = cell = angle_control = speed_control = null;
};

RotationUI.prototype.get_state = function() {
    return {
        n: this.n,
        r: _.map(this.transforms.a, function(r) { return [r.angle, r.velocity]; })
    };
};

RotationUI.prototype.set_state = function(state) {
    this.set_n(state.n);
    if (state.r)
        for (var i = 0; i < state.r.length; i++) {
            this.transforms.a[i].angle = state.r[i][0];
            this.transforms.a[i].velocity = state.r[i][1];
        }
};

RotationUI.prototype.change = function(callback) {
    this.change_cb = callback;
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
