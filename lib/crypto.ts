import crypto from 'crypto'

function getKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 32) throw new Error('ENCRYPTION_KEY must be exactly 32 characters')
  return Buffer.from(key, 'utf8')
}

export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export async function decryptToken(encryptedToken: string): Promise<string> {
  const [ivHex, encryptedHex] = encryptedToken.split(':')
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted token format')
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8')
}
