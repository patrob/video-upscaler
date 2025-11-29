/**
 * Temporal Smoother
 *
 * Provides frame blending and temporal smoothing functionality
 * for video enhancement.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';

export class TemporalSmoother {
  constructor(options = {}) {
    this.defaultBlendFactor = options.blendFactor || 0.3;
  }

  /**
   * Blend two frames together
   *
   * @param {string} currentPath - Path to current frame
   * @param {string} prevPath - Path to previous frame
   * @param {string} outputPath - Path for output
   * @param {number} blendFactor - Blend weight for previous frame (0-1)
   * @returns {Promise<string>} - Output path
   */
  async blend(currentPath, prevPath, outputPath, blendFactor = this.defaultBlendFactor) {
    // Load current frame and get metadata
    const currentBuffer = await fs.readFile(currentPath);
    const metadata = await sharp(currentBuffer).metadata();
    const { width, height } = metadata;

    // Load and resize previous frame to match current
    const prevBuffer = await sharp(prevPath)
      .resize(width, height, { fit: 'fill' })
      .toBuffer();

    // Composite with blending
    // Sharp's composite uses alpha for blending, so we adjust opacity
    const opacity = blendFactor;

    await sharp(currentBuffer)
      .composite([{
        input: await sharp(prevBuffer)
          .ensureAlpha(opacity)
          .toBuffer(),
        blend: 'over'
      }])
      .flatten({ background: { r: 0, g: 0, b: 0 } })
      .png({ quality: 100 })
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Blend multiple frames with weighted averaging
   *
   * @param {string[]} framePaths - Paths to frames (oldest first)
   * @param {string} outputPath - Output path
   * @param {number[]} weights - Weights for each frame (should sum to 1)
   * @returns {Promise<string>}
   */
  async blendMultiple(framePaths, outputPath, weights = null) {
    if (framePaths.length === 0) {
      throw new Error('No frames provided');
    }

    if (framePaths.length === 1) {
      await fs.copyFile(framePaths[0], outputPath);
      return outputPath;
    }

    // Default weights: exponential decay towards older frames
    if (!weights) {
      weights = this.calculateExponentialWeights(framePaths.length);
    }

    // Normalize weights
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / totalWeight);

    // Load first frame for dimensions
    const firstBuffer = await fs.readFile(framePaths[0]);
    const metadata = await sharp(firstBuffer).metadata();
    const { width, height, channels = 3 } = metadata;

    // Accumulator for weighted pixel values
    const accumulator = new Float32Array(width * height * channels);

    // Process each frame
    for (let i = 0; i < framePaths.length; i++) {
      const frameBuffer = await sharp(framePaths[i])
        .resize(width, height, { fit: 'fill' })
        .raw()
        .toBuffer();

      const weight = weights[i];

      // Add weighted pixel values
      for (let j = 0; j < frameBuffer.length; j++) {
        accumulator[j] += frameBuffer[j] * weight;
      }
    }

    // Convert back to uint8
    const outputPixels = Buffer.alloc(accumulator.length);
    for (let i = 0; i < accumulator.length; i++) {
      outputPixels[i] = Math.min(255, Math.max(0, Math.round(accumulator[i])));
    }

    // Save output
    await sharp(outputPixels, {
      raw: { width, height, channels }
    })
      .png({ quality: 100 })
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Calculate exponential decay weights
   *
   * @param {number} count - Number of frames
   * @param {number} decay - Decay factor (default 0.5)
   * @returns {number[]}
   */
  calculateExponentialWeights(count, decay = 0.5) {
    const weights = [];
    for (let i = 0; i < count; i++) {
      // Most recent frame gets highest weight
      weights.push(Math.pow(decay, count - 1 - i));
    }
    return weights;
  }

  /**
   * Apply motion-aware blending using flow data
   *
   * @param {string} currentPath - Current frame path
   * @param {string} prevPath - Previous frame path
   * @param {string} outputPath - Output path
   * @param {Object} flowData - Optical flow data
   * @param {number} blendFactor - Base blend factor
   * @returns {Promise<string>}
   */
  async blendWithFlow(currentPath, prevPath, outputPath, flowData, blendFactor) {
    // Adjust blend based on motion
    const { confidence = 1, maxMotion = 0 } = flowData || {};

    // Reduce blending when there's high motion
    // High motion = less temporal coherence expected
    const motionFactor = Math.max(0, 1 - (maxMotion / 10));
    const adjustedBlend = blendFactor * confidence * motionFactor;

    if (adjustedBlend < 0.05) {
      // Too much motion, skip blending
      await fs.copyFile(currentPath, outputPath);
      return outputPath;
    }

    return this.blend(currentPath, prevPath, outputPath, adjustedBlend);
  }

  /**
   * Detect scene change between frames
   *
   * @param {string} frame1Path - First frame path
   * @param {string} frame2Path - Second frame path
   * @param {number} threshold - Difference threshold (0-1)
   * @returns {Promise<boolean>} - True if scene change detected
   */
  async detectSceneChange(frame1Path, frame2Path, threshold = 0.3) {
    const [stats1, stats2] = await Promise.all([
      sharp(frame1Path).stats(),
      sharp(frame2Path).stats()
    ]);

    // Compare channel means
    let totalDiff = 0;
    const channels = Math.min(stats1.channels.length, stats2.channels.length);

    for (let i = 0; i < channels; i++) {
      const diff = Math.abs(stats1.channels[i].mean - stats2.channels[i].mean);
      totalDiff += diff / 255;  // Normalize to 0-1
    }

    const avgDiff = totalDiff / channels;
    return avgDiff > threshold;
  }
}

export default TemporalSmoother;
