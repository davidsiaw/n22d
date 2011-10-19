var canvas, glcanvas, model; // set in main()

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
        throw (id + ": " + gl.getShaderInfoLog(shader));
    return shader;
}

function cone() {
    // http://www.ibiblio.org/e-notes/webgl/gpu/make_cone.htm
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

function hypercube(n) { // only works for n >= 2 (because polygons are 2d)
    var triangles = [];
    var ps = permutations(n - 2);
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            for (var P = 0; P < ps.length; P++) {
                var p = ps[P].slice();
                p.splice(j, 0, 0);
                p.splice(i, 0, 0);
                var face = hypercube_face(p, j, i);
                for (var f = 0; f < face.length; f++) {
                    triangles.push(face[f]);
                }
            }
        }
    }
    var m = new Model(triangles);
    m.particle.center = new Vector(
        _.map(_.range(n), function() { return -.5;}), 0);
    return m;
}

function hypercube_face(v, i, j) {
    var colour = side_colour(i).plus(side_colour(j)).divide(2).hsv2rgb();
    assert(v[i] == 0);
    assert(v[j] == 0);
    var a = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    a[1][i] = 1;
    a[2][j] = 1;
    a[0] = new Vector(a[0], 1);
    a[1] = new Vector(a[1], 1);
    a[2] = new Vector(a[2], 1);
    a = new Triangle(a, colour);

    var b = [
        v.slice(),
        v.slice(),
        v.slice()
    ];
    b[0][i] = b[0][j] = 1;
    b[1][i] = 1;
    b[2][j] = 1;
    b[0] = new Vector(b[0], 1);
    b[1] = new Vector(b[1], 1);
    b[2] = new Vector(b[2], 1);
    b = new Triangle(b, colour);

    return [a, b];
}

// returns <n_loops> loops of <2*n_circle> triangles
function klein_bottle(n_circle, n_loops) {
    assert(n_loops % 2 == 0); // limitated by the way this is coded
    var loops = new Array(n_loops);
    var trans = newTranslation(new Vector([0, 2], 0));
    var adjust_rot = newRotation(1, 2, Math.PI / n_circle);
    var circle_template = circle(n_circle);
    var c_prev = trans.times(circle_template);
    
    for (var i = 1; i <= n_loops; i++) {
        var frac = i/n_loops;
        var mobius_rot = newRotation(2, 4, frac * Math.PI);
        var torus_rot = newRotation(2, 3, frac * 2*Math.PI);
        var transform = torus_rot.times(trans).times(mobius_rot);
        if (i % 2)
            transform = transform.times(adjust_rot);
        var c_i = transform.times(circle_template);
        if (i % 2)
            var points = _.flatten(_.zip(c_prev, c_i));
        else
            var points = _.flatten(_.zip(c_i, c_prev));
        loops[i-1] = triangle_loop(points, klein_colour(frac));
        c_prev = c_i;
    }

    return _.flatten(loops);
}

function klein_colour(frac) {
    return new Colour(frac, 0.75, 1).hsv2rgb();
}

// circle with radius 1 on the 1-2 plane
function circle(n) {
    var p = new Array(n);
    p[0] = new Vector([1], 1);
    for (var i = 1; i < n; i++)
        p[i] = newRotation(1, 2, i/n * 2*Math.PI).times(p[0]);
    return p;
}

// make a closed loop of triangles
// like a closed version of a GL triangle strip
function triangle_loop(points, colour) {
    var p = points;
    var triangles = new Array(p.length);
    triangles[0] = new Triangle([p[p.length-2], p[p.length-1], p[0]], colour);
    triangles[1] = new Triangle([p[p.length-1], p[0], p[1]], colour);
    for (var i = 2; i < p.length; i++)
        triangles[i] = new Triangle([p[i], p[i-1], p[i-2]], colour);
    return triangles;
}

function side_colour(i) {
    return new Colour(i * 0.25, 0.75, 1);
}

window.requestAnimFrame = function() {
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    return (
        window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        }
    );
}();

function set_handlers(canvas, particle) {
    var drag = false;
    var drag_x = 0;
    var drag_y = 0;

    canvas.onmousedown = function(ev) {
        drag = true;
        drag_x = ev.clientX;
        drag_y = ev.clientY;
    }
    canvas.onmouseup = function(ev) {
        drag = false;
    }
    canvas.onmousemove = function(ev) {
        if (!drag)
            return;
        var xRot = ev.clientX - drag_x;
        var yRot = ev.clientY - drag_y;
        drag_x = ev.clientX;
        drag_y = ev.clientY;
        particle.ax = newRotation(1, 3, xRot*Math.PI/180).times(particle.ax);
        particle.ax = newRotation(2, 3, -yRot*Math.PI/180).times(particle.ax);
    }
    var wheelHandler = function(ev) {
        var del = 1.1;
        var ds = ((ev.detail || ev.wheelDelta) > 0) ? del : (1 / del);
        particle.x.a[3] *= ds;
        ev.preventDefault();
    };
    canvas.addEventListener('DOMMouseScroll', wheelHandler, false);
    canvas.addEventListener('mousewheel', wheelHandler, false);
}

function main() {
    canvas = document.getElementById("canvas");
    glcanvas = new GLCanvas(canvas);

    var m = model = new Model(klein_bottle(60, 20));
    m.particle.x = new Vector([0, 0, 0, -10]);
    m.particle.ax = newRotation(1, 3, Math.PI/2);
    m.particle.iav = newRotation(1, 4, 3*Math.PI/180);

    set_handlers(canvas, m.particle);
    window.setInterval(function() {m.particle.evolve()}, 30);
    (function animloop() {
        glcanvas.draw([m]);
        requestAnimFrame(animloop);
    })();
}
