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

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function copy(a) {
    return (a && a.copy()) || a;
}
