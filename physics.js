function Particle(x) {
    this.x = x || new Vector([], 0);
    this.v = new Vector([], 0);
    this.a = new Vector([], 0);
    this.ax = new InfiniteMatrix(newMatrixI(1, 1));
    this.av = new InfiniteMatrix(newMatrixI(1, 1));
}

Particle.prototype.evolve = function() {
    this.x = this.x.plus(this.v).plus(this.a.times(this.a).times(1/2));
    this.v = this.v.plus(this.a);
    this.ax = this.av.times(this.ax);
};

Particle.prototype.transformation = function() {
    return newTranslation(this.x).times(this.ax);
}

var TICK_RATE = 10;

function newRotationVelocity(i, j, rads_per_sec) {
    return newRotation(i, j, rads_per_sec / TICK_RATE);
}
