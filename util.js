// common or generic things

// var Child = inherit(Parent(), Child(...));
function inherit(Parent, Child) {
    Parent.prototype.constructor = Parent; // redundant after 1st inheritence
    Child.Parent = Parent;
    Child.prototype = new Parent();
    Child.prototype.constructor = Child;
    return Child;
}

// Parent(this)(...) -- not bound to this!
function Parent(that) {
    return that.constructor.Parent;
}

// Super(this).method.call(this, args...);
function Super(that) {
    return Parent(that).prototype;
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
