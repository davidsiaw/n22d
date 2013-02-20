/* This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details. */


// common or generic things
function AssertFailed(msg) {
    this.message = msg;
}
AssertFailed.prototype = new Error();

function assert(exp, message) {
    if (!exp)
        throw new AssertFailed(message);
}
// function assert() {} // to disable assertions

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
