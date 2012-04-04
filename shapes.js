function compass_model(dims, circle_res) {
    var compass = new Model();
    var num_discs = dims*(dims-1)/2;
    for (var i=0, axis_1=1; axis_1 <= dims; axis_1++) {
        for (var axis_2=1; axis_2 < axis_1; axis_2++, i++) {
            var fill_colour = new Colour([i/num_discs, .4, 1]).hsv2rgb();
            var border_colour = new Colour([i/num_discs, .6, 1]).hsv2rgb();
            var disc = disc_model(circle_res, fill_colour, border_colour);
            disc.transforms.a = [new LazyTransform(
                new BigMatrix().to_swap(2, axis_2).times(
                    new BigMatrix().to_swap(1, axis_1)))];
            compass.children.push(disc);
        }
    }
    return compass;
}

// planer disc with radius 1 on the 1-2 plane
function disc_model(n, fill_colour, border_colour) {
    var template = new Vertex(new Vector([1, 1, 0]), border_colour);
    template.tangent.expand(new Vector([0, 1]));

    var border = new Lines('LINE_LOOP');
    border.vertices = vertex_circle(n, template);
    
    var fill = new Primitives('TRIANGLE_FAN');
    template.colour = fill_colour;
    template.tangent.expand(new Vector([0, 0, 1]));
    fill.vertices = vertex_circle(n, template, true);
    fill.vertices.unshift(fill.vertices[0].copy()); // add the center point
    fill.vertices[0].loc.a = [1];

    return new Model([fill, border]); // draw border on top of fill
}

// circle on the 1-2 plane
function vertex_circle(num_vertices, template, closed) {
    var r = new BigMatrix();
    return $R(0, num_vertices, !closed).map(function(i) {
        return template.times_left(r.to_rotation(i/num_vertices, 1, 2));
    });
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

    var template = new Vertex(new Vector([1, 1, 0]), colour);
    template.tangent.expand([
        new Vector([0, 0, 1]),
        new Vector([0, 0, 0, 1])
    ]);
    var circle_0 = vertex_circle(n_circle, template); // original circle
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

function circle(n, colour) {
    var vertices = new Array(n);

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
