/**
 * DeviceCapabilityManager
 * Detects device capabilities to optimize game performance for mobile devices
 * 
 * LOW END MOBILE OPTIMIZATION: This manager detects device capabilities (GPU tier, 
 * CPU cores, memory) to automatically configure game settings for optimal performance
 * on low-end mobile devices. Used in main.ts to set FPS, power preference, and antialiasing.
 */

export interface DeviceCapabilities {
    isMobile: boolean;
    isLowEndDevice: boolean;
    gpuTier: 'high' | 'medium' | 'low';
    hasHighDPI: boolean;
    recommendedQuality: 'high' | 'low';
    recommendedFPS: number;
    shouldUseLowPowerMode: boolean;
}

export class DeviceCapabilityManager {
    private capabilities: DeviceCapabilities;

    constructor() {
        this.capabilities = this.detectCapabilities();
        console.log('[DeviceCapabilityManager] Device capabilities:', this.capabilities);
    }

    private detectCapabilities(): DeviceCapabilities {
        const isMobile = this.detectMobile();
        const gpuTier = this.detectGPUTier();
        const hasHighDPI = this.detectHighDPI();
        const isLowEndDevice = this.detectLowEndDevice(isMobile, gpuTier);
        
        // Determine recommended quality based on device capabilities
        const recommendedQuality = (isLowEndDevice || gpuTier === 'low') ? 'low' : 'high';
        
        // Determine recommended FPS (lower for low-end devices to save battery)
        const recommendedFPS = isLowEndDevice ? 30 : 60;
        
        // Use low power mode on mobile devices, especially low-end ones
        const shouldUseLowPowerMode = isMobile && (isLowEndDevice || gpuTier === 'low');

        return {
            isMobile,
            isLowEndDevice,
            gpuTier,
            hasHighDPI,
            recommendedQuality,
            recommendedFPS,
            shouldUseLowPowerMode
        };
    }

    private detectMobile(): boolean {
        try {
            const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera;
            const isMobileUA = /android|iphone|ipad|ipod|iemobile|blackberry|mobile/i.test(ua);
            
            // Also check for touch support
            const hasTouch = 'ontouchstart' in window || (navigator as any).maxTouchPoints > 0;
            
            // Check screen size (mobile typically < 768px width)
            const isSmallScreen = window.innerWidth < 768;
            
            return isMobileUA || (hasTouch && isSmallScreen);
        } catch (_e) {
            return false;
        }
    }

    private detectGPUTier(): 'high' | 'medium' | 'low' {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2') || 
                      canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
            
            if (!gl) {
                return 'low';
            }

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) {
                // If we can't detect GPU, assume medium for safety
                return 'medium';
            }

            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            
            const rendererLower = renderer.toLowerCase();
            const vendorLower = vendor.toLowerCase();

            // High-end GPUs
            if (rendererLower.includes('adreno 6') || 
                rendererLower.includes('adreno 7') ||
                rendererLower.includes('apple gpu') ||
                rendererLower.includes('mali-g') ||
                rendererLower.includes('mali-t8') ||
                rendererLower.includes('powervr') ||
                rendererLower.includes('nvidia') ||
                rendererLower.includes('radeon') ||
                rendererLower.includes('geforce')) {
                return 'high';
            }

            // Low-end GPUs
            if (rendererLower.includes('adreno 2') ||
                rendererLower.includes('adreno 3') ||
                rendererLower.includes('adreno 4') ||
                rendererLower.includes('mali-4') ||
                rendererLower.includes('mali-t6') ||
                rendererLower.includes('mali-t7') ||
                rendererLower.includes('videoCore') ||
                rendererLower.includes('sgx')) {
                return 'low';
            }

            // Default to medium for unknown GPUs
            return 'medium';
        } catch (_e) {
            return 'medium';
        }
    }

    private detectHighDPI(): boolean {
        try {
            return window.devicePixelRatio > 1.5;
        } catch (_e) {
            return false;
        }
    }

    private detectLowEndDevice(isMobile: boolean, gpuTier: 'high' | 'medium' | 'low'): boolean {
        if (!isMobile) {
            return false; // Assume desktop is not low-end
        }

        // Check hardware concurrency (CPU cores)
        const cores = navigator.hardwareConcurrency || 2;
        if (cores < 4) {
            return true;
        }

        // Check device memory (if available)
        const deviceMemory = (navigator as any).deviceMemory;
        if (deviceMemory && deviceMemory < 3) {
            return true;
        }

        // Low GPU tier indicates low-end device
        if (gpuTier === 'low') {
            return true;
        }

        // Check for older devices based on user agent
        try {
            const ua = navigator.userAgent.toLowerCase();
            // Older Android devices
            if (ua.includes('android 4') || ua.includes('android 5') || ua.includes('android 6')) {
                return true;
            }
            // Older iOS devices (iPhone 6 and below)
            if (ua.includes('iphone os 9') || ua.includes('iphone os 10') || ua.includes('iphone os 11')) {
                return true;
            }
        } catch (_e) {
            // Ignore errors
        }

        return false;
    }

    public getCapabilities(): DeviceCapabilities {
        return { ...this.capabilities };
    }

    public isMobile(): boolean {
        return this.capabilities.isMobile;
    }

    public isLowEndDevice(): boolean {
        return this.capabilities.isLowEndDevice;
    }

    public getGPUTier(): 'high' | 'medium' | 'low' {
        return this.capabilities.gpuTier;
    }

    public getRecommendedQuality(): 'high' | 'low' {
        return this.capabilities.recommendedQuality;
    }

    public getRecommendedFPS(): number {
        return this.capabilities.recommendedFPS;
    }

    public shouldUseLowPowerMode(): boolean {
        return this.capabilities.shouldUseLowPowerMode;
    }
}

