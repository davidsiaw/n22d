/* This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */


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

function module(f) {
    var mod = {};
    try {
        f(mod);
    } finally {
        return mod;
    }
}

function diff(a, b) {
    var same = true;
    for (var i = 0; i < a.length; i++)
        if (a[i] != b[i]) {
            same = false;
            console.log(''+i + ' ' + a[i] + ' ' + b[i]);
        }
    if (same)
        console.log('same');
}
