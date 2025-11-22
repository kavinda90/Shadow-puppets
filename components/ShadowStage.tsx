import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GeminiLiveService } from '../services/geminiLive';
import { AppState } from '../types';
import { Loader2, Play, Square } from 'lucide-react';

// Anatomy connections to create a "solid" hand for shadow casting
const BONE_CONNECTIONS = [
  // Thumb
  { start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 4 },
  // Index
  { start: 0, end: 5 }, { start: 5, end: 6 }, { start: 6, end: 7 }, { start: 7, end: 8 },
  // Middle
  { start: 0, end: 9 }, { start: 9, end: 10 }, { start: 10, end: 11 }, { start: 11, end: 12 },
  // Ring
  { start: 0, end: 13 }, { start: 13, end: 14 }, { start: 14, end: 15 }, { start: 15, end: 16 },
  // Pinky
  { start: 0, end: 17 }, { start: 17, end: 18 }, { start: 18, end: 19 }, { start: 19, end: 20 },
  // Webbing / Palm Fillers (Crucial for solid shadows)
  { start: 1, end: 5 },   
  { start: 5, end: 9 },   
  { start: 9, end: 13 },
  { start: 13, end: 17 },
  { start: 2, end: 5 },
  { start: 5, end: 6 }, // Extra palm density
  { start: 9, end: 10 },
  { start: 13, end: 14 },
  { start: 17, end: 18 },
  { start: 0, end: 17 } // Wrist to pinky base
];

// Radius logic - slightly thicker to ensure seamless 2D silhouette
const getLandmarkRadius = (index: number): number => {
    if ([4, 8, 12, 16, 20].includes(index)) return 0.8; // Tips
    if ([3, 7, 11, 15, 19].includes(index)) return 0.9; // DIP
    if ([2, 6, 10, 14, 18].includes(index)) return 1.1; // PIP
    return 1.3; // Knuckles/Base
};

interface ShadowStageProps {
  onStateChange: (state: AppState) => void;
}

