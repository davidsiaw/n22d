/* This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */


// trig functions with cleaner return values (and args)
function cos2pi(a) {
    a %= 1;
    if (a in cos2pi.angles)
        return cos2pi.angles[a];
    else
        return Math.cos(2*Math.PI*a);
}
cos2pi.angles = {};
cos2pi.angles[-3/4] = 0;
cos2pi.angles[-1/4] = 0;
cos2pi.angles[1/4] = 0;
cos2pi.angles[3/4] = 0;

function sin2pi(a) {
    a %= 1;
    if (a in sin2pi.angles)
        return sin2pi.angles[a];
    else
        return Math.sin(2*Math.PI*a);
}
sin2pi.angles = {};
sin2pi.angles[-1/2] = 0;
sin2pi.angles[1/2] = 0;

// dimensions are constant, values are not
var Matrix = Class.create({
    initialize: function(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.a = new Array(this.rows);
        for (var i = 0; i < this.rows; i++)
            this.a[i] = new Array(this.cols);
    },

    copy: function() {
        var o = new this.constructor(this.rows, this.cols);
        for (var i = 0; i < this.rows; i++)
            for (var j = 0; j < this.cols; j++)
                o.a[i][j] = this.a[i][j];
        return o;
    },

    // change to the zero matrix
    to_0: function() {
        for (var i = 0; i < this.rows; i++)
            for (var j = 0; j < this.cols; j++)
                this.a[i][j] = 0;
        return this;
    },

    // change to the identity matrix
    to_I: function() {
        this.to_0();
        var diag = Math.min(this.rows, this.cols);
        for (var i = 0; i < diag; i++)
            this.a[i][i] = 1;
        return this;
    },

    to_swap: function(row_1, row_2) {
        this.to_I().swap_rows(row_1, row_2);
        return this;
    },

    to_translation: function(vector) {
        assert(vector.a.length == this.rows);
        this.to_I();
        for (var i = 0; i < vector.a.length; i++)
            this.a[i][0] = vector.a[i];
        this.a[0][0] = 1;
        return this;
    },

    // A primitive planar rotation. Only angle is required.
    to_rotation: function(angle, axis_1, axis_2) {
        axis_1 = axis_1 || 1;
        axis_2 = axis_2 || 0;
        var max_axis = Math.max(axis_1, axis_2);
        assert(this.rows > max_axis);
        assert(this.cols > max_axis);
        this.to_I();
        this.a[axis_1][axis_1] = this.a[axis_2][axis_2] = cos2pi(angle);
        this.a[axis_1][axis_2] = sin2pi(angle);
        this.a[axis_2][axis_1] = -this.a[axis_1][axis_2];
        return this;
    },

    // dimension combining matrix
    to_dim_comb: function() {
        assert(this.rows == 4);
        this.to_I();
        for (var i = 3; i < this.cols; i++)
            this.a[3][i] = 1;
        return this;
    },

    // change this to the product of two other matrices
    to_times: function(a, b) {
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
    },

    times: function(other) {
        var result;
        if (other instanceof Array)
            return other.map(this.times, this);
        else if (other instanceof Vector) {
            result = new other.constructor(new Array(this.rows));
        } else if (other instanceof Matrix) {
            result = new other.constructor(this.rows, other.cols);
        } else if (other.as_Vectors)
            return other.as_Vectors(this.times.bind(this));
        else
            assert(false);
        return result.to_times(this, other);
    },

    add: function(other) {
        for (var i = 0; i < other.rows; i++)
            for (var j = 0; j < other.cols; j++)
                this.a[i][j] += other.a[i][j];
        return this;
    },

    minus: function(other) {
        assert(this.rows == other.rows);
        assert(this.cols == other.cols);
        var diff = this.copy();
        for (var i = 0; i < other.rows; i++)
            for (var j = 0; j < other.cols; j++)
                diff.a[i][j] -= other.a[i][j];
        return diff;
    },

    transpose: function() {
        var m = new Matrix(this.cols, this.rows);
        for (var i = 0; i < this.cols; i++)
            for (var j = 0; j < this.rows; j++)
                m.a[i][j] = this.a[j][i];
        return m;
    },

    swap_rows: function(i, j) {
        var tmp = this.a[i];
        this.a[i] = this.a[j];
        this.a[j] = tmp;
    },

    swap_cols: function(i, j) {
        for (var row = 0; row < this.rows; row++) {
            var tmp = this.a[row][i];
            this.a[row][i] = this.a[row][j];
            this.a[row][j] = tmp;
        }
    },

    as_webgl_array: function() {
        assert(this.rows == 4);
        assert(this.cols == 4);
        // first row and column become last
        var a = this.transpose().a;
        return [a[1][1], a[1][2], a[1][3], a[1][0],
                a[2][1], a[2][2], a[2][3], a[2][0],
                a[3][1], a[3][2], a[3][3], a[3][0],
                a[0][1], a[0][2], a[0][3], a[0][0]];
    },

    is_affine: function() {
        for (var i = 1; i < this.cols; i++)
            if (this.a[0][i])
                return false;
        return true;        
    }
});


