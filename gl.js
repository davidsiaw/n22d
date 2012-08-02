/* This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */


/* Object oriented extensions to WebGL classes

var gl = GL.new_GL(canvas, {context parameters});
gl.new_Buffer();
gl.new_Texture();
etc.

Dependencies
    ./util.js
    prototype.js
    webgl-utils.js
    webgl-debug.js
    ./math.js
*/

var GL = module(function($) {
    $.new_GL = function(canvas, parms) {
        var gl = WebGLDebugUtils.makeDebugContext(
           WebGLUtils.setupWebGL(canvas),
           function(err, func, args) {
               var error = new Error(WebGLDebugUtils.glEnumToString(err));
               error.func = func;
               error.args = [];
               for (var i = 0; i < args.length; i++) {
                   var arg = args[i];
                   if (arg === null) // XXX bug in thing
                       arg = 'null';
                   else
                       arg = WebGLDebugUtils.glFunctionArgToString(func, i, arg);
                   error.args.push(arg);
               }
               throw error;
           });

        if (gl) {
            Object.extend(gl, GLMethods);
            gl.initialize();
            return gl;
        }
    };

    GLMethods = {
        initialize: function() {
            this.framebuffer = new $.NullFramebuffer(this);
        },

        new_Texture: function() { return this._(this.createTexture()); },
        new_Renderbuffer: function() { return this._(this.createRenderbuffer()); },
        new_Framebuffer: function() { return this._(this.createFramebuffer()); },
        new_Buffer: function() { return this._(this.createBuffer()); },
        _: function(x) {
            x._gl = this;
            return x;
        }
    };

    $.NullFramebuffer = Class.create({
        initialize: function(gl) { this._gl = gl; },
        bind: function() {
            return this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
        }
    });

    Object.extend(WebGLTexture.prototype, {
        bind: function() {
            return this._gl.bindTexture(this._gl.TEXTURE_2D, this);
        },

        texture_unit: function(unit_num) {
            this._gl.activeTexture(this._gl.TEXTURE0 + unit_num);
            this.bind();
        }
    });

    Object.extend(WebGLRenderbuffer.prototype, {
        bind: function() {
            return this._gl.bindRenderbuffer(this._gl.RENDERBUFFER, this);
        }
    });

    Object.extend(WebGLFramebuffer.prototype, {
        bind: function() {
            return this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this);
        },

        attach_colour: function(texture) {
            this.bind();
            texture.bind();
            var gl = this._gl;
            this.colour = texture;
            return gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        },

        attach_depth: function(renderbuffer) {
            this.bind();
            renderbuffer.bind();
            var gl = this._gl;
            this.depth = renderbuffer;
            return gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
        }
    });

    Object.extend(WebGLBuffer.prototype, {
        bind: function() {
            return this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this);
        },

        store: function(data) {
            this.bind();
            this._gl.bufferData(this._gl.ARRAY_BUFFER, data, this._gl.STATIC_DRAW);
        },

        vertex_attrib: function(attrib, length) {
            this.bind();
            return this._gl.vertexAttribPointer(attrib, length, this._gl.FLOAT, false, 0, 0);
        }
    });

    $.Program = Class.create({
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
            for (i = 0; i < attribs; i++) {
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

            for (i = 0; i < attribs; i++)
                gl.disableVertexAttribArray(i);
        },

        _make_shader: function(type, src) {
            var gl = this._gl;
            var shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        }
    });
});
