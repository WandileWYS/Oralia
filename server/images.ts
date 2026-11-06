import { z } from 'zod';
import type { KeyframeImageRequest } from '../src/types/images.ts';

export function fallbackImage(input: KeyframeImageRequest) {
  return {
    sceneNumber: input.sceneNumber,
    imageUrl: `/images/fallback/${input.collection.toLowerCase()}-${input.sceneNumber}.svg`,
    mimeType: 'image/svg+xml' as const,
    provenance: 'Oralia illustrative placeholder; not AI generated' as const,
    fallbackReason: process.env.OPENAI_API_KEY ? 'presentation-demo' as const : 'missing-api-key' as const,
  };
}

// Server-only preparation: demo HTTP routes never invoke the paid provider.
// Durable storage and verified creator authorization must precede public use.
export async function synthesizeKeyframe(
  input: KeyframeImageRequest,
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch } = {},
) {
  const env = options.env ?? process.env;
  if (!env.OPENAI_API_KEY || !env.OPENAI_IMAGE_MODEL) throw new Error('Image provider is not configured.');
  try {
    const response = await (options.fetch ?? fetch)('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL, prompt: input.prompt, n: 1, size: '1024x1024', output_format: 'png' }),
    });
    if (!response.ok) throw new Error('Provider failed.');
    const data = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).length(1) }).parse(await response.json());
    const encoded = data.data[0].b64_json;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 16000000) throw new Error('Invalid image.');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG.');
    return { bytes, mimeType: 'image/png' as const, provenance: 'OpenAI-generated image' as const };
  } catch {
    throw new Error('Image generation is unavailable. Use the illustrative fallback.');
  }
}
