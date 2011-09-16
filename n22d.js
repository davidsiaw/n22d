function go() {
    var canvas = document.getElementById('c');
    var ctx = canvas.getContext('2d');
    var canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (var x = 0; x < canvasData.width; x++) {
        for (var y = 0; y < canvasData.height; y++) {
            // Index of the pixel in the array
            var idx = (x + y * canvas.width) * 4;
            canvasData.data[idx + 0] = 255;
            canvasData.data[idx + 1] = 255;
            canvasData.data[idx + 2] = 255;
            canvasData.data[idx + 3] = 255;
        }
    }

    var draw_fn = function(point, surface_colour) {
        var x = point.a[1] + canvas.width/2;
        var y = point.a[2] + canvas.height/2;
        if (x < 0 || x >= canvas.width)
            return;
        if (y < 0 || y >= canvas.height)
            return;
        var idx = (x + y * canvas.width) * 4;
        canvasData.data[idx + 0] = surface_colour.a[0];
        canvasData.data[idx + 1] = surface_colour.a[1];
        canvasData.data[idx + 2] = surface_colour.a[2];
        canvasData.data[idx + 3] = 255;
    };
    var t = new Triangle([
            new Vector([1, -1000, 1000, 200]),
            new Vector([1, 1000, 1000, 200]),
            new Vector([1, 0, -1000, 200])
        ],
        new Colour(0, 0, 255)
    )
    t.perspective_project(20).draw(draw_fn, t);
    ctx.putImageData(canvasData, 0, 0);
}

function Colour(r, g, b) {
    this.a = [r, g, b];
}
// I guess this means Vector methods should use this.constructor()
Colour.prototype = new Vector([0]);

function Matrix(a) {
    this.a = a;
    assert(this.rows());
    assert(this.cols());
}

// just put this in the constructor
function newMatrixHW(h, w) {
    var r = new Array(h);
    for (var i = 0; i < h; i++) {
        r[i] = new Array(w);
    }
    return new Matrix(r);
}

function newMatrixI(h, w) {
    var m = newMatrixHW(h, w);
    for (var i = 0; i < h; i++) {
        for (var j = 0; j < w; j++) {
            m.a[i][j] = i==j ? 1 : 0;
        }
    }
    return m
}

Matrix.prototype.rows = function() {
    return this.a.length;
};

Matrix.prototype.cols = function() {
    return this.a[0].length;
};

Matrix.prototype.times = function(o) {
    if (o instanceof Matrix) {
        assert(this.cols() == o.rows());
        var m = newMatrixHW(this.rows(), o.cols());
        var r = m.a;
        for (var i = 0; i < r.length; i++) {
            for (var j = 0; j < r[0].length; j++) {
                r[i][j] = 0;
                for (var k = 0; k < o.length; k++) {
                    r[i][j] += this.a[i][k] * o.a[k][j];
                }
            }
        }
        return m;
    } else if (o instanceof Vector) {
        assert(this.cols() == o.a.length);
        var a = new Array(this.a.length);
        for (var i = 0; i < this.a.length; i++) {
            a[i] = 0;
            for (var j = 0; j < o.a.length; j++) {
                a[i] += this.a[i][j] * o.a[j];
            }
        }
    } else {
        assert(false);
    }
};

// obviously not actually infinite
// acts as I outside the explicitly defined area
function InfiniteMatrix(matrix) {
    this.m = matrix;
}

function newTranslation(vector) {
    var m = newMatrixI(vector.a.length + 1, 1);
    m.a[0][0] = 1;
    for (var i = 0; i < vector.a.length; i++) {
        m.a[i+1][0] = vector.a[i];
    }
    return new InfiniteMatrix(m);
}

InfiniteMatrix._squarify = function(matrix, size) {
    var r = newMatrixI(size, size);
    var copy_h = Math.min(size, matrix.rows());
    var copy_w = Math.min(size, matrix.cols());
    for (var i = 0; i < copy_h; i++) {
        for (var j = 0; j < copy_w; j++) {
            r.a[i][j] = matrix.a[i][j];
        }
    }
    return r;
};

InfiniteMatrix.prototype.times = function(o) {
    if (o instanceof InfiniteMatrix) {
        var size = Math.max(this.a.rows(), this.a.cols(), o.a.rows(), o.a.cols());
        var a = InfiniteMatrix._squarify(this.m, size);
        var b = InfiniteMatrix._squarify(o.m, size);
        return new InfiniteMatrix(a.times(b));
    } else {
        var a = InfiniteMatrix._squarify(o.a.length);
        return a.times(o);
    }
};

// "infinite" (0 outside of explicitly defined area)
function Vector(a) {
    this.a = a.slice();
}

Vector.prototype.dot = function(v) {
    var r = 0;
    for (var i = 0; i < Math.min(this.a.length, v.a.length); i++) {
        r += this.a[i] * v.a[i];
    }
    return r;
};

