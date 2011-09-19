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

Matrix.prototype.rowtimes = function(row, constant) {
    for (var i = 0; i < this.a[row].length; i++)
        this.a[row][i] *= constant;
};

Matrix.prototype.rowminus = function(a, b) {
    for (var i = 0; i < this.a[a].length; i++)
        this.a[a][i] -= this.a[b][i];
};

// only 2x2 :)
// trashes both this and v :)
Matrix.prototype.solve = function(v) {
    assert(this.rows() == 2);
    assert(this.cols() == 2);
    assert(v.a.length == 2);
    v.a[0] /= this.a[0][0];
    this.rowtimes(0, 1/this.a[0][0]);
    v.a[1] /= this.a[1][0];
    this.rowtimes(1, 1/this.a[1][0]);
    this.rowminus(1, 0);
    v.a[1] /= this.a[1][1];
    v.a[0] -= this.a[0][1]*v.a[1];
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
    return this._plus(v);
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
