window.onload = () => {
  const canvas = document.getElementById('canvas');
  
  const gl = canvas.getContext('webgl2');
  gl.getExtension('EXT_color_buffer_float');

  if (!gl) {
    alert('webgl2 not supported');
    return;
  }

  const stats = new Stats();
  const container = document.getElementById('container');
  container.appendChild(stats.domElement);

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  addEventListener('resize', resizeCanvas);
  resizeCanvas();

  gl.viewport(0.0, 0.0, canvas.width, canvas.height);
  
  let calculateGrayScottProgram = createProgram('vs', 'calculate_gray_scott_fs');
  let renderGrayScottProgram = createProgram('vs', 'render_gray_scott_fs');

  let calculateGrayScottUniforms = getUniformLocations(calculateGrayScottProgram, ['u_resolution', 'u_mousePosition', 'u_mousePress', 'u_texture', 'u_delta', 'u_feed', 'u_kill']);
  let renderGrayScottUniforms = getUniformLocations(renderGrayScottProgram, ['u_texture']);

  let mousePosition = [0.0, 0.0];

  window.addEventListener('mousemove', (e) => {
    mousePosition = [e.clientX, canvas.height - e.clientY];
  });

  let mousePress = false;
  window.addEventListener('mousedown', () => {
    mousePress = true;
  });
  window.addEventListener('mouseup', () => {
    mousePress = false;
  });

  render();

  function render() {

    let params = {
      feed: document.getElementById('feed').value,
      kill: document.getElementById('kill').value,
    };

    // swapping functions
    let grayScottFBObjR = createFramebuffer(canvas.width, canvas.height);
    let grayScottFBObjW = createFramebuffer(canvas.width, canvas.height);
    function swapGrayScottFBObj() {
      let tmp = grayScottFBObjR;
      grayScottFBObjR = grayScottFBObjW;
      grayScottFBObjW = tmp;
    };

    function calculateGrayScott(dt) {
      gl.useProgram(calculateGrayScottProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, grayScottFBObjW.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, grayScottFBObjR.texture);
      gl.uniform2f(calculateGrayScottUniforms['u_resolution'], canvas.width, canvas.height);
      gl.uniform2fv(calculateGrayScottUniforms['u_mousePosition'], mousePosition);
      gl.uniform1i(calculateGrayScottUniforms['u_mousePress'], mousePress);
      gl.uniform1i(calculateGrayScottUniforms['u_texture'], 0);
      gl.uniform1f(calculateGrayScottUniforms['u_delta'], dt);
      gl.uniform1f(calculateGrayScottUniforms['u_feed'], params.feed);
      gl.uniform1f(calculateGrayScottUniforms['u_kill'], params.kill);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      swapGrayScottFBObj();
    }

    function renderGrayScott() {
      gl.useProgram(renderGrayScottProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, grayScottFBObjR.texture);
      gl.uniform1i(renderGrayScottUniforms['u_texture'], 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    let previousRealSeconds = new Date().getTime();

    loop();

    function loop() {

      stats.update();

      gl.viewport(0.0, 0.0, canvas.width, canvas.height);

      params = {
        feed: document.getElementById('feed').value,
        kill: document.getElementById('kill').value,
      };

      let e_feed = document.getElementById('disp_feed');
      let e_kill = document.getElementById('disp_kill');
      
      e_feed.innerHTML = String(params.feed);
      e_kill.innerHTML = String(params.kill);

      let currentRealSeconds = new Date().getTime();
      let dt = currentRealSeconds - previousRealSeconds;

      if (dt > 1.0 || dt <= 0) {
        dt = 1.0;
      }

      calculateGrayScott(dt);

      previousRealSeconds = currentRealSeconds;

      renderGrayScott();

      requestAnimationFrame(loop);
    }
  }

  function createProgram(vs_id, fs_id) {

    function createShader(id) {

      let shader;
  
      let scriptElement = document.getElementById(id);
  
      if (!scriptElement) {return;}
  
      switch (scriptElement.type) {

          case 'x-shader/x-vertex':
              shader = gl.createShader(gl.VERTEX_SHADER);
              break;
          case 'x-shader/x-fragment':
              shader = gl.createShader(gl.FRAGMENT_SHADER);
              break;
          default:
              return;
      }
  
      gl.shaderSource(shader, scriptElement.text);
  
      gl.compileShader(shader);
  
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          return shader;
      } else {
          throw(gl.getShaderInfoLog(shader));
      }
   }

    let vs = createShader(vs_id);
    let fs = createShader(fs_id);

    let program = gl.createProgram();
    
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);

      return program;
    } else {
      alert(gl.getProgramInfoLog(program));
    }
  }

  function getUniformLocations(program, uniforms) {

    let locations = {};

    for (let i = 0; i < uniforms.length; i++) {
      locations[uniforms[i]] = (gl.getUniformLocation(program, uniforms[i]));
    }

    return locations;
  }

  function createTexture(width, height, internalFormat, format, type) {

    let tex = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return tex;
  }

  function createFramebuffer(width, height) {

    let framebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    let texture = createTexture(width, height, gl.RG32F, gl.RG, gl.FLOAT);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return {
      framebuffer: framebuffer,
      texture: texture
    };
  }
}