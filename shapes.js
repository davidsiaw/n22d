function klein_bottle_model(gl, n_circle, n_loops) {
    return new Model(gl.TRIANGLES, klein_bottle(n_circle, n_loops));
}

// Models a Klein bottle to look like a cross between a torus and a Mobius strip.
// n_circle: Number of points in the small radius (like in a torus).
// n_loops: Number of loops of triangles. The model will have small holes
//          unless n_loops is even.
// returns <2*n_circle*n_loops> triangles
function klein_bottle(n_circle, n_loops) {
    var loops = new Array(n_loops);
    var trans = new BigMatrix().to_translation(new Vector([0, 0, 2]));
    var torus_rot = new BigMatrix();
    var mobius_rot = new BigMatrix();
    var offset_rot = new BigMatrix();
    var colour = new Vector([0, 0.4, 1]);

    var circle_0 = circle(n_circle); // original circle
    var circle_prev = trans.times(circle_0); // previous circle

    for (var i = 1; i <= n_loops; i++) {
        var frac = i/n_loops;

        // offset each circle of points so we can make triangles between them
        offset_rot.to_rotation(frac * Math.PI, 1, 2);
        // a half rotation like in a mobius strip
        mobius_rot.to_rotation(frac * Math.PI, 2, 4);
        // if we didn't do mobius_rot we would get a torus
        torus_rot.to_rotation(frac * 2*Math.PI, 2, 3);
        // only torus_rot acts on coordinate 3, changing it continuously, so the surface
        // never intersects itself

        var transform = torus_rot.times(trans).times(mobius_rot).times(offset_rot);
        var circle_i = transform.times(circle_0);
        loops[i-1] = triangle_loop(circle_prev, circle_i, colour);
        circle_prev = circle_i;
    }

    return loops.flatten();
}

// circle with radius 1 on the 1-2 plane
function circle(n) {
    var p = new Array(n);
    var r = new Matrix(3, 3);
    p[0] = new Vector([1, 1, 0]);
    for (var i = 1; i < n; i++)
        p[i] = r.to_rotation(i/n * 2*Math.PI, 1, 2).times(p[0]);
    return p;
}

// make a closed loop of triangles from two offset loops of Vectors
function triangle_loop(pt_loop_0, pt_loop_1, colour) {
    var p = pt_loop_0.zip(pt_loop_1).flatten();
    var triangles = new Array(p.length);
    triangles[0] = triangle(p[p.length-2], p[p.length-1], p[0], colour);
    triangles[1] = triangle(p[p.length-1], p[0], p[1], colour);
    for (var i = 2; i < p.length; i++)
        triangles[i] = triangle(p[i], p[i-1], p[i-2], colour);

    return triangles;
}

function triangle(a, b, c, colour) {
    var plane = new Space([a.point_minus(c), b.point_minus(c)]);
    return [a, b, c].map(function(loc) {
        var v = new Vertex();
        v.loc = loc.copy();
        v.tangent = plane.copy();
        v.colour = colour.copy();
        return v;
    });
}
