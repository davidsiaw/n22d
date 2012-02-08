// common or generic things
var AssertFailed = Class.create();
AssertFailed.prototype = Object.extend(new Error, {
    initialize: function(msg) { this.message = msg; }
});

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
