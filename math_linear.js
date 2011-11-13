// wrapper to make single-arg functions transparently map over arrays
function broadcast(f) {
    return function(o) {
        if (o instanceof Array) {
            var r = new o.constructor(o.length);
            for (var i = 0; i < o.length; i++)
                r[i] = f.call(this, o[i]);
            return r;
        } else
            return f.call(this, o);
    }
}

// dimensions are constant, values are not
function Matrix(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.a = new Array(rows);
    for (var i = 0; i < rows; i++)
        this.a[i] = new Array(cols);
}

// change to the zero matrix
Matrix.prototype.to_0 = function() {
    for (var i = 0; i < this.rows; i++)
        for (var j = 0; j < this.cols; j++)
            this.a[i][j] = 0;
    return this;
}

// change to the identity matrix
Matrix.prototype.to_I = function() {
    this.to_0();
    var diag = Math.min(this.rows, this.cols);
    for (var i = 0; i < diag; i++)
        this.a[i][i] = 1;
    return this;
}

// change this to the product of two other matrices
Matrix.prototype.to_times = function(a, b) {
    assert(a.cols == b.rows);
    assert(this.rows == a.rows);
    assert(this.cols == b.cols);
    assert(this != a && this != b);
    this.to_0();
    for (var i = 0; i < this.rows; i++)
        for (var j = 0; j < this.cols; j++)
            for (var k = 0; k < a.cols; k++)
                this.a[i][j] += a.a[i][k] * b.a[k][j];
    return this;
}

Matrix.prototype.times = function(other) {
    if (other instanceof Vector) {
        var result = new other.constructor(new Array(this.rows));
    } else if (other instanceof Matrix) {
        var result = new other.constructor(this.rows, other.cols);
    } else
        assert(false);
    return result.to_times(this, other);
};

Matrix.prototype.to_translation = function(vector) {
    assert(vector.a.length == this.rows);
    this.to_I();
    for (var i = 0; i < vector.a.length; i++)
        this.a[i][0] = vector.a[i];
    this.a[0][0] = 1;
    return this;
};

// a single rotation on a plane. you can build any N-d rotation out of these
Matrix.prototype.to_rotation = function(axis_1, axis_2, angle) {
    var max_axis = Math.max(axis_1, axis_2);
    assert(this.rows > max_axis);
    assert(this.cols > max_axis);
    this.to_I();
    this.a[axis_1][axis_1] = this.a[axis_2][axis_2] = Math.cos(angle);
    this.a[axis_1][axis_2] = Math.sin(angle);
    this.a[axis_2][axis_1] = -this.a[axis_1][axis_2];
    return this;
};

// functionality copied from CanvasMatrix.js
// I didn't think through the math myself
Matrix.prototype.to_perspective = function(fov, aspect_ratio, z_near, z_far) {
    assert(this.rows == 4);
    assert(this.cols == 4);
    this.to_0();
    var cot = 1/Math.tan(fov/2);
    // puts scaled [3] onto the point normalization axis
    this.a[0][3] = -2 * z_near * z_far / (z_far - z_near);
    this.a[1][1] = cot / aspect_ratio;
    this.a[2][2] = cot;
    this.a[3][0] = -1;
    this.a[3][3] = -(z_far + z_near) / (z_far - z_near);
    return this;
}

Matrix.prototype.as_webgl_array = function() {
    assert(this.rows == 4);
    assert(this.cols == 4);
    // first row and column become last
    var a = this.a;
    return [a[1][1], a[1][2], a[1][3], a[1][0],
            a[2][1], a[2][2], a[2][3], a[2][0],
            a[3][1], a[3][2], a[3][3], a[3][0],
            a[0][1], a[0][2], a[0][3], a[0][0]];
};

// needs a better name, not actually infinite
// acts as I outside the explicitly defined area
// You don't have to pass opt_matrix if you want to use one of the to_ methods.
function InfiniteMatrix(opt_matrix) {
    this.m = opt_matrix;
}

InfiniteMatrix.prototype.to_rotation = function(axis_1, axis_2, angle) {
    var size = Math.max(axis_1, axis_2) + 1;
    this.m = new Matrix(size, size);
    this.m.to_rotation(axis_1, axis_2, angle);
    return this;
};

InfiniteMatrix.prototype.to_translation = function(vector) {
    this.m = new Matrix(vector.a.length, 1);
    this.m.to_translation(vector);
    return this;
};

// this implementation dependends on the properties of InfiniteMatrix
// and Vector but I think the assumptions are reasonable for anything
// arithmetic that you could want to do on a computer
InfiniteMatrix.prototype.times = broadcast(function(o) {
    if (o instanceof InfiniteMatrix) {
        var size = Math.max(this.m.rows, this.m.cols, o.m.rows, o.m.cols);
        var a = this._expand(size, size);
        var b = o._expand(size, size);
        return new InfiniteMatrix(a.times(b));
    } else if (o instanceof Vector) {
        var rows = Math.max(this.m.rows, o.a.length);
        var middle = Math.max(rows, this.m.cols, o.a.length);
        var a = this._expand(this.m.rows, middle);
        var b = o._expand(middle);
        return a.times(b);
    } else
        assert(false);
});

// expand for multiplication
InfiniteMatrix.prototype._expand = function(height, width) {
    var r = new Matrix(height, width).to_I();
    var copy_h = Math.min(height, this.m.rows);
    var copy_w = Math.min(width, this.m.cols);
    for (var i = 0; i < copy_h; i++)
        for (var j = 0; j < copy_w; j++)
            r.a[i][j] = this.m.a[i][j];
    return r;
};

