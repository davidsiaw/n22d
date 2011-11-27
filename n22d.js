/* N-dimensional renderer that uses WebGL.
 * div: <div />
 * models: [Model, ...] add and remove models whenever you want.
 */
function N22d(div, models) {
    assert(!div.children().length);

    this.models = models || [];
    this.div = div;
    if (!window.WebGLRenderingContext)
        return this.error(
            "Your browser doesn't support WebGL. For this to work " +
            "you need to <a href='http://get.webgl.org'>get WebGL</a>.");
    this.canvas = $('<canvas></canvas>')[0];
    this.div.append(this.canvas);
    this.gl = this.canvas.getContext("experimental-webgl");
    if (!this.gl)
        this.error(
            "WebGL isn't working. Maybe " +
            "<a href='http://get.webgl.org'>http://get.webgl.org</a> " +
            "can help you.");
    this.prog = this.init_shaders();
    this.vertex_buffer = this.gl.createBuffer();
    
    var gl = this.gl;
    var pos = gl.getAttribLocation(this.prog, "vPos");
    var colour = gl.getAttribLocation(this.prog, "vColour");
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 6*4, 0);
    gl.enableVertexAttribArray(colour);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 6*4, 3*4);

    gl.enable(gl.DEPTH_TEST);
    gl.clearDepth(1.0);
    gl.clearColor(1, 1, 1, 1);

    this.resize();
}

N22d.prototype.error = function(msg) {
    this.div.append($('<span>'+msg+'</span>'));
    throw new Error(msg);
};

N22d.prototype.init_shaders = function() {
    var prog = this.gl.createProgram();
    this.gl.attachShader(prog, getShader(this.gl, "shader-vs"));
    this.gl.attachShader(prog, getShader(this.gl, "shader-fs"));
    this.gl.linkProgram(prog);
    this.gl.useProgram(prog);
    return prog;
}

N22d.prototype.resize = function() {
    var width = $(this.div).width();
    var height = $(this.div).height();
    this.canvas.width = width
    this.canvas.height = height
    this.gl.viewport(0, 0, width, height);

    var persp = new Matrix(4, 4).to_perspective(Math.PI/4, width/height, .1, 30);
    this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.prog,"prMatrix"),
            false, new Float32Array(persp.as_webgl_array()));
};

N22d.prototype.draw = function() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    for (var i = 0; i < this.models.length; i++)
        this._draw_triangles(this.models[i].transformed_triangles());

    this.gl.flush();
};

N22d.prototype._draw_triangles = function(triangles) {
    var data = new Float32Array(6 * 3 * triangles.length);
    var light = new Vector([1]); // light at camera
    var i = 0;
    for (var j = 0; j < triangles.length; j++) {
        var triangle = triangles[j];
        var plane = triangle.plane();
        for (var k = 0; k < 3; k++) {
            data[i++] = triangle.vs[k].a[1];
            data[i++] = triangle.vs[k].a[2];
            data[i] = 0;
            for (var l = 3; l < triangle.vs[k].a.length; l++) {
                data[i] += triangle.vs[k].a[l];
            }
            i++;

            var diffuse = plane.diffuse_factor(triangle.vs[k].point_minus(light));
            var colour = triangle.colour.times(Math.pow(diffuse, 1));
            for (var l = 1; l < 4; l++)
                data[i++] = colour.a[l];
        }
    }

    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 3 * triangles.length);
};

N22d.prototype.animate = function() {
    var t = this;
    function frame() {
        var time = (new Date()).getTime();
        _.map(t.models, function(m) { m.transforms.evolve(time); });
        t.draw();
        requestAnimFrame(frame);
    }
    requestAnimFrame(frame);
};

function Colour(r, g, b) {
    if (arguments.length == 1)
        this.a = arguments[0];
    else
        this.a = [0, r, g, b];
}
inherit(Colour, new Vector(null));

Colour.prototype.hsv2rgb = function() {
    // Lineage:
    // - http://jsres.blogspot.com/2008/01/convert-hsv-to-rgb-equivalent.html
    // - http://www.easyrgb.com/math.html
    var h=this.a[1], s=this.a[2], v=this.a[3];
    var r, g, b;
    if(s==0){
        this.a[1] = this.a[2] = this.a[3] = v;
    }else{
        // h must be < 1
        var var_h = h * 6;
        if (var_h==6) var_h = 0;
        // Or ... var_i = floor( var_h )
        var var_i = Math.floor( var_h );
        var var_1 = v*(1-s);
        var var_2 = v*(1-s*(var_h-var_i));
        var var_3 = v*(1-s*(1-(var_h-var_i)));
        if(var_i==0){ 
            var_r = v; 
            var_g = var_3; 
            var_b = var_1;
        }else if(var_i==1){ 
            var_r = var_2;
            var_g = v;
            var_b = var_1;
        }else if(var_i==2){
            var_r = var_1;
            var_g = v;
            var_b = var_3
        }else if(var_i==3){
            var_r = var_1;
            var_g = var_2;
            var_b = v;
        }else if (var_i==4){
            var_r = var_3;
            var_g = var_1;
            var_b = v;
        }else{ 
            var_r = v;
            var_g = var_1;
            var_b = var_2
        }
        this.a[1] = var_r;
        this.a[2] = var_g;
        this.a[3] = var_b;
    }
    return this;
};

// just the 2d kind
function Plane(p, a, b) {
    this.p = p;
    // orthonormal basis
    this.a = a = a.normalize();
    this.b = b.minus(b.proj(a)).normalize();
}

// cos(angle between light and plane's normal space)
Plane.prototype.diffuse_factor = function(light) {
    var normal = light.minus(light.proj(this.a)).minus(light.proj(this.b));
    if (normal.norm() == 0) // light shining parallel to surface
        return 0;
    return normal.normalize().dot(light.normalize());
};

function Triangle(vs, colour) {
    assert(vs.length == 3);
    this.vs = vs;
    this.colour = colour;
}

Triangle.prototype.transform = function(transform) {
    var vs = new Array(this.vs.length);
    for (var i = 0; i < vs.length; i++)
        vs[i] = transform.times(this.vs[i]);
    return new Triangle(vs, this.colour.copy());
};

Triangle.prototype.plane = function() {
    var a = this.vs[0].point_minus(this.vs[2]);
    var b = this.vs[1].point_minus(this.vs[2]);
    return new Plane(this.vs[0], a, b);
};


function Model(triangles) {
    this.triangles = triangles;
    this.transforms = new TransformChain();
}

Model.prototype.transformed_triangles = function() {
    var transform = this.transforms.transform;
    return _.map(this.triangles, function(t) {return t.transform(transform);});
};

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3)
            str += k.textContent;
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment")
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    else if (shaderScript.type == "x-shader/x-vertex")
        shader = gl.createShader(gl.VERTEX_SHADER);
    else
        assert(false);
    gl.shaderSource(shader, str);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
        throw new Error(id + ": " + gl.getShaderInfoLog(shader));
    return shader;
}
