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
var Matrix = Class.create({
    initialize: function(rows_or_matrix, opt_cols) {
        if (rows_or_matrix instanceof Matrix) {
            assert(opt_cols === undefined);
            var matrix = rows_or_matrix;
            this.rows = matrix.rows;
            this.cols = matrix.cols;
            this.a = matrix.a.slice();
            for (var i = 0; i < this.rows; i++)
                this.a[i] = this.a[i].slice();
        } else if (rows_or_matrix instanceof Array) {
            assert(opt_cols === undefined);
            this.a = rows_or_matrix;
            this.rows = this.a.length;
            this.cols = this.a.length && this.a[0].length;
        } else {
            this.rows = rows_or_matrix;
            this.cols = opt_cols;
            this.a = new Array(this.rows);
            for (var i = 0; i < this.rows; i++)
                this.a[i] = new Array(this.cols);
        }
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
        this.to_I().row_swap(row_1, row_2);
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
        this.a[axis_1][axis_1] = this.a[axis_2][axis_2] = Math.cos(angle);
        this.a[axis_1][axis_2] = Math.sin(angle);
        this.a[axis_2][axis_1] = -this.a[axis_1][axis_2];
        return this;
    },

    // functionality copied from CanvasMatrix.js
    // I didn't think through the math myself
    to_perspective: function(fov, aspect_ratio, z_near, z_far) {
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
        if (other instanceof Vector) {
            var result = new other.constructor(new Array(this.rows));
        } else if (other instanceof Matrix) {
            var result = new other.constructor(this.rows, other.cols);
        } else
            assert(false);
        return result.to_times(this, other);
    },

    add: function(other) {
        for (var i = 0; i < other.rows; i++)
            for (var j = 0; j < other.cols; j++)
                this.a[i][j] += other.a[i][j];
        return this;
    },

    transpose: function() {
        var m = new Matrix(this.cols, this.rows);
        for (var i = 0; i < this.cols; i++)
            for (var j = 0; j < this.rows; j++)
                m.a[i][j] = this.a[j][i];
        return m;
    },

    row_swap: function(i, j) {
        var tmp = this.a[i];
        this.a[i] = this.a[j];
        this.a[j] = tmp;
    },

    // decompose into [row_permutation, lower_unit_triangular, upper_triangular]
    plu_decompose: function() {
        var p = new Matrix(this.rows, this.rows).to_I();
        var l = new Matrix(this.rows, this.rows).to_I();
        var u = new Matrix(this);

        for (var diag = 0; diag < l.rows; diag++) {
            var max = diag;
            for (var row = diag+1; row < u.rows; row++)
                if (Math.abs(u.a[row][diag]) > Math.abs(u.a[max][diag]))
                    max = row;
            p.row_swap(diag, max);
            u.row_swap(diag, max);
            l.row_swap(diag, max);
            l.a[diag][max] = l.a[max][diag] = 0;
            l.a[diag][diag] = l.a[max][max] = 1;

            for (var row = diag+1; row < u.rows; row++) {
                l.a[row][diag] = u.a[row][diag] / u.a[diag][diag];
                if (isNaN(l.a[row][diag]))
                    continue;
                for (var col = diag; col < u.cols; col++)
                    u.a[row][col] -= l.a[row][diag] * u.a[diag][col];
            }
        }
        return [p, l, u];
    },

    plu_decompose_test: function() {
        var plu = this.plu_decompose();
        var p = plu[0];
        var l = plu[1];
        var u = plu[2];
        return [this, p.times(l).times(u), p, l, u];
    },

    solve: function(other) {
        var plu = this.plu_decompose();
        var p = plu[0];
        var l = plu[1];
        var u = plu[2];

        // invert p
        other = p.transpose().times(other);

        // invert l
        for (var row = 1; row < this.rows; row++)
            for (var middle = 0; middle < row; middle++)
                for (var col = 0; col < this.cols; col++)
                    other.a[row][col] -= l.a[row][middle] * other.a[middle][col];

        // invert u
        for (var row = this.rows-1; row >= 0; row--) {
            for (var middle = row+1; middle < this.cols; middle++)
                for (var col = 0; col < other.cols; col++)
                    other.a[row][col] -= u.a[row][middle] * other.a[middle][col];

            for (var col = 0; col < this.cols; col++)
                other.a[row][col] /= u.a[row][row];
        }

        return other;
    },

    solve_test: function(other) {
        return [other, this.times(this.solve(other))];
    },

    inverse: function() {
        assert(this.rows == this.cols);
        return this.solve(new Matrix(this.rows, this.cols).to_I());
    },

    inverse_test: function() {
        return this.times(this.inverse());
    },

    as_webgl_array: function() {
        assert(this.rows == 4);
        assert(this.cols == 4);
        // first row and column become last
        var a = this.a;
        return [a[1][1], a[1][2], a[1][3], a[1][0],
                a[2][1], a[2][2], a[2][3], a[2][0],
                a[3][1], a[3][2], a[3][3], a[3][0],
                a[0][1], a[0][2], a[0][3], a[0][0]];
    }
});

