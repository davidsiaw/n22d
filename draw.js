// just the 2d kind
function Plane(p, a, b) {
    this.p = p;
    // orthonormal basis
    this.a = a = a.normalize();
    this.b = b.minus(b.proj(a)).normalize();
}

// cos(angle between light and surface normal)
Plane.prototype.diffuse_factor = function(light) {
    var normal = light.minus(light.proj(this.a)).minus(light.proj(this.b));
    return normal.normalize().dot(light.normalize());
    // later will have to worry about light being behind the surface
};

function Triangle(vs, colour) {
    assert(vs.length == 3);
    this.vs = vs;
    this.colour = colour
}

Triangle.prototype.transform = function(transform) {
    var vs = new Array(this.vs.length);
    for (var i = 0; i < vs.length; i++) {
        vs[i] = transform.times(this.vs[i]);
    }
    return new Triangle(vs, this.colour);
};

Triangle.prototype.plane = function() {
    var a = this.vs[0].minus(this.vs[2]);
    var b = this.vs[1].minus(this.vs[2]);
    return new Plane(this.vs[0], a, b);
};

// array of {0,1}^n (not actually permutations)
// maybe better to convert ints 0-2^n-1 to binary
function permutations(n) {
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

function Model(triangles) {
    this.particle = new Particle();
    this.triangles = triangles;
}

Model.prototype.vertex_buffer = function() {
    var transform = this.particle.transformation();
    var light = new Vector([1]); // light at origin
    var buffer = new Float32Array(4 * 3 * this.triangles.length);
    var i = 0;
    for (var j = 0; j < this.triangles.length; j++) {
        var triangle = this.triangles[j].transform(transform);
        var plane = triangle.plane();
        for (var k = 0; k < 3; k++) {
            for (var l = 1; l < 4; l++) {
                buffer[i] = triangle.vs[k].a[l];
                i++;
            }
            buffer[i] = plane.diffuse_factor(triangle.vs[k].minus(light));
            i++;
        }
    }
    return buffer;
};

function hypercube(n) { // only works for n >= 2 (because it makes polygons)
    var triangles = [];
    var ps = permutations(n - 2);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            for (var P = 0; P < ps.length; P++) {
                var p = ps[P].slice();
                p.splice(j+1, 0, 0);
                p.splice(i+1, 0, 0);
                var face = hypercube_face(p, j+1, i+1);
                for (var f = 0; f < face.length; f++) {
                    triangles.push(face[f]);
                }
            }
        }
    }
    return new Model(triangle);
}

// need to make Vertex objects and make them points
function hypercube_face(v, i, j) {
    assert(v[i] == 0);
    assert(v[j] == 0);
    var a = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    a[1][i] = 1;
    a[2][j] = 1;
    a = new Triangle(a, new Colour(0, 0, 0));

    var b = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    b[0][i] = b[0][j] = 1;
    b[1][i] = 1;
    b[2][j] = 1;
    b = new Triangle(b, new Colour(0, 0, 0));

    return [a, b];
}
