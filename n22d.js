/* Widget for N-dimensional renderer that uses WebGL. */
var N22d = Class.create({
    initialize: function(vertices) {
        this.dom = new Element('div');
        this.dom.observe('DOMNodeInserted', this.resize.bind(this));
        this.dom.observe('resize', this.resize.bind(this));
        this.canvas = new Element('canvas');
        this.dom.update(this.canvas);
        this.gl = this._make_gl({alpha: true});
        if (!this.gl)
            return;

        // writable:
        this.transform = new AffineUnitaryBigMatrix();
        this.light = new Vector([1]);
        this.ambient = .3;

        this._viewport = new Viewport(this.canvas);

        this._initialize();
    },

    _initialize: function() {
        var gl = this.gl;
        this.data = null;
        this.buffer = gl.createBuffer();
        this.prog = this._make_program(this.vertex_shader_src, this.fragment_shader_src);
        gl.useProgram(this.prog);
        this.projection = gl.getUniformLocation(this.prog, "projection");
        this.vertex = gl.getAttribLocation(this.prog, "vertex");
        this.colour = gl.getAttribLocation(this.prog, "v_colour");
        gl.enableVertexAttribArray(this.pos);
        gl.enableVertexAttribArray(this.colour);

        gl.enable(this.gl.BLEND);
        gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        gl.clearDepth(1.0);
        gl.clearColor(1, 1, 1, 1);
    },

    vertex_shader_src: [
        'uniform mat4 projection;',
        'attribute vec3 vertex;',
        'attribute vec4 v_colour;',
        'varying vec4 f_colour;',
        'void main(void) {',
        '    gl_Position = projection * vec4(vertex, 1.);',
        '    f_colour = v_colour;',
        '}'
    ].join('\n'),

    fragment_shader_src: [
        '#ifdef GL_ES',
        'precision highp float;',
        '#endif',
        'varying vec4 f_colour;',

        'void main(void) {',
        '    gl_FragColor = f_colour;',
        '}'
    ].join('\n'),

    set_viewport: function(viewport) {
        this.gl.viewport(0, 0, viewport.width, viewport.height);
        this.gl.uniformMatrix4fv(this.projection, false,
                viewport.projection.as_webgl_array());
    },

    draw: function() {
        var gl = this.gl;
        var primitives = this.primitives;
        var transform = this.transform;
        var light = this.light;
        var ambient = this.ambient;
        this.set_viewport(this.viewport);

        var stride = 7;
        var vertices = primitives.vertices;
        var length = stride * primitives.vertices.length;
        if (!this.data || this.data.length != length)
            this.data = new Float32Array(length);

        var i = 0;
        for (var j = 0; j < vertices.length; j++) {
            var loc = transform.times(vertices[j].loc);
            var tangent = transform.times(vertices[j].tangent);
            var colour = vertices[j].colour;

            this.data[i++] = loc.a[1];
            this.data[i++] = loc.a[2];
            this.data[i] = 0;
            for (var k = 3; k < loc.a.length; k++)
                this.data[i] += loc.a[k];
            i++;

            var light_vector = loc.point_minus(light).normalized();
            var diffuse = tangent.ortho_vector(light_vector).norm();
            var illum = this.ambient + (1-ambient)*Math.pow(diffuse, .75);
            for (var l = 0; l < 3; l++)
                this.data[i++] = illum * colour.a[l];
            this.data[i++] = colour.a[3];
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(this.vertex, 3, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.colour, 4, gl.FLOAT, false, stride*4, 3*4);
        gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
        gl.drawArrays(gl[primitives.type], 0, vertices.length);
    },

    resize: function() {
        var size = Math.min(new Element.Layout(this.dom).get('width'),
                            document.viewport.getHeight());
        size = 512; // XXX
        this.canvas.width = this.canvas.height = size;
        this._viewport.resize();
        this.draw_async();
    },

    screen2model: function(x, y, nd) {
        nd = Math.max(nd, this.transform.m.cols)
        var world = this._viewport.screen2world(x, y, nd);
        return this.transform.inverse().times(world);
    },

    // Vector you can dot with things to compute their depths (z on the screen)
    z_functional: function(nd) {
        nd = Math.max(nd, this.transform.m.cols)
        var d = new BigMatrix(new Matrix(1, nd).to_0());
        for (var i = 3; i < nd; i++)
            d.m.a[0][i] = 1;
        return new Vector(d.times(this.transform).m.a[0]);
    },

    max_z: function(points) {
        var nd = points.max(function(p) { return p.a.length; });
        var z = this.z_functional(nd);
        var p = points[0];
        for (var i = 1; i < points.length; i++)
            if (points[i].dot(z) > p.dot(z))
                p = points[i];
        return p;
    },

    draw_async: function() {
        return requestAnimFrame(this.draw.bind(this));
    },

    _make_gl: function(parms) {
        return WebGLDebugUtils.makeDebugContext(
           WebGLUtils.setupWebGL(this.canvas),
           function(err, func, args) {
               var error = new GLError(WebGLDebugUtils.glEnumToString(err));
               error.func = func;
               error.args = [];
               for (var i = 0; i < args.length; i++) {
                   var arg = args[i];
                   if (arg === null) // bug in thing
                       arg = 'null';
                   else
                       arg = WebGLDebugUtils.glFunctionArgToString(func, i, arg)
                   error.args.push(arg);
               }
               throw error;
           });
    },

});

var N22dError = Class.create();
N22dError.prototype = Object.extend(new Error, {
    initialize: function(msg) { this.message = msg; }
});
var ShaderCompileError = Class.create(N22dError);
var GLError = Class.create(N22dError);

var Viewport = Class.create({
    initialize: function(canvas) {
        this.canvas = canvas;
        this.fov = Math.PI/4;
        this.resize();
    },

    resize: function() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        var aspect = this.width / this.height;
        this.projection = new Matrix(4, 4).to_perspective(this.fov, aspect, -4, -15);
    },

    screen2world: function(x, y, nd) {
        var screen = new Vector([1, 2*x/this.width-1, 1-2*y/this.height, -1]);
        var diff_3d = this.projection.inverse().times(screen);
        diff_3d.a[0] = 0;
        var diff_nd = new Matrix(4, nd).to_dim_comb().solve_affine(diff_3d);
        return new AffineSpace(new Vector([1]).copy(nd), diff_nd);
    }
});

