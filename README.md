# Skyscraper Stacker

A physics-based tower building game for web and iPad. Stack blocks to build the tallest skyscraper!

## Play Now

**[Play Skyscraper Stacker](https://jukkan.github.io/skyscraper-stacker/)**

## Features

- **3D Physics**: Realistic block stacking with Cannon.js physics engine
- **Touch-Optimized**: Works great on iPad and mobile devices
- **3 Block Types**:
  - Foundation Block (20x15x20) - Wide and stable base
  - Office Tower (10x30x10) - Standard building block
  - Spire (5x50x5) - Tall and wobbly for challenging stacks
- **Height Meter**: Track your tower's height in real-time
- **Smooth 60fps**: Optimized for mobile performance

## Controls

### Desktop
- **Left Click**: Select block from palette, then click scene to place
- **Left Drag**: Orbit camera around scene
- **Mouse Wheel**: Zoom in/out
- **Right Click + Drag**: Orbit camera

### Touch (iPad/Mobile)
- **Tap**: Select block, then tap scene to place
- **One Finger Drag**: Orbit camera
- **Pinch**: Zoom in/out

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Tech Stack
- [Vite](https://vitejs.dev/) - Fast build tool
- [Three.js](https://threejs.org/) - 3D rendering
- [Cannon-es](https://pmndrs.github.io/cannon-es/) - Physics engine

## File Structure

```
/
├── index.html          # Entry point
├── src/
│   ├── main.js         # Game setup and loop
│   ├── physics.js      # Cannon.js physics world
│   ├── blocks.js       # Block definitions
│   ├── controls.js     # Touch/mouse input
│   └── styles.css      # UI styling
├── public/             # Static assets
├── package.json        # Dependencies
└── vite.config.js      # Vite configuration
```

## Deployment

This project is automatically deployed to GitHub Pages via GitHub Actions.

To deploy manually:
```bash
npm run build
# Deploy the 'dist' folder to GitHub Pages
```

## License

MIT
