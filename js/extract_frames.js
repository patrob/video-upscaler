#!/usr/bin/env node

/**
 * Frame Extraction Script
 *
 * Extracts frames from a video file using FFmpeg.
 *
 * Input (JSON arg):
 * {
 *   "input": "/path/to/video.mp4",
 *   "outputDir": "/path/to/frames",
 *   "fps": 24
 * }
 *
 * Output (JSON stdout):
 * {
 *   "frameCount": 120,
 *   "duration": 5.0
 * }
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Extract frames from video using FFmpeg
 */
async function extractFrames(inputPath, outputDir, fps) {
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Build FFmpeg command
  const outputPattern = path.join(outputDir, 'frame_%05d.png');

  const args = [
    '-i', inputPath,
    '-vf', `fps=${fps}`,
    '-q:v', '1',  // Highest quality for PNG
    '-start_number', '0',
    outputPattern
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Count extracted frames
        const files = await fs.readdir(outputDir);
        const frameCount = files.filter(f => f.endsWith('.png')).length;

        // Parse duration from FFmpeg output
        const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
        let duration = 0;
        if (durationMatch) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds);
        }

        resolve({ frameCount, duration });
      } catch (err) {
        reject(err);
      }
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
    const { input, outputDir, fps = 24 } = config;

    if (!input || !outputDir) {
      throw new Error('Missing required parameters: input, outputDir');
    }

    // Check if input file exists
    await fs.access(input);

    // Extract frames
    const result = await extractFrames(input, outputDir, fps);

    // Output result as JSON
    console.log(JSON.stringify({
      frameCount: result.frameCount,
      duration: result.duration
    }));

  } catch (error) {
    console.log(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
