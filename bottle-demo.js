function klein_bottle_demo() {
    var n22d = window.n22d = new FourD.Four22d();

    // bottle model
    var vertices = klein_bottle(30, 60);
    var r = new BigMatrix().to_rotation(1/4, 1, 3);
    vertices = vertices.map(function(v) { return v.times_left(r); });

    // ui
    var origin = new Vector([1]);
    var s3 = new AffineSpace(origin, [[0,1], [0,0,1], [0,0,0,1]]);
    var s4 = new AffineSpace(origin, [[0,1], [0,0,0,1], [0,0,0,0,1]]);
    var ball3 = new BallUI(n22d, 3.5, s3, new Colour([1,0,0,0]));
    var ball4 = new BallUI(n22d, 3.5, s4, new Colour([0,1,0,0]));

    n22d.set_vertices(vertices.concat(ball3.model(), ball4.model()));
    n22d.transform.to_translation(new Vector([0, 0, 0, -9.5]));

    var drag = new MouseDrag(function(mouse_drag) {
        if (mouse_drag.dragging) {
            if (mouse_drag.move_event.shiftKey)
                var ball = ball4;
            else
                var ball = ball3;
            var a = ball.grab(mouse_drag.x, mouse_drag.y);
            var b = ball.grab(mouse_drag.x_prev, mouse_drag.y_prev);
            n22d.transform = n22d.transform.times(ball.drag(a, b));
            n22d.touch = n22d.transform.times(a);
        } else
            n22d.touch = new Vector([]); // XXX hack
        n22d.draw_async();
    });
    drag.bind(n22d.canvas);

    return n22d;
}
