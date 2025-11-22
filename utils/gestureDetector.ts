import { HandLandmark } from '../types';

// Helper to check if a finger is extended
// We compare the fingertip to the knuckle (MCP). 
// If the tip is significantly higher (smaller y) than the knuckle, it's up.
const isFingerExtended = (landmarks: any[], tipIdx: number, pipIdx: number, mcpIdx: number) => {
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  const mcp = landmarks[mcpIdx];
  
  // Distance check for extension
  const tipToWrist = Math.sqrt(Math.pow(tip.x - landmarks[0].x, 2) + Math.pow(tip.y - landmarks[0].y, 2));
  const pipToWrist = Math.sqrt(Math.pow(pip.x - landmarks[0].x, 2) + Math.pow(pip.y - landmarks[0].y, 2));
  
  return tipToWrist > pipToWrist * 1.1; // Tip must be further from wrist than PIP
};

const isFingerCurled = (landmarks: any[], tipIdx: number, pipIdx: number, mcpIdx: number) => {
    return !isFingerExtended(landmarks, tipIdx, pipIdx, mcpIdx);
};

export const detectGesture = (landmarks: any[]): string | null => {
  if (!landmarks || landmarks.length === 0) return null;

  // Indices
  // Thumb: 1-4, Index: 5-8, Middle: 9-12, Ring: 13-16, Pinky: 17-20
  
  const indexExtended = isFingerExtended(landmarks, 8, 6, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 10, 9);
  const ringExtended = isFingerExtended(landmarks, 16, 14, 13);
  const pinkyExtended = isFingerExtended(landmarks, 20, 18, 17);
  // Thumb is trickier, usually check angle. For shadows, checking x/y relative to index mcp helps.
  
  // 1. RABBIT: Index + Middle UP, Ring + Pinky DOWN
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return 'rabbit';
  }

  // 2. DEER/STAG: All fingers spread/up (Thumb usually up too)
  if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return 'deer';
  }

  // 3. WOLF: Thumb up/forward, Index up/hooked, others curled/fist
  // Simplified check: Index Extended, Middle/Ring/Pinky Curled.
  // (Often Wolf uses thumb+index as mouth, others as ears, but let's stick to a simple one-hand wolf shape)
  if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
      // "Rock on" sign creates a wolf/dog head shadow
      return 'wolf';
  }
  
  // 4. DUCK/SNAKE: Hand creates a "C" shape (beak). 
  // Fingers are grouped together. 
  // This is hard to detect purely by extension, we check proximity of tips.
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const dist = Math.sqrt(Math.pow(indexTip.x - thumbTip.x, 2) + Math.pow(indexTip.y - thumbTip.y, 2));
  
  if (dist < 0.1 && !middleExtended && !ringExtended && !pinkyExtended) {
     // Tips touching, others curled (basic beak)
     return 'duck';
  }

  return null;
};
