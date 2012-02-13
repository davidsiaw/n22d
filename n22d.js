var N22dError = Class.create();
N22dError.prototype = Object.extend(new Error, {
    initialize: function(msg) { this.message = msg; }
});

var WebGLError = Class.create(N22dError);
var ShaderCompileError = Class.create(N22dError);

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
        if (!window.WebGLRenderingContext)
            throw new WebGLError('no WebGL support');
        this.canvas = new Element('canvas');
        this.div.update(this.canvas);
        this.gl = WebGLDebugUtils.makeDebugContext(WebGLUtils.setupWebGL(this.canvas));
        if (!this.gl)
            throw new WebGLError("can't get WebGL context");

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clearDepth(1.0);
        this.gl.clearColor(1, 1, 1, 1);
        this.prog = this.init_shaders_4d();

        this.resize();
    },

    init_shaders_simple: function() {
        var vertex_shader = this.make_shader(this.gl.VERTEX_SHADER, [
            'uniform mat4 prMatrix;',
            'attribute vec3 vPos;',
            'attribute vec3 vColour;',
            'varying vec4 fColour;',
            'void main(void) {',
            '    gl_Position = prMatrix * vec4(vPos, 1.);',
            '    fColour = vec4(vColour, 1.);',
            '}'
        ].join('\n'));
        var fragment_shader = this.make_shader(this.gl.FRAGMENT_SHADER, [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'varying vec4 fColour;',

            'void main(void) {',
            '    gl_FragColor = fColour;',
            '}'
        ].join('\n'));

        var prog = this.gl.createProgram();
        this.gl.attachShader(prog, vertex_shader);
        this.gl.attachShader(prog, fragment_shader);
        this.gl.linkProgram(prog);
        this.gl.useProgram(prog);

        return prog;
    },

    init_shaders_4d: function() {
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

        var prog = this.gl.createProgram();
        this.gl.attachShader(prog, vertex_shader);
        this.gl.attachShader(prog, fragment_shader);
        this.gl.linkProgram(prog);
        this.gl.useProgram(prog);

        return prog;
    },

    make_shader: function(type, src) {
        var gl = this.gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
            throw new ShaderCompileError(gl.getShaderInfoLog(shader));
        return shader;
    },

    resize: function() {
        this.fov = Math.PI/4;
        this.width =  Math.min(new Element.Layout(this.div).get('width'),
                            document.viewport.getHeight());
        this.height = this.width
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.gl.viewport(0, 0, this.width, this.height);
    },

    draw: function() {
        var start = new Date().getTime();

        if (this.models.any(function(m) { return m.needs_draw(); })) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            var light = new Vector([1]); // light at camera
            for (var i = 0; i < this.models.length; i++)
                if (this.models[i].needs_draw())
                    this.models[i].draw(this, light);

            this.gl.flush();
        }
        this.last_draw_time = new Date().getTime() - start;
    },

    draw4d: function() {
        var start = new Date().getTime();

        if (this.models.any(function(m) { return m.needs_draw(); })) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            var light = new Vector([1]); // light at camera
            for (var i = 0; i < this.models.length; i++)
                if (this.models[i].needs_draw())
                    this.models[i].draw4d(this, light);

            this.gl.flush();
        }
        this.last_draw_time = new Date().getTime() - start;
    },

    animate: function() {
        var frame = function() {
            var time = new Date().getTime();
            this.models.each(function(m) { m.transforms.evolve(time); });
            this.draw4d();
            requestAnimFrame(frame);
        }.bind(this);
        requestAnimFrame(frame);
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
    initialize: function(r, g, b) {
        if (arguments.length == 1)
            this.a = arguments[0];
        else
            this.a = [r, g, b];
    },

    hsv2rgb: function() {
        // Lineage:
        // - http://jsres.blogspot.com/2008/01/convert-hsv-to-rgb-equivalent.html
        // - http://www.easyrgb.com/math.html
        var h=this.a[1], s=this.a[2], v=this.a[3];
        var r, g, b;
        if(s==0){
            this.a[1] = this.a[2] = this.a[3] = v;
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
            this.a[1] = var_r;
            this.a[2] = var_g;
            this.a[3] = var_b;
        }
        return this;
    }
});

var Triangle = Class.create({
    initialize: function(vs, colour) {
        assert(vs.length == 3);
        this.vs = vs;
        this.colour = colour;
    },

    transform: function(transform) {
        var vs = new Array(this.vs.length);
        for (var i = 0; i < vs.length; i++)
            vs[i] = transform.times(this.vs[i]);
        return new Triangle(vs, this.colour.copy());
    },

    tangent: function() {
        var tangent = new Space();
        tangent.expand(this.vs[0].point_minus(this.vs[2]));
        tangent.expand(this.vs[1].point_minus(this.vs[2]));
        return tangent;
    }
});

