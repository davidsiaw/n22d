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

Plane.prototype.unproj = function(p) {
    var m = newMatrixHW(2, 2);
    m.a[0][0] = p.a[3]*this.a.a[1] - p.a[1]*this.a.a[3];
    m.a[0][1] = p.a[3]*this.b.a[1] - p.a[1]*this.b.a[3];
    m.a[1][0] = p.a[3]*this.a.a[2] - p.a[2]*this.a.a[3];
    m.a[1][1] = p.a[3]*this.b.a[2] - p.a[2]*this.b.a[3];
    var v = new Vector(new Array(2));
    v.a[0] = p.a[1]*this.p.a[3] - p.a[3]*this.p.a[1];
    v.a[1] = p.a[2]*this.p.a[3] - p.a[3]*this.p.a[2];
    m.solve(v);
    return this.p.plus(this.a.times(v.a[0])).plus(this.b.times(v.a[1]));
};

function Line(a, b) {
    this.a = a;
    this.ab = b.minus(a);
}

Line.prototype.on_same_side = function(p, q) {
    // I think doesn't work when three of the points form a line
    var w = this.ab.a[2]*(p.a[1]-this.a.a[1]) - this.ab.a[1]*(p.a[2]-this.a.a[2]);
    var v = this.ab.a[2]*(q.a[1]-this.a.a[1]) - this.ab.a[1]*(q.a[2]-this.a.a[2]);
    return w*v >= 0;
}

function BoundingBox(l, t, r, b) {
    this.l = l;
    this.t = t;
    this.r = r;
    this.b = b;
}

BoundingBox.prototype.intersect = function(box) {
    this.l = Math.max(this.l, box.l);
    this.t = Math.max(this.t, box.t);
    this.r = Math.min(this.r, box.r);
    this.b = Math.min(this.b, box.b);
};

BoundingBox.prototype.shift = function(dx, dy) {
    this.l += dx;
    this.t += dy;
    this.r += dx;
    this.b += dy;
};

BoundingBox.prototype.copy = function() {
    return new BoundingBox(this.l, this.t, this.r, this.b);
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

Triangle.prototype.perspective_proj = function(plane_z) {
    var vs = new Array(3);
    for (var i = 0; i < this.vs.length; i++) {
        vs[i] = this.vs[i].perspective_proj(plane_z);
    }
    return new Triangle(vs, this.colour);
}

Triangle.prototype.plane = function() {
    var a = this.vs[0].minus(this.vs[2]);
    var b = this.vs[1].minus(this.vs[2]);
    return new Plane(this.vs[0], a, b);
};

Triangle.prototype.bounding_box = function() {
    var vs = this.vs;
    var l = Math.floor(Math.min(vs[0].a[1], vs[1].a[1], vs[2].a[1]));
    var t = Math.floor(Math.min(vs[0].a[2], vs[1].a[2], vs[2].a[2]));
    var r = Math.ceil(Math.max(vs[0].a[1], vs[1].a[1], vs[2].a[1]));
    var b = Math.ceil(Math.max(vs[0].a[2], vs[1].a[2], vs[2].a[2]));
    return new BoundingBox(l, t, r, b);
};

Triangle.prototype.contains = function(p) {
    return new Line(this.vs[0], this.vs[1]).on_same_side(this.vs[2], p) &&
           new Line(this.vs[0], this.vs[2]).on_same_side(this.vs[1], p) &&
           new Line(this.vs[1], this.vs[2]).on_same_side(this.vs[0], p);
};

Triangle.prototype.draw = function(canvas, unprojected) {
    // TODO correct on triangle borders?
    var box = this.bounding_box();
    var cbox = canvas.bounding_box.copy();
    cbox.shift(-canvas.width/2, -canvas.height/2);
    box.intersect(cbox);

    var plane = unprojected.plane();
    var p = new Vector([0, 0, 0, plane.p.a[3]]);
    for (p.a[1] = box.l; p.a[1] < box.r; p.a[1]++) {
       for (p.a[2] = box.t; p.a[2] < box.b; p.a[2]++) {
            // yeah this is dumb. I'm lazy and I don't like doing things the
            // normal way (plane sweep or whatever)
            if (this.contains(p)) {
                // passing p like this hardcodes a light source at the same
                // position as the camera
                var x = p.a[1] + canvas.width/2;
                var y = p.a[2] + canvas.height/2;
                var un = plane.unproj(p);
                var diffuse_factor = plane.diffuse_factor(p);
                canvas.draw(x, y, un.a[3], this.colour.times(diffuse_factor));
            }
        }
    }
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

Model.prototype.draw = function(canvas, plane_z) {
    var transform = this.particle.transformation();
    for (var i = 0; i < this.triangles.length; i++) {
        var t = this.triangles[i].transform(transform);
        t.perspective_proj(plane_z).draw(canvas, t);
    }
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
