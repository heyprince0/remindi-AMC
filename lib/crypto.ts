import crypto from 'node:crypto'

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.ENCRYPTION_KEY

  if (!configuredKey) {
    throw new Error('ENCRYPTION_KEY is not configured')
  }

  return crypto.createHash('sha256').update(configuredKey, 'utf8').digest()
}

export async function encryptToken(token: string): Promise<string> {
  try {
    if (!token) {
      throw new Error('Token is required')
    }

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
  } catch (error: unknown) {
    console.error('Failed to encrypt WhatsApp access token', error)
    throw new Error('Unable to encrypt access token')
  }
}

export async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    const [ivHex, encryptedHex] = encryptedToken.split(':')

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted token format')
    }

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return decrypted.toString('utf8')
  } catch (error: unknown) {
    console.error('Failed to decrypt WhatsApp access token', error)
    throw new Error('Unable to decrypt access token')
  }
}

