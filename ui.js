// stores state for a mouse drag
var MouseDrag = Class.create({
    initialize: function(callback) {
        this.callback = callback;

        this.dragging = false;
        this.x_first = this.y_first = null;
        this.x_prev = this.y_prev = null;
        this.x = this.y = null;
        this.move_event = null; // only set during event handling
    },

    bind: function(el) {
        el.observe('mousedown', this._mousedown_cb.bind(this));
        el.observe('mouseup', this._mouseup_cb.bind(this));
        el.observe('mousemove', this._mousemove_cb.bind(this));
    },

    _mousedown_cb: function(ev) {
        this.dragging = true;
        this.x_first = this.x = this.x_prev = ev.offsetX;
        this.y_first = this.y = this.y_prev = ev.offsetY;
    },

    _mouseup_cb: function(ev) {
        this.dragging = false;
        this.callback(this);
    },

    _mousemove_cb: function(ev) {
        if (!this.dragging)
            return;

        this.x_prev = this.x;
        this.y_prev = this.y;
        this.x = ev.offsetX;
        this.y = ev.offsetY;

        this.move_event = ev;
        this.callback(this);
        this.move_event = null; // break reference cycle
    }
});

/* A UI you can spin like a trackball, like the one in Google Earth. */
var BallUI = Class.create({
    initialize: function(radius) {
        this.radius = radius;
        this.transform = new BigMatrix();
    },

    drag: function(line_prev, line) {
        var handle_prev = this.closest_point(line_prev);
        var handle = this.closest_point(line);
        handle_prev.a[0] = handle.a[0] = 0;
        var space = new Space([handle_prev, handle]);
        if (space.basis.length != 2)
            return;
        var rot = new Matrix(2, 2).to_rotation(handle.angle(handle_prev)/2/Math.PI);
        rot = new BigMatrix(space.inside(rot));
        this.transform.m = this.transform.times(rot).m.affine_orthonormalize();
    },

    // returns closest intersection to line.point or another point close to line
    closest_point: function(line) {
        var p = line.point;
        var d = line.diff.basis[0];
        var r = this.radius;
        var x2 = d.a[1]*d.a[1] + d.a[2]*d.a[2] + d.a[3]*d.a[3];
        var x1 = 2*d.a[1]*p.a[1] + 2*d.a[2]*p.a[2] + 2*d.a[3]*p.a[3];
        var x0 = p.a[1]*p.a[1] + p.a[2]*p.a[2] + p.a[3]*p.a[3] - r*r;
        var s = solve_quadratic(x2, x1, x0);
        if (s.length)
            return p.plus(d.times(s.min()));
        else {
            // doesn't normalize to be on the sphere
            var center = new Vector([1]); // center of this sphere
            var pc = center.point_minus(p);
            return p.plus(d.times(pc.dot(pc)/d.dot(pc)));
        }
    }
});

function solve_quadratic(a, b, c) {
    var desc = Math.sqrt(b*b - 4*a*c);
    if (isNaN(desc))
        return [];
    else if (desc == 0)
        return [-b/a/2];
    else
        return [(desc - b)/a/2, (-desc - b)/a/2];
}
