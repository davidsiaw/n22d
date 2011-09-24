// probably bugs:
// - not drawing points on triangle borders
// - unproject->reproject has a lot of error

// super: sup(this).method.call(this, args...);
function sup(t) {
    return t.prototype.constructor.prototype;
}

function inherit(Cons, prototype) {
    Cons.prototype = prototype;
    Cons.prototype.constructor = Cons;
}

function Canvas(canvas_el) {
    this.canvas_el = canvas_el;
    this.ctx = canvas_el.getContext('2d');
    this.get();
}

Canvas.prototype.get = function() {
    this.width = this.canvas_el.width;
    this.height = this.canvas_el.height;
    this.zbuffer = new Array(this.width);
    for (var i = 0; i < this.width; i++)
        this.zbuffer[i] = new Array(this.height);
    this.bounding_box = new BoundingBox(0, 0, this.canvas_el.width, this.canvas_el.height);
    this.canvasData = this.ctx.getImageData(0, 0, this.canvas_el.width, this.canvas_el.height);
}

Canvas.prototype.put = function() {
    this.ctx.putImageData(this.canvasData, 0, 0);
};

Canvas.prototype.draw = function(x, y, z, colour) {
    var zb = this.zbuffer[x][y];
    if (zb != 0 && z >= this.zbuffer[x][y])
        return;
    this.zbuffer[x][y] = z;
    this._draw(x, y, colour);
};

Canvas.prototype._draw = function(x, y, colour) {    
    assert(x >= 0 && x < this.width);
    assert(y >= 0 && y < this.height);

    var idx = (x + y * this.width) * 4;
    this.canvasData.data[idx + 0] = colour.a[1];
    this.canvasData.data[idx + 1] = colour.a[2];
    this.canvasData.data[idx + 2] = colour.a[3];
    this.canvasData.data[idx + 3] = 255;
};

Canvas.prototype.clear = function() {
    var white = new Colour(255, 255, 255);
    for (var x = 0; x < this.width; x++)
        for (var y = 0; y < this.height; y++) {
            this._draw(x, y, white);
            this.zbuffer[x][y] = 0;
        }
};

function Colour(r, g, b) {
    if (arguments.length == 1)
        this.a = arguments[0];
    else
        this.a = [0, r, g, b];
}
inherit(Colour, new Vector(null));

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

$(document).ready(function() {
    var canvas = new Canvas(document.getElementById('c'));

    var blue = new Colour(0, 0, 255);
    var t1 = new Triangle([
            new Vector([1, -1000, 1000, 200]),
            new Vector([1, 1000, 1000, 200]),
            new Vector([1, 0, -1000, 200])
        ],
        blue);
    var t2 = new Triangle([
            new Vector([1, -100, -100, 20]),
            new Vector([1, 100, -100, 20]),
            new Vector([1, 0, 100, 20])
        ],
        blue);
    var m = new Model([t1, t2]);
    m.particle.av = newRotation(1, 2, Math.PI/4);

    var update = function() {
        //canvas.get();
        m.particle.evolve();
        canvas.clear();
        m.draw(canvas, 20);
        canvas.put();
    };
    setInterval(update, 10);
});
