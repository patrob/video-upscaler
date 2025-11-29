/**
 * Ollama API Client
 *
 * Provides a simple interface to the Ollama local API
 * for image enhancement using vision models.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

export class OllamaClient {
  constructor(host = OLLAMA_HOST) {
    this.host = host;
    this.timeout = 120000; // 2 minute timeout for image processing
  }

  /**
   * Generate a response from Ollama with optional images
   *
   * @param {Object} options - Generation options
   * @param {string} options.model - Model name (e.g., 'llava')
   * @param {string} options.prompt - Text prompt
   * @param {string[]} options.images - Base64 encoded images
   * @param {boolean} options.stream - Whether to stream response
   * @returns {Promise<Object>} - Generated response
   */
  async generate(options) {
    const {
      model,
      prompt,
      images = [],
      stream = false
    } = options;

    const url = `${this.host}/api/generate`;

    const body = {
      model,
      prompt,
      images,
      stream,
      options: {
        temperature: 0.1,  // Low temperature for consistent enhancement
        num_predict: 100   // Short response expected
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if Ollama is available and the model exists
   *
   * @param {string} model - Model name to check
   * @returns {Promise<boolean>} - Whether model is available
   */
  async checkModel(model) {
    try {
      const url = `${this.host}/api/tags`;
      const response = await fetch(url);

      if (!response.ok) {
        return false;
      }

      const { models } = await response.json();
      return models.some(m => m.name === model || m.name.startsWith(`${model}:`));

    } catch {
      return false;
    }
  }

  /**
   * Pull a model if not available
   *
   * @param {string} model - Model name to pull
   * @returns {Promise<void>}
   */
  async pullModel(model) {
    const url = `${this.host}/api/pull`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: model, stream: false })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull model: ${errorText}`);
    }
  }

  /**
   * Get available models
   *
   * @returns {Promise<string[]>} - List of available model names
   */
  async listModels() {
    const url = `${this.host}/api/tags`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to list models');
    }

    const { models } = await response.json();
    return models.map(m => m.name);
  }

  /**
   * Check if Ollama server is running
   *
   * @returns {Promise<boolean>}
   */
  async isRunning() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default OllamaClient;
