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

// A vertex of a model; encapsulates all per-vertex input to a vertex shader.
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

// A Model is a collection of Vertexes to be drawn in one shot along with
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
