function klein_bottle_demo(div) {
    var bottle = klein_bottle_model(30, 60);
    var r = new BigMatrix().to_rotation(1/4, 1, 3);
    bottle.vertices = bottle.vertices.map(function (v) {
        return v.times_left(r);
    });

    var ball = sphere_subdivide(icosahedron(), 1).each(function (t) {
        t[0].colour = t[1].colour = t[2].colour = new Vector([1, 0, 0, Math.random()/6+.4]);
    });
    ball = sphere_finish(sphere_subdivide(ball, 1));
    var scale = new BigMatrix().to_scale([1,3.5,3.5,3.5]);
    ball.each(function (v) { v.loc = scale.times(v.loc); });
    bottle.vertices = bottle.vertices.concat(ball);

    var ball_ui = new BallUI(3.5);
    ball_ui.transform.to_translation(new Vector([0, 0, 0, -9.5]));

    var n22d = window.n22d = new N22d(div, FourD.Program);
    n22d.primitives = bottle;
    n22d.transform = ball_ui.transform;
    n22d.program.set_touch_radius(.5);

    var drag = new MouseDrag(function(mouse_drag) {
        var line = n22d.screen2world(mouse_drag.x, mouse_drag.y, 3);
        var line_prev = n22d.screen2world(mouse_drag.x_prev, mouse_drag.y_prev, 3);
        n22d.program.set_touch(n22d.transform.times(ball_ui.closest_point(line)));
        if (mouse_drag.dragging)
            ball_ui.drag(line_prev, line);
        n22d.draw_async();
    });
    drag.bind(n22d.canvas);
    n22d.draw_async();
}
