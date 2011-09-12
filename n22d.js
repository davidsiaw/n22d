function go() {
    var canvas = document.getElementById('c');
    var ctx = canvas.getContext('2d');
    var canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (var x = 0; x < canvasData.width; x++) {
        for (var y = 0; y < canvasData.height; y++) {
            // Index of the pixel in the array
            var idx = (x + y * canvas.width) * 4;
            canvasData.data[idx + 0] = 0;
            canvasData.data[idx + 1] = 255;
            canvasData.data[idx + 2] = 0;
            canvasData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(canvasData, 0, 0);
}

// acts as I outside the bounds of a
function Operator(a) {
    this.a = a.slice();
    for (var i = 0; i < a.length; i++) {
        a[i] = a[i].slice();
    }
}

Operator.prototype.times = function(o) {
    assert(a.length);
    assert(o.length);
    var a = new Array(Math.max(this.a.length, o.a[0].length));
    var width = Math.max(this.a[0].length, o.length);
    for (var i = 0; i < a.length; i++) {
        a[i] = new Array(width);
    }

    for (var i = 0; i < a.length; i++) {
        for (var j = 0; j < width; j++) {
            a[i][j] = 0;
            // XXX
        }
    }
};

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

function Triangle(vs) {
    this.vs = vs;
}

// array of {0,1}^n
function permutations(n) {
    if (n == 0) {
        return [];
    } else if (n == 1) {
        return [[0], [1]];
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

function hypercube(n) { // only works for n >= 3
    var triangles = [];
    var ps = permutations(n - 2);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            for (var P = 0; P < ps.length; P++) {
                var p = ps[P].slice();
                p.splice(j, 0, 0);
                p.splice(i, 0, 0);
                var face = hypercube_face(p, j, i);
                for (var f = 0; f < face.length; f++) {
                    triangles.push(face[f]);
                }
            }
        }
    }
    return triangles;
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
    a = new Triangle(a);

    var b = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    b[0][i] = b[0][j] = 1;
    b[1][i] = 1;
    b[2][j] = 1;
    b = new Triangle(b);

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
