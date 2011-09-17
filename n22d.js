// super: sup(this).method.call(this, args...);
function sup(t) {
    return t.prototype.constructor.prototype;
}
function inherit(Cons, prototype) {
    Cons.prototype = prototype;
    Cons.prototype.constructor = Cons;
}

function go() {
    var canvas = new Canvas(document.getElementById('c'));
    var t = new Triangle([
            new Vector([1, -100, 100, 20]),
            new Vector([1, 10000, 10000, 2000]),
            new Vector([1, 0, -1000, 200])
        ],
        new Colour(0, 0, 255)
    )
    canvas.fill(new Colour(255, 255, 255));
    t.perspective_proj(20).draw(canvas, t);
    canvas.put();
}

function Canvas(canvas_el) {
    this.canvas_el = canvas_el;
    this.ctx = canvas_el.getContext('2d');
    this.get();
}

Canvas.prototype.get = function() {
    this.width = this.canvas_el.width;
    this.height = this.canvas_el.height;
    this.bounding_box = new BoundingBox(0, 0, this.canvas_el.width, this.canvas_el.height);
    this.canvasData = this.ctx.getImageData(0, 0, this.canvas_el.width, this.canvas_el.height);
}

Canvas.prototype.put = function() {
    this.ctx.putImageData(this.canvasData, 0, 0);
};

Canvas.prototype.draw = function(x, y, colour) {
    assert(x >= 0 && x < this.width);
    assert(y >= 0 && y < this.height);
    var idx = (x + y * this.width) * 4;
    this.canvasData.data[idx + 0] = colour.a[1];
    this.canvasData.data[idx + 1] = colour.a[2];
    this.canvasData.data[idx + 2] = colour.a[3];
    this.canvasData.data[idx + 3] = 255;
};

Canvas.prototype.fill = function(colour) {
    for (var x = 0; x < this.width; x++)
        for (var y = 0; y < this.height; y++)
            this.draw(x, y, colour);
};

function Colour(r, g, b) {
    if (arguments.length == 1)
        this.a = arguments[0];
    else
        this.a = [0, r, g, b];
}
inherit(Colour, new Vector(null));

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
// a=[0, ...] for a vector and a=[1, ...] for a point or you can pass [...]
// and specify type
function Vector(a, type) {
    this.a = a;
    if (type !== undefined) {
        a.unshift(type);
    }
}

Vector.prototype.isV = function() {
    return this.a[0] === 0;
};

Vector.prototype.isP = function() {
    return this.a[0] === 1;
};

Vector.prototype.dot = function(v) {
    assert(this.isV() && v.isV());
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
    assert(this.isV() || v.isV());
    this._plus(v);
}
Vector.prototype._plus = function(v) {
    if (v.a.length > this.a.length) {
        return v.plus(this);
    }

    var r = this.copy();
    for (var i = 0; i < v.a.length; i++) {
        r.a[i] += v.a[i];
    }
    return r;
};

Vector.prototype.minus = function(o) {
    assert(this.isP() || o.isV());
    return new this.constructor(this._plus(o._times(-1)).a);
};

Vector.prototype.proj = function(onto) {
    return onto.times(this.dot(onto) / onto.dot(onto));
};

Vector.prototype.perspective_proj = function(projection_plane_z) {
    assert(this.isP());
    var f = projection_plane_z / this.a[3];
    return new Vector([1, f*this.a[1], f*this.a[2], projection_plane_z]);
};

Vector.prototype.copy = function() {
    return new this.constructor(this.a.slice());
};

Vector.prototype.times = function(constant) {
    assert(this.isV());
    return this._times(constant);
}
Vector.prototype._times = function(constant) {
    var r = this.copy();
    for (var i = 0; i < r.a.length; i++) {
        r.a[i] *= constant;
    }
    return r;
};

Vector.prototype.divide = function(constant) {
    return this.times(1/constant);
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
    // TODO z-buffer, correct on triangle borders?
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
                var diffuse_factor = plane.diffuse_factor(p);
                var x = p.a[1] + canvas.width/2;
                var y = p.a[2] + canvas.height/2;
                canvas.draw(x, y, this.colour.times(diffuse_factor));
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
