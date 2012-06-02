var FourD = module(function(mod) {
    mod.Program = Class.create(GLProgram, {
        vertex_shader_src: [
            'uniform vec4 translation;',
            'uniform mat4 rotation;',
            'uniform mat4 projection;',
            'uniform vec4 light;',
            'uniform vec4 click;',
            'uniform float ambient;',

            'attribute vec4 vertex;',
            // orthogonal basis vectors for the tangent plane
            'attribute vec4 tangent1;',
            'attribute vec4 tangent2;',

            'attribute vec4 v_colour;',
            'varying vec4 f_colour;',
            'varying vec4 f_loc;',

            'void main(void) {',
            '    vec4 v = rotation*vertex + translation;',
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

        fragment_shader_src: [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'uniform vec4 touch;',
            'uniform float touch_radius;',
            'varying vec4 f_colour;',
            'varying vec4 f_loc;',

            'void main(void) {',
            '    gl_FragColor.rgb = f_colour.rgb;',
            '    float sigmoid = 1./(1.+exp(8.*(distance(touch, f_loc)-touch_radius)));',
            '    gl_FragColor.a = f_colour.a + (.8 - f_colour.a)*sigmoid;',
            '}'
        ].join('\n'),

        initialize: function(n22d) {
            this.n22d = n22d;
            var gl = this.gl = n22d.gl;
            var prog = this.prog = gl.createProgram();
            this.vertex_buffer = new VertexBuffer(this.gl);

            var vertex_shader = this._make_shader(gl.VERTEX_SHADER, this.vertex_shader_src);
            var fragment_shader = this._make_shader(gl.FRAGMENT_SHADER, this.fragment_shader_src);
            gl.attachShader(prog, vertex_shader);
            gl.attachShader(prog, fragment_shader);
            gl.linkProgram(prog);

            this.translation = gl.getUniformLocation(prog, "translation");
            this.rotation = gl.getUniformLocation(prog, "rotation");
            this.projection = gl.getUniformLocation(prog, "projection");
            this.light = gl.getUniformLocation(prog, "light");
            this.touch = gl.getUniformLocation(prog, "touch");
            this.touch_radius = gl.getUniformLocation(prog, "touch_radius");
            this.ambient = gl.getUniformLocation(prog, "ambient");

            this.vertex = gl.getAttribLocation(prog, "vertex");
            this.tangent1 = gl.getAttribLocation(prog, "tangent1");
            this.tangent2 = gl.getAttribLocation(prog, "tangent2");
            this.v_colour = gl.getAttribLocation(prog, "v_colour");
            gl.enableVertexAttribArray(this.vertex);
            gl.enableVertexAttribArray(this.tangent1);
            gl.enableVertexAttribArray(this.tangent2);
            gl.enableVertexAttribArray(this.v_colour);

            gl.enable(this.gl.BLEND);
            gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            gl.clearDepth(1.0);
            gl.clearColor(1, 1, 1, 1);
        },

        set_viewport: function(viewport) {
            this.gl.viewport(0, 0, viewport.width, viewport.height);
            this.gl.uniformMatrix4fv(this.projection, false,
                    viewport.projection.as_webgl_array());
        },

        set_transform: function(transform) {
            assert(transform.m.rows <= 5);
            assert(transform.m.cols <= 5);
            assert(transform.m.is_affine());
            assert(transform.m.a[0][0] == 1);
            var translation = transform.times(new Vector([1]));
            var rotation = transform.submatrix(1, 4, 1, 4);
            this.gl.uniform4fv(this.translation, translation.copy(5).a.slice(1, 5));
            this.gl.uniformMatrix4fv(this.rotation, false,
                    rotation.transpose().a.flatten());
        },

        set_ambient: function(ambient) {
            this.gl.uniform1f(this.ambient, ambient);
        },

        set_light: function(light) {
            this.gl.uniform4fv(this.light, light.copy(5).a.slice(1, 5));
        },

        set_touch: function(touch_loc) {
            this.gl.uniform4fv(this.touch, touch_loc.copy(5).a.slice(1, 5));
        },

        set_touch_radius: function(radius) {
            this.gl.uniform1f(this.touch_radius, radius);
        },

        set_draw_parms: function(p) {
            this.set_viewport(p.viewport);
            this.set_transform(p.transform);
            this.set_ambient(p.ambient);
            this.set_light(p.light);
            this.set_touch(p.touch);
            this.set_touch_radius(p.touch_radius);
        },

        populate: function(vertices) {
            this.vertex_buffer.bind(this);
            this.vertex_buffer.populate(vertices);
        },

        draw: function() {
            var gl = this.gl;
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.set_draw_parms(this.n22d);
            this.vertex_buffer.bind(this);
            var primitives = this.n22d.primitives;
            gl.drawArrays(gl[primitives.type], 0, primitives.vertices.length);
            gl.flush();
        }
    });

    var VertexBuffer = Class.create({
        initialize: function(gl) {
            this.gl = gl;
            this.buffer = this.gl.createBuffer();
        },

        bind: function(prog) {
            var stride = 16;
            var gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.vertexAttribPointer(prog.vertex, 4, gl.FLOAT, false, stride*4, 0);
            gl.vertexAttribPointer(prog.tangent1, 4, gl.FLOAT, false, stride*4, 4*4);
            gl.vertexAttribPointer(prog.tangent2, 4, gl.FLOAT, false, stride*4, 8*4);
            gl.vertexAttribPointer(prog.v_colour, 4, gl.FLOAT, false, stride*4, 12*4);
        },

        /* Buffer a vertices into the current gl.ARRAY_BUFFER
         * vertices: [Vertex, ...]
         */
        populate: function(vertices) {
            var stride = 16;
            var data = new Float32Array(stride * vertices.length);
            for (var i = 0; i < vertices.length; i++) {
                var v = vertices[i];
                var data_i = i*stride;

                copy_0_padded(v.loc.a, 1, data, data_i, 4);
                if (v.tangent.basis.length == 0)
                    copy_0_padded([], 0, data, data_i+4, 8);
                else if (v.tangent.basis.length == 1) {
                    copy_0_padded(v.tangent.basis[0].a, 1, data, data_i+4, 4);
                    copy_0_padded([], 0, data, data_i+8, 4);
                } else if (v.tangent.basis.length == 2) {
                    copy_0_padded(v.tangent.basis[0].a, 1, data, data_i+4, 4);
                    copy_0_padded(v.tangent.basis[1].a, 1, data, data_i+8, 4);
                } else
                    assert(false);
                copy_0_padded(v.colour.a, 0, data, data_i+12, 4);
            }
            
            var gl = this.gl;
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        }
    });

    function copy_0_padded(src, src_i, dst, dst_i, length) {
        for (; src_i < src.length; src_i++, length--)
            dst[dst_i++] = src[src_i];
        for (; length > 0; length--)
            dst[dst_i++] = 0;
    }
});
