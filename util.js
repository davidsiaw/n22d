// common or generic things

// super: sup(this).method.call(this, args...);
function sup(t) {
    return t.prototype.constructor.prototype;
}

function inherit(Cons, prototype) {
    Cons.prototype = prototype;
    Cons.prototype.constructor = Cons;
}

function AssertFailed(msg) {
    Error.call(this, msg);
}
inherit(AssertFailed, new Error());

function assert(exp, message) {
    if (!exp)
        throw new AssertFailed(message);
}
// function assert() {} // to disable assertions

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = 
        window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        };
