// Extensions to WebGL* classes to make them more convenient and object-oriented.
// They only work when you use the special constructor functions to make your
// buffers and things.

var GL = {};
function GL_init(gl) {
    for (var key in gl)
        if (typeof gl[key] == 'number')
            GL[key] = gl[key];
}


function newTexture(gl) {
    var t = gl.createTexture();
    t.gl = gl;
    return t;
}

Object.extend(WebGLTexture.prototype, {
    bind: function() {
        return this.gl.bindTexture(this.gl.TEXTURE_2D, this);
    },

    texture_unit: function(unit_num) {
        this.gl.activeTexture(this.gl.TEXTURE0 + unit_num);
        this.bind();
    }
});


function newRenderbuffer(gl) {
    var r = gl.createRenderbuffer();
    r.gl = gl;
    return r;
}

Object.extend(WebGLRenderbuffer.prototype, {
    bind: function() {
        return this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this);
    }
});

var NullFramebuffer = Class.create({
    initialize: function(gl) { this.gl = gl; },
    bind: function() {
        return this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
});

function newFramebuffer(gl) {
    var fb = gl.createFramebuffer();
    fb.gl = gl;
    return fb;
}

Object.extend(WebGLFramebuffer.prototype, {
    bind: function() {
        return this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this);
    },

    attach_colour: function(texture) {
        this.bind();
        texture.bind();
        var gl = this.gl;
        this.colour = texture;
        return gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    },

    attach_depth: function(renderbuffer) {
        this.bind();
        renderbuffer.bind();
        var gl = this.gl;
        this.depth = renderbuffer;
        return gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
    }
});


function newStaticBuffer(gl) {
    var b = gl.createBuffer();
    b.gl = gl;
    Object.extend(b, StaticBufferMethods);
    return b;
}

var StaticBufferMethods = {
    bind: function() {
        return this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this);
    },

    store: function(data) {
        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    }
};

function newStaticFloat32Buffer(gl, stride) {
    var b = newStaticBuffer(gl);
    b.stride = stride;
    Object.extend(b, StaticFloat32BufferMethods);
    return b;
}

var StaticFloat32BufferMethods = {
    vertex_attrib: function(attrib) {
        this.bind();
        return this.gl.vertexAttribPointer(attrib, this.stride, this.gl.FLOAT, false, 0, 0);
    }
};


var Program = Class.create({
    initialize: function(gl) {
        this._gl = gl;
        var vs = this._make_shader(gl.VERTEX_SHADER, this._vs_src);
        var fs = this._make_shader(gl.FRAGMENT_SHADER, this._fs_src);

        var prog = this._prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        var unis = this.get(gl.ACTIVE_UNIFORMS);
        this._uniforms = {};
        for (var i = 0; i < unis; i++) {
            var uniform = gl.getActiveUniform(prog, i);
            this._uniforms[uniform.name] = gl.getUniformLocation(prog, uniform.name);
        }

        var attribs = this.get(gl.ACTIVE_ATTRIBUTES);
        this._attribs = {};
        for (var i = 0; i < attribs; i++) {
            var attrib = gl.getActiveAttrib(prog, i);
            this._attribs[attrib.name] = gl.getAttribLocation(prog, attrib.name);
        }
    },

    get: function(parm) {
        return this._gl.getProgramParameter(this._prog, parm);
    },

    run: function() {
        var gl = this._gl;
        var attribs = this.get(gl.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < attribs; i++)
            gl.enableVertexAttribArray(i);

        gl.useProgram(this._prog);
        this._run.apply(this, arguments);
        gl.useProgram(null);

        for (var i = 0; i < attribs; i++)
            gl.disableVertexAttribArray(i);
    },

    _make_shader: function(type, src) {
        var gl = this._gl;
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
            throw new ShaderCompileError(gl.getShaderInfoLog(shader));
        return shader;
    }
});