/* A sort of unbounded matrix.
 *  m: Matrix defining the top left corner.
 */
var BigMatrix = Class.create({
    initialize: function(matrix) {
        this.m = matrix || new Matrix(0,0);
    },

    to_I: function() {
        this.m = new Matrix(0, 0);
        return this;
    },

    to_scale: function(a) {
        this.m = new Matrix(a.length, a.length).to_0();
        for (var i = 0; i < a.length; i++)
            this.m.a[i][i] = a[i];
        return this;
    },

    // only angle is required
    to_rotation: function(angle, axis_1, axis_2) {
        axis_1 = axis_1 || 1;
        axis_2 = axis_2 || 0;
        var size = Math.max(axis_1, axis_2) + 1;
        this.m = new Matrix(size, size);
        this.m.to_rotation(angle, axis_1, axis_2);
        return this;
    },

    to_translation: function(vector) {
        this.m = new Matrix(vector.a.length, 1);
        this.m.to_translation(vector);
        return this;
    },

    to_swap: function(row_1, row_2) {
        var size = Math.max(row_1, row_2) + 1;
        this.m = new Matrix(size, size).to_swap(row_1, row_2);
        return this;
    },

    transpose: function() {
        return new BigMatrix(this.m.transpose());
    },

    times: function(o) {
        if (o instanceof Array)
            return o.map(this.times, this);
        else if (o instanceof BigMatrix) {
            var size = Math.max(this.m.rows, this.m.cols, o.m.rows, o.m.cols);
            var a = this._expand(size, size);
            var b = o._expand(size, size);
            return new BigMatrix(a.times(b));
        } else if (o instanceof Vector) {
            var rows = Math.max(this.m.rows, o.a.length);
            var middle = Math.max(rows, this.m.cols, o.a.length);
            var a = this._expand(rows, middle);
            var b = o.copy(middle);
            return a.times(b);
        } else if (o.as_Vectors)
            return o.as_Vectors(this.times.bind(this));
        else
            assert(false);
    },

    _expand: function(rows, cols) {
        rows = Math.max(this.m.rows, rows);
        cols = Math.max(this.m.cols, cols);
        return this.submatrix(0, rows, 0, cols);
    },

    submatrix: function(row, rows, col0, cols) {
        var s = new Matrix(rows, cols);
        for (var i = 0; i < rows; i++, row++)
            for (var j = 0, col = col0; j < cols; j++, col++)
                s.a[i][j] = this.get(row, col);
        return s;
    },

    get: function(row, col) {
        if (row < this.m.rows && col < this.m.cols)
            return this.m.a[row][col];
        else if (row != col)
            return 0;
        else
            return 1;
    },

    equals: function(o) {
        if (this.get != o.get)
            return false;
        var max_rows = Math.max(this.m.rows, o.m.rows);
        var max_cols = Math.max(this.m.cols, o.m.cols);
        for (var i = 0; i < max_rows; i++)
            for (var j = 0; j < max_cols; j++)
                if (this.get(i, j) != o.get(i, j))
                    return false;
        return true;
    },

    swap_rows: function(i, j) {
        var size = Math.max(i, j) + 1;
        this.m = this._expand(size, size);
        this.m.swap_rows(i, j);
        return this;
    }
});

