import Head from "next/head"
import Link from "next/link"
import fs from "fs"
import path from "path"
import matter from "gray-matter"

export default function BlogIndex({ posts }) {
  return (
    <>
      <Head>
        <title>Remindi Journal | Field Service Insights</title>
        <meta name="description" content="Practical insights for service businesses managing contracts, customers, technicians, and recurring work." />
        <meta property="og:title" content="Remindi Journal" />
        <meta property="og:description" content="Practical insights for modern field service teams." />
        <meta property="og:type" content="website" />
      </Head>
      <main className="blog-shell">
        <div className="blog-container">
          <header className="blog-header">
            <Link href="/" className="brand">remindi<span>.</span></Link>
            <p className="eyebrow">THE REMINDI JOURNAL</p>
            <h1>Run a sharper service business.</h1>
            <p className="intro">Clear, useful thinking for teams that keep customers, contracts, and technicians moving.</p>
          </header>
          <section className="post-list" aria-label="Blog posts">
            {posts.map((post) => (
              <article className="post-card" key={post.slug}>
                <div className="post-meta">{post.date}</div>
                <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                <p>{post.description}</p>
                <Link href={`/blog/${post.slug}`} className="read-link">Read article <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </section>
        </div>
      </main>
      <style jsx>{`
        .blog-shell { min-height: 100vh; background: #0b0d12; color: #f6f7fb; }
        .blog-container { width: min(100% - 40px, 900px); margin: 0 auto; padding: 32px 0 96px; }
        .blog-header { border-bottom: 1px solid #242832; padding-bottom: 72px; }
        .brand { color: #f6f7fb; font-size: 20px; font-weight: 700; letter-spacing: -.04em; text-decoration: none; }
        .brand span { color: #8b9dff; }
        .eyebrow { color: #8b9dff; font-size: 11px; font-weight: 700; letter-spacing: .16em; margin: 92px 0 18px; }
        h1 { font-size: clamp(42px, 7vw, 72px); letter-spacing: -.065em; line-height: .98; margin: 0; max-width: 700px; }
        .intro { color: #a5acba; font-size: 18px; line-height: 1.6; margin: 26px 0 0; max-width: 530px; }
        .post-list { display: grid; gap: 0; }
        .post-card { border-bottom: 1px solid #242832; padding: 42px 0 44px; }
        .post-meta { color: #737b8c; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        h2 { font-size: clamp(26px, 4vw, 38px); letter-spacing: -.04em; line-height: 1.1; margin: 14px 0 12px; }
        h2 a { color: #f6f7fb; text-decoration: none; }
        h2 a:hover { color: #aab6ff; }
        .post-card p { color: #a5acba; line-height: 1.65; margin: 0; max-width: 650px; }
        .read-link { color: #aab6ff; display: inline-block; font-size: 14px; font-weight: 600; margin-top: 22px; text-decoration: none; }
        .read-link span { display: inline-block; margin-left: 5px; transition: transform .2s; }
        .read-link:hover span { transform: translateX(4px); }
        @media (max-width: 600px) { .blog-container { width: min(100% - 32px, 900px); padding-top: 24px; } .eyebrow { margin-top: 72px; } .blog-header { padding-bottom: 52px; } }
      `}</style>
    </>
  )
}

export function getStaticProps() {
  const postsDirectory = path.join(process.cwd(), "content/posts")
  const posts = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".mdx")).map((file) => {
    const source = fs.readFileSync(path.join(postsDirectory, file), "utf8")
    const { data } = matter(source)
    return data
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
  return { props: { posts } }
}


