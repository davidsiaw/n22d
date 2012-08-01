var FourD = module(function($) {
    $.Four22d = Class.create({
        initialize: function() {
            // writable
            this.transform = new AffineUnitaryBigMatrix().to_I();
            this.light = new Vector([1, 0, 0, -1]);
            this.ambient = .3;
            this.touch = new Vector([]);
            this.touch_radius = 1/8;

            // readable
            this.dom = new Element('div');
            this.canvas = new Element('canvas');

            var resize = this._resize_cb.bind(this);
            this.dom.observe('DOMNodeInserted', resize);
            this.dom.observe('resize', resize);
            this.dom.update(this.canvas);

            // gl
            var gl = this._gl = GL.new_GL(this.canvas, {alpha: true});
            if (!gl) return;
            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            this._draw_prog = new DrawProgram(gl);

            // vertex attributes
            this._vertices = null;
            this._coords = gl.new_Buffer();
            this._tangent1s = gl.new_Buffer();
            this._tangent2s = gl.new_Buffer();
            this._colours = gl.new_Buffer();
        },

        set_vertices: function(vertices) {
            var coords = new Float32Array(4*vertices.length);
            var t1s = new Float32Array(4*vertices.length);
            var t2s = new Float32Array(4*vertices.length);
            var colours = new Float32Array(4*vertices.length);

            for (var i=0, j=0; i < vertices.length; i++, j+=4) {
                var v = vertices[i];
                copy4d(v.loc, coords, j);
                copy4d(v.tangent.basis[0], t1s, j);
                copy4d(v.tangent.basis[1], t2s, j);
                for (var k = 0; k < 4; k++)
                    colours[j+k] = v.colour.a[k];
            }

            this._coords.store(coords);
            this._tangent1s.store(t1s);
            this._tangent2s.store(t2s);
            this._colours.store(colours);
            this._vertices = vertices;
        },

        _resize_cb: function() {
            var gl = this._gl;
            var s = 512; // XXX
            this.canvas.width = this.canvas.height = s;
            gl.viewport(0, 0, s, s);
        },

        draw: function() {
            this._draw_prog.run(this);
        }
    });

    /* A vertex of a model; encapsulates all per-vertex input to a vertex shader.
    loc: Vector, a point in affine space -- coordinate [0] must be nonzero.
    colour: RGBA Vector
    tangent: local tangent Space for lighting. If empty (the default), the Vertex
        will be coloured as if it is fully lit.
    */
    $.Vertex = Class.create({
        initialize: function(loc, colour, tangent) {
            this.loc = loc ? as_Vector(loc) : null;
            this.colour = colour ? as_Vector(colour) : null;
            this.tangent = tangent || new Space();
        },

        copy: function() {
            var v = new $.Vertex();
            v.loc = copy(this.loc);
            v.colour = copy(this.colour);
            v.tangent = copy(this.tangent);
            return v;
        },

        as_Vectors: function(func) {
            var v = this.copy();
            v.loc = func(v.loc);
            v.tangent = func(v.tangent);
            return v;
        }
    });

    var DrawProgram = Class.create(GL.Program, {
        _run: function(viewer) {
            var gl = this._gl;
            var u = this._uniforms;
            var v = viewer;

            mat5(v.transform, gl, u.rotation, u.translation);
            gl.uniform1f(u.ambient, v.ambient);
            gl.uniform4fv(u.light, vec4d(v.light));

            v._coords.vertex_attrib(this._attribs.coords, 4);
            v._tangent1s.vertex_attrib(this._attribs.tangent1, 4);
            v._tangent2s.vertex_attrib(this._attribs.tangent2, 4);
            v._colours.vertex_attrib(this._attribs.v_colour, 4);

            gl.drawArrays(gl.TRIANGLES, 0, v._vertices.length);
            gl.flush();
        },

        _vs_src: [
            'uniform vec4 translation;',
            'uniform mat4 rotation;',
            'uniform mat4 projection;',
            'uniform vec4 light;',
            'uniform float ambient;',

            'attribute vec4 coords;',
            // orthogonal basis vectors for the tangent plane
            'attribute vec4 tangent1;',
            'attribute vec4 tangent2;',

            'attribute vec4 v_colour;',
            'varying vec4 f_colour;',
            'varying vec4 f_loc;',

            'void main(void) {',
            '    vec4 v = rotation*coords + translation;',
            '    f_loc = v;',
            '    gl_Position = vec4(v[0], v[1], v[2] + v[3], 1.);',

            '    vec4 t1 = rotation * tangent1;',
            '    vec4 t2 = rotation * tangent2;',

            '    vec4 light_dir = normalize(v - light);',
            '    vec4 normal = light_dir - t1*dot(t1, light_dir) - t2*dot(t2, light_dir);',
            '    float illum = pow(length(normal), .75);',
            '    illum = ambient + (1.-ambient) * illum;',
            '    f_colour.a = v_colour.a;',
            '    f_colour.rgb = illum * v_colour.rgb;',
            '}'
        ].join('\n'),

        _fs_src: [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'varying vec4 f_colour;',
            'varying vec4 f_loc;',

            'void main(void) {',
            '    gl_FragColor.a = f_colour.a;',
            '    gl_FragColor.rgb = gl_FragColor.a*f_colour.rgb;',
            '}'
        ].join('\n')
    });

    function copy4d(v, dst, j) {
        assert(v.a.length <= 5);
        for (var i = 1; i < v.a.length; i++)
            dst[j++] = v.a[i];
        for (; i < 5; i++)
            dst[j++] = 0;
    }

    function vec4d(v) {
        assert(v.a.length <= 5);
        return v.copy(5).a.slice(1, 5);
    }

    function mat4(m) {
        assert(m.rows == 4);
        assert(m.cols == 4);
        // move w to the end
        var a = m.transpose().a;
        return [a[1][1], a[1][2], a[1][3], a[1][0],
                a[2][1], a[2][2], a[2][3], a[2][0],
                a[3][1], a[3][2], a[3][3], a[3][0],
                a[0][1], a[0][2], a[0][3], a[0][0]];
    }

    // u_translation and u_rotation are uniforms
    function mat5(m, gl, u_rotation, u_translation) {
        assert(m.m.rows <= 5);
        assert(m.m.cols <= 5);
        assert(m.m.is_affine());
        var translation = m.times(new Vector([1]));
        assert(translation.a[0] == 1);
        var rotation = m.submatrix(1, 4, 1, 4);
        gl.uniform4fv(u_translation, translation.copy(5).a.slice(1, 5));
        gl.uniformMatrix4fv(u_rotation, false, rotation.transpose().a.flatten());
    }
});