// easy to invert with high precision
var AffineUnitaryBigMatrix = Class.create(BigMatrix, {
    initialize: function($super, m) {
        $super(m);
        assert(this.m.is_affine());
    },

    times: function($super, o) {
        if (o instanceof AffineUnitaryBigMatrix) {
            var size = Math.max(this.m.rows, this.m.cols, o.m.rows, o.m.cols);
            var a = this._expand(size, size);
            var b = o._expand(size, size);
            return new AffineUnitaryBigMatrix(a.times(b));
        } else
            return $super(o);
    }
});

function as_Vector(x) {
    if (x instanceof Vector)
        return x;
    else if (x instanceof Array)
        return new Vector(x);
    else
        assert(false);
}

// vectors' infiniteness matches whatever you try to operate on
// them with:
//    - finite when you multiply them by finite matrices and 
//    - infinite (expanding) when you combine them with BigMatrix's and
//      other Vectors, in which case they are treated as having 0 components
//      outside the explicitly defined area.
var Vector = Class.create({
    initialize: function(a) {
        this.a = a;
    },

    dot: function(v) {
        var r = 0;
        for (var i = 0; i < Math.min(this.a.length, v.a.length); i++)
            r += this.a[i] * v.a[i];
        return r;
    },

    angle: function(v) {
        return Math.acos(this.dot(v) / this.norm() / v.norm())/2/Math.PI;
    },

    // l2 norm
    norm: function() {
        return Math.sqrt(this.dot(this));
    },

    normalized: function() {
        return this.divide(this.norm());
    },

    affine_normalized: function() {
        assert(this.isP());
        var a = 1/this.a[0];
        a /= a*this.a[0]; // try hard to get a good inverse of a[0]
        var v = this.times(a);
        v.a[0] = 1;
        return v;
    },

    plus: function(other) {
        var answer = this.copy(Math.max(this.a.length, other.a.length));
        for (var i = 0; i < other.a.length; i++)
            answer.a[i] += other.a[i];
        return answer;
    },

    // in-place subtraction, other must be the same length or shorter
    subtract: function(other) {
        for (var i = 0; i < other.a.length; i++)
            this.a[i] -= other.a[i];
        return this;
    },

    minus: function(other) {
        var difference = this.copy(Math.max(this.a.length, other.a.length));
        return difference.subtract(other);
    },

    isV: function() { return this.a[0] == 0; },
    isP: function() { return this.a[0] != 0; },

    // Add Points in an affine space together.
    // If the a[0]s cancel out, returns a vector from one to the other,
    // otherwise returns a point on the line between the two points.
    point_plus: function(other) {
        assert(this.isP());
        assert(other.isP());
        return this.plus(other);
    },

    point_minus: function(other) {
        assert(this.isP());
        assert(other.isP());
        return this.minus(other);
    },

    // copy, optionally to a vector with a different number of dimensions
    copy: function(opt_length) {
        var a = new Array(opt_length === undefined ? this.a.length : opt_length);
        var copy_length = Math.min(a.length, this.a.length);
        for (var i = 0; i < copy_length; i++)
            a[i] = this.a[i];
        for (; i < a.length; i++)
            a[i] = 0;
        return new this.constructor(a);
    },

    to_0: function() {
        for (var i = 0; i < this.a.length; i++)
            this.a[i] = 0;
        return this;
    },

    // Set this to matrix*vector (common interface with Matrix)
    to_times: function(matrix, vector) {
        assert(this != vector);
        assert(matrix.rows == this.a.length);
        assert(matrix.cols == vector.a.length);
        this.to_0();
        for (var i = 0; i < matrix.rows; i++)
            for (var j = 0; j < matrix.cols; j++)
                this.a[i] += matrix.a[i][j] * vector.a[j];
        return this;
    },

    times: function(constant) {
        var r = this.copy();
        for (var i = 0; i < r.a.length; i++)
            r.a[i] *= constant;
        return r;
    },

    divide: function(constant) {
        return this.times(1/constant);
    },

    // component-wise multiplication
    cpt_times: function(v) {
            var r = new this.constructor(new Array(Math.min(this.a.length, v.a.length)));
            for (var i = 0; i < r.a.length; i++)
                r.a[i] = this.a[i] * v.a[i];
            return r;
    },

    equals: function(v) {
        if (v.a.length > this.a.length)
            return v.equals(this);
        for (var i = 0; i < v.a.length; i++)
            if (this.a[i] != v.a[i])
                return false;
        for (; i < this.a.length; i++)
            if (this.a[i])
                return false;
        return true;
    }
});

