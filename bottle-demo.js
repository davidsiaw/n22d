function klein_bottle_demo() {
    var n22d = window.n22d = new FourD.Four22d();

    // colours
    var ball3_colour = hsv2rgb(new Vector([0, .5, 1, 0]));
    var ball4_colour = hsv2rgb(new Vector([1/3, .5, 1, 0]));
    var bottle_colour = hsv2rgb(new Vector([2/3, 1, 1, .8]));
    
    // bottle model
    var vertices = klein_bottle(30, 60, bottle_colour);
    var r = new BigMatrix().to_rotation(1/4, 1, 3);
    vertices = vertices.map(function(v) { return v.times_left(r); });

    // ui
    var origin = new Vector([1]);
    var s3 = new AffineSpace(origin, [[0,1], [0,0,1], [0,0,0,1]]);
    var s4 = new AffineSpace(origin, [[0,1], [0,0,0,1], [0,0,0,0,1]]);
    var ball3 = new BallUI(n22d, 1, s3, ball3_colour);
    var ball4 = new BallUI(n22d, 1, s4, ball4_colour);

    n22d.set_vertices(vertices.concat(ball3.model(), ball4.model()));

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

function hsv2rgb(vec) {
    // Lineage:
    // - http://jsres.blogspot.com/2008/01/convert-hsv-to-rgb-equivalent.html
    // - http://www.easyrgb.com/math.html
    var h=vec.a[0], s=vec.a[1], v=vec.a[2];
    var r, g, b;
    if(s==0){
        vec.a[0] = vec.a[1] = vec.a[2] = v;
    }else{
        // h must be < 1
        var var_h = h * 6;
        if (var_h==6) var_h = 0;
        // Or ... var_i = floor( var_h )
        var var_i = Math.floor( var_h );
        var var_1 = v*(1-s);
        var var_2 = v*(1-s*(var_h-var_i));
        var var_3 = v*(1-s*(1-(var_h-var_i)));
        if(var_i==0){
            var_r = v;
            var_g = var_3;
            var_b = var_1;
        }else if(var_i==1){
            var_r = var_2;
            var_g = v;
            var_b = var_1;
        }else if(var_i==2){
            var_r = var_1;
            var_g = v;
            var_b = var_3
        }else if(var_i==3){
            var_r = var_1;
            var_g = var_2;
            var_b = v;
        }else if (var_i==4){
            var_r = var_3;
            var_g = var_1;
            var_b = v;
        }else{
            var_r = v;
            var_g = var_1;
            var_b = var_2;
        }
        vec.a[0] = var_r;
        vec.a[1] = var_g;
        vec.a[2] = var_b;
    }
    return vec;
}