// vectors' infiniteness (boundedness?) matches whatever you try to operate on
// them with:
//    - finite when you multiply them by finite matrices and 
//    - infinite (expanding) when you combine them with InfiniteMatrix's and
//      other Vectors, in which case they are treated as having 0 components
//      outside the explicitly defined area.
// a=[0, ...] is a vector, anything else is a point
function Vector(a, type) {
    this.a = a;
    if (type !== undefined)
        a.unshift(type);
}

Vector.prototype.isV = function() {
    return !this.a[0];
};

Vector.prototype.isP = function() {
    return Boolean(this.a[0]);
};

Vector.prototype.dot = function(v) {
    assert(this.isV() && v.isV());
    var r = 0;
    for (var i = 0; i < Math.min(this.a.length, v.a.length); i++)
        r += this.a[i] * v.a[i];
    return r;
};

// l2 norm
Vector.prototype.norm = function() {
    return Math.sqrt(this.dot(this));
};

Vector.prototype.normalize = function() {
    return this.divide(this.norm());
};

// for adding vectors to points or to each other
Vector.prototype.plus = function(other) {
    if (other.a.length > this.a.length)
        return other.plus(this);
    assert(this.isV() || other.isV());
    assert(this.isV() || this.a[0] == 1);
    assert(other.isV() || other.a[0] == 1);
    var answer = this.copy(); // this is always the longer one
    for (var i = 0; i < other.a.length; i++)
        answer.a[i] += other.a[i];
    return answer;
};

Vector.prototype.minus = function(other) {
    return this.plus(other.times(-1));
};

// for adding points together
// if the first components (a[0]) cancel out, returns a vector between the two
// otherwise returns a point on the line between the two points.
Vector.prototype.point_plus = function(other) {
    if (other.a.length > this.a.length)
        return other.point_plus(this);
    assert(this.isP());
    assert(other.isP());
    var answer = this.copy(); // this is always the longer one
    for (var i = 0; i < other.a.length; i++)
        answer.a[i] += other.a[i];
    return answer;
};

Vector.prototype.point_minus = function(other) {
    return this.point_plus(other.times(-1));
};

Vector.prototype.proj = function(onto) {
    return onto.times(this.dot(onto) / onto.dot(onto));
};

Vector.prototype.copy = function() {
    return new this.constructor(this.a.slice());
};

// expand to length, filling with 0s
Vector.prototype._expand = function(length) {
    var a = this.a;
    return new this.constructor(_.range(length).map(function(i) {
        if (i < a.length)
            return a[i];
        else
            return 0;
    }));
};

Vector.prototype.to_0 = function() {
    for (var i = 0; i < this.a.length; i++)
        this.a[i] = 0;
    return this;
};

// Set this to matrix*vector (common interface with Matrix)
Vector.prototype.to_times = function(matrix, vector) {
    assert(this != vector);
    assert(matrix.rows == this.a.length);
    assert(matrix.cols == vector.a.length);
    this.to_0();
    for (var i = 0; i < matrix.rows; i++)
        for (var j = 0; j < matrix.cols; j++)
            this.a[i] += matrix.a[i][j] * vector.a[j];
    return this;
};

Vector.prototype.times = function(constant) {
    var r = this.copy();
    for (var i = 0; i < r.a.length; i++)
        r.a[i] *= constant;
    return r;
}

Vector.prototype.divide = function(constant) {
    return this.times(1/constant);
};

// component-wise multiplication
Vector.prototype.cpt_times = function(v) {
        var r = new this.constructor(new Array(Math.min(this.a.length, v.a.length)));
        for (var i = 0; i < r.a.length; i++)
            r.a[i] = this.a[i] * v.a[i];
        return r;
};

Vector.prototype.equals = function(v) {
    if (v.a.length > this.a.length)
        return v.equals(this);
    for (var i = 0; i < v.a.length; i++)
        if (this.a[i] != v.a[i])
            return false;
    for (; i < this.a.length; i++)
        if (this.a[i])
            return false;
    return true;
};


function Rotation(axis_1, axis_2, opt_angle) {
    this.axis_1 = axis_1;
    this.axis_2 = axis_2;
    this.angle = opt_angle || 0;
    this.transform = new InfiniteMatrix();
    this.update_transform();

    this.velocity = 0; // radians per second
    this.last_evolve = null;
}

// on first call sets last evolve time
Rotation.prototype.evolve = function(time) {
    if (this.last_evolve) {
        this.angle += this.velocity / 1000 * (time - this.last_evolve);
        this.update_transform();
    }
    this.last_evolve = time;
};

Rotation.prototype.update_transform = function() {
    this.transform.to_rotation(this.axis_1, this.axis_2, this.angle);
};


function Position(opt_x) {
    this.x = opt_x || new Vector([], 0);
    this.v = new Vector([], 0); // units per second
    this.a = new Vector([], 0);
    this.last_evolve = null;
    this.transform = new InfiniteMatrix();
    this.update_transform();
}

Position.prototype.evolve = function(time) {
    if (this.last_evolve) {
        var diff = time - this.last_evolve;
        this.x = this.x.plus(this.v).plus(this.a.cpt_times(this.a).times(diff/2000));
        this.v = this.v.plus(this.a.times(diff/1000));
        this.update_transform();
    }
    this.last_evolve = time;
};

Position.prototype.update_transform = function() {
    this.transform.to_translation(this.x);
};
