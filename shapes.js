function hypercube(n) { // only works for n >= 2 (because polygons are 2d)
    var triangles = [];
    var ps = permutations(n - 2);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            for (var P = 0; P < ps.length; P++) {
                var p = ps[P].slice();
                p.splice(j, 0, 0);
                p.splice(i, 0, 0);
                var face = _hypercube_face(p, j, i);
                for (var f = 0; f < face.length; f++) {
                    triangles.push(face[f]);
                }
            }
        }
    }
    return new Model(triangles);
}

// array of {0,1}^n (not actually permutations)
// maybe better to convert ints 0-2^n-1 to binary
function _permutations(n) {
    if (n == 0) {
        return [[]];
    }
    var p = permutations(n - 1);
    var q = [];
    for (var i = 0; i < p.length; i++) {
        var a = p[i].slice();
        a.push(0);
        q.push(a);
        a = a.slice();
        a[a.length - 1] = 1;
        q.push(a);
    }
    return q;
}

function _hypercube_face(v, i, j) {
    var colour = _side_colour(i).plus(_side_colour(j)).divide(2).hsv2rgb();
    assert(v[i] == 0);
    assert(v[j] == 0);
    var a = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    a[1][i] = 1;
    a[2][j] = 1;
    a[0] = new Vector([1, a[0]]);
    a[1] = new Vector([1, a[1]]);
    a[2] = new Vector([1, a[2]]);
    a = new Triangle(a, colour);

    var b = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    b[0][i] = b[0][j] = 1;
    b[1][i] = 1;
    b[2][j] = 1;
    b[0] = new Vector([1, b[0]]);
    b[1] = new Vector([1, b[1]]);
    b[2] = new Vector([1, b[2]]);
    b = new Triangle(b, colour);

    return [a, b];
}

function _side_colour(i) {
    return new Colour(i * 0.25, 0.75, 1);
}

// Models a Klein bottle to look like a cross between a torus and a Mobius strip.
// n_circle: Number of points in the small radius (like in a torus).
// n_loops: Number of loops of triangles. The model will have small holes
//          unless n_loops is even.
// returns <2*n_circle*n_loops> triangles
function klein_bottle(n_circle, n_loops) {
    var loops = new Array(n_loops);
    var trans = new InfiniteMatrix().to_translation(new Vector([0, 0, 2]));
    var torus_rot = new InfiniteMatrix();
    var mobius_rot = new InfiniteMatrix();
    var offset_rot = new InfiniteMatrix();

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
        var points = _.flatten(_.zip(circle_prev, circle_i));
        loops[i-1] = triangle_loop(points, new Colour(0, 0.4, 1));
        circle_prev = circle_i;
    }

    return _.flatten(loops);
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

// make a closed loop of triangles
// like a closed version of a GL triangle strip
function triangle_loop(points, colour) {
    var p = points;
    var triangles = new Array(p.length);
    triangles[0] = new Triangle([p[p.length-2], p[p.length-1], p[0]], colour);
    triangles[1] = new Triangle([p[p.length-1], p[0], p[1]], colour);
    for (var i = 2; i < p.length; i++)
        triangles[i] = new Triangle([p[i], p[i-1], p[i-2]], colour);
    return triangles;
}
