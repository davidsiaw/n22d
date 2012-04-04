var NdProgram = Class.create(GLProgram, {
    initialize: function(gl) {
        this.gl = gl;
        this.data = null;
        this.buffer = gl.createBuffer();

        var vertex_shader = this._make_shader(gl.VERTEX_SHADER, [
            'uniform mat4 projection;',
            'attribute vec3 vertex;',
            'attribute vec3 v_colour;',
            'varying vec4 f_colour;',
            'void main(void) {',
            '    gl_Position = projection * vec4(vertex, 1.);',
            '    f_colour = vec4(v_colour, 1.);',
            '}'
        ].join('\n'));
        var fragment_shader = this._make_shader(gl.FRAGMENT_SHADER, [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'varying vec4 f_colour;',

            'void main(void) {',
            '    gl_FragColor = f_colour;',
            '}'
        ].join('\n'));

        this.prog = gl.createProgram();
        gl.attachShader(this.prog, vertex_shader);
        gl.attachShader(this.prog, fragment_shader);
        gl.linkProgram(this.prog);

        this.projection = gl.getUniformLocation(this.prog, "projection");
        this.vertex = gl.getAttribLocation(this.prog, "vertex");
        this.colour = gl.getAttribLocation(this.prog, "v_colour");
        gl.enableVertexAttribArray(this.pos);
        gl.enableVertexAttribArray(this.colour);
    },

    set_ambient: function(ambient) { this.ambient = ambient; },
    set_light: function(light) { this.light = light; },
    set_transform: function(transform) { this.transform = transform; },
    set_projection: function(proj) {
        this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array());
    },

    draw_primitives: function(primitives) {
        var gl = this.gl;
        assert(this.transform);
        assert(this.light);

        var stride = 6;
        var vertices = primitives.vertices;
        var length = stride * primitives.vertices.length;
        if (!this.data || this.data.length < length)
            this.data = new Float32Array(length);

        var i = 0;
        for (var j = 0; j < vertices.length; j++) {
            var loc = this.transform.times(vertices[j].loc);
            var tangent = this.transform.times(vertices[j].tangent);
            var colour = vertices[j].colour;

            this.data[i++] = loc.a[1];
            this.data[i++] = loc.a[2];
            this.data[i] = 0;
            for (var k = 3; k < loc.a.length; k++)
                this.data[i] += loc.a[k];
            i++;

            var light_vector = loc.point_minus(this.light).normalized();
            var diffuse = light_vector.minus_space(tangent).norm();
            var illum = this.ambient + (1-this.ambient)*Math.pow(diffuse, .75);
            var colour = colour.times(illum, 1);
            for (var l = 0; l < 3; l++)
                this.data[i++] = colour.a[l];
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(this.vertex, 3, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.colour, 3, gl.FLOAT, false, stride*4, 3*4);
        gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
        primitives._draw_arrays(gl);
    }
});
