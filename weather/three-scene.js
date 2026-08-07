/* ==========================================================================
   Aether3D - Three.js Weather & Globe Engine
   ========================================================================== */

class WeatherSceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // Groups
        this.globeGroup = new THREE.Group();
        this.dioramaGroup = new THREE.Group();
        
        // Weather systems
        this.rainParticles = null;
        this.snowParticles = null;
        this.clouds = [];
        this.windmillBlades = null;
        this.ambientSound = null;
        
        // Lighting
        this.sunLight = null;
        this.ambientLight = null;
        this.cabinLight = null;
        
        // Active states
        this.currentView = 'globe'; // 'globe' or 'diorama'
        this.currentWeather = 'sunny';
        this.autoRotateGlobe = true;
        this.lightningFlashActive = false;
        
        // Globe Pin
        this.activePin = null;

        // Initialize Three.js
        this.init();
        this.buildStarsBackground();
        this.buildGlobe();
        this.buildDiorama();
        this.buildWeatherSystems();
        
        // Set initial view and weather
        this.setWeather('sunny');
        this.setView('globe', false); // instant first view
        
        // Start animation loop
        this.animate();
        
        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());
    }

    init() {
        // Scene setup with Fog
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x080b11);
        this.scene.fog = new THREE.FogExp2(0x080b11, 0.002);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            45, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 5, 13);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // Controls setup
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 30;
        this.controls.minDistance = 3;

        // Lighting setup
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Main Sun/Directional Light (casting shadows)
        this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
        this.sunLight.position.set(10, 15, 10);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 40;
        const d = 10;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // Scene Groups
        this.scene.add(this.globeGroup);
        this.scene.add(this.dioramaGroup);
    }

    buildStarsBackground() {
        const starsGeometry = new THREE.BufferGeometry();
        const count = 2000;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            // Distant sphere projection
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = 150 + Math.random() * 50; // far away stars

            positions[i] = r * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = r * Math.cos(phi);

            // Shimmering blue-white color
            const intensity = 0.5 + Math.random() * 0.5;
            colors[i] = intensity * 0.9;     // R
            colors[i + 1] = intensity * 0.95; // G
            colors[i + 2] = intensity;        // B
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starsMaterial = new THREE.PointsMaterial({
            size: 0.6,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        const starPoints = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(starPoints);
    }

    buildGlobe() {
        const R = 3.5;
        
        // Textures with CDN fallbacks
        const textureLoader = new THREE.TextureLoader();
        
        // Generate procedural backup textures if networks are blocked
        const defaultMap = this.generateProceduralWorldMap();
        
        // Earth sphere
        const globeGeo = new THREE.SphereGeometry(R, 64, 64);
        const globeMat = new THREE.MeshStandardMaterial({
            map: defaultMap,
            roughness: 0.6,
            metalness: 0.1,
            bumpScale: 0.05
        });
        
        // Try loading high-res texture
        textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
            (texture) => {
                globeMat.map = texture;
                globeMat.needsUpdate = true;
            },
            undefined,
            () => console.log('Using procedural fallback for globe texture')
        );

        const globeMesh = new THREE.Mesh(globeGeo, globeMat);
        globeMesh.castShadow = true;
        globeMesh.receiveShadow = true;
        this.globeGroup.add(globeMesh);

        // Outer atmospheric glow
        const glowGeo = new THREE.SphereGeometry(R * 1.04, 32, 32);
        const glowMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.75 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.7;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        this.globeGroup.add(glowMesh);

        // Slowly rotating cloud layer
        const cloudsGeo = new THREE.SphereGeometry(R * 1.015, 64, 64);
        const cloudsMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending
        });
        
        // Try loading clouds texture
        textureLoader.load(
            'https://unpkg.com/three-globe/example/img/earth-clouds.png',
            (texture) => {
                cloudsMat.alphaMap = texture;
                cloudsMat.transparent = true;
                cloudsMat.opacity = 0.45;
                cloudsMat.blending = THREE.NormalBlending;
                cloudsMat.needsUpdate = true;
            }
        );

        this.cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
        this.globeGroup.add(this.cloudsMesh);
    }

    generateProceduralWorldMap() {
        // Draw a dark blue vector-grid styled world map onto a canvas
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Dark space/ocean background
        ctx.fillStyle = '#0a101d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Neon grid lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const gridStep = 32;
        for (let x = 0; x < canvas.width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw rough continent outlines procedurally to avoid empty texture
        ctx.fillStyle = '#1e3a8a';
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 15;
        
        // Helper function for continent shapes
        const drawLand = (pts) => {
            ctx.beginPath();
            ctx.moveTo(pts[0][0] * 2048, pts[0][1] * 1024);
            for(let i=1; i<pts.length; i++) {
                ctx.lineTo(pts[i][0] * 2048, pts[i][1] * 1024);
            }
            ctx.closePath();
            ctx.fill();
        };

        // Simplified approximations of continents [0..1] coord map
        // North America
        drawLand([[0.1, 0.25], [0.35, 0.25], [0.3, 0.45], [0.25, 0.55], [0.18, 0.65], [0.12, 0.45]]);
        // South America
        drawLand([[0.25, 0.55], [0.32, 0.6], [0.36, 0.7], [0.3, 0.9], [0.24, 0.75], [0.23, 0.6]]);
        // Africa
        drawLand([[0.45, 0.45], [0.55, 0.45], [0.62, 0.55], [0.58, 0.75], [0.5, 0.85], [0.45, 0.65]]);
        // Eurasia
        drawLand([[0.4, 0.2], [0.85, 0.15], [0.88, 0.45], [0.72, 0.55], [0.55, 0.42], [0.45, 0.35]]);
        // Australia
        drawLand([[0.78, 0.65], [0.86, 0.68], [0.85, 0.8], [0.76, 0.78]]);
        // Greenland
        drawLand([[0.35, 0.15], [0.42, 0.13], [0.38, 0.22]]);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    buildDiorama() {
        // Floating Island Base (Grass top, rocky bottom)
        const islandRadius = 4;
        const islandHeight = 1.8;
        
        // Cylinder base
        const baseGeo = new THREE.CylinderGeometry(islandRadius, islandRadius - 0.5, islandHeight, 8, 4);
        // Perturb cylinder vertices to make it look organic and "low-poly"
        const pos = baseGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            // Skip top vertices to keep the grassy lawn flat
            const y = pos.getY(i);
            if (y < islandHeight / 2 - 0.1) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const angle = Math.atan2(z, x);
                const dist = Math.sqrt(x*x + z*z) * (0.95 + Math.random() * 0.1);
                pos.setX(i, Math.cos(angle) * dist);
                pos.setZ(i, Math.sin(angle) * dist);
            }
        }
        baseGeo.computeVertexNormals();

        // Separate materials for top (grass) and sides (dirt/rock)
        const baseMatSide = new THREE.MeshStandardMaterial({
            color: 0x54473d, // earthy brown
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true
        });
        const baseMatTop = new THREE.MeshStandardMaterial({
            color: 0x4f772d, // lush grass green
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        // Multimaterial assignment: 0 = side, 1 = top, 2 = bottom
        const islandMesh = new THREE.Mesh(baseGeo, [baseMatSide, baseMatTop, baseMatSide]);
        islandMesh.position.y = -islandHeight / 2;
        islandMesh.receiveShadow = true;
        islandMesh.castShadow = true;
        this.dioramaGroup.add(islandMesh);

        // Cozy Wooden Cabin
        const cabinGroup = new THREE.Group();
        cabinGroup.position.set(-1.5, 0, -1.2);
        
        // Cabin Base (Box)
        const cabinBaseGeo = new THREE.BoxGeometry(1.2, 1.0, 1.2);
        const cabinBaseMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true, roughness: 0.9 });
        const cabinBase = new THREE.Mesh(cabinBaseGeo, cabinBaseMat);
        cabinBase.position.y = 0.5;
        cabinBase.castShadow = true;
        cabinBase.receiveShadow = true;
        cabinGroup.add(cabinBase);

        // Sloped Roof (Cone-like or Prism)
        const roofGeo = new THREE.ConeGeometry(1.1, 0.7, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, flatShading: true }); // red roof
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 1.35;
        roof.rotation.y = Math.PI / 4; // align faces to cabin box
        roof.castShadow = true;
        cabinGroup.add(roof);

        // Glowing Windows
        const windowGeo = new THREE.PlaneGeometry(0.25, 0.25);
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // warm yellow glow
        const win1 = new THREE.Mesh(windowGeo, windowMat);
        win1.position.set(0, 0.5, 0.61); // front window
        const win2 = win1.clone();
        win2.position.set(0.61, 0.5, 0); // side window
        win2.rotation.y = Math.PI / 2;
        cabinGroup.add(win1);
        cabinGroup.add(win2);

        // Chimney with smoke generator hook
        const chimneyGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x475569, flatShading: true });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(-0.35, 1.2, -0.35);
        chimney.castShadow = true;
        cabinGroup.add(chimney);

        // Add a PointLight inside/near cabin to cast warm glow
        this.cabinLight = new THREE.PointLight(0xfef08a, 0.8, 4);
        this.cabinLight.position.set(0, 0.5, 0.8);
        cabinGroup.add(this.cabinLight);

        this.dioramaGroup.add(cabinGroup);

        // Windmill (Clean Energy!)
        const windmillGroup = new THREE.Group();
        windmillGroup.position.set(1.8, 0, 1.2);

        // Tower base
        const towerGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.2, 5);
        const towerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, flatShading: true, roughness: 0.8 });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 1.1;
        tower.castShadow = true;
        tower.receiveShadow = true;
        windmillGroup.add(tower);

        // Windmill Head
        const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x64748b, flatShading: true });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 2.2, 0.15);
        windmillGroup.add(head);

        // Blades
        this.windmillBlades = new THREE.Group();
        this.windmillBlades.position.set(0, 2.2, 0.4);
        
        const bladeGeo = new THREE.BoxGeometry(1.6, 0.15, 0.02);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: true });
        
        for (let i = 0; i < 4; i++) {
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            blade.rotation.z = (i * Math.PI) / 2;
            // Shift blade pivot center slightly
            blade.geometry.translate(0.8, 0, 0);
            blade.castShadow = true;
            this.windmillBlades.add(blade);
        }
        windmillGroup.add(this.windmillBlades);
        this.dioramaGroup.add(windmillGroup);

        // Low-Poly Deciduous Trees
        this.createTree(-1.2, 0, 1.5, 1.2);  // Large tree front-left
        this.createTree(-2.2, 0, 0.6, 0.9);  // Medium tree left-back
        this.createTree(1.8, 0, -1.8, 1.1);  // Medium tree right-back

        // A small glass pond
        const pondGeo = new THREE.CircleGeometry(1.1, 8);
        const pondMat = new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            roughness: 0.1,
            metalness: 0.9,
            flatShading: true
        });
        const pond = new THREE.Mesh(pondGeo, pondMat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(0.8, 0.01, -0.6);
        this.dioramaGroup.add(pond);
    }

    createTree(x, y, z, scale) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, y, z);
        treeGroup.scale.set(scale, scale, scale);

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.0, 5);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        // Leaves (Low poly cloud spheres)
        const leafMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8, // will dynamically change green/white/autumn based on weather
            flatShading: true,
            roughness: 0.9
        });
        
        // Cache leaf meshes to dynamically color them later
        treeGroup.userData = { isTree: true, leaves: [] };

        const leafConfig = [
            { size: 0.6, x: 0, y: 1.1, z: 0 },
            { size: 0.5, x: 0.25, y: 0.85, z: 0.15 },
            { size: 0.5, x: -0.2, y: 0.9, z: -0.2 },
            { size: 0.4, x: -0.15, y: 1.3, z: 0.15 }
        ];

        leafConfig.forEach(cfg => {
            const leafGeo = new THREE.IcosahedronGeometry(cfg.size, 1);
            const leaf = new THREE.Mesh(leafGeo, leafMat.clone());
            leaf.position.set(cfg.x, cfg.y, cfg.z);
            leaf.castShadow = true;
            treeGroup.add(leaf);
            treeGroup.userData.leaves.push(leaf);
        });

        this.dioramaGroup.add(treeGroup);
    }

    buildWeatherSystems() {
        // Rain particles
        const rainCount = 1500;
        const rainGeometry = new THREE.BufferGeometry();
        const rainPositions = new Float32Array(rainCount * 3);
        const rainVelocities = new Float32Array(rainCount);

        for (let i = 0; i < rainCount * 3; i += 3) {
            rainPositions[i] = (Math.random() - 0.5) * 12;      // X bounds
            rainPositions[i + 1] = Math.random() * 12 + 0.1;    // Y bounds (above ground)
            rainPositions[i + 2] = (Math.random() - 0.5) * 12;  // Z bounds
            rainVelocities[i / 3] = 0.15 + Math.random() * 0.1; // falling speed
        }

        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        
        // Custom texture/shader look for rain lines
        const rainMaterial = new THREE.PointsMaterial({
            color: 0x93c5fd,
            size: 0.08,
            transparent: true,
            opacity: 0.75,
            sizeAttenuation: true
        });

        this.rainParticles = new THREE.Points(rainGeometry, rainMaterial);
        this.dioramaGroup.add(this.rainParticles);

        // Snow particles
        const snowCount = 1000;
        const snowGeometry = new THREE.BufferGeometry();
        const snowPositions = new Float32Array(snowCount * 3);
        const snowVelocities = new Float32Array(snowCount * 3); // holds: Y speed, X drift phase, Z drift phase

        for (let i = 0; i < snowCount * 3; i += 3) {
            snowPositions[i] = (Math.random() - 0.5) * 10;   // X
            snowPositions[i + 1] = Math.random() * 10 + 0.1; // Y
            snowPositions[i + 2] = (Math.random() - 0.5) * 10; // Z
            
            snowVelocities[i] = 0.03 + Math.random() * 0.03;       // Y fall speed
            snowVelocities[i + 1] = Math.random() * Math.PI * 2;   // X drift angle phase
            snowVelocities[i + 2] = Math.random() * Math.PI * 2;   // Z drift angle phase
        }

        snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
        const snowMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.12,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true
        });

        this.snowParticles = new THREE.Points(snowGeometry, snowMaterial);
        this.dioramaGroup.add(this.snowParticles);

        // Clouds (Low-poly floating groups)
        const cloudCount = 4;
        const cloudColors = [0xffffff, 0xf1f5f9, 0xe2e8f0, 0xcbd5e1];
        
        for (let i = 0; i < cloudCount; i++) {
            const cloud = new THREE.Group();
            
            // Random horizontal pos, height between 4 and 6
            const angle = (i / cloudCount) * Math.PI * 2;
            const radius = 2 + Math.random() * 2;
            cloud.position.set(
                Math.cos(angle) * radius,
                4.5 + Math.random() * 1.5,
                Math.sin(angle) * radius
            );
            
            const cloudMat = new THREE.MeshStandardMaterial({
                color: cloudColors[i % cloudColors.length],
                flatShading: true,
                roughness: 0.9,
                metalness: 0.1
            });

            // Put a few overlapping spheres inside each cloud
            const numSpheres = 3 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numSpheres; j++) {
                const sphereGeo = new THREE.SphereGeometry(0.4 + Math.random() * 0.4, 5, 5);
                const sphere = new THREE.Mesh(sphereGeo, cloudMat);
                sphere.position.set(
                    (Math.random() - 0.5) * 0.9,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.9
                );
                sphere.castShadow = true;
                cloud.add(sphere);
            }
            
            // Store cloud speed/orbit data
            cloud.userData = {
                orbitSpeed: 0.003 + Math.random() * 0.004,
                orbitRadius: radius,
                orbitAngle: angle,
                yPos: cloud.position.y
            };
            
            this.dioramaGroup.add(cloud);
            this.clouds.push(cloud);
        }
    }

    setWeather(weather) {
        this.currentWeather = weather;
        
        let targetFogColor = 0x080b11;
        let targetFogDensity = 0.002;
        let targetSunColor = 0xfffaed;
        let targetSunIntensity = 1.2;
        let leafColor = 0x4f772d; // Green grass trees
        
        // Hide weather systems initially, selectively display
        this.rainParticles.visible = false;
        this.snowParticles.visible = false;

        // Customise lighting and particles per weather state
        switch (weather) {
            case 'sunny':
                targetSunColor = 0xfff6e0;
                targetSunIntensity = 1.5;
                targetFogColor = 0x0f172a;
                targetFogDensity = 0.002;
                leafColor = 0x22c55e; // vibrant green
                break;
                
            case 'cloudy':
                targetSunColor = 0xcbd5e1;
                targetSunIntensity = 0.6;
                targetFogColor = 0x1e293b;
                targetFogDensity = 0.008;
                leafColor = 0x567d46; // muted green
                break;
                
            case 'rainy':
                targetSunColor = 0x94a3b8;
                targetSunIntensity = 0.3;
                targetFogColor = 0x0f172a;
                targetFogDensity = 0.025;
                leafColor = 0x4d6a3c;
                this.rainParticles.visible = true;
                break;
                
            case 'stormy':
                targetSunColor = 0x475569;
                targetSunIntensity = 0.15;
                targetFogColor = 0x080b11;
                targetFogDensity = 0.035;
                leafColor = 0x3e5433;
                this.rainParticles.visible = true;
                break;
                
            case 'snowy':
                targetSunColor = 0xf8fafc;
                targetSunIntensity = 0.75;
                targetFogColor = 0x1e293b;
                targetFogDensity = 0.02;
                leafColor = 0xf1f5f9; // snowy white trees
                this.snowParticles.visible = true;
                break;
                
            case 'foggy':
                targetSunColor = 0x94a3b8;
                targetSunIntensity = 0.3;
                targetFogColor = 0x111827;
                targetFogDensity = 0.06; // highly dense fog
                leafColor = 0x3f5436;
                break;
        }

        // Animate color transitions smoothly using GSAP
        gsap.to(this.scene.fog, { density: targetFogDensity, duration: 1.5 });
        gsap.to(this.scene.background, {
            r: new THREE.Color(targetFogColor).r,
            g: new THREE.Color(targetFogColor).g,
            b: new THREE.Color(targetFogColor).b,
            duration: 1.5,
            onUpdate: () => {
                this.scene.fog.color.copy(this.scene.background);
            }
        });
        
        gsap.to(this.sunLight, { intensity: targetSunIntensity, duration: 1.5 });
        gsap.to(this.sunLight.color, {
            r: new THREE.Color(targetSunColor).r,
            g: new THREE.Color(targetSunColor).g,
            b: new THREE.Color(targetSunColor).b,
            duration: 1.5
        });

        // Color clouds
        this.clouds.forEach(cloud => {
            cloud.children.forEach(mesh => {
                let cloudTargetColor = 0xffffff;
                if (weather === 'rainy' || weather === 'stormy') {
                    cloudTargetColor = 0x475569;
                } else if (weather === 'cloudy' || weather === 'foggy') {
                    cloudTargetColor = 0x94a3b8;
                }
                gsap.to(mesh.material.color, {
                    r: new THREE.Color(cloudTargetColor).r,
                    g: new THREE.Color(cloudTargetColor).g,
                    b: new THREE.Color(cloudTargetColor).b,
                    duration: 1.5
                });
            });
        });

        // Color trees leaves based on season/weather
        this.dioramaGroup.traverse(child => {
            if (child.userData && child.userData.isTree) {
                child.userData.leaves.forEach(leaf => {
                    gsap.to(leaf.material.color, {
                        r: new THREE.Color(leafColor).r,
                        g: new THREE.Color(leafColor).g,
                        b: new THREE.Color(leafColor).b,
                        duration: 1.5
                    });
                });
            }
        });

        // Window lighting logic
        if (weather === 'stormy' || weather === 'rainy' || weather === 'foggy') {
            gsap.to(this.cabinLight, { intensity: 1.5, duration: 1.0 }); // glow bright
        } else {
            gsap.to(this.cabinLight, { intensity: 0.6, duration: 1.0 });
        }
    }

    setView(view, animate = true) {
        this.currentView = view;
        const duration = animate ? 1.5 : 0;
        const ease = "power2.inOut";

        if (view === 'globe') {
            this.autoRotateGlobe = true;
            this.globeGroup.visible = true;
            
            // Scale and move diorama away
            gsap.to(this.dioramaGroup.scale, { x: 0.001, y: 0.001, z: 0.001, duration: duration, ease: ease, onComplete: () => {
                if (this.currentView === 'globe') this.dioramaGroup.visible = false;
            }});
            
            // Bring back globe scale
            gsap.to(this.globeGroup.scale, { x: 1, y: 1, z: 1, duration: duration, ease: ease });

            // Animate camera target and pos
            gsap.to(this.camera.position, { x: 0, y: 3, z: 12, duration: duration, ease: ease });
            gsap.to(this.controls.target, { x: 0, y: 0, z: 0, duration: duration, ease: ease });
            
        } else if (view === 'diorama') {
            this.autoRotateGlobe = false;
            this.dioramaGroup.visible = true;

            // Scale down globe
            gsap.to(this.globeGroup.scale, { x: 0.001, y: 0.001, z: 0.001, duration: duration, ease: ease, onComplete: () => {
                if (this.currentView === 'diorama') this.globeGroup.visible = false;
            }});

            // Scale up diorama
            this.dioramaGroup.scale.set(0.001, 0.001, 0.001);
            gsap.to(this.dioramaGroup.scale, { x: 1, y: 1, z: 1, duration: duration, ease: ease });

            // Animate camera to look cozy at diorama
            gsap.to(this.camera.position, { x: 5, y: 6, z: 8, duration: duration, ease: ease });
            gsap.to(this.controls.target, { x: 0, y: 0.8, z: 0, duration: duration, ease: ease });
        }
    }

    addPinAtCoordinates(lat, lon, cityName) {
        // Remove existing pin first
        this.removePin();

        const R = 3.5;
        // Standard conversions
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (180 - lon) * (Math.PI / 180);

        const x = R * Math.sin(phi) * Math.cos(theta);
        const y = R * Math.cos(phi);
        const z = R * Math.sin(phi) * Math.sin(theta);

        // Pin Container (so it aligns outwards relative to globe center)
        const pinContainer = new THREE.Group();
        pinContainer.position.set(x, y, z);
        
        // Orient pin pointing outwards from center
        const pinDirection = new THREE.Vector3(x, y, z).normalize();
        const upVector = new THREE.Vector3(0, 1, 0);
        pinContainer.quaternion.setFromUnitVectors(upVector, pinDirection);

        // Glowing Beacon cone/cylinder pointing down
        const beaconGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
        // Translate base pivot to sit exactly on the surface of earth
        beaconGeo.translate(0, 0.25, 0);
        const beaconMat = new THREE.MeshBasicMaterial({ 
            color: 0x3b82f6, 
            transparent: true, 
            opacity: 0.8 
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        // Point downwards towards earth surface
        beacon.rotation.x = Math.PI;
        pinContainer.add(beacon);

        // Inner glowing beacon tip sphere
        const tipGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(0, 0.5, 0); // floats slightly above pin
        pinContainer.add(tip);

        // Expanding pulse rings (torus / thin disc)
        const ringGeo = new THREE.RingGeometry(0.02, 0.25, 16);
        ringGeo.rotateX(-Math.PI / 2); // lie flat on sphere surface
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x3b82f6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        pinContainer.add(ring);

        this.globeGroup.add(pinContainer);
        this.activePin = {
            container: pinContainer,
            ring: ring,
            ringScale: 1.0
        };

        // If in Globe view, rotate the globe group smoothly so that the pin faces the camera
        if (this.currentView === 'globe') {
            this.focusCameraOnPin(x, y, z);
        }
    }

    removePin() {
        if (this.activePin) {
            this.globeGroup.remove(this.activePin.container);
            this.activePin = null;
        }
    }

    focusCameraOnPin(x, y, z) {
        // Temporarily halt auto-rotation to let user look at pin
        this.autoRotateGlobe = false;
        
        // Find position vector for the camera (same ray from globe center, but further out)
        const pinPos = new THREE.Vector3(x, y, z);
        const targetCamPos = pinPos.clone().normalize().multiplyScalar(12);

        gsap.to(this.camera.position, {
            x: targetCamPos.x,
            y: targetCamPos.y,
            z: targetCamPos.z,
            duration: 2.0,
            ease: "power2.out",
            onComplete: () => {
                // Resume subtle auto-rotate after a small delay
                setTimeout(() => {
                    if (this.currentView === 'globe') this.autoRotateGlobe = true;
                }, 4000);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.001;

        // 1. Globe Rotations
        if (this.globeGroup.visible) {
            if (this.autoRotateGlobe) {
                this.globeGroup.children[0].rotation.y += 0.0012; // Earth spins
                if (this.cloudsMesh) this.cloudsMesh.rotation.y += 0.0018; // clouds drift faster
            }
            
            // Animate Pin beacon pulse ring
            if (this.activePin) {
                this.activePin.ringScale += 0.018;
                if (this.activePin.ringScale > 2.2) {
                    this.activePin.ringScale = 0.1;
                }
                const scale = this.activePin.ringScale;
                this.activePin.ring.scale.set(scale, 1, scale);
                this.activePin.ring.material.opacity = 1.0 - (scale / 2.2);
            }
        }

        // 2. Diorama Rotations and Weather Particles
        if (this.dioramaGroup.visible) {
            // Windmill rotation based on weather intensity
            let rotationSpeed = 0.015;
            if (this.currentWeather === 'stormy') rotationSpeed = 0.09;
            else if (this.currentWeather === 'rainy') rotationSpeed = 0.035;
            else if (this.currentWeather === 'sunny') rotationSpeed = 0.012;
            else if (this.currentWeather === 'cloudy') rotationSpeed = 0.02;
            
            if (this.windmillBlades) {
                this.windmillBlades.rotation.z += rotationSpeed;
            }

            // Cloud orbits
            this.clouds.forEach(cloud => {
                cloud.userData.orbitAngle += cloud.userData.orbitSpeed;
                cloud.position.x = Math.cos(cloud.userData.orbitAngle) * cloud.userData.orbitRadius;
                cloud.position.z = Math.sin(cloud.userData.orbitAngle) * cloud.userData.orbitRadius;
                // Add soft bobbing
                cloud.position.y = cloud.userData.yPos + Math.sin(time * 2 + cloud.userData.orbitRadius) * 0.12;
            });

            // Falling Rain particles
            if (this.rainParticles && this.rainParticles.visible) {
                const posArr = this.rainParticles.geometry.attributes.position.array;
                const vArr = this.rainParticles.geometry.attributes.position.count;
                
                // Wind vector based on storminess
                const windX = this.currentWeather === 'stormy' ? -0.04 : -0.015;
                
                for (let i = 0; i < vArr; i++) {
                    const idx = i * 3;
                    posArr[idx + 1] -= 0.15; // Y fall
                    posArr[idx] += windX;    // wind drift X
                    
                    // Reset if falls below ground plane
                    if (posArr[idx + 1] < 0) {
                        posArr[idx + 1] = 10 + Math.random() * 2;
                        posArr[idx] = (Math.random() - 0.5) * 10;
                        posArr[idx + 2] = (Math.random() - 0.5) * 10;
                    }
                }
                this.rainParticles.geometry.attributes.position.needsUpdate = true;
            }

            // Floating Snow particles
            if (this.snowParticles && this.snowParticles.visible) {
                const posArr = this.snowParticles.geometry.attributes.position.array;
                const vCount = this.snowParticles.geometry.attributes.position.count;
                const posAttribute = this.snowParticles.geometry.attributes.position;
                
                for (let i = 0; i < vCount; i++) {
                    const idx = i * 3;
                    
                    // Fall speed
                    posArr[idx + 1] -= 0.025;
                    
                    // Drift in X & Z utilizing sine waves
                    posArr[idx] += Math.sin(time + i) * 0.005;
                    posArr[idx + 2] += Math.cos(time * 0.5 + i) * 0.005;
                    
                    if (posArr[idx + 1] < 0) {
                        posArr[idx + 1] = 8 + Math.random() * 2;
                        posArr[idx] = (Math.random() - 0.5) * 8;
                        posArr[idx + 2] = (Math.random() - 0.5) * 8;
                    }
                }
                posAttribute.needsUpdate = true;
            }

            // 3. Lightning generator for Storms
            if (this.currentWeather === 'stormy' && Math.random() < 0.01 && !this.lightningFlashActive) {
                this.triggerLightningFlash();
            }
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    triggerLightningFlash() {
        this.lightningFlashActive = true;
        const initialFogColor = this.scene.fog.color.getHex();
        const flashColor = 0xe2e8f0; // bright purple/white lightning light

        // Chain flicker timeline
        const tl = gsap.timeline({
            onComplete: () => {
                this.lightningFlashActive = false;
                // Make sure we end back at dark base
                this.scene.fog.color.setHex(initialFogColor);
                this.renderer.setClearColor(initialFogColor);
                this.sunLight.intensity = 0.15;
            }
        });

        // Flash 1
        tl.to(this.scene.fog.color, { r: 0.9, g: 0.95, b: 1, duration: 0.05 })
          .to(this.sunLight, { intensity: 4.5, duration: 0.05 }, "<")
          .to(this.scene.fog.color, { r: 0.03, g: 0.04, b: 0.07, duration: 0.1 })
          .to(this.sunLight, { intensity: 0.15, duration: 0.1 }, "<")
          // Flicker gap
          .delay(0.08)
          // Flash 2
          .to(this.scene.fog.color, { r: 0.8, g: 0.85, b: 1, duration: 0.04 })
          .to(this.sunLight, { intensity: 3.5, duration: 0.04 }, "<")
          .to(this.scene.fog.color, { r: 0.03, g: 0.04, b: 0.07, duration: 0.25 })
          .to(this.sunLight, { intensity: 0.15, duration: 0.25 }, "<");
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
}