// acts as I outside the explicitly defined area
var BigMatrix = Class.create({
    // You don't have to pass opt_matrix if you want to use one of the to_ methods.
    initialize: function(opt_matrix) {
        if (opt_matrix instanceof BigMatrix)
            this.m = new Matrix(opt_matrix.m);
        else
            this.m = opt_matrix;
    },

    to_I: function() {
        this.m = new Matrix(0, 0);
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

    times: broadcast(function(o) {
        if (o instanceof BigMatrix) {
            var size = Math.max(this.m.rows, this.m.cols, o.m.rows, o.m.cols);
            var a = this._expand(size, size);
            var b = o._expand(size, size);
            return new BigMatrix(a.times(b));
        } else if (o instanceof Vector) {
            var rows = Math.max(this.m.rows, o.a.length);
            var middle = Math.max(rows, this.m.cols, o.a.length);
            var a = this._expand(this.m.rows, middle);
            var b = o._expand(middle);
            return a.times(b);
        } else if (o instanceof Space) {
            return new Space(this.times(o.basis));
        } else
            assert(false);
    }),

    // expand for multiplication
    _expand: function(height, width) {
        var r = new Matrix(height, width).to_I();
        var copy_h = Math.min(height, this.m.rows);
        var copy_w = Math.min(width, this.m.cols);
        for (var i = 0; i < copy_h; i++)
            for (var j = 0; j < copy_w; j++)
                r.a[i][j] = this.m.a[i][j];
        return r;
    },

    get: function(row, col) {
        if (row < this.m.rows && col < this.m.cols)
            return this.m.a[row][col];
        else if (row != col)
            return 0;
        else
            return 1;
    },

    submatrix: function(row, row_end, col0, col_end) {
        var s = new Matrix(row_end - row, col_end - col0);
        for (var i = 0; row < row_end; i++, row++)
            for (var j = 0, col = col0; col < col_end; j++, col++)
                s.a[i][j] = this.get(row, col);
        return s;
    },

    equals: function(o) {
        var max_rows = Math.max(this.m.rows, o.m.rows);
        var max_cols = Math.max(this.m.cols, o.m.cols);
        for (var i = 0; i < max_rows; i++)
            for (var j = 0; j < max_cols; j++)
                if (this.get(i, j) != o.get(i, j))
                    return false;
        return true;
    }
});

// vectors' infiniteness matches whatever you try to operate on
// them with:
//    - finite when you multiply them by finite matrices and 
//    - infinite (expanding) when you combine them with BigMatrix's and
//      other Vectors, in which case they are treated as having 0 components
//      outside the explicitly defined area.
// a=[0, ...] is a vector, anything else is a point
var Vector = Class.create({
    initialize: function(a) {
        this.a = a;
    },

    isV: function() { return !this.a[0]; },
    isP: function() { return Boolean(this.a[0]); },

    dot: function(v) {
        var r = 0;
        for (var i = 0; i < Math.min(this.a.length, v.a.length); i++)
            r += this.a[i] * v.a[i];
        return r;
    },

    angle: function(v) {
        return Math.arccos(this.dot(v) / this.norm() / v.norm());
    },

    // l2 norm
    norm: function() {
        return Math.sqrt(this.dot(this));
    },

    normalized: function() {
        return this.divide(this.norm());
    },

    plus: function(other) {
        if (other.a.length > this.a.length)
            return other.plus(this);
        assert(this.isV() || other.isV());
        assert(this.isV() || this.a[0] == 1);
        assert(other.isV() || other.a[0] == 1);
        var answer = this.copy(); // this is always the longer one
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
        return this.plus(other.times(-1));
    },

    minus_space: function(space) {
        var length = this.a.length;
        for (var i = 0; i < space.basis.length; i++)
            if (space.basis[i].a.length > length)
                length = space.basis[i].a.length;
        var result = this.copy(length);
        for (var i = 0; i < space.basis.length; i++)
            result.subtract(result.proj_onto(space.basis[i]));
        return result;
    },

    // for adding points together
    // if the first components (a[0]) cancel out, returns a vector between the two
    // otherwise returns a point on the line between the two points.
    point_plus: function(other) {
        assert(this.isP());
        assert(other.isP());
        var answer = this.copy(Math.max(this.a.length, other.a.length));
        for (var i = 0; i < other.a.length; i++)
            answer.a[i] += other.a[i];
        return answer;
    },

    point_minus: function(other) {
        return this.point_plus(other.times(-1));
    },

    proj_onto: function(onto) {
        return onto.times(this.dot(onto) / onto.dot(onto));
    },

    // copy, optionally to a vector with a different number of dimensions
    copy: function(opt_length) {
        var a = new Array(opt_length === undefined ? this.a.length : opt_length);
        var copy_length = Math.min(a.length, this.a.length);
        for (var i = 0; i < copy_length; i++)
            a[i] = this.a[i];
        for (var i = copy_length; i < a.length; i++)
            a[i] = 0;
        return new this.constructor(a);
    },

    // expand to length, filling with 0s
    _expand: function(length) {
        var a = new Array(length);
        var copy_length = Math.min(this.a.length, length);
        for (var i = 0; i < copy_length; i++)
            a[i] = this.a[i];
        for (; i < length; i++)
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
        this.basis = [];
        if (vs)
            this.expand(vs);
    },

    copy: function() { return new Space(this.basis); },

    expand: broadcast(function(vector) {
        vector = vector.minus_space(this);
        var norm = vector.norm();
        if (norm)
            return this.basis.push(vector.divide(norm));
    }),

    basis_change: function() {
        var cols = this.basis.max(function(v) { return v.a.length; });
        var m = new Matrix(this.basis.length, cols).to_0();
        for (var i = 0; i < this.basis.length; i++)
            for (var j = 0; j < this.basis[i].a.length; j++)
                m.a[i][j] = this.basis[i].a[j];
        return m;
    },

    inside: function(o) {
        assert(o.rows == o.cols);
        o = new Matrix(o);
        for (var diag = 0; diag < o.rows; diag++) // subtract I
            o.a[diag][diag] -= 1;
        var b = this.basis_change();
        var ret = b.transpose().times(o).times(b);
        for (var diag = 0; diag < ret.rows; diag++) // add I
            ret.a[diag][diag] += 1;
        return ret;
    }
});

// XXX not a big fan of this
var StaticTransform = Class.create({
    initialize: function(t) {
        this.transform = t || new BigMatrix().to_I();
    },
    evolve: function() {},
    update_transform: function() {}
});

var Rotation = Class.create({
    initialize: function(opt_angle, axis_1, axis_2) {
        this.angle = opt_angle || 0;
        this.axis_1 = axis_1 || 1;
        this.axis_2 = axis_2 || 0;
        this.transform = new BigMatrix();
        this.update_transform();

        this.velocity = 0; // radians per second
        this.last_evolve = null;
    },

    evolve: function(time) {
        if (this.last_evolve) {
            this.angle += this.velocity / 1000 * (time - this.last_evolve);
            this.update_transform();
        }
        this.last_evolve = time;
    },

    update_transform: function() {
        this.transform.to_rotation(this.angle, this.axis_1, this.axis_2);
    }
});

var Position = Class.create({
    initialize: function(opt_x) {
        this.x = opt_x || new Vector([0]);
        this.v = new Vector([0]); // units per second
        this.a = new Vector([0]);
        this.last_evolve = null;
        this.transform = new BigMatrix();
        this.update_transform();
    },

    evolve: function(time) {
        if (this.last_evolve) {
            var diff = time - this.last_evolve;
            this.x = this.x.plus(this.v).plus(this.a.cpt_times(this.a).times(diff/2000));
            this.v = this.v.plus(this.a.times(diff/1000));
            this.update_transform();
        }
        this.last_evolve = time;
    },

    update_transform: function() {
        this.transform.to_translation(this.x);
    }
});

// a chain of lazily evaluated transforms
var TransformChain = Class.create({
    initialize: function(a) {
        this.a = a || [];
        this.transform = new BigMatrix();
        this.update_transform();
    },

    evolve: function(time) {
        for (var i = 0; i < this.a.length; i++)
            this.a[i].evolve(time);
        this.update_transform();
    },

    update_transform: function() {
        this.transform.to_I();
        for (var i = 0; i < this.a.length; i++) {
            this.a[i].update_transform();
            this.transform = this.transform.times(this.a[i].transform);
        }
    }
});
