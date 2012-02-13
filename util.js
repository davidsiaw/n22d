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
