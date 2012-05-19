function klein_bottle_demo(div) {
    var bottle = klein_bottle_model(30, 60);
    var ball = sphere_subdivide(icosahedron(), 1).each(function (t) {
        t[0].colour = t[1].colour = t[2].colour = new Vector([1, 0, 0, Math.random()/6+.4]);
    });
    ball = sphere_finish(sphere_subdivide(ball, 1));
    var scale = new BigMatrix().to_scale([1,3.5,3.5,3.5]);
    ball.each(function (v) { v.loc = scale.times(v.loc); });

    bottle.vertices = bottle.vertices.concat(ball);
    var bottle_pos = new Position(new Vector([0, 0, 0, -9.5]));
    var ball_ui = new BallUI(bottle, 3.5);
    ball_ui.transform.to_rotation(1/4, 1, 3);
    bottle.transforms.a = [bottle_pos, ball_ui];

    var n22d = window.n22d = new N22d(div, [bottle], FourD.Program);
    n22d.program.set_touch_radius(.5);

    n22d.ondrag(function(mouse_drag) {
        n22d.program.set_touch(bottle.transforms.transform.times(ball_ui.grab(mouse_drag.pos)));
        if (mouse_drag.dragging) {
            ball_ui.drag(mouse_drag);
        } else ;
        n22d.draw_async();
    });
    n22d.draw_async();
}
