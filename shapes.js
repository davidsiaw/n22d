function axes_model(nd, length) {
    var vertices = [];
    for (var i = 0; i < nd; i++) {
        var colour = new Colour([i/nd, 1, .75]).hsv2rgb();
        var start = new Vector(new Array(i+1)).to_0();
        start.a[0] = 1;
        start.a[i+1] = -length;
        vertices.push(new Vertex(start, colour));
        var end = new Vector(new Array(i+1)).to_0();
        end.a[0] = 1;
        end.a[i+1] = length;
        vertices.push(new Vertex(end, colour));
    }
    return new Primitives('LINES', vertices);
}

function compass_model(dims, disc_res) {
    var compass = new Model();
    for (var i = 0; i < dims; i++) {
        var colour_i = new Colour([i/dims, 1, .75]).hsv2rgb();
        for (var j = 0; j < i; j++) {
            var colour_j = new Colour([j/dims, 1, .75]).hsv2rgb();
            var colour = colour_i.plus(colour_j).divide(2);
            var disc = disc_model(disc_res, colour);
            disc.transforms.a.push(new LazyTransform(
                new BigMatrix().to_swap(1, j+1).times(new BigMatrix().to_swap(2, i+1))));
            compass.children.push(disc);
        }
    }
    return compass;
}

// planer disc with radius 1 on the 1-2 plane (as a triangle strip)
function disc_model(n, colour) {
    var m = new Primitives('TRIANGLE_FAN');
    m.vertices[0] = new Vertex(new Vector([1, 1, 0]), colour);
    m.vertices[0].tangent.expand([
        new Vector([0, 1]),
        new Vector([0, 0, 1])
    ]);

    var r = new BigMatrix();
    for (var i = 1; i < n; i++) {
        r.to_rotation(i/n, 1, 2);
        m.vertices.push(m.vertices[0].times_left(r));
    }
    m.vertices.push(m.vertices[0].copy()); // close the fan
    m.vertices.unshift(m.vertices[0].copy()); // add the center point
    m.vertices[0].loc.a = [1];
    return m;
}

// Models a Klein bottle to look like a cross between a torus and a Mobius strip.
// n_circle: Number of points in the small radius (like in a torus).
// n_loops: Number of loops of triangles. The model will have small holes
//          unless n_loops is even.
// returns <2*n_circle*n_loops> triangles
function klein_bottle_model(n_circle, n_loops) {
    var loops = new Array(n_loops);
    var trans = new BigMatrix().to_translation(new Vector([0, 0, 2]));
    var torus_rot = new BigMatrix();
    var mobius_rot = new BigMatrix();
    var offset_rot = new BigMatrix();
    var colour = new Vector([0, 0.4, 1]);

    var circle_0 = circle(n_circle, colour); // original circle
    var circle_prev = circle_0.map(function(v) { // previous circle
        return v.times_left(trans);
    });

    for (var i = 1; i <= n_loops; i++) {
        var frac = i/n_loops;

        // offset each circle of points so we can make triangles between them
        offset_rot.to_rotation(frac/2, 1, 2);
        // a half rotation like in a mobius strip
        mobius_rot.to_rotation(frac/2, 2, 4);
        // if we didn't do mobius_rot we would get a torus
        torus_rot.to_rotation(frac, 2, 3);
        // only torus_rot acts on coordinate 3, changing it continuously, so the surface
        // never intersects itself

        var transform = torus_rot.times(trans).times(mobius_rot).times(offset_rot);
        var circle_i = circle_0.map(function(v) {
            return v.times_left(transform);
        });
        loops[i-1] = triangle_loop(circle_prev, circle_i);
        circle_prev = circle_i;
    }

    return new Primitives('TRIANGLES', loops.flatten());
}

// circle with radius 1 on the 1-2 plane
function circle(n, colour) {
    var vertices = new Array(n);
    vertices[0] = new Vertex(new Vector([1, 1, 0]), colour);
    vertices[0].tangent.expand([
        new Vector([0, 0, 1]),
        new Vector([0, 0, 0, 1])
    ]);

    var r = new BigMatrix();
    for (var i = 1; i < n; i++) {
        r.to_rotation(i/n, 1, 2);
        vertices[i] = vertices[0].times_left(r);
    }
    return vertices;
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
