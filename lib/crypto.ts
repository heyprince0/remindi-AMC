import crypto from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'utf8')

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, dataHex] = encryptedToken.split(':')
  if (!ivHex || !dataHex) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(ivHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