// vector space
var Space = Class.create({
    initialize: function(vs) {
        this.nd = 0; // max number of coordinates in basis vectors
        this.basis = [];
        if (vs)
            this.add(vs);
    },

    copy: function() { return new Space(this); },

    as_Vectors: function(func) {
        return new Space(func(this.basis));
    },

    project_vector: function(vector) {
        var p = new Vector([]);
        for (var i = 0; i < this.basis.length; i++)
            p = p.plus(this.basis[i].times(this.basis[i].dot(vector)));
        return p;
    },

    ortho_vector: function(vector) {
        return vector.minus(this.project_vector(vector));
    },

    // expands if ortho_norm/vector_norm >= tolerance
    add_vector: function(vector, tolerance) {
        vector = as_Vector(vector);
        tolerance = tolerance || 1e-6; // XXX awful
        var ortho = this.ortho_vector(vector);
        var ortho_norm = ortho.norm();
        var vector_norm = vector.norm();
        if (vector_norm >= tolerance && ortho_norm/vector_norm >= tolerance) {
            this.basis.push(ortho.divide(ortho_norm));
            this.nd = Math.max(this.nd, ortho.a.length);
        }
    },

    add: function(space, tolerance) {
        if (space instanceof Vector) {
            this.add_vector(space, tolerance);
            return;
        } else if (space instanceof Array)
            var vectors = space;
        else
            var vectors = space.basis;

        for (var i = 0; i < vectors.length; i++)
            this.add_vector(vectors[i], tolerance);

        return this;
    },

    plus: function(space, tolerance) {
        var sum = this.copy();
        sum.add(space, tolerance);
        return sum;
    },

    // subspace of this orthogonal to space
    minus: function(space) {
        var diff = new Space();
        for (var i = 0; i < this.basis.length; i++)
            diff.add_vector(space.ortho_vector(this.basis[i]));
        return diff;
    },

    basis_change: function(min_size) {
        var cols = Math.max(this.nd, min_size||0);
        var m = new Matrix(this.basis.length, cols).to_0();
        for (var i = 0; i < this.basis.length; i++)
            for (var j = 0; j < this.basis[i].a.length; j++)
                m.a[i][j] = this.basis[i].a[j];
        return m;
    },

    projection: function(min_size) {
        var b = this.basis_change(min_size);
        return b.transpose().times(b);
    },

    /* Do an operation as if it were inside this space.
     * o: Matrix
     * returns: Matrix
     */
    inside: function(o) {
        assert(o.rows == o.cols);
        o = o.copy();
        for (var diag = 0; diag < o.rows; diag++) // subtract I
            o.a[diag][diag] -= 1;
        var b = this.basis_change();
        var ret = b.transpose().times(o).times(b);
        for (var diag = 0; diag < ret.rows; diag++) // add I
            ret.a[diag][diag] += 1;
        return ret;
    }
});
