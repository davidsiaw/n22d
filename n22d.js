/* Widget for N-dimensional renderer that uses WebGL.
div: <div />
primitives: Primitives
Program: GLProgram constructor (optional; NdProgram by default).
*/
var N22d = Class.create({
    initialize: function(div, Program) {
        assert(!div.childElements().length);
        this.div = div;
        this.canvas = new Element('canvas');
        this.div.update(this.canvas);
        this.gl = WebGLDebugUtils.makeDebugContext(
            WebGLUtils.setupWebGL(this.canvas));
        if (!this.gl)
            return;

        this.viewport = new Viewport(this.canvas);
        this.primitives = null;
        this.transform = new BigMatrix();
        this.ambient = .3;
        this.light = new Vector([1]);
        this.touch_radius = .5;
        this.touch = new Vector([]);

        this._set_program(new (Program || NdProgram)(this));
        this._resize();
    },

    _set_program: function(program) {
        program.use();
        this.program = program;
    },

    _resize: function() {
        var size = Math.min(new Element.Layout(this.div).get('width'),
                            document.viewport.getHeight());
        this.canvas.width = this.canvas.height = size;
        this.viewport.resize();
        this.draw_async();
    },

    screen2model: function(x, y, nd) {
        var v = this.viewport.screen2clip(x, y);
        v.a[0] = 0; // no need to renormalize because it's a direction
        var line = new AffineSpace(new Vector([1,0,0,0]), new Space(v));
        var dc = new Matrix(4, nd+1).to_dim_comb(nd);
        var t = dc.times(this.transform._expand(nd+1, nd+1));
        return t.solve_affine_space(line);
    },

    draw_async: function() {
        return requestAnimFrame(this.program.draw.bind(this.program));
    }
});

var N22dError = Class.create();
N22dError.prototype = Object.extend(new Error, {
    initialize: function(msg) { this.message = msg; }
});

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
        this.projection = new Matrix(4, 4).to_perspective(this.fov, aspect, -.1, -30);
    },

    screen2clip: function(x, y) {
        var v = new Vector([1, 2*x/this.width-1, 1-2*y/this.height, -1]);
        return this.projection.inverse().times(v);
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

/* A collection of OpenGL drawing primitives.
id: string uuid
type: string 'TRIANGLES', 'LINE_STRIP', etc. from the names of the GL constants
vertices: [Vertex, ...]
*/
var Primitives = Class.create({
    initialize: function(type, vertices) {
        this.id = uuid();
        this.type = type;
        this.vertices = vertices || [];
    }
});

var ShaderCompileError = Class.create(N22dError);
var GLProgram = Class.create({
    draw: function() { assert(false); },
    use: function() { this.gl.useProgram(this.prog); },

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
