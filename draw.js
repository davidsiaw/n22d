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
    if (normal.norm() == 0) // light shining parallel to surface
        return 0;
    return normal.normalize().dot(light.normalize());
    // later will have to worry about light being behind the surface
};

function Triangle(vs, colour) {
    assert(vs.length == 3);
    this.vs = vs;
    this.colour = colour;
}

Triangle.prototype.transform = function(transform) {
    var vs = new Array(this.vs.length);
    for (var i = 0; i < vs.length; i++) {
        vs[i] = transform.times(this.vs[i]);
    }
    return new Triangle(vs, this.colour.copy());
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

function GLCanvas(canvas) {
    var gl;
    this.canvas = canvas;

    if (!window.WebGLRenderingContext)
        throw "Your browser does not support WebGL. See http://get.webgl.org";
    this.gl = gl = canvas.getContext("experimental-webgl");
    if (!gl) 
        throw "Can't get WebGL";

    this.resize();

    var prog = gl.createProgram();
    gl.attachShader(prog, getShader(gl, "shader-vs"));
    gl.attachShader(prog, getShader(gl, "shader-fs"));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    
    var pos = gl.getAttribLocation(prog, "vPos");
    var colour = gl.getAttribLocation(prog, "vColour");
    this.vertex_buffer = gl.createBuffer();
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 6*4, 0);
    gl.enableVertexAttribArray(colour);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 6*4, 3*4);

    var prMatrix = new CanvasMatrix4();
    prMatrix.perspective(45, 1, .1, 30);
    gl.uniformMatrix4fv( gl.getUniformLocation(prog,"prMatrix"),
            false, new Float32Array(prMatrix.getAsArray()) );

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearDepth(1.0);
    gl.clearColor(1, 1, 1, 1);
}

GLCanvas.prototype.resize = function() {
    var size = Math.min(window.innerWidth, window.innerHeight) - 10;
    this.canvas.width = size;
    this.canvas.height = size;
    this.gl.viewport(0, 0, size, size);
};

GLCanvas.prototype.draw = function(models) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    for (var i = 0; i < models.length; i++) {
        var m = models[i];
        var transform = m.particle.transformation();
        this._draw_triangles(m.triangles, transform);
    }

    this.gl.flush();
};

GLCanvas.prototype._draw_triangles = function(triangles, transform) {
    var data = new Float32Array(6 * 3 * triangles.length);
    var light = new Vector([1]); // light at camera
    var i = 0;
    for (var j = 0; j < triangles.length; j++) {
        var triangle = triangles[j].transform(transform);
        var plane = triangle.plane();
        for (var k = 0; k < 3; k++) {
            data[i++] = triangle.vs[k].a[1];
            data[i++] = triangle.vs[k].a[2];
            data[i] = 0;
            for (var l = 3; l < triangle.vs[k].a.length; l++) {
                data[i] += triangle.vs[k].a[l];
            }
            i++;

            var diffuse = plane.diffuse_factor(triangle.vs[k].minus(light));
            var colour = triangle.colour.times(diffuse);
            for (var l = 1; l < 4; l++)
                data[i++] = triangle.colour.a[l];
        }
    }

    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 3 * triangles.length);
};