// l2 norm
Vector.prototype.norm = function() {
    return Math.sqrt(this.dot(this));
};

Vector.prototype.normalize = function() {
    return this.divide(this.norm());
};

Vector.prototype.plus = function(v) {
    if (v.a.length > this.a.length) {
        return v.plus(this);
    }
    var r = new Vector(this.a);
    for (var i = 0; i < v.a.length; i++) {
        r.a[i] += v.a[i];
    }
    return r;
};

Vector.prototype.minus = function(v) {
    return this.plus(v.negate());
};

Vector.prototype.negate = function() {
    return this.times(-1);
};

Vector.prototype.proj = function(onto) {
    return onto.times(this.dot(onto) / onto.dot(onto));
};

Vector.prototype.times = function(constant) {
    var r = new Vector(this.a);
    for (var i = 0; i < r.a.length; i++) {
        r.a[i] *= constant;
    }
    return r;
};

Vector.prototype.divide = function(constant) {
    var r = new Vector(this.a);
    for (var i = 0; i < r.a.length; i++) {
        r.a[i] /= constant;
    }
    return r;
};

Vector.prototype.perspective_project = function(plane_z) {
    var v = this.times(plane_z / this.a[3]);
    v.a[0] = 1;
    return v;
};

Vector.prototype.equals = function(v) {
    // not consistent with Vector's "infiniteness":
    if (this.a.length != v.a.length)
        return false;
    for (var i = 0; i < this.a.length; i++)
        if (this.a[i] != v.a[i])
            return false;
    return true;
};

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

Triangle.prototype.perspective_project = function(plane_z) {
    var vs = new Array(3);
    for (var i = 0; i < this.vs.length; i++) {
        vs[i] = this.vs[i].perspective_project(plane_z);
    }
    return new Triangle(vs, this.colour);
}

Triangle.prototype.plane = function() {
    var a = this.vs[0].minus(this.vs[2]);
    var b = this.vs[1].minus(this.vs[2]);
    return new Plane(this.vs[0], a, b);
};

Triangle.prototype.draw = function(draw_fn, unprojected) {
    var plane = unprojected.plane();
    // bounding box
    // TODO clip to canvas, z-buffer, correct on triangle borders?
    var left = Math.floor(Math.min(this.vs[0].a[1], this.vs[1].a[1], this.vs[2].a[1]));
    var right = Math.ceil(Math.max(this.vs[0].a[1], this.vs[1].a[1], this.vs[2].a[1]));
    var top_ = Math.floor(Math.min(this.vs[0].a[2], this.vs[1].a[2], this.vs[2].a[2]));
    var bottom = Math.ceil(Math.max(this.vs[0].a[2], this.vs[1].a[2], this.vs[2].a[2]));

    // wrong: need to compute the actual point we are looking at on the plane
    var p = new Vector([0, 0, 0, this.vs[0].a[3]]);
    for (p.a[1] = left; p.a[1] < right; p.a[1]++) {
        for (p.a[2] = top_; p.a[2] < bottom; p.a[2]++) {
            // yeah this is dumb. I'm lazy and I don't like doing things the
            // normal way (plane sweep or whatever)
            if (same_side(this.vs[0], this.vs[1], this.vs[2], p) &&
                same_side(this.vs[0], this.vs[2], this.vs[1], p) &&
                same_side(this.vs[1], this.vs[2], this.vs[0], p)) {
                // passing p like this hardcodes a light source at the same
                // position as the camera
                var diffuse_factor = plane.diffuse_factor(p);
                draw_fn(p, this.colour.times(diffuse_factor));
            }
        }
    }
};

function same_side(a, b, p, q) {
    var ab = b.minus(a);
    // I think doesn't work when three of the points form a line
    var w = ab.a[2]*(p.a[1]-a.a[1]) - ab.a[1]*(p.a[2]-a.a[2]);
    var v = ab.a[2]*(q.a[1]-a.a[1]) - ab.a[1]*(q.a[2]-a.a[2]);
    return w*v >= 0;
}

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
    this.triangles = triangles;
    this.position = new Vector([]);
    this.rotation = new InfiniteMatrix(new Matrix([[1]]));
}

// transform all triangles for rendering
Model.transform = function(rotation) {
    var translation = newTranslation(this.position);
    var transform = rotation.times(translation.times(this.rotation));
    var new_triangles = new Array(this.triangles.length);
    for (var i = 0; i < this.triangles.length; i++) {
        new_triangles[i] = this.triangles[i].transform(transform);
    }
};

function hypercube(n) { // only works for n >= 2 (because it makes polygons)
    var triangles = [];
    var ps = permutations(n - 2);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            for (var P = 0; P < ps.length; P++) {
                var p = ps[P].slice();
                // makes these points as opposed to directions (affine space?)
                p.unshift(1);
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

function AssertException(message) {
    this.message = message;
}

AssertException.prototype.toString = function () {
  return 'AssertException: ' + this.message;
};

function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}
