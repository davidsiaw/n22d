// circle of <n> Vertexes on the 1-2 plane
function circle(n) {
    var v = new FourD.Vertex([1, 1]);
    v.tangent.add([[0, 0, 1], [0, 0, 0, 1]]);
    var r = new BigMatrix();
    return $R(0, n, true).map(function(i) {
        return r.to_rotation(i/n, 1, 2).times(v);
    });
}

// make a closed loop of triangles from two offset loops of Vertex's
function triangle_loop(pt_loop_0, pt_loop_1) {
    var p = pt_loop_0.zip(pt_loop_1).flatten();
    var triangles = new Array(p.length);
    triangles[0] = [p[p.length-2], p[p.length-1], p[0]];
    triangles[1] = [p[p.length-1], p[0], p[1]];
    for (var i = 2; i < p.length; i++)
        triangles[i] = [p[i], p[i-1], p[i-2]];

    return triangles;
}

// Models a Klein bottle to look like a cross between a torus and a Mobius strip.
// n_circle: Number of points in the small radius (like in a torus).
// n_loops: Number of loops of triangles. The model will have small holes
//          unless n_loops is even.
// returns <2*n_circle*n_loops> triangles
function klein_bottle(n_circle, n_loops) {
    var loops = new Array(n_loops);
    var trans = new BigMatrix().to_translation(new Vector([1, 0, 2/3]));
    var torus_rot = new BigMatrix();
    var mobius_rot = new BigMatrix();
    var offset_rot = new BigMatrix();

    var circle_0 = new BigMatrix().to_scale([1, 1/3, 1/3]).times(circle(n_circle));
    var circle_prev = trans.times(circle_0);

    for (var i = 1; i <= n_loops; i++) {
        var frac = i/n_loops;

        // offset each circle of points so we can make triangles between them
        offset_rot.to_rotation(frac/2, 1, 2);
        // a gradual half rotation like in a mobius strip
        mobius_rot.to_rotation(frac/2, 2, 4);
        // if we didn't do mobius_rot we would get a torus
        torus_rot.to_rotation(frac, 2, 3);
        // only torus_rot acts on coordinate 3, changing it continuously, so
        // the surface never intersects itself despite appearances

        var transform = torus_rot.times(trans).times(mobius_rot).times(offset_rot);
        var circle_i = transform.times(circle_0);
        loops[i-1] = triangle_loop(circle_prev, circle_i);
        circle_prev = circle_i;
    }

    return loops.flatten();
}
