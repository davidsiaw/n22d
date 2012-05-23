function control_ball(r) {
    var ball = sphere_subdivide(icosahedron(), 1).each(function (t) {
        t[0].colour = t[1].colour = t[2].colour = new Vector([1, 0, 0, Math.random()/6+.4]);
    });
    ball = sphere_finish(sphere_subdivide(ball, 2));
    var scale = new BigMatrix().to_scale([1, r, r, r]);
    ball.each(function (v) { v.loc = scale.times(v.loc); });
    return ball;
}

function klein_bottle_demo(div) {
    var r = new BigMatrix().to_rotation(1/4, 1, 3);
    var bottle = klein_bottle(30, 60).map(function(v) {
        return v.times_left(r);
    });
    var ball3 = control_ball(3.5);
    var swap = new BigMatrix().to_rotation(-1/4, 1, 4);
    var ball4 = control_ball(3.5).map(function(v) {
        v.colour.a[0] = 0;
        v.colour.a[1] = 1;
        return v.times_left(swap);
    });

    var ball_ui = new BallUI(3.5);
    ball_ui.transform.to_translation(new Vector([0, 0, 0, -9.5]));

    var n22d = window.n22d = new N22d(div, FourD.Program);
    n22d.primitives = new Primitives('TRIANGLES', bottle.concat(ball3, ball4));
    n22d.transform = ball_ui.transform;

    var drag = new MouseDrag(function(mouse_drag) {
        if (mouse_drag.dragging) {
            var line = n22d.screen2model(mouse_drag.x, mouse_drag.y, 3);
            var line_prev = n22d.screen2model(mouse_drag.x_prev, mouse_drag.y_prev, 3);
            n22d.touch = n22d.transform.times(ball_ui.closest_point(line));
            ball_ui.drag(line_prev, line);
        } else
            n22d.touch = new Vector([]); // hack
        n22d.draw_async();
    });
    drag.bind(n22d.canvas);
    n22d.draw_async();
}
