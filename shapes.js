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
    var m = new Model(triangles);
    m.particle.center = new Vector(
        _.map(_.range(n), function() { return -.5;}), 0);
    return m;
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
    a[0] = new Vector(a[0], 1);
    a[1] = new Vector(a[1], 1);
    a[2] = new Vector(a[2], 1);
    a = new Triangle(a, colour);

    var b = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    b[0][i] = b[0][j] = 1;
    b[1][i] = 1;
    b[2][j] = 1;
    b[0] = new Vector(b[0], 1);
    b[1] = new Vector(b[1], 1);
    b[2] = new Vector(b[2], 1);
    b = new Triangle(b, colour);

    return [a, b];
}

function _side_colour(i) {
    return new Colour(i * 0.25, 0.75, 1);
}

// returns <n_loops> loops of <2*n_circle> triangles
function klein_bottle(n_circle, n_loops) {
    assert(n_loops % 2 == 0); // limitated by the way this is coded
    var loops = new Array(n_loops);
    var trans = newTranslation(new Vector([0, 2], 0));
    var adjust_rot = newRotation(1, 2, Math.PI / n_circle);
    var circle_template = circle(n_circle);
    var c_prev = trans.times(circle_template);
    
    for (var i = 1; i <= n_loops; i++) {
        var frac = i/n_loops;
        var mobius_rot = newRotation(2, 4, frac * Math.PI);
        var torus_rot = newRotation(2, 3, frac * 2*Math.PI);
        var transform = torus_rot.times(trans).times(mobius_rot);
        if (i % 2)
            transform = transform.times(adjust_rot);
        var c_i = transform.times(circle_template);
        if (i % 2)
            var points = _.flatten(_.zip(c_prev, c_i));
        else
            var points = _.flatten(_.zip(c_i, c_prev));
        loops[i-1] = triangle_loop(points, new Colour(0, 0, 0.75));
        c_prev = c_i;
    }

    return _.flatten(loops);
}

function _klein_colour(frac) {
    return new Colour(frac, 0.75, 1).hsv2rgb();
}

// circle with radius 1 on the 1-2 plane
function circle(n) {
    var p = new Array(n);
    p[0] = new Vector([1], 1);
    for (var i = 1; i < n; i++)
        p[i] = newRotation(1, 2, i/n * 2*Math.PI).times(p[0]);
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
