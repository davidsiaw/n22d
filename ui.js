/* A UI you can spin like a trackball like the one in Google Earth. */
var BallUI = Class.create(LazyTransform, {
    initialize: function(model, radius) {
        this.model = model;
        this.radius = radius;
        this.transform = new BigMatrix().to_I();
    },

    drag: function(mouse_drag) {
        var handle_prev = this.grab(mouse_drag.pos_prev);
        var handle = this.grab(mouse_drag.pos);
        handle_prev.a[0] = handle.a[0] = 0;
        var space = new Space([handle_prev, handle]);
        if (space.basis.length != 2)
            return;
        var rot = new Matrix(2, 2).to_rotation(handle.angle(handle_prev)/2/Math.PI);
        rot = new BigMatrix(space.inside(rot));

        if (mouse_drag.move_event.shiftKey) {
            var swap = new BigMatrix().to_swap(3, 4);
            rot = swap.times(rot).times(swap);
        }
        this.transform.m = this.transform.times(rot).m.affine_orthonormalize();
    },

    // returns point in model-space
    grab: function(mouse_line) {
        var projection = new BigMatrix(null, BigMatrix.ND_PROJ_GET_FN);
        var transform = projection.times(this.model.transforms.transform).m;
        var line = transform.solve_affine_space(mouse_line);
        assert(line.diff.basis.length == 1);
        return this.closest_point(line);
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
