import "./style.css";
import * as THREE from "three";
import * as dat from "dat.gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { gsap } from "gsap";

// Debug
const gui = new dat.GUI();

// Window sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const canvas = document.querySelector("canvas.webgl");

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  sizes.width / sizes.height,
  0.1,
  1000
);
camera.position.z = 6;
camera.position.y = -0.5;

const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Declare constants
let textMesh = null;
let logoGroup = null;

// Lights
const pointLight = new THREE.PointLight(0xffffff, 1, 100); // color, intensity, distance
pointLight.position.set(3, 3, 3); // Position the light source
scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);

// Load font
const loader = new FontLoader();
loader.load("./tt_bluescreens_demibold.json", function (font) {
  const shapes = font.generateShapes("Soundness", 1.5);

  const nodeMat = new THREE.MeshBasicMaterial({ color: "#fff" });
  const nodeGeo = new THREE.SphereGeometry(0.015, 8, 8);

  const shapeGeo = new THREE.ShapeGeometry(shapes);
  shapeGeo.computeBoundingBox();

  const bbox = shapeGeo.boundingBox;
  const offsetX = (bbox.max.x + bbox.min.x) / 2 + 0.85;
  const offsetY = (bbox.max.y + bbox.min.y) / 2;

  const zRange = 0.6;
  const maxLinks = 2; // number of nearby nodes to connect

  shapes.forEach((shape) => {
    const points2D = shape.getPoints(3);
    const points3D = [];

    /** Convert to 3D points + add spheres */
    points2D.forEach((pt) => {
      const z = (Math.random() - 0.5) * zRange;
      const vec3 = new THREE.Vector3(pt.x - offsetX, pt.y - offsetY, z);
      points3D.push(vec3);

      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: "#fff",
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const pulseGeometry = new THREE.RingGeometry(0.03, 0.035, 32);
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.copy(vec3);
      pulse.lookAt(camera.position); // make sure it always faces the camera

      // Store custom data for animation
      pulse.userData = { t: Math.random() * Math.PI * 2 };
      scene.add(pulse);

      const sphere = new THREE.Mesh(nodeGeo, nodeMat);
      sphere.position.copy(vec3);
      scene.add(sphere);
    });

    /** Connect each point to its N nearest neighbors */
    const lineSegments = [];
    for (let i = 0; i < points3D.length; i++) {
      const a = points3D[i];

      // Find closest points
      const neighbors = points3D
        .map((b, j) => ({ b, dist: a.distanceTo(b), j }))
        .filter((entry) => entry.j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, maxLinks);

      neighbors.forEach(({ b }) => {
        lineSegments.push(a.clone(), b.clone());
      });
    }

    /** Lines to connect all the nodes */
    const lineGeo = new THREE.BufferGeometry().setFromPoints(lineSegments);
    const lineMat = new THREE.LineBasicMaterial({
      color: "#fff",
      transparent: true,
      opacity: 0.25,
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);

    /** Lines to stroke the letters */
    const outlinePoints = points2D.map(
      (pt) => new THREE.Vector3(pt.x - offsetX, pt.y - offsetY, 0)
    );
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const outlineLine = new THREE.Line(
      outlineGeo,
      new THREE.LineBasicMaterial({
        color: "#fff",
        transparent: true,
        opacity: 0.6,
      })
    );

    scene.add(outlineLine);
    scene.add(lineMesh);
  });

  // Load SVG logo after text is loaded
  loadSVGLogo();
});

function loadSVGLogo() {
  const svgLoader = new SVGLoader();

  // Load from external file
  svgLoader.load(
    "./interlocking-blue-knot.svg", // Path to your SVG file
    function (data) {
      const paths = data.paths;
      logoGroup = new THREE.Group();

      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];

        // Get the color from the path
        const material = new THREE.MeshBasicMaterial({
          color: path.color || 0x182cd2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        // Create shapes from the path
        const shapes = path.toShapes(true);

        for (let j = 0; j < shapes.length; j++) {
          const shape = shapes[j];

          const extrudeSettings = {
            depth: 0.1,
            bevelEnabled: true,
            bevelThickness: 18,
            bevelSize: 0.02,
            bevelOffset: 0,
            bevelSegments: 5,
          };

          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const mesh = new THREE.Mesh(geometry, material);
          logoGroup.add(mesh);

          // Create a stroke-style animated outline using Line
          const points = shape.getPoints(100);
          const strokeGeometry = new THREE.BufferGeometry().setFromPoints(
            points
          );
          const strokeMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
          });

          const line = new THREE.Line(strokeGeometry, strokeMaterial);

          // Start with 0 drawn
          strokeGeometry.setDrawRange(0, 0);
          logoGroup.add(line);

          // Animate the stroke drawing in a loop
          const totalPoints = strokeGeometry.attributes.position.count;

          function animateStroke() {
            let drawCount = { value: 0 };
            gsap.to(drawCount, {
              value: totalPoints,
              duration: 10,
              repeat: -1,
              yoyo: true,
              ease: "power1.inOut",
              onUpdate: () => {
                strokeGeometry.setDrawRange(0, Math.floor(drawCount.value));
              },
            });
          }

          animateStroke();
        }
      }

      // Scale and position the logo
      logoGroup.scale.multiplyScalar(0.0025);
      logoGroup.position.set(1.65, 1.1, 0.1);
      logoGroup.rotation.x = Math.PI;

      scene.add(logoGroup);
    },
    function (progress) {
      console.log("SVG loading progress:", progress);
    },
    function (error) {
      console.error("Error loading SVG:", error);
    }
  );
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

function animate() {
  requestAnimationFrame(animate);

  scene.traverse((obj) => {
    if (obj.geometry?.type === "RingGeometry") {
      const t = performance.now() * 0.0008 + obj.userData.t;

      const scale = 1 + Math.abs(Math.sin(t)) * 0.5;
      const opacity = Math.sin(t) * 0.5;

      obj.scale.set(scale, scale, scale);
      obj.material.opacity = Math.max(0, opacity);

      obj.lookAt(camera.position);
    }
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();
