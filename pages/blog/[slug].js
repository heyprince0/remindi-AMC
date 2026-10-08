import Head from "next/head"
import Link from "next/link"
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { serialize } from "next-mdx-remote/serialize"
import { MDXRemote } from "next-mdx-remote"

export default function BlogPost({ source, frontmatter }) {
  return (
    <>
      <Head>
        <title>{frontmatter.title} | Remindi Journal</title>
        <meta name="description" content={frontmatter.description} />
        <meta property="og:title" content={frontmatter.title} />
        <meta property="og:description" content={frontmatter.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://remindi.online/blog/${frontmatter.slug}`} />
      </Head>
      <main className="post-shell">
        <div className="post-container">
          <Link href="/blog" className="back-link">← Back to journal</Link>
          <header className="post-header">
            <div className="post-meta">{frontmatter.date}</div>
            <h1>{frontmatter.title}</h1>
            <p>{frontmatter.description}</p>
          </header>
          <article className="prose"><MDXRemote {...source} /></article>
          <aside className="cta">
            <p className="eyebrow">READY TO GET STARTED?</p>
            <h2>Keep your service business moving.</h2>
            <Link href="/signup" className="cta-link">Try Remindi Free <span aria-hidden="true">→</span></Link>
          </aside>
        </div>
      </main>
      <style jsx>{`
        .post-shell { min-height: 100vh; background: #0b0d12; color: #f6f7fb; }
        .post-container { width: min(100% - 40px, 760px); margin: 0 auto; padding: 32px 0 96px; }
        .back-link { color: #aab6ff; font-size: 14px; text-decoration: none; }
        .post-header { border-bottom: 1px solid #242832; margin-top: 74px; padding-bottom: 48px; }
        .post-meta { color: #737b8c; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        h1 { font-size: clamp(42px, 7vw, 70px); letter-spacing: -.065em; line-height: 1; margin: 16px 0 20px; }
        .post-header p { color: #a5acba; font-size: 19px; line-height: 1.6; margin: 0; max-width: 620px; }
        .prose { color: #c8ccd5; font-size: 17px; line-height: 1.8; padding: 48px 0 72px; }
        .prose :global(h2) { color: #f6f7fb; font-size: 30px; letter-spacing: -.04em; line-height: 1.2; margin: 48px 0 14px; }
        .prose :global(h3) { color: #f6f7fb; font-size: 22px; margin: 34px 0 10px; }
        .prose :global(p) { margin: 0 0 22px; }
        .prose :global(strong) { color: #f6f7fb; }
        .prose :global(ul), .prose :global(ol) { padding-left: 24px; }
        .prose :global(li) { margin: 8px 0; }
        .cta { background: #151923; border: 1px solid #2b3242; border-radius: 16px; padding: 34px; }
        .eyebrow { color: #8b9dff; font-size: 11px; font-weight: 700; letter-spacing: .16em; margin: 0 0 14px; }
        .cta h2 { font-size: 28px; letter-spacing: -.04em; margin: 0; }
        .cta-link { color: #0b0d12; background: #aab6ff; border-radius: 7px; display: inline-block; font-size: 14px; font-weight: 700; margin-top: 24px; padding: 12px 16px; text-decoration: none; }
        .cta-link span { margin-left: 5px; }
        @media (max-width: 600px) { .post-container { width: min(100% - 32px, 760px); padding-top: 24px; } .post-header { margin-top: 58px; } .cta { padding: 26px; } }
      `}</style>
    </>
  )
}

export async function getStaticPaths() {
  const postsDirectory = path.join(process.cwd(), "content/posts")
  const paths = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".mdx")).map((file) => {
    const source = fs.readFileSync(path.join(postsDirectory, file), "utf8")
    const { data } = matter(source)
    return { params: { slug: data.slug } }
  })
  return { paths, fallback: false }
}

export async function getStaticProps({ params }) {
  const source = fs.readFileSync(path.join(process.cwd(), "content/posts", `${params.slug}.mdx`), "utf8")
  const { data, content } = matter(source)
  return { props: { source: await serialize(content), frontmatter: data } }
}