var Colour = Class.create(Vector, {
    hsv2rgb: function() {
        // Lineage:
        // - http://jsres.blogspot.com/2008/01/convert-hsv-to-rgb-equivalent.html
        // - http://www.easyrgb.com/math.html
        var h=this.a[0], s=this.a[1], v=this.a[2];
        var r, g, b;
        if(s==0){
            this.a[0] = this.a[1] = this.a[2] = v;
        }else{
            // h must be < 1
            var var_h = h * 6;
            if (var_h==6) var_h = 0;
            // Or ... var_i = floor( var_h )
            var var_i = Math.floor( var_h );
            var var_1 = v*(1-s);
            var var_2 = v*(1-s*(var_h-var_i));
            var var_3 = v*(1-s*(1-(var_h-var_i)));
            if(var_i==0){
                var_r = v;
                var_g = var_3;
                var_b = var_1;
            }else if(var_i==1){
                var_r = var_2;
                var_g = v;
                var_b = var_1;
            }else if(var_i==2){
                var_r = var_1;
                var_g = v;
                var_b = var_3
            }else if(var_i==3){
                var_r = var_1;
                var_g = var_2;
                var_b = v;
            }else if (var_i==4){
                var_r = var_3;
                var_g = var_1;
                var_b = v;
            }else{
                var_r = v;
                var_g = var_1;
                var_b = var_2;
            }
            this.a[0] = var_r;
            this.a[1] = var_g;
            this.a[2] = var_b;
        }
        return this;
    }
});

/* A vertex of a model; encapsulates all per-vertex input to a vertex shader.
loc: Vector, a point in affine space -- coordinate [0] must be nonzero.
colour: a Colour
tangent: local tangent Space for lighting. If empty (the default), the Vertex
    will be coloured as if it is fully lit.
*/
var Vertex = Class.create({
    initialize: function(loc, colour, tangent) {
        this.loc = loc || null;
        this.colour = colour || null;
        this.tangent = tangent || new Space();
    },

    copy: function() {
        var v = new Vertex();
        v.loc = copy(this.loc);
        v.colour = copy(this.colour);
        v.tangent = copy(this.tangent);
        return v;
    },

    times_left: function(m) {
        var v = this.copy();
        v.loc = m.times(v.loc);
        v.tangent = m.times(v.tangent);
        return v;
    }
});
