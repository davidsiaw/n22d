var NdProgram = Class.create(GLProgram, {
    initialize: function(gl) {
        this.gl = gl;

        var vertex_shader = this.make_shader(gl.VERTEX_SHADER, [
            'uniform mat4 projection;',
            'attribute vec3 vertex;',
            'attribute vec3 v_colour;',
            'varying vec4 f_colour;',
            'void main(void) {',
            '    gl_Position = projection * vec4(vertex, 1.);',
            '    f_colour = vec4(v_colour, 1.);',
            '}'
        ].join('\n'));
        var fragment_shader = this.make_shader(gl.FRAGMENT_SHADER, [
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
            'varying vec4 f_colour;',

            'void main(void) {',
            '    gl_FragColor = f_colour;',
            '}'
        ].join('\n'));

        this.prog = this.gl.createProgram();
        gl.attachShader(this.prog, vertex_shader);
        gl.attachShader(this.prog, fragment_shader);
        gl.linkProgram(this.prog);

        this.projection = gl.getUniformLocation(this.prog, "projection");
        this.vertex = gl.getAttribLocation(this.prog, "vertex");
        this.colour = gl.getAttribLocation(this.prog, "v_colour");
        gl.enableVertexAttribArray(this.pos);
        gl.enableVertexAttribArray(this.colour);
    },

    set_light: function(light) { this.light = light; },
    set_transform: function(transform) { this.transform = transform; },
    set_projection: function(proj) {
        this.gl.uniformMatrix4fv(this.projection, false, proj.as_webgl_array());
    },

    buffer_vertices: function(model) {
        assert(this.transform);
        assert(this.light);

        var stride = 6;
        model.buffer_size(this.gl, stride * model.vertices.length);
        var vertices = model.vertices;
        var data = model.array;

        var i = 0;
        for (var j = 0; j < vertices.length; j++) {
            var loc = this.transform.times(vertices[j].loc);
            var tangent = this.transform.times(vertices[j].tangent);
            var colour = vertices[j].colour;

            data[i++] = loc.a[1];
            data[i++] = loc.a[2];
            data[i] = 0;
            for (var k = 3; k < loc.a.length; k++)
                data[i] += loc.a[k];
            i++;

            var light_vector = loc.point_minus(this.light);
            var normal = light_vector.minus_space(tangent);
            if (normal.norm() == 0)
                var colour = colour.times(0);
            else {
                var diffuse = normal.normalized().dot(light_vector.normalized());
                var colour = colour.times(diffuse, 1);
            }
            for (var l = 0; l < 3; l++)
                data[i++] = colour.a[l];
        }

        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
        gl.vertexAttribPointer(this.vertex, 3, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.colour, 3, gl.FLOAT, false, stride*4, 3*4);
    }
});
