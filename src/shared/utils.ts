export async function readFullBody(
  body: ReadableStream<Uint8Array> | null,
  maxSize: number,
): Promise<ArrayBuffer | null> {
  if (!body) return null

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalSize += value.length
      if (totalSize > maxSize) {
        throw new Error(`Body exceeds maximum size of ${maxSize} bytes`)
      }

      chunks.push(value)
    }

    if (chunks.length === 0) return null

    const result = new Uint8Array(totalSize)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result.buffer
  } finally {
    reader.releaseLock()
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