var Model = Class.create({
    initialize: function(triangles) {
        this._data = null;
        this._last_transform = null;
        this.vertex_buffer = null;
        this.triangles = triangles;
        this.transforms = new TransformChain();
    },

    // assumes triangles don't change 
    needs_draw: function() {
        return !this._last_transform ||
            !this.transforms.transform.equals(this._last_transform);
    },

    buffer: function(n22d) {
        this._data = new Float32Array(6 * 3 * this.triangles.length);
        this.vertex_buffer = n22d.gl.createBuffer();
    },

    draw: function(n22d, light) {
        if (!this.vertex_buffer)
            this.buffer(n22d);

        this._last_transform = new BigMatrix(this.transforms.transform);

        var triangles = this.triangles.map(function(t) {
            return t.transform(this.transforms.transform);
        }, this);

        var data = this._data;
        var i = 0;
        for (var j = 0; j < triangles.length; j++) {
            var triangle = triangles[j];
            var tangent = triangle.tangent();
            for (var k = 0; k < 3; k++) {
                data[i++] = triangle.vs[k].a[1];
                data[i++] = triangle.vs[k].a[2];
                data[i] = 0;
                for (var l = 3; l < triangle.vs[k].a.length; l++)
                    data[i] += triangle.vs[k].a[l];
                i++;

                var light_vector = triangle.vs[k].point_minus(light);
                var normal = light_vector.minus_space(tangent);
                if (normal.norm() == 0)
                    var colour = triangle.colour.times(0);
                else {
                    var diffuse = normal.normalized().dot(light_vector.normalized());
                    var colour = triangle.colour.times(Math.pow(diffuse, 1));
                }
                for (var l = 0; l < 3; l++)
                    data[i++] = colour.a[l];
            }
        }

        var gl = n22d.gl;
        var aspect = n22d.width / n22d.height;
        var perspective = new Matrix(4, 4).to_perspective(n22d.fov, aspect, .1, 30);
        gl.uniformMatrix4fv(gl.getUniformLocation(n22d.prog, "prMatrix"),
                false, new Float32Array(perspective.as_webgl_array()));

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

        var pos = gl.getAttribLocation(n22d.prog, "vPos");
        var colour = gl.getAttribLocation(n22d.prog, "vColour");
        gl.enableVertexAttribArray(pos);
        gl.enableVertexAttribArray(colour);
        gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 6*4, 0);
        gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 6*4, 3*4);

        gl.drawArrays(gl.TRIANGLES, 0, 3 * triangles.length);
    },

    buffer4d: function(n22d) {
        var data = this._data = new Float32Array(15*3*this.triangles.length);
        this.vertex_buffer = n22d.gl.createBuffer();
        var i = 0;
        var copy = function(vector, start, length) {
            assert(vector.a.length <= start + length);
            for (var z = start; z < vector.a.length; z++, length--)
                data[i++] = vector.a[z];
            for (; length; length--)
                data[i++] = 0;
        };

        this.triangles.each(function(triangle) {
            var tangent = triangle.tangent();
            for (var j = 0; j < triangle.vs.length; j++) {
                copy(triangle.vs[j], 1, 4);
                copy(tangent.basis[0], 1, 4);
                copy(tangent.basis[1], 1, 4);
                copy(triangle.colour, 0, 3);
            }
        });

        var gl = n22d.gl;
        var prog = n22d.prog;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

        var vertex = gl.getAttribLocation(prog, "vertex");
        var tangent1 = gl.getAttribLocation(prog, "tangent1");
        var tangent2 = gl.getAttribLocation(prog, "tangent2");
        var v_colour = gl.getAttribLocation(prog, "v_colour");
        gl.enableVertexAttribArray(vertex);
        gl.enableVertexAttribArray(tangent1);
        gl.enableVertexAttribArray(tangent2);
        gl.enableVertexAttribArray(v_colour);
        gl.vertexAttribPointer(vertex, 4, gl.FLOAT, false, 15*4, 0);
        gl.vertexAttribPointer(tangent1, 4, gl.FLOAT, false, 15*4, 4*4);
        gl.vertexAttribPointer(tangent2, 4, gl.FLOAT, false, 15*4, 8*4);
        gl.vertexAttribPointer(v_colour, 3, gl.FLOAT, false, 15*4, 12*4);
    },

    draw4d: function(n22d, light) {
        assert(this.transforms.transform.m.rows <= 5);
        assert(this.transforms.transform.m.cols <= 5);
        this._last_transform = new BigMatrix(this.transforms.transform);
        if (!this.vertex_buffer)
            this.buffer4d(n22d);
        var gl = n22d.gl;
        var prog = n22d.prog;

        var aspect = n22d.width / n22d.height;
        var translation = this.transforms.transform.times(new Vector([1]));
        var rotation = this.transforms.transform.submatrix(1, 5, 1, 5).transpose();
        var projection = new Matrix(4, 4).to_perspective(n22d.fov, aspect, .1, 30);
        gl.uniform4fv(gl.getUniformLocation(prog, "translation"),
                translation.copy(5).a.slice(1, 5));
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "rotation"),
                false, new Float32Array(rotation.a.flatten()));
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "projection"),
                false, new Float32Array(projection.as_webgl_array()));
        gl.uniform4fv(gl.getUniformLocation(prog, "light"),
                light.copy(5).a.slice(1, 5));

        gl.drawArrays(gl.TRIANGLES, 0, 3*this.triangles.length);
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
