var FourD = module(function(mod) {
    mod.Four22d = Class.create({
        initialize: function() {
            // writable:
            this.transform = new AffineUnitaryBigMatrix();
            this.light = new Vector([1]);
            this.ambient = .3;
            this.touch = new Vector([]);
            this.touch_radius = .5;

            this.dom = new Element('div');
            this.dom.observe('DOMNodeInserted', this.resize.bind(this));
            this.dom.observe('resize', this.resize.bind(this));
            this.canvas = new Element('canvas');
            this.dom.update(this.canvas);
            this.gl = this._make_gl({alpha: true});
            if (!this.gl)
                return;

            var gl = this.gl;
            assert(gl.getExtension('OES_texture_float'));

            this._next_depth_slice = new NextDepthSliceProgram(gl);
            this._draw_slice = new DrawSliceProgram(gl);
            this._view_texture = new ViewTexture(gl);
            this._depth_textures = [newTexture(gl), newTexture(gl)];

            // vertex attributes
            this._vertices = null;
            this._coords = newStaticFloat32Buffer(gl, 4);
            this._tangent1s = newStaticFloat32Buffer(gl, 4);
            this._tangent2s = newStaticFloat32Buffer(gl, 4);
            this._colours = newStaticFloat32Buffer(gl, 4);

            this._viewport = new mod.Viewport(this.canvas);
            this._dst_framebuffer = new NullFramebuffer(gl);
            this._aux_framebuffer = newFramebuffer(gl);
            this._aux_framebuffer.attach_depth(newRenderbuffer(gl));
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

        resize: function() {
            var gl = this.gl;
            var s = Math.min(new Element.Layout(this.dom).get('width'),
                                document.viewport.getHeight());
            s = 512; // XXX
            this.canvas.width = this.canvas.height = s;
            this._viewport.resize();

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
            this._dst_framebuffer.bind();
            var gl = this.gl;
            gl.clearColor(1, 1, 1, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            var prev_slice = this._depth_textures[1];
            this._depth_slice_init(prev_slice);
            for (var i = 0; i < 4; i++) {
                var this_slice = this._depth_textures[i % 2];
                this._next_depth_slice.run(this, prev_slice, this_slice);
                // don't blend the first time because the bg is white and
                // white + stuff = white
                this._draw_slice.run(this, this_slice, i != 0);
                prev_slice = this_slice;
            }
        },

        _depth_slice_init: function(depth_slice) {
            var gl = this.gl;
            this._aux_framebuffer.attach_colour(depth_slice);
            // clear to depth 0 at first so no fragments get blocked
            gl.clearColor(0, 1, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.finish();
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

        _make_gl: function(parms) {
            return WebGLDebugUtils.makeDebugContext(
               WebGLUtils.setupWebGL(this.canvas),
               function(err, func, args) {
                   var error = new Error(WebGLDebugUtils.glEnumToString(err));
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
        }
    });

    mod.Viewport = Class.create({
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

    /* A vertex of a model; encapsulates all per-vertex input to a vertex shader.
    loc: Vector, a point in affine space -- coordinate [0] must be nonzero.
    colour: RGBA Vector
    tangent: local tangent Space for lighting. If empty (the default), the Vertex
        will be coloured as if it is fully lit.
    */
    mod.Vertex = Class.create({
        initialize: function(loc, colour, tangent) {
            this.loc = loc || null;
            this.colour = colour || null;
            this.tangent = tangent || new Space();
        },

        copy: function() {
            var v = new mod.Vertex();
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
    var NextDepthSliceProgram = Class.create(Program, {
        _run: function(viewer, src_depths, dst_depths) {
            var gl = this._gl;
            var u = this._uniforms;
            var v = viewer;

            viewer._aux_framebuffer.attach_colour(dst_depths);
            src_depths.texture_unit(0);

            gl.uniform1i(u.depth_slice, 0);
            gl.uniformMatrix4fv(u.projection, false, v._viewport.projection.as_webgl_array());
            gl.uniform2f(u.dims, v._viewport.width, v._viewport.height);
            this._set_transform(v.transform);
            v._coords.vertex_attrib(this._attribs.coords);

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

        _set_transform: function(transform) {
            assert(transform.m.rows <= 5);
            assert(transform.m.cols <= 5);
            assert(transform.m.is_affine());
            assert(transform.m.a[0][0] == 1);
            var translation = transform.times(new Vector([1]));
            var rotation = transform.submatrix(1, 4, 1, 4);
            var gl = this._gl;
            gl.uniform4fv(this._uniforms.translation, translation.copy(5).a.slice(1, 5));
            gl.uniformMatrix4fv(this._uniforms.rotation, false, rotation.transpose().a.flatten());
        },

        _vs_src: [
            'uniform vec4 translation;',
            'uniform mat4 rotation;',
            'uniform mat4 projection;',
            'attribute vec4 coords;',

            'void main(void) {',
            '    vec4 v = rotation*coords + translation;',
            '    gl_Position = projection * vec4(v[0], v[1], v[2] + v[3], 1.);',
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
    var DrawSliceProgram = Class.create(Program, {
        _run: function(viewer, depth_slice, blend) {
            var gl = this._gl;
            var u = this._uniforms;
            var v = viewer;

            this._set_transform(v.transform);
            gl.uniform2f(u.dims, v._viewport.width, v._viewport.height);
            gl.uniformMatrix4fv(u.projection, false, v._viewport.projection.as_webgl_array());
            gl.uniform1f(u.ambient, v.ambient);
            gl.uniform4fv(u.light, vec4d(v.light));
            gl.uniform4fv(u.touch, vec4d(v.touch));
            gl.uniform1f(u.touch_radius, v.touch_radius);
            gl.uniform1i(u.depth_slice, 0);
            depth_slice.texture_unit(0);

            v._coords.vertex_attrib(this._attribs.coords);
            v._tangent1s.vertex_attrib(this._attribs.tangent1);
            v._tangent2s.vertex_attrib(this._attribs.tangent2);
            v._colours.vertex_attrib(this._attribs.v_colour);

            if (blend)
                gl.enable(gl.BLEND);
            else
                gl.disable(gl.BLEND);

            gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
            gl.disable(gl.DEPTH_TEST);

            v._dst_framebuffer.bind();
            gl.drawArrays(gl.TRIANGLES, 0, v._vertices.length);
            gl.finish();
        },

        _set_transform: function(transform) {
            assert(transform.m.rows <= 5);
            assert(transform.m.cols <= 5);
            assert(transform.m.is_affine());
            assert(transform.m.a[0][0] == 1);
            var translation = transform.times(new Vector([1]));
            var rotation = transform.submatrix(1, 4, 1, 4);

            var gl = this._gl;
            gl.uniform4fv(this._uniforms.translation, translation.copy(5).a.slice(1, 5));
            gl.uniformMatrix4fv(this._uniforms.rotation, false, rotation.transpose().a.flatten());
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
            '    gl_Position = projection * vec4(v[0], v[1], v[2] + v[3], 1.);',

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

            '    float sigmoid = 1./(1.+exp(8.*(distance(touch, f_loc)-touch_radius)));',
            '    gl_FragColor.a = f_colour.a + (.8 - f_colour.a)*sigmoid;',
            '    gl_FragColor.rgb = gl_FragColor.a*f_colour.rgb;',
            '}'
        ].join('\n')
    });

    var ViewTexture = Class.create(Program, {
        initialize: function($super, gl) {
            $super(gl);
            var square = [
                [-1, -1], [-1, 1], [1, 1],
                [1, 1], [1, -1], [-1, -1]
            ].flatten();
            this._buffer = newStaticBuffer(gl);
            this._buffer.store(new Float32Array(square));
        },

        _run: function(p) {
            var gl = this._gl;
            var u = this._uniforms;

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, p.texture);
            gl.uniform1i(u.texture, 0);
            gl.uniform2f(u.dims, p.viewport.width, p.viewport.height);

            this._buffer.bind();
            gl.vertexAttribPointer(this._attribs.v, 2, gl.FLOAT, false, 0, 0);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.finish();
        },

        _vs_src: [
            'attribute vec2 v;',

            'void main(void) {',
            '    gl_Position = vec4(v[0], v[1], 0., 1.);',
            '}'
        ].join('\n'),

        _fs_src: [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'uniform sampler2D texture;',
            'uniform vec2 dims;',

            'void main(void) {',
            '    gl_FragColor = texture2D(texture, gl_FragCoord.xy/dims);',
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
});
