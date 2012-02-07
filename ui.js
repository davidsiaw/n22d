function BallUI(model, radius) {
    this.model = model;
    this.radius = radius;
}

BallUI.prototype.grab = function(mouse_ray) {
    var pos = this.model.transforms.transform.times(new Vector([1]));
    var vs = this._intersect(mouse_ray, pos);
    if (vs.length) {
        var v = vs[0];
        vs.each(function(w) { if (w.norm() < v.norm()) v = w; });
        v.a[0] = 1; //
        return v.point_minus(pos);
    } else {
        // pick a point on the sphere that is kinda close to where the user
        // clicked. No good rigorous justification here, could probably be
        // done better.
        var tangent = mouse_ray.times(pos.a[3] / mouse_ray.a[3]);
        tangent.a[0] = 1;
        return tangent.point_minus(pos).normalized().times(this.radius);
    }
};

// ray from origin
BallUI.prototype._intersect = function(ray_velocity, pos) {
    // substitute parametric line into sphere relation
    var v = ray_velocity;
    var c = pos;
    var r = this.radius;
    var x2 = v.a[1]*v.a[1] + v.a[2]*v.a[2] + v.a[3]*v.a[3];
    var x1 = -2*v.a[1]*c.a[1] - 2*v.a[2]*c.a[2] - 2*v.a[3]*c.a[3];
    var x0 = c.a[1]*c.a[1] + c.a[2]*c.a[2] + c.a[3]*c.a[3] - r*r;
    var vs = solve_quadratic(x2, x1, x0).map(function(s) {
        s = v.times(s);
        return s;
    });
    return vs;
}

function solve_quadratic(a, b, c) {
    var desc = Math.sqrt(b*b - 4*a*c);
    if (isNaN(desc))
        return [];
    else if (desc == 0)
        return [-b/a/2];
    else
        return [(desc - b)/a/2, (-desc - b)/a/2];
}
