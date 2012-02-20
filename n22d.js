var N22dError = Class.create();
N22dError.prototype = Object.extend(new Error, {
    initialize: function(msg) { this.message = msg; }
});

/* N-dimensional renderer that uses WebGL.
 * div: <div />
 * models: [Model, ...] add and remove models whenever you want.
 */
var N22d = Class.create({
    initialize: function(div, models) {
        assert(!div.childElements().length);

        this.last_draw_time = 0;
        this.mouse_drag = null;
        this.models = models || [];
        this.div = div;
        this.canvas = new Element('canvas');
        this.div.update(this.canvas);
        this.gl = WebGLDebugUtils.makeDebugContext(WebGLUtils.setupWebGL(this.canvas));
        if (!this.gl)
            return;

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clearDepth(1.0);
        this.gl.clearColor(1, 1, 1, 1);
        this._set_program(new NdProgram(this.gl));
    },

    _set_program: function(prog) {
        this.gl.useProgram(prog.prog);
        prog.set_light(new Vector([1]));
        this.prog = prog;
        this.resize();
    },

    resize: function() {
        this.fov = Math.PI/4;
        this.width =  Math.min(new Element.Layout(this.div).get('width'),
                            document.viewport.getHeight());
        this.height = this.width
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.gl.viewport(0, 0, this.width, this.height);

        var aspect = this.width / this.height;
        var proj = new Matrix(4, 4).to_perspective(this.fov, aspect, .1, 30);
        this.prog.set_projection(proj);
    },

    draw: function() {
        var start = new Date().getTime();

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        for (var i = 0; i < this.models.length; i++) {
            var model = this.models[i];
            model.transforms.evolve(start);
            this.prog.set_transform(model.transforms.transform);
            this.prog.draw_model(model);
        }

        this.gl.flush();
        this.last_draw_time = new Date().getTime() - start;
    },

    pos_calc_closure: function() {
        var width = this.canvas.width, height = this.canvas.height, fov = this.fov;
        return function(x, y) {
            x = (2*x - width) / height;
            y = 1 - 2*y/height;
            return new Vector([0, x, y, -1/Math.tan(fov/2)]); //
        };
    },

    ondrag: function(callback) {
        return this.mouse_drag = new MouseDrag3D(this, callback);
    }
});

var ShaderCompileError = Class.create(N22dError);
var GLProgram = Class.create({
    draw_model: function(model) {
        this.buffer_vertices(model);
        this.gl.drawArrays(model.type, 0, model.vertices.length);
    },

    make_shader: function(type, src) {
        var gl = this.gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
            throw new ShaderCompileError(gl.getShaderInfoLog(shader));
        return shader;
    }
});

var NdProgram = Class.create(GLProgram, {
    initialize: function(gl) {
        this.gl = gl;

        var vertex_shader = this.make_shader(gl.VERTEX_SHADER, [
            'uniform mat4 projection;',
            'attribute vec3 vertex;',
            'attribute vec3 v_colour;',
            'varying vec4 f_colour;',
            'void main(void) {',
            '    gl_Position = projection * vec4(vertex, 1.);',
            '    f_colour = vec4(v_colour, 1.);',
            '}'
        ].join('\n'));
        var fragment_shader = this.make_shader(gl.FRAGMENT_SHADER, [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'varying vec4 f_colour;',

            'void main(void) {',
            '    gl_FragColor = f_colour;',
            '}'
        ].join('\n'));

        this.prog = this.gl.createProgram();
        gl.attachShader(this.prog, vertex_shader);
        gl.attachShader(this.prog, fragment_shader);
        gl.linkProgram(this.prog);

        this.projection = gl.getUniformLocation(this.prog, "projection");
        this.vertex = gl.getAttribLocation(this.prog, "vertex");
        this.colour = gl.getAttribLocation(this.prog, "v_colour");
        gl.enableVertexAttribArray(this.pos);
        gl.enableVertexAttribArray(this.colour);
    },

    set_light: function(light) { this.light = light; },
    set_transform: function(transform) { this.transform = transform; },
    set_projection: function(proj) {
        this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array());
    },

    buffer_vertices: function(model) {
        assert(this.transform);
        assert(this.light);

        var stride = 6;
        model.buffer_size(this.gl, stride * model.vertices.length);
        var vertices = model.vertices;
        var data = model.array;

        var i = 0;
        for (var j = 0; j < vertices.length; j++) {
            var loc = this.transform.times(vertices[j].loc);
            var tangent = this.transform.times(vertices[j].tangent);
            var colour = vertices[j].colour;

            data[i++] = loc.a[1];
            data[i++] = loc.a[2];
            data[i] = 0;
            for (var k = 3; k < loc.a.length; k++)
                data[i] += loc.a[k];
            i++;

            var light_vector = loc.point_minus(this.light);
            var normal = light_vector.minus_space(tangent);
            if (normal.norm() == 0)
                var colour = colour.times(0);
            else {
                var diffuse = normal.normalized().dot(light_vector.normalized());
                var colour = colour.times(diffuse, 1);
            }
            for (var l = 0; l < 3; l++)
                data[i++] = colour.a[l];
        }

        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
        gl.vertexAttribPointer(this.vertex, 3, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.colour, 3, gl.FLOAT, false, stride*4, 3*4);
    }
});

