import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { createBlock, createGhostBlock, setGhostValidity, getBlockHeightOffset, getBlockHalfExtents, BLOCK_TYPES } from './blocks.js';
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
    this.currentPlacementValid = false;
    this.lastPlacementInfo = null;

    // UI elements
    this.heightValueEl = null;
    this.instructionsEl = null;
    this.cancelBtn = null;

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
    this.controls.onPlaceBlock = (placementInfo) => {
      if (this.selectedBlockType && this.currentPlacementValid) {
        this.confirmPlacement(placementInfo);
      }
    };
  }

  setupUI() {
    this.heightValueEl = document.getElementById('height-value');
    this.instructionsEl = document.getElementById('instructions');
    this.cancelBtn = document.getElementById('cancel-btn');

    // Block palette buttons
    const blockButtons = document.querySelectorAll('.block-btn');
    blockButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBlockType(btn.dataset.block);
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectBlockType(btn.dataset.block);
      });
    });

    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
    });
    resetBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.reset();
    });

    // Cancel button
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cancelPlacement();
      });
      this.cancelBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cancelPlacement();
      });
    }

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
    const gridHelper = new THREE.GridHelper(200, 40, 0x666666, 0xaaaaaa);
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
      this.cancelPlacement();
    } else {
      this.selectedBlockType = type;
      this.createGhostBlockForType(type);
      document.getElementById('game-container').classList.add('placing-mode');

      // Show cancel button
      if (this.cancelBtn) {
        this.cancelBtn.classList.remove('hidden');
      }
    }
  }

  cancelPlacement() {
    this.selectedBlockType = null;
    this.removeGhostBlock();
    this.currentPlacementValid = false;
    this.lastPlacementInfo = null;

    // Update UI
    const blockButtons = document.querySelectorAll('.block-btn');
    blockButtons.forEach(btn => btn.classList.remove('selected'));
    document.getElementById('game-container').classList.remove('placing-mode');

    // Hide cancel button
    if (this.cancelBtn) {
      this.cancelBtn.classList.add('hidden');
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

  // Confirm placement - place block at ghost position with physics enabled
  confirmPlacement(placementInfo) {
    if (!this.selectedBlockType || !this.currentPlacementValid) return;

    const halfExtents = getBlockHalfExtents(this.selectedBlockType);
    if (!halfExtents) return;

    // Calculate final position
    const position = placementInfo.position.clone();
    position.y = placementInfo.surfaceY + halfExtents.y;

    // Create the actual block with physics
    const block = createBlock(this.selectedBlockType, {
      x: position.x,
      y: position.y,
      z: position.z
    });

    if (block) {
      this.scene.add(block.mesh);
      this.physics.addBody(block.body);
      this.blocks.push(block);

      // Update the controls with new block meshes for raycasting
      this.updateBlockMeshesForRaycast();

      // Deselect and hide ghost
      this.cancelPlacement();
    }
  }

  // Update block meshes array for raycasting
  updateBlockMeshesForRaycast() {
    const meshes = this.blocks.map(b => b.mesh);
    this.controls.setBlockMeshes(meshes);
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
    this.cancelPlacement();

    // Update block meshes for raycasting
    this.updateBlockMeshesForRaycast();

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

    // Get placement position from controls
    const placementInfo = this.controls.getGhostPlacementPosition();

    if (placementInfo) {
      const halfExtents = getBlockHalfExtents(this.selectedBlockType);
      if (!halfExtents) {
        this.ghostBlock.visible = false;
        return;
      }

      // Calculate ghost Y position (on top of surface)
      const ghostY = placementInfo.surfaceY + halfExtents.y;
      const position = placementInfo.position.clone();
      position.y = ghostY;

      // Smooth interpolation for ghost position
      this.ghostBlock.position.lerp(position, 0.3);
      this.ghostBlock.visible = true;

      // Check validity
      const isValid = this.checkPlacementValidity(position, halfExtents);
      this.currentPlacementValid = isValid;
      this.lastPlacementInfo = placementInfo;

      // Update visual feedback
      setGhostValidity(this.ghostBlock, isValid);
    } else {
      this.ghostBlock.visible = false;
      this.currentPlacementValid = false;
    }
  }

  // Check if placement is valid (no collision and has support)
  checkPlacementValidity(position, halfExtents) {
    // Check for collisions with existing blocks
    const noCollision = this.physics.isValidPlacement(
      { x: position.x, y: position.y, z: position.z },
      halfExtents
    );

    if (!noCollision) return false;

    // Check for support (ground or block beneath)
    const hasSupport = this.physics.hasSupport(
      { x: position.x, y: position.y, z: position.z },
      halfExtents
    );

    return hasSupport;
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
