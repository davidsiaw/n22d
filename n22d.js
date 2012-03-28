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
        this._set_program(new Fast4dProgram(this.gl));
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
                var_b = var_2
            }
            this.a[0] = var_r;
            this.a[1] = var_g;
            this.a[2] = var_b;
        }
        return this;
    }
});

// A vertex of a model; encapsulates all per-vertex input to a vertex shader.
var Vertex = Class.create({
    initialize: function(loc, colour, tangent) {
        // location as a point in affine space -- coordinate [0] must be 1
        this.loc = loc || null;
        this.colour = colour || null;
        // tangent space of the surface at this vertex (for lighting)
        this.tangent = tangent || new Space();
        // an empty tangent space means this vertex is always fully coloured
    },

    copy: function() {
        var v = new Vertex();
        v.loc = this.loc.copy();
        v.colour = this.colour.copy();
        v.tangent = this.tangent.copy();
        return v;
    },

    times_left: function(m) {
        var v = this.copy();
        v.loc = m.times(v.loc);
        v.tangent = m.times(v.tangent);
        return v;
    }
});

/* A group of Primitives objects, possibly nested.
children: [Model, ...]
transforms: TransformChain
*/
var Model = Class.create({
    initialize: function(children) {
        this.children = children || [];
        this.transforms = new TransformChain();
    }
});

/* A collection of OpenGL drawing primitives.
id: string uuid
type: string 'TRIANGLES', 'LINE_STRIP', etc. from the names of the GL constants
vertices: [Vertex, ...]
*/
var Primitives = Class.create(Model, {
    initialize: function($super, type, vertices) {
        $super();
        this.id = uuid();
        this.type = type;
        this.vertices = vertices || [];
    }
});

var ShaderCompileError = Class.create(N22dError);
var GLProgram = Class.create({
    set_light: function(light) { assert(false); },
    set_transform: function(transform) { assert(false); },
    set_projection: function(proj) { assert(false); },
    draw_primitives: function(primitives) { assert(false); },

    // transform is optional
    draw_model: function(model, transform) {
        model.transforms.update_transform();
        transform = transform || new BigMatrix().to_I();
        transform = transform.times(model.transforms.transform);
        if (model.vertices) {
            this.set_transform(transform);
            this.draw_primitives(model);
        } else
            model.children.each(function(child) {
                this.draw_model(child, transform);
            }, this);
    },

    _draw_arrays: function(primitives) {
        this.gl.drawArrays(this.gl[primitives.type], 0,
                           primitives.vertices.length);
    },

    _make_shader: function(type, src) {
        var gl = this.gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
            throw new ShaderCompileError(gl.getShaderInfoLog(shader));
        return shader;
    }
});

// Lazily-computed transform
var LazyTransform = Class.create({
    initialize: function(t) {
        this.transform = t || new BigMatrix().to_I();
    },
    evolve: function() {},
    update_transform: function() {}
});

var Rotation = Class.create(LazyTransform, {
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

var Position = Class.create(LazyTransform, {
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

var TransformChain = Class.create(LazyTransform, {
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
