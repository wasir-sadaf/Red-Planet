
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  // ======================================================
  // 1. HTML ELEMENTS
  // ======================================================

  const container = document.getElementById('mars-container');
  const viewStatus = document.getElementById('view-status');
  const loadingOverlay = document.getElementById('viewer-loading');
  const loadingMessage = document.getElementById('loading-message');

  const rotationToggle = document.getElementById('rotation-toggle');
  const rotationIcon = document.getElementById('rotation-icon');
  const rotationLabel = document.getElementById('rotation-label');
  const resetButton = document.getElementById('reset-view');

  const latitudeElement = document.getElementById('latitude');
  const longitudeElement = document.getElementById('longitude');

  if (!container) {
    throw new Error('Missing #mars-container in index.html');
  }

  // ======================================================
  // 2. SCENE, CAMERA AND RENDERER
  // ======================================================

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090d);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    100
  );

  const initialCameraPosition = new THREE.Vector3(0, 0, 3.2);
  camera.position.copy(initialCameraPosition);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'default'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  container.prepend(renderer.domElement);

  // ======================================================
  // 3. CAMERA CONTROLS
  // ======================================================

  const controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 6;
  controls.rotateSpeed = 0.55;

  // ======================================================
  // 4. LIGHTING
  // ======================================================

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  const sunlight = new THREE.DirectionalLight(0xffe0c2, 2.5);
  sunlight.position.set(4, 2, 5);
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0x7c91c7, 0.35);
  fillLight.position.set(-4, 1, -4);
  scene.add(fillLight);

  // ======================================================
  // 5. BACKGROUND STARS
  // ======================================================

  const starPositions = [];

  for (let i = 0; i < 1600; i++) {
    starPositions.push(
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80
    );
  }

  const starGeometry = new THREE.BufferGeometry();

  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starPositions, 3)
  );

  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.035,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // ======================================================
  // 6. MARS SPHERE
  // ======================================================

  const marsMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 5,
    specular: new THREE.Color(0x241008)
  });

  const marsGeometry = new THREE.SphereGeometry(1, 256, 128);
  const mars = new THREE.Mesh(marsGeometry, marsMaterial);

  mars.rotation.z = THREE.MathUtils.degToRad(25);
  scene.add(mars);

  // ======================================================
  // 7. ELEVATION SETTINGS
  // ======================================================

  const HEIGHTMAP_URL = './textures/mars-height.png';

  const MIN_ELEVATION_KM = -8;
  const MAX_ELEVATION_KM = 22;
  const MARS_RADIUS_KM = 3389.5;
  const TERRAIN_EXAGGERATION = 8;

  let terrainReady = false;

  // Keep the original terrain sampling and displacement.
  function getElevationRadius(grayscale) {
    const elevationKm =
      MIN_ELEVATION_KM +
      (grayscale / 255) *
      (MAX_ELEVATION_KM - MIN_ELEVATION_KM);

    const displacement =
      (elevationKm / MARS_RADIUS_KM) *
      TERRAIN_EXAGGERATION;

    return 1 + displacement;
  }

  // ======================================================
  // 8. LATITUDE AND LONGITUDE GRID
  // ======================================================

  // The grid is a separate overlay. It does not modify Mars geometry.
  const gridGroup = new THREE.Group();
  mars.add(gridGroup);

  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0xffa06a,
    transparent: true,
    opacity: 0.72,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  });

  function buildCoordinateGrid(imageData, width, height) {
    // Remove the previous grid if it is rebuilt.
    gridGroup.clear();

    function getHeight(u, v) {
      const x = Math.min(
        width - 1,
        Math.max(0, Math.floor(u * width))
      );

      const y = Math.min(
        height - 1,
        Math.max(0, Math.floor((1 - v) * height))
      );

      const pixelIndex = (y * width + x) * 4;
      return imageData.data[pixelIndex];
    }

    function getSurfacePoint(latitude, longitude) {
      const latRad = THREE.MathUtils.degToRad(latitude);
      const lonRad = THREE.MathUtils.degToRad(longitude);

      const u = (longitude + 180) / 360;
      const v = (latitude + 90) / 180;

      // Use the same spherical orientation as Three.js SphereGeometry.
      const phi = u * Math.PI * 2;
      const theta = (1 - v) * Math.PI;

      const grayscale = getHeight(u, v);
      const radius = getElevationRadius(grayscale) + 0.002;

      return new THREE.Vector3(
        -Math.cos(phi) * Math.sin(theta) * radius,
        Math.cos(theta) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
    }

    function addGridLine(coordinates) {
      const points = coordinates.map(([lat, lon]) =>
        getSurfacePoint(lat, lon)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, gridMaterial);

      gridGroup.add(line);
    }

    // Latitude lines: -75° to +75°, every 15°.
    for (let lat = -75; lat <= 75; lat += 15) {
      const coordinates = [];

      for (let lon = -180; lon <= 180; lon += 2) {
        coordinates.push([lat, lon]);
      }

      addGridLine(coordinates);
    }

    // Longitude lines: every 15°.
    for (let lon = -180; lon < 180; lon += 15) {
      const coordinates = [];

      for (let lat = -88; lat <= 88; lat += 2) {
        coordinates.push([lat, lon]);
      }

      addGridLine(coordinates);
    }

    console.log('Mars latitude/longitude grid added.');
  }

  // ======================================================
  // 9. APPLY MOLA ELEVATION
  // ======================================================

  function applyElevation(heightmapImage) {
    const canvas = document.createElement('canvas');

    canvas.width = heightmapImage.naturalWidth;
    canvas.height = heightmapImage.naturalHeight;

    const context = canvas.getContext('2d', {
      willReadFrequently: true
    });

    if (!context) {
      throw new Error('Could not create heightmap canvas context.');
    }

    context.drawImage(heightmapImage, 0, 0);

    const imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const positions = mars.geometry.attributes.position;
    const uvs = mars.geometry.attributes.uv;

    // Original terrain displacement is preserved.
    for (let i = 0; i < positions.count; i++) {
      const u = uvs.getX(i);
      const v = uvs.getY(i);

      const x = Math.min(
        canvas.width - 1,
        Math.max(0, Math.floor(u * canvas.width))
      );

      const y = Math.min(
        canvas.height - 1,
        Math.max(0, Math.floor((1 - v) * canvas.height))
      );

      const pixelIndex = (y * canvas.width + x) * 4;
      const grayscale = imageData.data[pixelIndex];

      const radius = getElevationRadius(grayscale);

      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );

      vertex.normalize().multiplyScalar(radius);

      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    positions.needsUpdate = true;
    mars.geometry.computeVertexNormals();
    mars.geometry.computeBoundingSphere();

    // Build the grid only after the heightmap has loaded.
    buildCoordinateGrid(imageData, canvas.width, canvas.height);

    terrainReady = true;

    if (viewStatus) {
      viewStatus.textContent = 'MOLA TERRAIN + COORDINATE GRID';
    }

    console.log('MOLA elevation applied.');
    console.log(`Heightmap: ${canvas.width} × ${canvas.height}`);
    console.log(`Terrain exaggeration: ${TERRAIN_EXAGGERATION}×`);
  }

  if (viewStatus) {
    viewStatus.textContent = 'LOADING MOLA ELEVATION';
  }

  const heightmapImage = new Image();

  heightmapImage.onload = () => {
    try {
      applyElevation(heightmapImage);
    } catch (error) {
      console.error('Failed to apply MOLA elevation:', error);

      if (viewStatus) {
        viewStatus.textContent = 'ELEVATION ERROR';
      }
    }
  };

  heightmapImage.onerror = () => {
    console.error('Failed to load MOLA heightmap:', HEIGHTMAP_URL);

    if (viewStatus) {
      viewStatus.textContent = 'HEIGHTMAP LOAD ERROR';
    }
  };

  heightmapImage.src = HEIGHTMAP_URL;

  // ======================================================
  // 10. ATMOSPHERE
  // ======================================================

  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      varying vec3 vNormal;

      void main() {
        float intensity = pow(
          max(
            0.0,
            0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0))
          ),
          3.0
        );

        gl_FragColor = vec4(
          1.0,
          0.25,
          0.08,
          intensity * 0.4
        );
      }
    `,

    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 64, 64),
    atmosphereMaterial
  );

  scene.add(atmosphere);

  // ======================================================
  // 11. NASA VIKING COLOR TEXTURE
  // ======================================================

  const textureLoader = new THREE.TextureLoader();

  if (viewStatus) {
    viewStatus.textContent = 'LOADING NASA TEXTURE';
  }

  textureLoader.load(
    './textures/mars-color.jpg',

    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;

      texture.anisotropy = Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        4
      );

      marsMaterial.map = texture;
      marsMaterial.color.set(0xffffff);
      marsMaterial.needsUpdate = true;

      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
      }

      if (viewStatus) {
        viewStatus.textContent = terrainReady
          ? 'MOLA TERRAIN + COORDINATE GRID'
          : 'NASA SURFACE DATA';
      }

      console.log('NASA Mars color texture loaded.');
    },

    (progress) => {
      if (progress.total > 0 && loadingMessage) {
        const percent = Math.round(
          (progress.loaded / progress.total) * 100
        );

        loadingMessage.textContent =
          `LOADING MARS TEXTURE ${percent}%`;
      }
    },

    (error) => {
      console.error('Failed to load NASA Mars texture:', error);

      if (viewStatus) {
        viewStatus.textContent = 'TEXTURE LOAD ERROR';
      }

      if (loadingMessage) {
        loadingMessage.textContent =
          'TEXTURE FAILED TO LOAD — CHECK CONSOLE';
      }

      marsMaterial.color.set(0xc66b43);
    }
  );

  // ======================================================
  // 12. ROTATION CONTROLS
  // ======================================================

  let isRotating = true;

  function updateRotationButton() {
    if (rotationIcon) {
      rotationIcon.textContent = isRotating ? 'Ⅱ' : '▶';
    }

    if (rotationLabel) {
      rotationLabel.textContent = isRotating
        ? 'Pause Rotation'
        : 'Resume Rotation';
    }

    if (rotationToggle) {
      rotationToggle.setAttribute(
        'aria-pressed',
        String(!isRotating)
      );
    }
  }

  rotationToggle?.addEventListener('click', () => {
    isRotating = !isRotating;
    updateRotationButton();
  });

  updateRotationButton();

  // ======================================================
  // 13. RESET CAMERA
  // ======================================================

  resetButton?.addEventListener('click', () => {
    camera.position.copy(initialCameraPosition);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  // ======================================================
  // 14. VIEW COORDINATE DISPLAY
  // ======================================================

  function updateCoordinates() {
    const direction = new THREE.Vector3();

    camera.getWorldDirection(direction);

    const latitude = THREE.MathUtils.radToDeg(
      Math.asin(
        THREE.MathUtils.clamp(direction.y, -1, 1)
      )
    );

    const longitude = THREE.MathUtils.radToDeg(
      Math.atan2(direction.x, direction.z)
    );

    if (latitudeElement) {
      latitudeElement.textContent = `${latitude.toFixed(1)}°`;
    }

    if (longitudeElement) {
      longitudeElement.textContent = `${longitude.toFixed(1)}°`;
    }
  }

  // ======================================================
  // 15. RESPONSIVE RESIZING
  // ======================================================

  function resizeRenderer() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  }

  const resizeObserver = new ResizeObserver(resizeRenderer);

  resizeObserver.observe(container);
  window.addEventListener('resize', resizeRenderer);

  // ======================================================
  // 16. ANIMATION LOOP
  // ======================================================

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    if (isRotating) {
      mars.rotation.y += delta * 0.12;
      atmosphere.rotation.y += delta * 0.06;
      stars.rotation.y += delta * 0.002;
    }

    controls.update();
    updateCoordinates();

    renderer.render(scene, camera);
  }

animate();
