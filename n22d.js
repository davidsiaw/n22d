// super: sup(this).method.call(this, args...);
function sup(t) {
    return t.prototype.constructor.prototype;
}

function inherit(Cons, prototype) {
    Cons.prototype = prototype;
    Cons.prototype.constructor = Cons;
}

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
        //Or ... var_i = floor( var_h )
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


function AssertException(message) {
    this.message = message;
}

AssertException.prototype.toString = function () {
  return 'AssertException: ' + this.message;
};

function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}

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
        raise (id + ": " + gl.getShaderInfoLog(shader));
    return shader;
}

function cylinder() {
    var h = 1, r1 = .5, r2 = .2, nPhi = 500;
    var pt = new Array(nPhi);
    var Phi = 0, dPhi = 2*Math.PI / (nPhi-1),
        Nx = r1 - r2, Ny = h, N = Math.sqrt(Nx*Nx + Ny*Ny);
    Nx /= N; Ny /= N;
    var j = 0;
    for (var i = 0; i < nPhi; i++){
        var cosPhi = Math.cos(Phi);
        var sinPhi = Math.sin(Phi);
        var cosPhi2 = Math.cos(Phi + dPhi/2);
        var sinPhi2 = Math.sin(Phi + dPhi/2);
        pt[j] = new Vector([1, -h/2, cosPhi * r1, sinPhi * r1]);
        j++;
        pt[j] = new Vector([1, h/2, cosPhi2 * r2, sinPhi2 * r2]);
        j++;
        Phi   += dPhi;
    }
    var triangles = [];
    for (var i = 2; i < pt.length; i++)
        triangles.push(new Triangle([pt[i-2], pt[i-1], pt[i]]));
    return new Model(triangles);
}

window.requestAnimFrame = function(){
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    return (
        window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(/* function */ callback){
            window.setTimeout(callback, 1000 / 60);
        }
    );
}();

function webGLStart() {
    var gl, canvas;

    canvas = document.getElementById("canvas");
    var size = Math.min(window.innerWidth, window.innerHeight) - 10;
    canvas.width =  size;   canvas.height = size;
    if (!window.WebGLRenderingContext){
        alert("Your browser does not support WebGL. See http://get.webgl.org");
        return;
    }
    try { gl = canvas.getContext("experimental-webgl");
    } catch(e) {}
    if ( !gl ) {alert("Can't get WebGL"); return;}
    gl.viewport(0, 0, size, size);

    var prog  = gl.createProgram();
    gl.attachShader(prog, getShader( gl, "shader-vs" ));
    gl.attachShader(prog, getShader( gl, "shader-fs" ));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var nd = 4;
    var m = hypercube(nd);
    m.particle.ax = newRotation(1, 3, -40*Math.PI/180);
    //m.particle.av = newRotation(2, 4, -2*Math.PI/180);
    m.particle.av = newRotation(1, 4, -3.2*Math.PI/180).times(m.particle.av);
    for (var i = 4; i <= nd; i++) {
        m.particle.av = newRotation(i-3, i, 3.1/i*Math.PI/180).times(m.particle.av);
    }
    m.particle.x = new Vector([0, 0, 0, -1.5]);
    //window.setInterval(function() {m.particle.evolve()}, 30);
    
    var posLoc = gl.getAttribLocation(prog, "aPos");
    var colour = gl.getAttribLocation(prog, "vColour");
    var vertex_buffer = gl.createBuffer();
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 6*4, 0);
    gl.enableVertexAttribArray(colour);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 6*4, 3*4);

    var prMatrix = new CanvasMatrix4();
    prMatrix.perspective(45, 1, .1, 30);
    gl.uniformMatrix4fv( gl.getUniformLocation(prog,"prMatrix"),
            false, new Float32Array(prMatrix.getAsArray()) );

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearDepth(1.0);
    gl.clearColor(1, 1, 1, 1);
    var xOffs = yOffs = 0,  drag  = 0;
    var xRot = 0;
    var yRot = 0;
    var transl = -1.5;

    (function animloop() {
        drawScene();
     requestAnimFrame(animloop);
     })();

    drawScene();

    function drawScene(){
        m.particle.x.a[3] = transl;
        m.particle.ax = newRotation(2, 3, xRot*Math.PI/180).times(m.particle.ax);
        m.particle.ax = newRotation(1, 3, yRot*Math.PI/180).times(m.particle.ax);
        yRot = 0;  xRot = 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, m.vertex_buffer(), gl.DYNAMIC_DRAW);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3 * m.triangles.length);
        gl.flush();
    }

    canvas.resize = function (){
        var size = Math.min(window.innerWidth, window.innerHeight) - 10;
        canvas.width =  size;   canvas.height = size;
        gl.viewport(0, 0, size, size);
        drawScene();
    }
    canvas.onmousedown = function ( ev ){
        drag  = 1;
        xOffs = ev.clientX;  yOffs = ev.clientY;
    }
    canvas.onmouseup = function ( ev ){
        drag  = 0;
        xOffs = ev.clientX;  yOffs = ev.clientY;
    }
    canvas.onmousemove = function ( ev ){
        if ( drag == 0 ) return;
        if ( ev.shiftKey ) {
            transl *= 1 + (ev.clientY - yOffs)/1000;
            yRot = - xOffs + ev.clientX; }
        else {
            yRot = - xOffs + ev.clientX;  xRot = - yOffs + ev.clientY; }
        xOffs = ev.clientX;  yOffs = ev.clientY;
        drawScene();
    }
    var wheelHandler = function(ev) {
        var del = 1.1;
        if (ev.shiftKey) del = 1.01;
        var ds = ((ev.detail || ev.wheelDelta) > 0) ? del : (1 / del);
        transl *= ds;
        drawScene();
        ev.preventDefault();
    };
    canvas.addEventListener('DOMMouseScroll', wheelHandler, false);
    canvas.addEventListener('mousewheel', wheelHandler, false);
}
