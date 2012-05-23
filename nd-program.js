var NdProgram = Class.create(GLProgram, {
    initialize: function(n22d) {
        this.n22d = n22d;
        var gl = this.gl = n22d.gl;
        this.data = null;
        this.buffer = gl.createBuffer();

        var vertex_shader = this._make_shader(gl.VERTEX_SHADER, [
            'uniform mat4 projection;',
            'attribute vec3 vertex;',
            'attribute vec4 v_colour;',
            'varying vec4 f_colour;',
            'void main(void) {',
            '    gl_Position = projection * vec4(vertex, 1.);',
            '    f_colour = v_colour;',
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

    draw: function() {
        // this doesn't order triangles properly for alpha blending
        var gl = this.gl;
        var primitives = this.n22d.primitives;
        var transform = this.n22d.transform;
        var light = this.n22d.light;
        var ambient = this.n22d.ambient;
        this.set_viewport(this.n22d.viewport);

        var stride = 7;
        var vertices = primitives.vertices;
        var length = stride * primitives.vertices.length;
        if (!this.data || this.data.length != length)
            this.data = new Float32Array(length);

        var i = 0;
        for (var j = 0; j < vertices.length; j++) {
            var loc = transform.times(vertices[j].loc);
            var tangent = transform.times(vertices[j].tangent);
            var colour = vertices[j].colour;

            this.data[i++] = loc.a[1];
            this.data[i++] = loc.a[2];
            this.data[i] = 0;
            for (var k = 3; k < loc.a.length; k++)
                this.data[i] += loc.a[k];
            i++;

            var light_vector = loc.point_minus(light).normalized();
            var diffuse = tangent.ortho_vector(light_vector).norm();
            var illum = this.ambient + (1-ambient)*Math.pow(diffuse, .75);
            for (var l = 0; l < 3; l++)
                this.data[i++] = illum * colour.a[l];
            this.data[i++] = colour.a[3];
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(this.vertex, 3, gl.FLOAT, false, stride*4, 0);
        gl.vertexAttribPointer(this.colour, 4, gl.FLOAT, false, stride*4, 3*4);
        gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
        gl.drawArrays(gl[primitives.type], 0, vertices.length);
    }
});
