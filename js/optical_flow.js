#!/usr/bin/env node

/**
 * Optical Flow Computation Script
 *
 * Computes optical flow between two consecutive frames.
 * Uses a simplified Lucas-Kanade implementation via pixel differencing.
 *
 * Input (JSON arg):
 * {
 *   "prevFrame": "/path/to/prev.png",
 *   "currFrame": "/path/to/curr.png"
 * }
 *
 * Output (JSON stdout):
 * {
 *   "flow": {
 *     "avgMotion": { "x": 0.5, "y": 0.2 },
 *     "maxMotion": 2.5,
 *     "confidence": 0.85
 *   }
 * }
 */

import { promises as fs } from 'fs';
import sharp from 'sharp';

/**
 * Compute simplified optical flow between two frames
 * This is a basic implementation that estimates motion vectors
 */
async function computeOpticalFlow(prevPath, currPath) {
  // Load both frames as grayscale for analysis
  const [prevData, currData] = await Promise.all([
    loadGrayscale(prevPath),
    loadGrayscale(currPath)
  ]);

  // Ensure same dimensions
  if (prevData.width !== currData.width || prevData.height !== currData.height) {
    throw new Error('Frame dimensions do not match');
  }

  const { width, height } = prevData;
  const prevPixels = prevData.pixels;
  const currPixels = currData.pixels;

  // Compute frame difference
  let totalDiff = 0;
  let maxDiff = 0;
  const blockSize = 16;
  const motionVectors = [];

  // Analyze motion in blocks
  for (let y = 0; y < height - blockSize; y += blockSize) {
    for (let x = 0; x < width - blockSize; x += blockSize) {
      const motion = computeBlockMotion(
        prevPixels, currPixels,
        x, y, blockSize, width
      );
      motionVectors.push(motion);

      const magnitude = Math.sqrt(motion.x * motion.x + motion.y * motion.y);
      totalDiff += magnitude;
      maxDiff = Math.max(maxDiff, magnitude);
    }
  }

  // Calculate average motion
  const avgX = motionVectors.reduce((sum, v) => sum + v.x, 0) / motionVectors.length;
  const avgY = motionVectors.reduce((sum, v) => sum + v.y, 0) / motionVectors.length;
  const avgMotion = totalDiff / motionVectors.length;

  // Confidence based on consistency of motion vectors
  const variance = motionVectors.reduce((sum, v) => {
    const dx = v.x - avgX;
    const dy = v.y - avgY;
    return sum + dx * dx + dy * dy;
  }, 0) / motionVectors.length;

  const confidence = Math.max(0, 1 - (variance / (maxDiff + 1)));

  return {
    avgMotion: { x: avgX, y: avgY },
    maxMotion: maxDiff,
    confidence,
    frameWidth: width,
    frameHeight: height
  };
}

/**
 * Load image as grayscale pixel data
 */
async function loadGrayscale(imagePath) {
  const image = sharp(imagePath).grayscale();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  return {
    pixels: data,
    width: info.width,
    height: info.height
  };
}

/**
 * Compute motion vector for a block using simple template matching
 */
function computeBlockMotion(prevPixels, currPixels, startX, startY, blockSize, width) {
  const searchRadius = 4;
  let bestDx = 0;
  let bestDy = 0;
  let minSAD = Infinity;  // Sum of Absolute Differences

  // Get current block
  const currBlock = getBlock(currPixels, startX, startY, blockSize, width);

  // Search for best match in previous frame
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const searchX = startX + dx;
      const searchY = startY + dy;

      // Skip if out of bounds
      if (searchX < 0 || searchY < 0) continue;

      const prevBlock = getBlock(prevPixels, searchX, searchY, blockSize, width);
      const sad = computeSAD(currBlock, prevBlock);

      if (sad < minSAD) {
        minSAD = sad;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  return { x: bestDx, y: bestDy };
}

/**
 * Extract a block of pixels
 */
function getBlock(pixels, startX, startY, blockSize, width) {
  const block = [];
  for (let y = 0; y < blockSize; y++) {
    for (let x = 0; x < blockSize; x++) {
      const idx = (startY + y) * width + (startX + x);
      block.push(pixels[idx] || 0);
    }
  }
  return block;
}

/**
 * Compute Sum of Absolute Differences
 */
function computeSAD(block1, block2) {
  let sad = 0;
  for (let i = 0; i < block1.length; i++) {
    sad += Math.abs((block1[i] || 0) - (block2[i] || 0));
  }
  return sad;
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
    const { prevFrame, currFrame } = config;

    if (!prevFrame || !currFrame) {
      throw new Error('Missing required parameters: prevFrame, currFrame');
    }

    // Check files exist
    await fs.access(prevFrame);
    await fs.access(currFrame);

    // Compute optical flow
    const flow = await computeOpticalFlow(prevFrame, currFrame);

    console.log(JSON.stringify({ flow }));

  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

main();
