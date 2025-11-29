#!/usr/bin/env node

/**
 * Batch Frame Processing Script
 *
 * Processes multiple frames with enhancement and temporal smoothing.
 *
 * Input (JSON arg):
 * {
 *   "frames": [
 *     {"input": "/path/to/frame.png", "output": "/path/to/enhanced.png", "index": 0},
 *     ...
 *   ],
 *   "model": "llava",
 *   "prompt": "Enhance this image...",
 *   "strength": 0.7,
 *   "temporalSmoothing": true,
 *   "temporalBlend": 0.3
 * }
 *
 * Output (JSON stdout):
 * {
 *   "outputs": ["/path/to/enhanced1.png", "/path/to/enhanced2.png", ...]
 * }
 */

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { OllamaClient } from './lib/ollama_client.js';
import { TemporalSmoother } from './lib/temporal_smoother.js';

/**
 * Process a batch of frames
 */
async function processBatch(frames, options) {
  const {
    model = 'llava',
    prompt = 'Enhance this image. Keep structure identical.',
    strength = 0.7,
    temporalSmoothing = true,
    temporalBlend = 0.3
  } = options;

  const ollama = new OllamaClient();
  const smoother = new TemporalSmoother();
  const outputs = [];

  let prevEnhanced = null;

  // Check if first frame has a previous enhanced reference
  if (frames[0].prevEnhanced) {
    prevEnhanced = frames[0].prevEnhanced;
  }

  // Process frames sequentially for temporal consistency
  for (const frameInfo of frames) {
    const { input, output, index } = frameInfo;

    try {
      // Ensure output directory exists
      await fs.mkdir(path.dirname(output), { recursive: true });

      // Read and encode input frame
      const imageBuffer = await fs.readFile(input);
      const base64Image = imageBuffer.toString('base64');
      const metadata = await sharp(imageBuffer).metadata();

      let enhancedPath = output;

      try {
        // Enhance via Ollama
        const response = await ollama.generate({
          model,
          prompt: `${prompt} Strength: ${strength}`,
          images: [base64Image],
          stream: false
        });

        if (response.images && response.images.length > 0) {
          // Decode enhanced image
          const enhancedBuffer = Buffer.from(response.images[0], 'base64');

          // Resize to match original dimensions
          let enhanced = sharp(enhancedBuffer)
            .resize(metadata.width, metadata.height, { fit: 'fill' });

          // Apply temporal smoothing if we have a previous frame
          if (temporalSmoothing && prevEnhanced) {
            const tempPath = output + '.temp.png';
            await enhanced.png().toFile(tempPath);

            // Apply temporal blending
            await smoother.blend(tempPath, prevEnhanced, output, temporalBlend);
            await fs.unlink(tempPath).catch(() => {});
          } else {
            await enhanced.png({ quality: 100 }).toFile(output);
          }
        } else {
          // Fallback to local enhancement
          await applyLocalEnhancement(input, output, strength);

          if (temporalSmoothing && prevEnhanced) {
            const tempPath = output + '.temp.png';
            await fs.rename(output, tempPath);
            await smoother.blend(tempPath, prevEnhanced, output, temporalBlend);
            await fs.unlink(tempPath).catch(() => {});
          }
        }
      } catch (ollamaError) {
        // Fallback on Ollama failure
        console.error(`Frame ${index}: Ollama failed, using fallback`);
        await applyLocalEnhancement(input, output, strength);

        if (temporalSmoothing && prevEnhanced) {
          const tempPath = output + '.temp.png';
          await fs.rename(output, tempPath);
          await smoother.blend(tempPath, prevEnhanced, output, temporalBlend);
          await fs.unlink(tempPath).catch(() => {});
        }
      }

      prevEnhanced = output;
      outputs.push(output);

    } catch (error) {
      console.error(`Error processing frame ${index}: ${error.message}`);
      // Copy original as fallback
      await fs.copyFile(input, output);
      outputs.push(output);
      prevEnhanced = output;
    }
  }

  return outputs;
}

/**
 * Apply local enhancement using Sharp (fallback)
 */
async function applyLocalEnhancement(inputPath, outputPath, strength) {
  const sharpening = Math.round(strength * 2);
  const contrast = 1 + (strength * 0.2);

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
    .linear(contrast, -(128 * (contrast - 1)))
    .png({ quality: 100 })
    .toFile(outputPath);
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
    const { frames, model, prompt, strength, temporalSmoothing, temporalBlend } = config;

    if (!frames || frames.length === 0) {
      throw new Error('No frames provided');
    }

    const outputs = await processBatch(frames, {
      model,
      prompt,
      strength,
      temporalSmoothing,
      temporalBlend
    });

    console.log(JSON.stringify({ outputs }));

  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

main();
