import fs from 'fs'
import path from 'path'

export default function Sitemap() {}

export async function getServerSideProps({ res }) {
  const posts = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'content/posts.json'), 'utf8')
  )

  const urls = posts.map(post => `
    <url>
      <loc>https://remindi.online/blog/${post.slug}</loc>
      <lastmod>${post.date}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://remindi.online</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://remindi.online/blog</loc>
    <priority>0.9</priority>
  </url>
  ${urls}
</urlset>`

  res.setHeader('Content-Type', 'text/xml')
  res.write(sitemap)
  res.end()

  return { props: {} }
}
