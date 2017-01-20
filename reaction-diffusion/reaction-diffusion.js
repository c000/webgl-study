(function (){
    "use strict";

    var createProgram = function(gl, vShaderId, fShaderId) {
        var p = gl.createProgram();
        var v = gl.createShader(gl.VERTEX_SHADER);
        var f = gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(v, document.getElementById(vShaderId).text);
        gl.shaderSource(f, document.getElementById(fShaderId).text);

        gl.compileShader(v);
        if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(v));
        }

        gl.compileShader(f);
        if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(f));
        }

        gl.attachShader(p, v);
        gl.attachShader(p, f);

        gl.linkProgram(p);
        gl.useProgram(p);
        return p;
    };

    var setVertexAttribute = function(gl, program, varName, value, dim, stride, offset) {
        gl.bindBuffer(gl.ARRAY_BUFFER, value);
        var location = gl.getAttribLocation(program, varName);
        if (location < 0) {
            console.error("Attribute " + varName + " not found");
            return;
        }
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
            location,
            dim,
            gl.FLOAT,
            false,
            stride,
            offset
        );
        return location;
    };

    var setTexture = function(gl, textureSize, array) {
        var t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            textureSize,
            textureSize,
            0,
            gl.RGBA,
            gl.FLOAT,
            array
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        return t;
    };

    var createFrameBuffer = function(gl, texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        var f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return f;
    };

    var canvas = document.getElementById("my-canvas");
    var gl = canvas.getContext("webgl");
    var ext = gl.getExtension("OES_texture_float");
    if (ext == null) {
        console.error("float texture not supported");
        return;
    }
    var program = createProgram(gl, "vertex-shader", "fragment-shader");
    var texProgram = createProgram(gl, "tex-vertex-shader", "tex-fragment-shader");

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  0,     1, 1, 2,    0, 0,
         1, -1,  0,     1, 2, 1,    1, 0,
         1,  1,  0,     2, 1, 1,    1, 1,
        -1,  1,  0,     1, 1, 2,    0, 1
    ]), gl.STATIC_DRAW);

    var texVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
         1,  1,
        -1,  1
    ]), gl.STATIC_DRAW);

    var tSize = 256;
    var textureData = [
        new Float32Array(tSize * tSize * 4),
        new Float32Array(tSize * tSize * 4)
    ];
    for (var y = 0; y < tSize; ++y) {
        for (var x = 0; x < tSize; ++x) {
            var index = 4 * (y * tSize + x);
            var xc = x - tSize / 2;
            var yc = y - tSize / 2;
            if (xc*xc+yc*yc < 64) {
                textureData[0][index+1] = 1;
            } else {
                textureData[0][index+0] = 1;
            }
        }
    }
    var texture = [
        setTexture(gl, tSize, textureData[0]),
        setTexture(gl, tSize, textureData[1])
    ];
    var framebuffer = [
        createFrameBuffer(gl, texture[0]),
        createFrameBuffer(gl, texture[1])
    ];
    gl.bindTexture(gl.TEXTURE_2D, null);

    var flip = function() {
        var t0 = texture[0]
        var t1 = texture[1];
        var f0 = framebuffer[0];
        var f1 = framebuffer[1];
        texture[0] = t1;
        texture[1] = t0;
        framebuffer[0] = f1;
        framebuffer[1] = f0;
    };

    var param = {
        f: 0.049,
        k: 0.0619,
        alpha: 3,
        seed: 0
    };

    var start = new Date();
    var loop = function() {
        gl.useProgram(texProgram);
        for (var i = 0; i < 4; ++i) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer[1]);
            setVertexAttribute(gl, texProgram, "position", texVertexBuffer, 2, 0, 0);
            gl.uniform1f(gl.getUniformLocation(texProgram, "delta"), 1.0 / tSize);
            gl.uniform1f(gl.getUniformLocation(texProgram, "f"), param.f);
            gl.uniform1f(gl.getUniformLocation(texProgram, "k"), param.k);
            gl.uniform1f(gl.getUniformLocation(texProgram, "alpha"), param.alpha);
            gl.uniform1f(gl.getUniformLocation(texProgram, "seed"), param.seed);
            gl.bindTexture(gl.TEXTURE_2D, texture[0]);
            gl.viewport(0, 0, tSize, tSize);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
            gl.flush();
            flip();
        }

        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        setVertexAttribute(gl, program, "position", vertexBuffer, 3, 32, 0);
        setVertexAttribute(gl, program, "color", vertexBuffer, 3, 32, 12);
        setVertexAttribute(gl, program, "texPosition", vertexBuffer, 2, 32, 24);
        gl.bindTexture(gl.TEXTURE_2D, texture[0]);
        gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
        gl.uniform1f(gl.getUniformLocation(program, "time"), (new Date() - start) * 1e-3);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        gl.flush();
        setTimeout(loop, 1);
    };
    loop();

})();