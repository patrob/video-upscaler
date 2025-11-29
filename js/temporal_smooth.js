#!/usr/bin/env node

/**
 * Temporal Smoothing Script
 *
 * Applies temporal smoothing to maintain consistency between frames.
 * Uses optical flow to warp previous frame and blend with current.
 *
 * Input (JSON arg):
 * {
 *   "currentFrame": "/path/to/current.png",
 *   "prevEnhanced": "/path/to/prev_enhanced.png",
 *   "flowData": { "avgMotion": {...}, ... },
 *   "blendFactor": 0.3
 * }
 *
 * Output (JSON stdout):
 * {
 *   "output": "/path/to/current.png"  // In-place update
 * }
 */

import { promises as fs } from 'fs';
import sharp from 'sharp';

/**
 * Apply temporal smoothing to a frame
 */
async function applyTemporalSmoothing(currentPath, prevEnhancedPath, flowData, blendFactor) {
  // Load both frames
  const [currentBuffer, prevBuffer] = await Promise.all([
    fs.readFile(currentPath),
    fs.readFile(prevEnhancedPath)
  ]);

  const currentMetadata = await sharp(currentBuffer).metadata();
  const { width, height } = currentMetadata;

  // Get raw pixel data
  const currentData = await sharp(currentBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const prevData = await sharp(prevBuffer)
    .resize(width, height)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Apply motion-compensated blending
  const blendedPixels = blendFrames(
    currentData.data,
    prevData.data,
    width,
    height,
    currentData.info.channels,
    flowData,
    blendFactor
  );

  // Save blended result
  await sharp(Buffer.from(blendedPixels), {
    raw: {
      width,
      height,
      channels: currentData.info.channels
    }
  })
    .png({ quality: 100 })
    .toFile(currentPath);

  return currentPath;
}

/**
 * Blend two frames with motion compensation
 */
function blendFrames(currentPixels, prevPixels, width, height, channels, flowData, blendFactor) {
  const output = Buffer.alloc(currentPixels.length);
  const { avgMotion = { x: 0, y: 0 }, confidence = 0.5 } = flowData || {};

  // Adjust blend factor based on motion confidence
  // Less blending when there's lots of motion (less confidence in temporal coherence)
  const adjustedBlend = blendFactor * confidence;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate source position in previous frame (motion compensation)
      const srcX = Math.round(x + avgMotion.x);
      const srcY = Math.round(y + avgMotion.y);

      const dstIdx = (y * width + x) * channels;

      // Check if source is within bounds
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * channels;

        // Blend channels
        for (let c = 0; c < channels; c++) {
          const current = currentPixels[dstIdx + c];
          const prev = prevPixels[srcIdx + c];
          output[dstIdx + c] = Math.round(
            current * (1 - adjustedBlend) + prev * adjustedBlend
          );
        }
      } else {
        // No previous data available, use current frame as-is
        for (let c = 0; c < channels; c++) {
          output[dstIdx + c] = currentPixels[dstIdx + c];
        }
      }
    }
  }

  return output;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const inputArg = process.argv[2];
    if (!inputArg) {
      throw new Error('No input argument provided');
    }

    const config = JSON.parse(inputArg);
    const { currentFrame, prevEnhanced, flowData, blendFactor = 0.3 } = config;

    if (!currentFrame || !prevEnhanced) {
      throw new Error('Missing required parameters: currentFrame, prevEnhanced');
    }

    // Check files exist
    await fs.access(currentFrame);
    await fs.access(prevEnhanced);

    // Apply temporal smoothing
    const output = await applyTemporalSmoothing(
      currentFrame,
      prevEnhanced,
      flowData,
      blendFactor
    );

    console.log(JSON.stringify({ output }));

  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

main();
