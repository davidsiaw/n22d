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
function klein_bottle(n_circle, n_loops) {
    var loops = new Array(n_loops);
    var trans = new BigMatrix().to_translation(new Vector([0, 0, 2]));
    var torus_rot = new BigMatrix();
    var mobius_rot = new BigMatrix();
    var offset_rot = new BigMatrix();
    var colour = new Vector([0, 0.3, .8, .8]);

    var template = new Vertex(new Vector([1, 1, 0]), colour);
    template.tangent.add([new Vector([0, 0, 1]), new Vector([0, 0, 0, 1])]);
    var circle_0 = vertex_circle(n_circle, template); // original circle
    var circle_prev = circle_0.map(function(v) { // previous circle
        return v.times_left(trans);
    });

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
        var circle_i = circle_0.map(function(v) {
            return v.times_left(transform);
        });
        loops[i-1] = triangle_loop(circle_prev, circle_i);
        circle_prev = circle_i;
    }

    return loops.flatten();
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

// radius 1, centered at origin
function tetrahedron() {
    var points = [new Vector([1, 1])];
    var r = new BigMatrix().to_rotation(Math.acos(1/3)/2/Math.PI);
    points.push(r.times(points[0]));
    r.to_rotation(1/3, 2, 3);
    points.push(r.times(points[1]));
    points.push(r.times(points[2]));
    var triangles = [];
    for (var i = 0; i < 4; i++)
        for (var j = 0; j < 4; j++)
            if (i != j)
                triangles.push(points[i]);
    return triangles;
}

// http://www.opengl.org.ru/docs/pg/0208.html
function icosahedron() {
    var x = .525731112119133606;
    var z = .850650808352039932;
     
    var vertices = [    
       [-x, 0, z], [x, 0, z], [-x, 0, -z], [x, 0, -z],
       [0, z, x], [0, z, -x], [0, -z, x], [0, -z, -x],
       [z, x, 0], [-z, x, 0], [z, -x, 0], [-z, -x, 0]
    ];

    return [
       [0,4,1], [0,9,4], [9,5,4], [4,5,8], [4,8,1],    
       [8,10,1], [8,3,10], [5,3,8], [5,2,3], [2,7,3],    
       [7,10,3], [7,6,10], [7,11,6], [11,0,6], [0,1,6], 
       [6,1,10], [9,0,11], [9,11,2], [9,2,5], [7,2,11]
    ].map(function(vs) { return vs.map(function(i) {
        return new Vertex(new Vector(vertices[i]));
    }); });
}

function sphere_subdivide(sphere, n) {
    var s = sphere;
    for (var i = 0; i < n; i++) {
        s = s.map(function (t) {
            var a = t[0], b = t[1], c = t[2];
            var d = new Vertex(a.loc.plus(b.loc).normalized(), a.colour);
            var e = new Vertex(b.loc.plus(c.loc).normalized(), b.colour);
            var f = new Vertex(a.loc.plus(c.loc).normalized(), c.colour);
            return [[d, e, f], [a, d, f], [b, d, e], [c, e, f]].map(function(t) {
                return t.map(function(v) {
                    return v.copy();
                });
            });
        });
        s = [].concat.apply([], s);
    }
    return s;
}

function sphere_finish(s) {
    var R3 = new Space([new Vector([1]), new Vector([0,1]), new Vector([0,0,1])]);
    return s.flatten().map(function(v) {
        v = v.copy();
        v.tangent = R3.minus(new Space([v.loc]));
        v.tangent.basis[0].a.unshift(0);
        v.tangent.basis[1].a.unshift(0);
        assert(v.tangent.basis.length == 2);
        v.loc.a.unshift(1);
        return v;
    });
}
