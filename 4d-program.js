var FourD = module(function(mod) {
    mod.Program = Class.create(GLProgram, {
        vertex_shader_src: [
            'uniform vec4 translation;',
            'uniform mat4 rotation;',
            'uniform mat4 projection;',
            'uniform vec4 light;',
            'uniform float ambient;',

            'attribute vec4 vertex;',
            // orthogonal basis vectors for the tangent plane
            'attribute vec4 tangent1;',
            'attribute vec4 tangent2;',

            'attribute vec4 v_colour;',
            'varying vec4 f_colour;',

            'void main(void) {',
            '    vec4 v = rotation*vertex + translation;',
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
            'varying vec4 f_colour;',

            'void main(void) {',
            '    gl_FragColor = f_colour;',
            '}'
        ].join('\n'),

        initialize: function(gl) {
            this._vertex_buffers = {}; // indexed by model.id
            this._index_buffers = {}; // indexed by model.id

            var prog = this.prog = gl.createProgram();
            this.gl = gl;

            var vertex_shader = this._make_shader(gl.VERTEX_SHADER, this.vertex_shader_src);
            var fragment_shader = this._make_shader(gl.FRAGMENT_SHADER, this.fragment_shader_src);
            gl.attachShader(prog, vertex_shader);
            gl.attachShader(prog, fragment_shader);
            gl.linkProgram(prog);

            this.translation = gl.getUniformLocation(prog, "translation");
            this.rotation = gl.getUniformLocation(prog, "rotation");
            this.projection = gl.getUniformLocation(prog, "projection");
            this.light = gl.getUniformLocation(prog, "light");
            this.ambient = gl.getUniformLocation(prog, "ambient");

            this.vertex = gl.getAttribLocation(prog, "vertex");
            this.tangent1 = gl.getAttribLocation(prog, "tangent1");
            this.tangent2 = gl.getAttribLocation(prog, "tangent2");
            this.v_colour = gl.getAttribLocation(prog, "v_colour");
            gl.enableVertexAttribArray(this.vertex);
            gl.enableVertexAttribArray(this.tangent1);
            gl.enableVertexAttribArray(this.tangent2);
            gl.enableVertexAttribArray(this.v_colour);
        },

        // assumes transform can be decomposed into a translation and a rotation
        set_transform: function(transform) {
            assert(transform.m.rows <= 5);
            assert(transform.m.cols <= 5);
            assert(transform.m.a[0][0] == 1);
            for (var i = 1; i < transform.m.cols; i++)
                assert(transform.m.a[0][i] == 0);
            var translation = transform.times(new Vector([1]));
            var rotation = transform.submatrix(1, 4, 1, 4);
            this.gl.uniform4fv(this.translation, translation.copy(5).a.slice(1, 5));
            this.gl.uniformMatrix4fv(this.rotation, false,
                    rotation.transpose().a.flatten()); // TODO why transpose?
        },

        set_projection: function(proj) {
            this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array())
        },

        set_light: function(light) {
            this.gl.uniform4fv(this.light, light.copy(5).a.slice(1, 5));
        },

        set_ambient: function(ambient) {
            this.gl.uniform1f(this.ambient, ambient);
        },

        draw_primitives: function(primitives) {
            var id = primitives.id;
            if (id in this._vertex_buffers)
                this._vertex_buffers[id].bind(this);
            else {
                var vb =  new VertexBuffer(this.gl);
                vb.bind(this);
                vb.populate(primitives);
                this._vertex_buffers[id] = vb;

                this._index_buffers[id] = new IndexBuffer(this.gl);
            }
            this._index_buffers[id].bind();
            this._index_buffers[id].populate(primitives.indices_by_triangle_depth());

            var gl = this.gl;
            gl.drawElements(gl[primitives.type], primitives.vertices.length,
                    gl.UNSIGNED_SHORT, 0);
        }
    });

    var IndexBuffer = Class.create({
        initialize: function(gl) {
            this.gl = gl;
            this.buffer = this.gl.createBuffer();
        },

        bind: function() {
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
        },

        populate: function(indices) {
            var gl = this.gl;
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices),
                gl.STREAM_DRAW);
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

        /* Buffer a Primitives into the current gl.ARRAY_BUFFER
         * primitives: Primitives
         */
        populate: function(primitives) {
            var stride = 16;
            var vertices = primitives.vertices;
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
