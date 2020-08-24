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

  let initializeTrailsProgram = createProgram('buffer_vs', 'init_trails_fs');
  let updateTrailsProgram = createProgram('buffer_vs', 'update_trails_fs');
  let renderTrailsProgram = createProgram('render_vs', 'render_trails_fs');

  let initializeUniforms = getUniformLocations(initializeTrailsProgram, []);
  let updateUniforms = getUniformLocations(updateTrailsProgram, ['uPositionTexture', 'uVelocityTexture', 'uTime', 'uDeltaTime']);
  let renderUniforms = getUniformLocations(renderTrailsProgram, ['uPositionTexture', 'vpMatrix']);

  let m = new matIV();
  let vMatrix = m.identity(m.create());
  let pMatrix = m.identity(m.create());
  let tmpMatrix = m.identity(m.create());

  m.lookAt([0.0, 0.0, 5.0], [0, 0, 0], [0, 1, 0], vMatrix);
  m.perspective(60, canvas.width / canvas.height, 0.1, 1000, pMatrix);
  m.multiply(pMatrix, vMatrix, tmpMatrix);

  render();

  function render() {

    let params = {
      trail_size: 4096,
      vertex_size: 256
    };

    // swapping functions
    let trailsFBObjR = createFramebuffer(params.trail_size, params.vertex_size);
    let trailsFBObjW = createFramebuffer(params.trail_size, params.vertex_size);
    function swapTrailsFBObj() {
      let tmp = trailsFBObjR;
      trailsFBObjR = trailsFBObjW;
      trailsFBObjW = tmp;
    };

    function initializeTrails() {
      gl.useProgram(initializeTrailsProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trailsFBObjW.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      swapTrailsFBObj();
    }

    function updateTrails(time, dt) {
      gl.useProgram(updateTrailsProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trailsFBObjW.framebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, trailsFBObjR.positionTexture);
      gl.uniform1i(updateUniforms['uPositionTexture'], 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, trailsFBObjR.velocityTexture);
      gl.uniform1i(updateUniforms['uVelocityTexture'], 1);
      gl.uniform1f(updateUniforms['uTime'], time);
      gl.uniform1f(updateUniforms['uDeltaTime'], dt);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      swapTrailsFBObj();
    }
    
    function renderTrails() {
      gl.clear(gl.COLOR_BUFFER_BIT); 
      gl.viewport(0.0, 0.0, canvas.width, canvas.height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(renderTrailsProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, trailsFBObjR.positionTexture);
      gl.uniform1i(renderUniforms['uPositiontexture'], 0);
      gl.uniformMatrix4fv(renderUniforms['vpMatrix'], false, tmpMatrix);
      gl.drawArraysInstanced(gl.LINE_STRIP, 0, params.vertex_size, params.trail_size);
      gl.disable(gl.BLEND);
    }
    
    let elapsedTime = 0.0;
    let prevTime = performance.now();

    initializeTrails();

    loop();

    function loop() {

      stats.update();

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.viewport(0.0, 0.0, canvas.width, canvas.height);

      params = {
        trail_size: 4096,
        vertex_size: 256
      };

      // let eTrailSize = document.getElementById('disp_trail_size');
      // let eVertexSize = document.getElementById('disp_vertex_size');
      
      // eTrailSize.innerHTML = String(params.trail_size);
      // eVertexSize.innerHTML = String(params.vertex_size);

      let currentTime = performance.now();
      let dt = Math.min(0.05, (currentTime - prevTime) * 0.001);
      elapsedTime += dt;
      prevTime = currentTime;

      updateTrails(elapsedTime, dt);

      renderTrails();

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

    gl.bindTexture(gl.TEXTURE_2D, null);

    return tex;
  }

  function createFramebuffer(width, height) {

    let framebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    let positionTexture = createTexture(width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    
    gl.bindTexture(gl.TEXTURE_2D, positionTexture);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, positionTexture, 0);

    let velocityTexture = createTexture(width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT);
    
    gl.bindTexture(gl.TEXTURE_2D, velocityTexture);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, velocityTexture, 0);

    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.bindTexture(gl.TEXTURE_2D, null);

    return {
      framebuffer: framebuffer,
      positionTexture: positionTexture,
      velocityTexture: velocityTexture 
    };
  }
}