const ShadowStage: React.FC<ShadowStageProps> = ({ onStateChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);
  
  const handMeshesRef = useRef<THREE.Group>(new THREE.Group());

  // Materials are created once
  const handMaterialRef = useRef<THREE.MeshBasicMaterial>(new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 0 // INVISIBLE TO CAMERA
  }));

  // This material is used by the light to "see" the object for shadows, even if opacity is 0
  const customDepthMaterialRef = useRef<THREE.MeshDepthMaterial>(new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking
  }));


  useEffect(() => {
    onStateChange(appState);
  }, [appState, onStateChange]);

  useEffect(() => {
    const init = async () => {
      setAppState(AppState.LOADING_MODEL);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, facingMode: "user" } 
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        initThreeJS();
        setAppState(AppState.READY);
      } catch (error) {
        console.error("Init failed:", error);
        setAppState(AppState.ERROR);
      }
    };

    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (geminiServiceRef.current) geminiServiceRef.current.disconnect();
      if (videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initThreeJS = () => {
    if (!canvasRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    // Light Greyish background as requested (0xe0e0e0)
    scene.background = new THREE.Color(0xe0e0e0); 
    sceneRef.current = scene;

    // Camera - viewing the wall directly
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    camera.position.set(0, 0, 60); 
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
        canvas: canvasRef.current, 
        antialias: true
    });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    // Use PCFShadowMap for sharper, harder edges than SoftShadowMap
    renderer.shadowMap.type = THREE.PCFShadowMap; 
    rendererRef.current = renderer;

    // --- The Setup ---
    
    // 1. The Wall (Receiver)
    // Slightly off-white to look natural against the grey background
    const wallGeometry = new THREE.PlaneGeometry(240, 135); // 16:9 Aspect
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, // Keep white for maximum shadow contrast
        shininess: 0, // Matte
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.z = -20;
    wall.receiveShadow = true;
    scene.add(wall);

    // 2. The Light (Source)
    // PointLight creates crisp shadows
    const light = new THREE.PointLight(0xffaa77, 130, 200);
    light.position.set(0, 15, 40);
    light.castShadow = true;
    
    // High res shadow map
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.bias = -0.0005;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 150;
    
    scene.add(light);

    // Very dim ambient light to ensure shadows are deep black, not grey
    const ambientLight = new THREE.AmbientLight(0x101010); 
    scene.add(ambientLight);

    // 3. Hand Group
    scene.add(handMeshesRef.current);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const animate = () => {
      renderFrame();
      requestRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const renderFrame = () => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current || !handLandmarkerRef.current || !videoRef.current) return;

    const now = performance.now();
    
    if (videoRef.current.videoWidth > 0) {
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, now);
        updateHandMeshes(results.landmarks);
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  const updateHandMeshes = (landmarksArray: any[]) => {
    handMeshesRef.current.clear();

    const WORLD_WIDTH = 40;
    const WORLD_HEIGHT = 25;
    const Z_OFFSET = 10; 
    
    landmarksArray.forEach((landmarks) => {
        // Map Landmarks
        const points = landmarks.map((l: any) => {
            const x = (0.5 - l.x) * WORLD_WIDTH * -1; 
            const y = (0.5 - l.y) * WORLD_HEIGHT;
            const z = Z_OFFSET - (l.z * 10); 
            return new THREE.Vector3(x, y, z);
        });

        // Helper to create shadow-casting invisible meshes
        const createShadowMesh = (geometry: THREE.BufferGeometry, position: THREE.Vector3, quaternion?: THREE.Quaternion) => {
             const m = new THREE.Mesh(geometry, handMaterialRef.current);
             m.customDepthMaterial = customDepthMaterialRef.current; // Critical for shadow map
             m.castShadow = true;
             m.position.copy(position);
             if (quaternion) m.quaternion.copy(quaternion);
             return m;
        };

        // Joints
        points.forEach((p: THREE.Vector3, index: number) => {
            const radius = getLandmarkRadius(index);
            const g = new THREE.SphereGeometry(radius, 12, 12);
            handMeshesRef.current.add(createShadowMesh(g, p));
        });

        // Bones
        BONE_CONNECTIONS.forEach(({ start: startIdx, end: endIdx }) => {
            const start = points[startIdx];
            const end = points[endIdx];
            
            const radiusTop = getLandmarkRadius(endIdx);
            const radiusBottom = getLandmarkRadius(startIdx);
            const distance = start.distanceTo(end);
            
            const cylinderGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, distance + 0.2, 12);
            
            // Calculate orientation
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const m = new THREE.Mesh(cylinderGeo, handMaterialRef.current); // Temp mesh to get rotation
            m.position.copy(mid);
            m.lookAt(end);
            m.rotateX(Math.PI / 2);
            
            handMeshesRef.current.add(createShadowMesh(cylinderGeo, mid, m.quaternion));
        });
    });
  };

  const startExperience = async () => {
    if (appState === AppState.READY) {
      try {
        geminiServiceRef.current = new GeminiLiveService();
        await geminiServiceRef.current.connect(
          (text) => console.log("Narrator:", text),
          (err) => {
             console.error("Gemini error", err);
             setAppState(AppState.ERROR);
          }
        );
        
        const sendFrame = async () => {
          if (canvasRef.current) {
            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
            geminiServiceRef.current?.sendVideoFrame(base64);
          }
        };
        
        // Send the first frame IMMEDIATELY to trigger the narrator
        await sendFrame();

        frameIntervalRef.current = window.setInterval(sendFrame, 1500);
        setAppState(AppState.RUNNING);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const stopExperience = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    geminiServiceRef.current?.disconnect();
    setAppState(AppState.READY);
  };

  return (
    <div className="relative w-full h-screen bg-[#1a1a1a]">
      {/* The 3D Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Loading Overlay */}
      {appState === AppState.LOADING_MODEL && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 text-white flex-col gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
          <p className="text-xl font-cinzel">Igniting the lamp...</p>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 z-40 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-full border border-white/10 flex items-center gap-4 pointer-events-auto shadow-2xl">
            
          {appState === AppState.READY && (
             <button 
               onClick={startExperience}
               className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-bold transition-all transform hover:scale-105"
             >
               <Play className="w-5 h-5" /> Start Show
             </button>
          )}

          {appState === AppState.RUNNING && (
            <>
              <button 
                onClick={stopExperience}
                className="flex items-center gap-2 px-6 py-3 bg-red-900/80 hover:bg-red-800 text-white rounded-full font-bold transition-all"
              >
                <Square className="w-5 h-5" /> End Show
              </button>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="flex items-center gap-3 px-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-white/80 text-sm font-medium">AI Narrator Listening</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Header / Branding */}
      <div className="absolute top-6 left-6 z-40 pointer-events-none">
          <h1 className="text-4xl font-cinzel text-gray-900 drop-shadow-sm">Lumina Theater</h1>
          <p className="text-gray-700 text-sm font-lato tracking-widest mt-1 uppercase">Shadow Puppetry</p>
      </div>

      {/* Error State */}
      {appState === AppState.ERROR && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 text-red-400">
              <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Lamp Malfunction</h2>
                  <p>Please check your camera connection and refresh.</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default ShadowStage;