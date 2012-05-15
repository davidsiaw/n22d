function klein_bottle_demo(div) {
    var bottle = klein_bottle_model(30, 60);
    var bottle_pos = new Position(new Vector([0, 0, 0, 0, -8.5]));
    var bottle_rot = new LazyTransform();
    bottle_rot.transform.to_rotation(1/4, 1, 3);
    var bottle_rot2 = new LazyTransform();
    bottle_rot2.transform.to_rotation(0, 3, 4);

    var ball_ui = new BallUI(bottle, 2.5);
    bottle.transforms.a = [bottle_rot2, bottle_pos, ball_ui, bottle_rot];

    var n22d = new N22d(div, [bottle], FourD.Program);

    n22d.ondrag(function(mouse_drag) {
        ball_ui.drag(mouse_drag);
        n22d.draw_async();
    });
    n22d.draw_async();
}
