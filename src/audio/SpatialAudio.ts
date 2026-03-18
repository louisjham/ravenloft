import * as THREE from 'three';

/**
 * Helper to create 3D spatial audio sources in the Three.js scene.
 */
export class SpatialAudio {
  private listener: THREE.AudioListener;

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
  }

  /**
   * Creates a positional audio source that can be attached to a 3D object.
   */
  public createPositionalSource(url: string, refDistance: number = 5, maxDistance: number = 20): THREE.PositionalAudio {
    const sound = new THREE.PositionalAudio(this.listener);
    const audioLoader = new THREE.AudioLoader();
    
    audioLoader.load(url, (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(refDistance);
      sound.setMaxDistance(maxDistance);
    });

    return sound;
  }

  public getListener(): THREE.AudioListener {
    return this.listener;
  }
}
