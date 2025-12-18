import * as THREE from 'three';

export class GameControls {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;

    // Camera orbit controls
    this.spherical = new THREE.Spherical(150, Math.PI / 3, 0);
    this.target = new THREE.Vector3(0, 30, 0);

    // Touch state
    this.touches = new Map();
    this.lastTouchDistance = 0;
    this.isDragging = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.lastMousePos = { x: 0, y: 0 };

    // Raycaster for picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.currentMousePosition = new THREE.Vector2();

    // Callbacks
    this.onPlaceBlock = null;

    // Ground plane for raycasting
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Block meshes for raycasting (managed by game)
    this.blockMeshes = [];

    // Grid snapping
    this.gridSize = 5;
    this.snapToGrid = true;

    this.setupEventListeners();
    this.updateCameraPosition();
  }

  setupEventListeners() {
    // Mouse events
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  updateCameraPosition() {
    const pos = new THREE.Vector3();
    pos.setFromSpherical(this.spherical);
    pos.add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  // Update block meshes array for raycasting
  setBlockMeshes(meshes) {
    this.blockMeshes = meshes;
  }

  // Mouse handlers
  onMouseDown(event) {
    if (event.target !== this.domElement) return;

    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.currentMousePosition.copy(this.mouse);

    if (event.button === 0 || event.button === 2) {
      this.isDragging = true;
      this.dragStartPos = { x: event.clientX, y: event.clientY };
      this.lastMousePos = { x: event.clientX, y: event.clientY };
    }
  }

  onMouseMove(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.currentMousePosition.copy(this.mouse);

    if (!this.isDragging) return;

    const deltaX = event.clientX - this.lastMousePos.x;
    const deltaY = event.clientY - this.lastMousePos.y;

    // Orbit camera
    this.spherical.theta -= deltaX * 0.005;
    this.spherical.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.spherical.phi + deltaY * 0.005));

    this.updateCameraPosition();
    this.lastMousePos = { x: event.clientX, y: event.clientY };
  }

  onMouseUp(event) {
    if (event.button === 0 && this.isDragging) {
      const dx = Math.abs(event.clientX - this.dragStartPos.x);
      const dy = Math.abs(event.clientY - this.dragStartPos.y);

      // If minimal movement, treat as click for placing
      if (dx < 5 && dy < 5 && this.onPlaceBlock) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const placementInfo = this.getPlacementPosition();
        if (placementInfo) {
          this.onPlaceBlock(placementInfo);
        }
      }
    }
    this.isDragging = false;
  }

  onWheel(event) {
    event.preventDefault();
    this.spherical.radius = Math.max(50, Math.min(300, this.spherical.radius + event.deltaY * 0.5));
    this.updateCameraPosition();
  }

  // Touch handlers
  onTouchStart(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY
      });
    }

    // Update mouse position for ghost block
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      this.currentMousePosition.copy(this.mouse);
    }

    if (this.touches.size === 2) {
      const touchArray = Array.from(this.touches.values());
      this.lastTouchDistance = this.getTouchDistance(touchArray[0], touchArray[1]);
    }
  }

  onTouchMove(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      if (this.touches.has(touch.identifier)) {
        this.touches.set(touch.identifier, {
          ...this.touches.get(touch.identifier),
          x: touch.clientX,
          y: touch.clientY
        });
      }
    }

    // Update mouse position for ghost block
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = this.domElement.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      this.currentMousePosition.copy(this.mouse);
    }

    if (this.touches.size === 1) {
      // Single touch - orbit
      const touch = this.touches.values().next().value;
      const startTouch = { x: touch.startX, y: touch.startY };

      const deltaX = touch.x - startTouch.x;
      const deltaY = touch.y - startTouch.y;

      this.spherical.theta -= deltaX * 0.003;
      this.spherical.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, this.spherical.phi + deltaY * 0.003));

      // Update start position for next frame
      const id = this.touches.keys().next().value;
      this.touches.set(id, { ...touch, startX: touch.x, startY: touch.y });

      this.updateCameraPosition();
    } else if (this.touches.size === 2) {
      // Pinch zoom
      const touchArray = Array.from(this.touches.values());
      const distance = this.getTouchDistance(touchArray[0], touchArray[1]);
      const delta = this.lastTouchDistance - distance;

      this.spherical.radius = Math.max(50, Math.min(300, this.spherical.radius + delta * 0.5));
      this.lastTouchDistance = distance;

      this.updateCameraPosition();
    }
  }

  onTouchEnd(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      const storedTouch = this.touches.get(touch.identifier);
      if (storedTouch) {
        const dx = Math.abs(touch.clientX - storedTouch.startX);
        const dy = Math.abs(touch.clientY - storedTouch.startY);

        // If minimal movement, treat as tap for placing
        if (dx < 15 && dy < 15 && this.onPlaceBlock && this.touches.size === 1) {
          const rect = this.domElement.getBoundingClientRect();
          this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
          this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

          const placementInfo = this.getPlacementPosition();
          if (placementInfo) {
            this.onPlaceBlock(placementInfo);
          }
        }

        this.touches.delete(touch.identifier);
      }
    }
  }

  getTouchDistance(t1, t2) {
    const dx = t1.x - t2.x;
    const dy = t1.y - t2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Snap position to grid
  snapPositionToGrid(position) {
    if (!this.snapToGrid) return position;

    return new THREE.Vector3(
      Math.round(position.x / this.gridSize) * this.gridSize,
      position.y,
      Math.round(position.z / this.gridSize) * this.gridSize
    );
  }

  // Get placement position - checks block tops first, then ground
  getPlacementPosition() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // First, check for intersections with existing blocks
    if (this.blockMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.blockMeshes, false);

      for (const intersect of intersects) {
        // Check if we're hitting the top face of the block
        if (intersect.face && intersect.face.normal) {
          const worldNormal = intersect.face.normal.clone();
          worldNormal.transformDirection(intersect.object.matrixWorld);

          // If normal points mostly upward (top face)
          if (worldNormal.y > 0.5) {
            const point = intersect.point.clone();
            // Snap to grid
            const snapped = this.snapPositionToGrid(point);
            snapped.y = point.y; // Keep the exact Y from intersection

            return {
              position: snapped,
              surfaceY: point.y,
              onBlock: true,
              targetBlock: intersect.object
            };
          }
        }
      }
    }

    // Fall back to ground plane
    const intersection = new THREE.Vector3();
    const ray = this.raycaster.ray;

    if (ray.intersectPlane(this.groundPlane, intersection)) {
      // Clamp to reasonable build area
      intersection.x = Math.max(-80, Math.min(80, intersection.x));
      intersection.z = Math.max(-80, Math.min(80, intersection.z));

      const snapped = this.snapPositionToGrid(intersection);
      snapped.y = 0;

      return {
        position: snapped,
        surfaceY: 0,
        onBlock: false,
        targetBlock: null
      };
    }

    return null;
  }

  // Get ghost position for preview (uses current mouse position)
  getGhostPlacementPosition() {
    this.raycaster.setFromCamera(this.currentMousePosition, this.camera);

    // First, check for intersections with existing blocks
    if (this.blockMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.blockMeshes, false);

      for (const intersect of intersects) {
        if (intersect.face && intersect.face.normal) {
          const worldNormal = intersect.face.normal.clone();
          worldNormal.transformDirection(intersect.object.matrixWorld);

          // If normal points mostly upward (top face)
          if (worldNormal.y > 0.5) {
            const point = intersect.point.clone();
            const snapped = this.snapPositionToGrid(point);
            snapped.y = point.y;

            return {
              position: snapped,
              surfaceY: point.y,
              onBlock: true,
              targetBlock: intersect.object
            };
          }
        }
      }
    }

    // Fall back to ground plane
    const intersection = new THREE.Vector3();
    const ray = this.raycaster.ray;

    if (ray.intersectPlane(this.groundPlane, intersection)) {
      intersection.x = Math.max(-80, Math.min(80, intersection.x));
      intersection.z = Math.max(-80, Math.min(80, intersection.z));

      const snapped = this.snapPositionToGrid(intersection);
      snapped.y = 0;

      return {
        position: snapped,
        surfaceY: 0,
        onBlock: false,
        targetBlock: null
      };
    }

    return null;
  }

  // Legacy method for compatibility
  getGroundPosition() {
    const info = this.getPlacementPosition();
    return info ? info.position : null;
  }
}
