var Fast4dProgram = Class.create(GLProgram, {
    vertex_shader_src: [
        'uniform vec4 translation;',
        'uniform mat4 rotation;',
        'uniform mat4 projection;',
        'uniform vec4 light;',

        'attribute vec4 vertex;',
        // orthogonal basis vectors for the tangent plane
        'attribute vec4 tangent1;',
        'attribute vec4 tangent2;',
        'attribute vec3 v_colour;',

        'varying vec4 f_colour;',

        'void main(void) {',
        '    vec4 v = rotation*vertex + translation;',
        '    vec4 t1 = rotation * tangent1;',
        '    vec4 t2 = rotation * tangent2;',

        '    vec4 light_dir = normalize(v - light);',
        '    vec4 normal = light_dir - t1*dot(t1, light_dir) - t2*dot(t2, light_dir);',

        '    gl_Position = projection * vec4(v[0], v[1], v[2] + v[3], 1.);',
        '    f_colour = vec4(v_colour * dot(light_dir, normalize(normal)), 1.);',
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
        var prog = this.prog = gl.createProgram();
        this.gl = gl;
        this._vertex_buffers = {}; // indexed by model.id

        var vertex_shader = this._make_shader(gl.VERTEX_SHADER, this.vertex_shader_src);
        var fragment_shader = this._make_shader(gl.FRAGMENT_SHADER, this.fragment_shader_src);
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
        var rotation = transform.submatrix(1, 4, 1, 4);
        this.gl.uniform4fv(this.translation, translation.copy(5).a.slice(1, 5));
        this.gl.uniformMatrix4fv(this.rotation, false, new Float32Array(rotation.transpose().a.flatten()));
    },

    set_projection: function(proj) {
        this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array());
    },

    draw_model: function(model) {
        if (model.id in this._vertex_buffers)
            this._bind_buffer(model);
        else {
            this._vertex_buffers[model.id] = this.gl.createBuffer();
            this._bind_buffer(model);
            this._buffer_model(model);
        }

        this._draw_arrays(model);
    },

    _bind_buffer: function(model) {
        var stride = 15;
        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vertex_buffers[model.id]);
        gl.vertexAttribPointer(this.vertex, 4, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.tangent1, 4, gl.FLOAT, false, stride*4, 4*4);
        gl.vertexAttribPointer(this.tangent2, 4, gl.FLOAT, false, stride*4, 8*4);
        gl.vertexAttribPointer(this.v_colour, 3, gl.FLOAT, false, stride*4, 12*4);
    },

    // Buffer a Model's Vertexes into the current gl.ARRAY_BUFFER
    _buffer_model: function(model) {
        var stride = 15;
        var data = new Float32Array(stride * model.vertices.length);
        var copy = this._copy_0_padded;
        for (var i = 0; i < model.vertices.length; i++) {
            var v = model.vertices[i];
            var data_i = i*stride;

            copy(v.loc.a, 1, data, data_i, 4);
            if (v.tangent.basis.length == 2) {
                copy(v.tangent.basis[0].a, 1, data, data_i+4, 4);
                copy(v.tangent.basis[1].a, 1, data, data_i+8, 4);
            } else // doesn't handle lighting with a linear tangent space
                copy([], 0, data, data_i+4, 8);
            copy(v.colour.a, 0, data, data_i+12, 3);
        }
        
        var gl = this.gl;
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    },

    _copy_0_padded: function(src, src_i, dst, dst_i, length) {
        for (; src_i < src.length; src_i++, length--)
            dst[dst_i++] = src[src_i];
        for (; length > 0; length--)
            dst[dst_i++] = 0;
    }
});
