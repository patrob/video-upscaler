#!/usr/bin/env node

/**
 * Video Assembly Script
 *
 * Assembles enhanced frames back into a video using FFmpeg.
 *
 * Input (JSON arg):
 * {
 *   "framesDir": "/path/to/enhanced",
 *   "output": "/path/to/output.mp4",
 *   "fps": 24
 * }
 *
 * Output (JSON stdout):
 * {
 *   "output": "/path/to/output.mp4",
 *   "frameCount": 120
 * }
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Assemble frames into video using FFmpeg
 */
async function assembleVideo(framesDir, outputPath, fps) {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Get frame pattern
  const inputPattern = path.join(framesDir, 'frame_%05d.png');

  // Count frames
  const files = await fs.readdir(framesDir);
  const frameCount = files.filter(f => f.endsWith('.png')).length;

  if (frameCount === 0) {
    throw new Error('No frames found in directory');
  }

  // Build FFmpeg command
  const args = [
    '-y',  // Overwrite output
    '-framerate', fps.toString(),
    '-i', inputPattern,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',  // High quality
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      resolve({ output: outputPath, frameCount });
    });

    ffmpeg.on('error', reject);
  });
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
    const { framesDir, output, fps = 24 } = config;

    if (!framesDir || !output) {
      throw new Error('Missing required parameters: framesDir, output');
    }

    // Check if frames directory exists
    await fs.access(framesDir);

    // Assemble video
    const result = await assembleVideo(framesDir, output, fps);

    // Output result as JSON
    console.log(JSON.stringify({
      output: result.output,
      frameCount: result.frameCount
    }));

  } catch (error) {
    console.log(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
