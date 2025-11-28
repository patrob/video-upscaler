#!/usr/bin/env node

/**
 * Frame Enhancement Script
 *
 * Enhances a single frame using Ollama's vision model.
 *
 * Input (JSON arg):
 * {
 *   "input": "/path/to/frame.png",
 *   "output": "/path/to/enhanced.png",
 *   "model": "llava",
 *   "prompt": "Enhance this image...",
 *   "strength": 0.7
 * }
 *
 * Output (JSON stdout):
 * {
 *   "output": "/path/to/enhanced.png"
 * }
 */

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { OllamaClient } from './lib/ollama_client.js';

/**
 * Enhance a frame using Ollama
 */
async function enhanceFrame(inputPath, outputPath, options) {
  const {
    model = 'llava',
    prompt = 'Enhance this image. Keep structure identical. Improve realism, detail, clarity.',
    strength = 0.7
  } = options;

  // Read input image
  const imageBuffer = await fs.readFile(inputPath);
  const base64Image = imageBuffer.toString('base64');

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();

  // Initialize Ollama client
  const ollama = new OllamaClient();

  try {
    // Send to Ollama for enhancement
    const response = await ollama.generate({
      model,
      prompt: `${prompt} Strength: ${strength}`,
      images: [base64Image],
      stream: false
    });

    // Check if Ollama returned an enhanced image
    if (response.images && response.images.length > 0) {
      // Decode the returned image
      const enhancedBuffer = Buffer.from(response.images[0], 'base64');

      // Ensure output maintains original dimensions
      await sharp(enhancedBuffer)
        .resize(metadata.width, metadata.height, { fit: 'fill' })
        .png({ quality: 100 })
        .toFile(outputPath);
    } else {
      // Fallback: Apply local enhancement if Ollama doesn't return image
      await applyLocalEnhancement(inputPath, outputPath, strength);
    }

    return outputPath;

  } catch (error) {
    // If Ollama fails, use local enhancement as fallback
    console.error(`Ollama enhancement failed: ${error.message}, using local fallback`);
    await applyLocalEnhancement(inputPath, outputPath, strength);
    return outputPath;
  }
}

/**
 * Apply local enhancement using Sharp (fallback)
 */
async function applyLocalEnhancement(inputPath, outputPath, strength) {
  const sharpening = Math.round(strength * 2);  // 0-2 range
  const contrast = 1 + (strength * 0.2);  // 1.0-1.2 range

  await sharp(inputPath)
    .sharpen({
      sigma: sharpening,
      m1: 0.5,
      m2: 0.5
    })
    .modulate({
      brightness: 1,
      saturation: 1 + (strength * 0.1)
    })
    .linear(contrast, -(128 * (contrast - 1)))  // Contrast adjustment
    .png({ quality: 100 })
    .toFile(outputPath);
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse input from command line argument
    const inputArg = process.argv[2];
    if (!inputArg) {
      throw new Error('No input argument provided');
    }

    const config = JSON.parse(inputArg);
    const { input, output, model, prompt, strength } = config;

    if (!input || !output) {
      throw new Error('Missing required parameters: input, output');
    }

    // Check if input file exists
    await fs.access(input);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(output), { recursive: true });

    // Enhance frame
    const resultPath = await enhanceFrame(input, output, {
      model,
      prompt,
      strength
    });

    // Output result as JSON
    console.log(JSON.stringify({
      output: resultPath
    }));

  } catch (error) {
    console.log(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