var Fast4dProgram = Class.create(GLProgram, {
    initialize: function(gl) {
        var prog = this.prog = gl.createProgram();
        this.gl = gl;

        var vs = $('4d-vs').textContent;
        var vertex_shader = this.make_shader(this.gl.VERTEX_SHADER, vs);
        var fragment_shader = this.make_shader(this.gl.FRAGMENT_SHADER, [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'varying vec4 f_colour;',

            'void main(void) {',
            '    gl_FragColor = f_colour;',
            '}'
        ].join('\n'));

        gl.attachShader(prog, vertex_shader);
        gl.attachShader(prog, fragment_shader);
        gl.linkProgram(prog);

        this.translation = gl.getUniformLocation(prog, "translation");
        this.rotation = gl.getUniformLocation(prog, "rotation");
        this.projection = gl.getUniformLocation(prog, "projection");
        this.light = gl.getUniformLocation(prog, "light");
        this.vertex = gl.getAttribLocation(prog, "vertex");
        this.tangent1 = gl.getAttribLocation(prog, "tangent1");
        this.tangent2 = gl.getAttribLocation(prog, "tangent2");
        this.v_colour = gl.getAttribLocation(prog, "v_colour");
        gl.enableVertexAttribArray(this.vertex);
        gl.enableVertexAttribArray(this.tangent1);
        gl.enableVertexAttribArray(this.tangent2);
        gl.enableVertexAttribArray(this.v_colour);
    },

    set_light: function(light) {
        this.gl.uniform4fv(this.light, light.copy(5).a.slice(1, 5));
    },

    // assumes transform can be decomposed into a translation and a rotation
    set_transform: function(transform) { 
        assert(transform.m.rows <= 5);
        assert(transform.m.cols <= 5);
        var translation = transform.times(new Vector([1]));
        var rotation = transform.submatrix(1, 5, 1, 5);
        this.gl.uniform4fv(this.translation, translation.copy(5).a.slice(1, 5));
        this.gl.uniformMatrix4fv(this.rotation, false, new Float32Array(rotation.transpose().a.flatten()));
    },

    set_projection: function(proj) {
        this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array());
    },

    buffer_vertices: function(model) {
        if (model.array)
            return; // already buffered

        var stride = 15;
        model.buffer_size(this.gl, stride * model.vertices.length);

        var i = 0;
        var data = model.array;
        var copy = function(a, start, length) {
            assert(a.length <= start + length);
            for (var z = start; z < a.length; z++, length--)
                data[i++] = a[z];
            for (; length; length--)
                data[i++] = 0;
        };

        model.vertices.each(function(v) {
            copy(v.loc.a, 1, 4);
            copy(v.tangent.basis[0].a, 1, 4);
            copy(v.tangent.basis[1].a, 1, 4);
            copy(v.colour.a, 0, 3);
        });

        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.vertex, 4, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.tangent1, 4, gl.FLOAT, false, stride*4, 4*4);
        gl.vertexAttribPointer(this.tangent2, 4, gl.FLOAT, false, stride*4, 8*4);
        gl.vertexAttribPointer(this.v_colour, 3, gl.FLOAT, false, stride*4, 12*4);
    },
});

// a vertex of a model; encapsulates all per-vertex input to a vertex shader
var Vertex = Class.create({
    initialize: function() {
        // location as a point in affine space -- coordinate [0] must be 1
        this.loc = null;
        // tangent space of the surface at this vertex (for lighting)
        this.tangent = null;
        this.colour = null;
    },

    copy: function() {
        var v = new Vertex();
        v.loc = this.loc.copy();
        v.tangent = this.tangent.copy();
        v.colour = this.colour.copy();
        return v;
    }
});

// A Model is a collection of vertices to be drawn in one shot along with
// other information necessary for drawing.
var Model = Class.create({
    initialize: function(type, vertices) {
        this.type = type;
        this.vertices = vertices;
        this.array = null;
        this.buffer = null;
        this.transforms = new TransformChain();
        this._last_transform = null;
    },

    buffer_size: function(gl, num_floats) {
        if (!this.array || this.array.length != num_floats) {
            this.array = new Float32Array(num_floats);
            this.buffer = gl.createBuffer();
        }
    }
});

// stores state for a mouse drag
var MouseDrag3D = Class.create({
    initialize: function(n22d, callback) {
        this.callback = callback;
        this.pos_calc = n22d.pos_calc_closure();

        this.dragging = false;
        this.pos_first = null;
        this.pos_prev = null;
        this.pos = null;
        this.move_event = null; // only set during event handling

        // don't store el to avoid circular references in the DOM
        var el = n22d.canvas;
        el.observe('mousedown', this._mousedown_cb.bind(this));
        el.observe('mouseup', this._mouseup_cb.bind(this));
        el.observe('mousemove', this._mousemove_cb.bind(this));
    },

    _mousedown_cb: function(ev) {
        this.dragging = true;
        var x = ev.offsetX, y = ev.offsetY;
        this.pos_first = this.pos_prev = this.pos = this.pos_calc(x, y);
    },

    _mouseup_cb: function(ev) {
        this.dragging = false;
    },

    _mousemove_cb: function(ev) {
        if (!this.dragging)
            return;
        this.pos_prev = this.pos;
        this.pos = this.pos_calc(ev.offsetX, ev.offsetY);

        this.move_event = ev;
        this.callback(this);
        this.move_event = null; // break reference cycle
    },

    distance: function() {
        return this.pos.minus(this.pos_prev).norm();
    }
});
