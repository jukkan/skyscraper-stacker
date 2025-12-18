import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -50, 0); // Gravity
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    this.world.allowSleep = true;

    // Default contact material
    this.defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.5,
        restitution: 0.1,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
      }
    );
    this.world.addContactMaterial(defaultContactMaterial);
    this.world.defaultContactMaterial = defaultContactMaterial;

    // Track all bodies
    this.bodies = [];
    this.groundBody = null;

    this.createGround();
  }

  createGround() {
    // Create ground plane
    const groundShape = new CANNON.Box(new CANNON.Vec3(200, 1, 200));
    this.groundBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(0, -1, 0),
      shape: groundShape,
      material: this.defaultMaterial
    });
    this.world.addBody(this.groundBody);
  }

  addBody(body) {
    body.material = this.defaultMaterial;
    this.world.addBody(body);
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index > -1) {
      this.bodies.splice(index, 1);
      this.world.removeBody(body);
    }
  }

  update(deltaTime) {
    // Fixed timestep for consistent physics
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;

    this.world.step(fixedTimeStep, deltaTime, maxSubSteps);
  }

  // Sync Three.js meshes with physics bodies
  syncMeshes() {
    for (const body of this.bodies) {
      if (body.userData && body.userData.mesh) {
        const mesh = body.userData.mesh;
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }
    }
  }

  // Calculate the highest point of all blocks
  getMaxHeight() {
    let maxHeight = 0;

    for (const body of this.bodies) {
      if (body.userData && body.userData.blockType) {
        // Get bounding box top
        const position = body.position;
        const shape = body.shapes[0];

        if (shape instanceof CANNON.Box) {
          const topY = position.y + shape.halfExtents.y;
          maxHeight = Math.max(maxHeight, topY);
        }
      }
    }

    return Math.max(0, maxHeight);
  }

  // Clear all blocks (keep ground)
  reset() {
    // Remove all dynamic bodies
    const bodiesToRemove = [...this.bodies];
    for (const body of bodiesToRemove) {
      this.removeBody(body);
    }
  }

  // Check if a position would collide with existing blocks
  checkCollision(position, halfExtents) {
    for (const body of this.bodies) {
      if (body.userData && body.userData.blockType) {
        const shape = body.shapes[0];
        if (shape instanceof CANNON.Box) {
          const bPos = body.position;
          const bHalf = shape.halfExtents;

          // Simple AABB collision check
          const overlap =
            Math.abs(position.x - bPos.x) < (halfExtents.x + bHalf.x) &&
            Math.abs(position.y - bPos.y) < (halfExtents.y + bHalf.y) &&
            Math.abs(position.z - bPos.z) < (halfExtents.z + bHalf.z);

          if (overlap) return true;
        }
      }
    }
    return false;
  }

  // Check if placement is valid (no collision with existing blocks)
  isValidPlacement(position, halfExtents, tolerance = 0.5) {
    // Check against all existing blocks
    for (const body of this.bodies) {
      if (body.userData && body.userData.blockType) {
        const shape = body.shapes[0];
        if (shape instanceof CANNON.Box) {
          const bPos = body.position;
          const bHalf = shape.halfExtents;

          // AABB overlap check with small tolerance
          const overlapX = Math.abs(position.x - bPos.x) < (halfExtents.x + bHalf.x - tolerance);
          const overlapY = Math.abs(position.y - bPos.y) < (halfExtents.y + bHalf.y - tolerance);
          const overlapZ = Math.abs(position.z - bPos.z) < (halfExtents.z + bHalf.z - tolerance);

          if (overlapX && overlapY && overlapZ) {
            return false; // Collision detected
          }
        }
      }
    }
    return true;
  }

  // Check if a block at position would have support (ground or another block beneath)
  hasSupport(position, halfExtents) {
    const bottomY = position.y - halfExtents.y;

    // Check if on ground
    if (bottomY <= 0.5) {
      return true;
    }

    // Check if any block is beneath to provide support
    for (const body of this.bodies) {
      if (body.userData && body.userData.blockType) {
        const shape = body.shapes[0];
        if (shape instanceof CANNON.Box) {
          const bPos = body.position;
          const bHalf = shape.halfExtents;
          const bTopY = bPos.y + bHalf.y;

          // Check if this block's top is near our block's bottom
          if (Math.abs(bTopY - bottomY) < 1.0) {
            // Check horizontal overlap (at least 20% overlap in both X and Z)
            const overlapX = Math.max(0,
              Math.min(position.x + halfExtents.x, bPos.x + bHalf.x) -
              Math.max(position.x - halfExtents.x, bPos.x - bHalf.x)
            );
            const overlapZ = Math.max(0,
              Math.min(position.z + halfExtents.z, bPos.z + bHalf.z) -
              Math.max(position.z - halfExtents.z, bPos.z - bHalf.z)
            );

            const minOverlapX = halfExtents.x * 0.4; // 20% of block width
            const minOverlapZ = halfExtents.z * 0.4;

            if (overlapX >= minOverlapX && overlapZ >= minOverlapZ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  // Get the top Y position of a block at given XZ position
  getTopYAt(x, z, blockHalfExtents) {
    let maxTopY = 0;

    for (const body of this.bodies) {
      if (body.userData && body.userData.blockType) {
        const shape = body.shapes[0];
        if (shape instanceof CANNON.Box) {
          const bPos = body.position;
          const bHalf = shape.halfExtents;

          // Check if XZ overlaps
          const overlapX = Math.abs(x - bPos.x) < (blockHalfExtents.x + bHalf.x);
          const overlapZ = Math.abs(z - bPos.z) < (blockHalfExtents.z + bHalf.z);

          if (overlapX && overlapZ) {
            const topY = bPos.y + bHalf.y;
            maxTopY = Math.max(maxTopY, topY);
          }
        }
      }
    }

    return maxTopY;
  }

  // Get all bodies for iteration
  getBodies() {
    return this.bodies;
  }
}
