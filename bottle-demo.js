function klein_bottle_demo() {
    var n22d = window.n22d = new FourD.Four22d();

    // bottle model
    var bottle_colour = hsv2rgb(new Vector([2/3, 1, 1, .8]));
    var vertices = klein_bottle(30, 60, bottle_colour);
    var r = new BigMatrix().to_rotation(1/4, 1, 3);
    var s = new BigMatrix().to_scale([1, .75, .75, .75, .75]);
    vertices = r.times(s).times(vertices).each(function(v) {
        v.colour = bottle_colour;
    });

    n22d.set_vertices(vertices);
    function rotate_draw() {
        var time = new Date().getTime();
        n22d.transform.to_rotation(time/5000, 1, 3);
        n22d.transform = n22d.transform.times(new AffineUnitaryBigMatrix().to_rotation(time/4000, 2, 4));
        n22d.draw();
        requestAnimFrame(rotate_draw);
    }
    requestAnimFrame(rotate_draw);

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
