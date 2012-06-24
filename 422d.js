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
            assert(gl.getExtension('OES_texture_float'));

            // vertex attributes
            this._vertices = null;
            this._coords = gl.new_Buffer();
            this._tangent1s = gl.new_Buffer();
            this._tangent2s = gl.new_Buffer();
            this._colours = gl.new_Buffer();

            // depth slicing
            this._depth_textures = [gl.new_Texture(), gl.new_Texture()];
            this._aux_framebuffer = gl.new_Framebuffer();
            this._aux_framebuffer.attach_depth(gl.new_Renderbuffer());
            this._next_depth_slice = new NextDepthSliceProgram(gl);
            this._draw_slice = new DrawSliceProgram(gl);
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

            this._aux_framebuffer.depth.bind();
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, s, s);

            for (var i = 0; i < this._depth_textures.length; i++) {
                this._depth_textures[i].bind();
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, s, s, 0, gl.RGBA, gl.FLOAT, null);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            }

            this.draw_async();
        },

        draw_async: function() {
            return requestAnimFrame(this.draw.bind(this));
        },

        draw: function() {
            var gl = this._gl;
            var prev_slice = this._depth_textures[1];
            this._depth_slice_init(prev_slice);
            for (var i = 0; i < 5; i++) {
                var this_slice = this._depth_textures[i % 2];
                this._next_depth_slice.run(this, prev_slice, this_slice);
                // don't blend the first time because the bg is white and
                // white + stuff = white
                this._draw_slice.run(this, this_slice, i != 0);
                prev_slice = this_slice;
            }
        },

        _depth_slice_init: function(depth_slice) {
            var gl = this._gl;
            this._aux_framebuffer.attach_colour(depth_slice);
            // clear to depth 0 at first so no fragments get blocked
            gl.clearColor(0, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.finish();
        },

        screen2model: function(x, y) {
            var w = this.canvas.width, h = this.canvas.height;
            var p = new Vector([1, 2*x/w-1, 1-2*y/h, -1]);
            var d = new Space([[0, 0, 0, 1], [0, 0, 0, 0, 1]]);
            return this.transform.inverse().times(new AffineSpace(p, d));
        },

        // Vector you can dot with things to compute their depths (z on the screen)
        z_functional: function(nd) {
            nd = Math.max(nd, this.transform.m.cols)
            var d = new BigMatrix(new Matrix(1, nd).to_0());
            for (var i = 3; i < nd; i++)
                d.m.a[0][i] = 1;
            return new Vector(d.times(this.transform).m.a[0]);
        },

        min_z: function(points) {
            var nd = points.max(function(p) { return p.a.length; });
            var z = this.z_functional(nd);
            var p = points[0];
            for (var i = 1; i < points.length; i++)
                if (points[i].dot(z) < p.dot(z))
                    p = points[i];
            return p;
        },

    });

    /* A vertex of a model; encapsulates all per-vertex input to a vertex shader.
    loc: Vector, a point in affine space -- coordinate [0] must be nonzero.
    colour: RGBA Vector
    tangent: local tangent Space for lighting. If empty (the default), the Vertex
        will be coloured as if it is fully lit.
    */
    $.Vertex = Class.create({
        initialize: function(loc, colour, tangent) {
            this.loc = loc || null;
            this.colour = colour || null;
            this.tangent = tangent || new Space();
        },

        copy: function() {
            var v = new $.Vertex();
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

    // Takes a slice of depth values and generates depths of the next slice
    // below it.
    var NextDepthSliceProgram = Class.create(GL.Program, {
        _run: function(viewer, src_depths, dst_depths) {
            var gl = this._gl;
            var u = this._uniforms;
            var v = viewer;

            viewer._aux_framebuffer.attach_colour(dst_depths);
            src_depths.texture_unit(0);

            gl.uniform1i(u.depth_slice, 0);
            gl.uniform2f(u.dims, v.canvas.width, v.canvas.height);
            mat5(v.transform, gl, u.rotation, u.translation);
            v._coords.vertex_attrib(this._attribs.coords, 4);

            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LESS);

            // default to max depth so fragments that aren't drawn this time
            // aren't drawn later either
            gl.clearColor(1, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, v._vertices.length);
            gl.finish();
        },

        _vs_src: [
            'uniform vec4 translation;',
            'uniform mat4 rotation;',
            'attribute vec4 coords;',

            'void main(void) {',
            '    vec4 v = rotation*coords + translation;',
            '    gl_Position = vec4(v[0], v[1], v[2] + v[3], 1.);',
            '}'
        ].join('\n'),

        _fs_src: [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'uniform sampler2D depth_slice;',
            'uniform vec2 dims;',

            'void main(void) {',
            '    if (gl_FragCoord.z <= texture2D(depth_slice, gl_FragCoord.xy/dims).r)',
            '        discard;',
            '    gl_FragColor = vec4(gl_FragCoord.z, 0., 0., 1.);',
            '}'
        ].join('\n')
    });

    // Draw a slice of the model.
    var DrawSliceProgram = Class.create(GL.Program, {
        _run: function(viewer, depth_slice, blend) {
            var gl = this._gl;
            var u = this._uniforms;
            var v = viewer;

            mat5(v.transform, gl, u.rotation, u.translation);
            gl.uniform2f(u.dims, v.canvas.width, v.canvas.height);
            gl.uniform1f(u.ambient, v.ambient);
            gl.uniform4fv(u.light, vec4d(v.light));
            gl.uniform4fv(u.touch, vec4d(v.touch));
            gl.uniform1f(u.touch_radius, v.touch_radius);
            gl.uniform1i(u.depth_slice, 0);
            depth_slice.texture_unit(0);

            v._coords.vertex_attrib(this._attribs.coords, 4);
            v._tangent1s.vertex_attrib(this._attribs.tangent1, 4);
            v._tangent2s.vertex_attrib(this._attribs.tangent2, 4);
            v._colours.vertex_attrib(this._attribs.v_colour, 4);

            if (blend)
                gl.enable(gl.BLEND);
            else
                gl.disable(gl.BLEND);

            gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
            gl.disable(gl.DEPTH_TEST);

            gl.framebuffer.bind();
            gl.drawArrays(gl.TRIANGLES, 0, v._vertices.length);
            gl.finish();
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

            'uniform sampler2D depth_slice;',
            'uniform vec2 dims;',
            'uniform vec4 touch;',
            'uniform float touch_radius;',

            'varying vec4 f_colour;',
            'varying vec4 f_loc;',


            'void main(void) {',
            '    float diff = gl_FragCoord.z - texture2D(depth_slice, gl_FragCoord.xy/dims).r;',
            // XXX why? precision difference between this and the depth shader?
            '    float tolerance = .002;',
            '    if (diff < -tolerance || diff > tolerance)',
            '        discard;',

            '    float sigmoid = 1.-smoothstep(.1, .2, acos(dot(touch, normalize(f_loc))));',
            '    gl_FragColor.a = f_colour.a + (.8 - f_colour.a)*sigmoid;',
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
