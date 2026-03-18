type AnimationCallback = () => Promise<void>;

interface AnimationTask {
  id: string;
  name: string;
  run: AnimationCallback;
  priority: number;
}

class AnimationQueue {
  private queue: AnimationTask[] = [];
  private isProcessing: boolean = false;
  private onQueueEmpty: (() => void) | null = null;

  async enqueue(name: string, run: AnimationCallback, priority: number = 0) {
    const id = Math.random().toString(36).substr(2, 9);
    this.queue.push({ id, name, run, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      await this.processNext();
    }
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      if (this.onQueueEmpty) this.onQueueEmpty();
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();

    if (task) {
      try {
        console.log(`[AnimationQueue] Running: ${task.name}`);
        await task.run();
      } catch (error) {
        console.error(`[AnimationQueue] Error in ${task.name}:`, error);
      }
    }

    await this.processNext();
  }

  clear() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }

  setQueueEmptyCallback(callback: () => void) {
    this.onQueueEmpty = callback;
  }
}

export const animationQueue = new AnimationQueue();
