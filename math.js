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
        if (other instanceof Array)
            return other.map(this.times, this);
        else if (other instanceof Vector) {
            var result = new other.constructor(new Array(this.rows));
        } else if (other instanceof Matrix) {
            var result = new other.constructor(this.rows, other.cols);
        } else if (other instanceof Space) {
            return new other.constructor(this.times(other.basis));
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

    swap_rows: function(i, j) {
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
            p.swap_rows(diag, max);
            u.swap_rows(diag, max);
            l.swap_rows(diag, max);
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


/* A sort of unbounded matrix.
 *  m: Matrix defining the top left corner.
 *  get: function(row, col) defining the area outside of m.
 */
var BigMatrix = Class.create({
    initialize: function(matrix, get_fn) {
        this.m = matrix || new Matrix(0,0);
        this.get = get_fn || BigMatrix.I_GET_FN;
    },

    to_I: function() {
        this.m = new Matrix(0, 0);
        this.get = BigMatrix.I_GET_FN;
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

    to_perspective: function(fov, aspect, z_near, z_far) {
        this.m = new Matrix(4, 4).to_perspective(fov, aspect, z_near, z_far);
        this.get = BigMatrix.ZERO_GET_FN;
        return this;
    },

    transpose: function() {
        return new BigMatrix(this.m.transpose());
    },

    // this does the wrong thing for .get()
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
        } else if (o instanceof Space) {
            return new Space(this.times(o.basis));
        } else
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

// possibilities for BigMatrix.get
BigMatrix.ZERO_GET_FN = function(row, col) {
    if (row < this.m.rows && col < this.m.cols)
        return this.m.a[row][col];
    else
        return 0;
};

BigMatrix.I_GET_FN = function(row, col) {
    if (row < this.m.rows && col < this.m.cols)
        return this.m.a[row][col];
    else if (row != col)
        return 0;
    else
        return 1;
};

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
        this.basis = [];
        if (vs)
            this.add(vs);
    },

    copy: function() { return new Space(this); },

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
        tolerance = tolerance || 1e-14; // figured this out experimentally
        var ortho = this.ortho_vector(vector);
        var ortho_norm = ortho.norm();
        var vector_norm = vector.norm();
        if (vector_norm && ortho_norm/vector_norm >= tolerance)
            return this.basis.push(ortho.divide(ortho_norm));
    },

    add: function(space, tolerance) {
        if (space instanceof Vector)
            return this.add_vector(space, tolerance);
        else if (space instanceof Array)
            var vectors = space;
        else
            var vectors = space.basis;

        for (var i = 0; i < vectors.length; i++)
            this.add_vector(vectors[i], tolerance);

        return this;
    },

    minus: function(space) {
        var diff = new Space();
        for (var i = 0; i < this.basis.length; i++)
            diff.add_vector(space.ortho_vector(this.basis[i]));
        return diff;
    },

    basis_change: function() {
        var cols = this.basis.max(function(v) { return v.a.length; });
        var m = new Matrix(this.basis.length, cols).to_0();
        for (var i = 0; i < this.basis.length; i++)
            for (var j = 0; j < this.basis[i].a.length; j++)
                m.a[i][j] = this.basis[i].a[j];
        return m;
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
