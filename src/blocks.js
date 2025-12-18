import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Block type definitions
export const BLOCK_TYPES = {
  foundation: {
    name: 'Foundation Block',
    size: { x: 20, y: 15, z: 20 },
    color: 0xFFE66D,
    mass: 8,
    friction: 0.7
  },
  office: {
    name: 'Office Tower',
    size: { x: 10, y: 30, z: 10 },
    color: 0x4ECDC4,
    mass: 5,
    friction: 0.6
  },
  spire: {
    name: 'Spire',
    size: { x: 5, y: 50, z: 5 },
    color: 0xFF6B6B,
    mass: 3,
    friction: 0.5
  }
};

// Create toon material for cartoon look
function createToonMaterial(color) {
  // Create gradient map for toon shading
  const colors = new Uint8Array(3);
  colors[0] = 80;  // dark
  colors[1] = 160; // mid
  colors[2] = 255; // light

  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  gradientMap.needsUpdate = true;

  return new THREE.MeshToonMaterial({
    color: color,
    gradientMap: gradientMap
  });
}

// Create a Three.js mesh for a block type
export function createBlockMesh(blockType) {
  const config = BLOCK_TYPES[blockType];
  if (!config) {
    console.error(`Unknown block type: ${blockType}`);
    return null;
  }

  const geometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
  const material = createToonMaterial(config.color);
  const mesh = new THREE.Mesh(geometry, material);

  // Add edges for cartoon effect
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x333333,
    linewidth: 2
  });
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  mesh.add(edges);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockType = blockType;

  return mesh;
}

// Create a Cannon.js physics body for a block type
export function createBlockBody(blockType, position = { x: 0, y: 0, z: 0 }) {
  const config = BLOCK_TYPES[blockType];
  if (!config) {
    console.error(`Unknown block type: ${blockType}`);
    return null;
  }

  const halfExtents = new CANNON.Vec3(
    config.size.x / 2,
    config.size.y / 2,
    config.size.z / 2
  );

  const shape = new CANNON.Box(halfExtents);
  const body = new CANNON.Body({
    mass: config.mass,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape: shape,
    material: new CANNON.Material({
      friction: config.friction,
      restitution: 0.1
    })
  });

  // Add damping for more realistic feel
  body.linearDamping = 0.1;
  body.angularDamping = 0.3;

  return body;
}

// Create a complete block (mesh + physics body)
export function createBlock(blockType, position = { x: 0, y: 50, z: 0 }) {
  const mesh = createBlockMesh(blockType);
  const body = createBlockBody(blockType, position);

  if (!mesh || !body) {
    return null;
  }

  // Link mesh and body
  mesh.userData.physicsBody = body;
  body.userData = { mesh: mesh, blockType: blockType };

  return { mesh, body };
}

// Create ghost preview block (semi-transparent)
export function createGhostBlock(blockType) {
  const config = BLOCK_TYPES[blockType];
  if (!config) return null;

  const geometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
  const material = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.blockType = blockType;
  mesh.userData.isGhost = true;

  return mesh;
}

// Get the height offset for placing a block (half its height)
export function getBlockHeightOffset(blockType) {
  const config = BLOCK_TYPES[blockType];
  return config ? config.size.y / 2 : 0;
}
