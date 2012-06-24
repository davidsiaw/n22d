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
    initialize: function(n22d, radius, space, colour) {
        this.n22d = n22d;
        this.radius = radius;
        this.space = space;
        this.colour = colour;
    },

    model: function() {
        var colour = this.colour;
        var ball = sphere_subdivide(icosahedron(), 1).each(function (t) {
            t[0].colour = t[1].colour = t[2].colour = colour.copy();
            t[0].colour.a[3] = Math.random()/8 + .2;
        });
        ball = sphere_finish(sphere_subdivide(ball, 2));

        var r = this.radius;
        var scale = new BigMatrix().to_scale([r, r, r]);
        var move = this.space.diff.basis_change().transpose();
        return ball.map(function(v) {
            v.loc = scale.times(v.loc);
            v = v.times_left(move);
            v.loc = v.loc.plus(this.space.point);
            return v;
        }, this);
    },

    drag: function(handle, handle_prev) {
        handle = handle.minus(this.space.point);
        handle_prev = handle_prev.minus(this.space.point);
        var angle = handle.angle(handle_prev);
        if (!angle)
            return;
        var rot = new Matrix(2, 2).to_rotation(angle);
        var rot_space = new Space([handle_prev, handle]);
        return new AffineUnitaryBigMatrix(rot_space.inside(rot));
    },

    grab: function(x, y) {
        var grab_space = this.n22d.screen2model(x, y, this.space.diff.nd);
        var local = this.space.intersection(grab_space);
        var closest = local.closest_to(this.space.point);
        var norm = closest.minus(this.space.point).norm();
        if (norm > this.radius) {
            var d = closest.minus(this.space.point);
            return this.space.point.plus(d.times(this.radius/norm));
        }
        var adjacent = Math.sqrt(this.radius*this.radius-norm*norm);
        assert(local.diff.basis.length == 1);
        var d = local.diff.basis[0].times(adjacent);
        return this.n22d.min_z([closest.plus(d), closest.minus(d)]);
    }
});
