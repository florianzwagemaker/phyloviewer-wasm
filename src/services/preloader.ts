/**
 * Preloader service for initializing all external dependencies during app startup.
 * This eliminates loading delays when users interact with the application.
 */

import { BiowasmService } from './biowasm';

class PreloaderService {
  private biowasmInstance: BiowasmService | null = null;
  private biowasmInitialized = false;
  private phylocanvasLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Preloads all external dependencies.
   * Should be called during app initialization.
   */
  async preloadAll(): Promise<void> {
    // Return existing promise if already loading
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.executePreload();
    return this.loadingPromise;
  }

  private async executePreload(): Promise<void> {
    console.log('🚀 Starting preload of all external dependencies...');
    const startTime = performance.now();

    try {
      // Preload in parallel for faster initialization
      // Use Promise.allSettled to continue even if some fail
      const results = await Promise.allSettled([
        this.preloadBiowasm(),
        this.preloadPhylocanvasGL()
      ]);

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      // Check results
      const biowasmResult = results[0];
      const phylocanvasResult = results[1];
      
      const biowasmSuccess = biowasmResult.status === 'fulfilled';
      const phylocanvasSuccess = phylocanvasResult.status === 'fulfilled';
      
      if (biowasmSuccess && phylocanvasSuccess) {
        console.log(`✅ All dependencies preloaded successfully in ${duration}ms`);
      } else if (biowasmSuccess || phylocanvasSuccess) {
        console.log(`⚠️ Partial preload completed in ${duration}ms`);
        if (!biowasmSuccess) {
          console.warn('❌ Biowasm preload failed - will attempt on-demand loading');
        }
        if (!phylocanvasSuccess) {
          console.warn('❌ PhylocanvasGL preload failed - will attempt on-demand loading');
        }
      } else {
        console.error('❌ All preloads failed - app will use on-demand loading');
      }
    } catch (error) {
      console.error('❌ Error during preload:', error);
      // Don't throw - allow app to continue with on-demand loading
    }
  }

  /**
   * Preloads Biowasm/Aioli with FastTree.
   */
  private async preloadBiowasm(): Promise<void> {
    if (this.biowasmInstance && this.biowasmInitialized) {
      console.log('✓ Biowasm already loaded');
      return;
    }

    try {
      console.log('📦 Preloading Biowasm with FastTree...');
      this.biowasmInstance = new BiowasmService(['fasttree/2.1.11']);
      await this.biowasmInstance.init();
      this.biowasmInitialized = true;
      console.log('✓ Biowasm preloaded and initialized');
    } catch (error) {
      console.error('❌ Failed to preload Biowasm:', error);
      // Don't throw - allow the app to continue and try on-demand loading later
      this.biowasmInstance = null;
      this.biowasmInitialized = false;
    }
  }  /**
   * Preloads the PhylocanvasGL library from CDN.
   */
  private async preloadPhylocanvasGL(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
        this.phylocanvasLoaded = true;
        console.log('✓ PhylocanvasGL already loaded');
        resolve();
        return;
      }

      // Check if script tag already exists
      if (document.querySelector('script[src*="phylocanvas"]')) {
        console.log('📦 PhylocanvasGL script tag found, waiting for load...');
        const checkInterval = setInterval(() => {
          if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
            this.phylocanvasLoaded = true;
            clearInterval(checkInterval);
            console.log('✓ PhylocanvasGL preloaded');
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('PhylocanvasGL loading timeout'));
        }, 10000);
        return;
      }

      console.log('📦 Preloading PhylocanvasGL from CDN...');

      // Create and load script tag
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@phylocanvas/phylocanvas.gl@1.59.0/dist/bundle.min.js';
      script.onload = () => {
        setTimeout(() => {
          if ((window as any).phylocanvas && (window as any).phylocanvas.PhylocanvasGL) {
            this.phylocanvasLoaded = true;
            console.log('✓ PhylocanvasGL preloaded');
            resolve();
          } else {
            reject(new Error('PhylocanvasGL not available after load'));
          }
        }, 500);
      };
      script.onerror = () => reject(new Error('Failed to load PhylocanvasGL script'));
      document.head.appendChild(script);
    });
  }

  /**
   * Gets the preloaded Biowasm instance.
   * If not preloaded, initializes it on-demand.
   * @throws Error if initialization fails
   */
  async getBiowasmInstance(): Promise<BiowasmService> {
    // If preloading is in progress, wait for it to complete first
    if (this.loadingPromise) {
      console.log('⏳ Waiting for preload to complete...');
      await this.loadingPromise;
    }

    // Check if we have an initialized instance after preload
    if (this.biowasmInstance && this.biowasmInitialized) {
      return this.biowasmInstance;
    }

    // Preload failed or wasn't called - initialize on-demand
    console.warn('⚠️ Biowasm not preloaded, initializing on-demand...');
    
    try {
      const service = new BiowasmService(['fasttree/2.1.11']);
      await service.init();
      this.biowasmInstance = service;
      this.biowasmInitialized = true;
      console.log('✓ Biowasm initialized on-demand');
      return this.biowasmInstance;
    } catch (error) {
      console.error('❌ Failed to initialize Biowasm:', error);
      throw new Error(
        'Failed to initialize FastTree. Please check your internet connection and try again.'
      );
    }
  }

  /**
   * Checks if PhylocanvasGL is loaded.
   */
  isPhylocanvasLoaded(): boolean {
    return this.phylocanvasLoaded;
  }

  /**
   * Gets loading status for UI feedback.
   */
  getLoadingStatus(): {
    biowasm: boolean;
    phylocanvas: boolean;
    all: boolean;
  } {
    return {
      biowasm: this.biowasmInstance !== null && this.biowasmInitialized,
      phylocanvas: this.phylocanvasLoaded,
      all: this.biowasmInstance !== null && this.biowasmInitialized && this.phylocanvasLoaded
    };
  }
}

// Export singleton instance
export const preloader = new PreloaderService();
