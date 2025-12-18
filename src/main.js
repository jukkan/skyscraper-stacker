import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { createBlock, createGhostBlock, getBlockHeightOffset, BLOCK_TYPES } from './blocks.js';
import { GameControls } from './controls.js';

class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.physics = null;
    this.controls = null;

    // Game state
    this.selectedBlockType = null;
    this.ghostBlock = null;
    this.blocks = [];
    this.isPlacingMode = false;

    // UI elements
    this.heightValueEl = null;
    this.instructionsEl = null;

    // Performance
    this.clock = new THREE.Clock();
    this.lastTime = 0;

    this.init();
  }

  init() {
    this.setupRenderer();
    this.setupScene();
    this.setupLights();
    this.setupPhysics();
    this.setupControls();
    this.setupUI();
    this.createGround();

    // Start game loop
    this.animate();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  setupRenderer() {
    const canvas = document.getElementById('game-canvas');

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setupScene() {
    this.scene = new THREE.Scene();

    // Pastel sky gradient (set via CSS, keep scene transparent)
    this.scene.background = null;

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.camera.position.set(100, 80, 100);
    this.camera.lookAt(0, 30, 0);
  }

  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.3);
    fillLight.position.set(-30, 40, -30);
    this.scene.add(fillLight);
  }

  setupPhysics() {
    this.physics = new PhysicsWorld();
  }

  setupControls() {
    const canvas = document.getElementById('game-canvas');
    this.controls = new GameControls(this.camera, canvas, this.scene);

    // Set up block placement callback
    this.controls.onPlaceBlock = (position) => {
      if (this.selectedBlockType) {
        this.placeBlock(position);
      }
    };
  }

  setupUI() {
    this.heightValueEl = document.getElementById('height-value');
    this.instructionsEl = document.getElementById('instructions');

    // Block palette buttons
    const blockButtons = document.querySelectorAll('.block-btn');
    blockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectBlockType(btn.dataset.block);
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.selectBlockType(btn.dataset.block);
      });
    });

    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => this.reset());
    resetBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.reset();
    });

    // Close instructions
    const closeInstructionsBtn = document.getElementById('close-instructions');
    closeInstructionsBtn.addEventListener('click', () => {
      this.instructionsEl.classList.add('hidden');
    });
    closeInstructionsBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.instructionsEl.classList.add('hidden');
    });
  }

  createGround() {
    // Visual ground plane
    const groundGeometry = new THREE.PlaneGeometry(400, 400);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x90EE90, // Light green
      roughness: 0.8,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper for visual reference
    const gridHelper = new THREE.GridHelper(200, 20, 0x666666, 0xaaaaaa);
    gridHelper.position.y = 0.1;
    this.scene.add(gridHelper);
  }

  selectBlockType(type) {
    // Update UI
    const blockButtons = document.querySelectorAll('.block-btn');
    blockButtons.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.block === type);
    });

    // Toggle selection
    if (this.selectedBlockType === type) {
      this.selectedBlockType = null;
      this.removeGhostBlock();
      document.getElementById('game-container').classList.remove('placing-mode');
    } else {
      this.selectedBlockType = type;
      this.createGhostBlockForType(type);
      document.getElementById('game-container').classList.add('placing-mode');
    }
  }

  createGhostBlockForType(type) {
    this.removeGhostBlock();
    this.ghostBlock = createGhostBlock(type);
    if (this.ghostBlock) {
      this.ghostBlock.visible = false;
      this.scene.add(this.ghostBlock);
    }
  }

  removeGhostBlock() {
    if (this.ghostBlock) {
      this.scene.remove(this.ghostBlock);
      this.ghostBlock = null;
    }
  }

  placeBlock(position) {
    if (!this.selectedBlockType) return;

    const heightOffset = getBlockHeightOffset(this.selectedBlockType);
    const dropHeight = this.physics.getMaxHeight() + 80; // Drop from above current stack

    const spawnPosition = {
      x: position.x,
      y: dropHeight + heightOffset,
      z: position.z
    };

    const block = createBlock(this.selectedBlockType, spawnPosition);
    if (block) {
      this.scene.add(block.mesh);
      this.physics.addBody(block.body);
      this.blocks.push(block);

      // Add slight random rotation for more interesting stacking
      block.body.angularVelocity.set(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );
    }
  }

  reset() {
    // Remove all blocks from scene
    for (const block of this.blocks) {
      this.scene.remove(block.mesh);
    }
    this.blocks = [];

    // Reset physics
    this.physics.reset();

    // Reset UI
    this.selectedBlockType = null;
    this.removeGhostBlock();
    const blockButtons = document.querySelectorAll('.block-btn');
    blockButtons.forEach(btn => btn.classList.remove('selected'));
    document.getElementById('game-container').classList.remove('placing-mode');

    // Update height display
    this.updateHeightMeter();
  }

  updateHeightMeter() {
    const height = Math.round(this.physics.getMaxHeight());
    if (this.heightValueEl) {
      this.heightValueEl.textContent = height;
    }
  }

  updateGhostBlock() {
    if (!this.ghostBlock || !this.selectedBlockType) return;

    const position = this.controls.getGroundPosition();
    if (position) {
      const heightOffset = getBlockHeightOffset(this.selectedBlockType);
      this.ghostBlock.position.set(position.x, heightOffset, position.z);
      this.ghostBlock.visible = true;
    } else {
      this.ghostBlock.visible = false;
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const deltaTime = this.clock.getDelta();

    // Update physics
    this.physics.update(deltaTime);
    this.physics.syncMeshes();

    // Update ghost block position
    this.updateGhostBlock();

    // Update height meter
    this.updateHeightMeter();

    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
