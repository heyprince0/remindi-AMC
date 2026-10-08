import { useEffect, useState } from "react"
import Head from "next/head"
import Link from "next/link"
import fs from "fs"
import path from "path"

const formatDate = (date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${date}T00:00:00`))
const sanitizeHtml = (html) => html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "").replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2")

export default function BlogPost({ post }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => { const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) }; update(); window.addEventListener("scroll", update, { passive: true }); return () => window.removeEventListener("scroll", update) }, [])
  return <>
    <Head><title>{post.title} – Remindi Blog</title><meta name="description" content={post.description} /><meta property="og:title" content={`${post.title} – Remindi Blog`} /><meta property="og:description" content={post.description} /><meta property="og:type" content="article" /><meta property="og:url" content={`https://remindi.online/blog/${post.slug}`} /><meta property="og:site_name" content="Remindi" /></Head>
    <div className="progress" style={{ width: `${progress}%` }} aria-hidden="true" />
    <main className="post-page"><nav className="navbar"><Link href="/" className="logo">remindi<span>.</span></Link><div className="nav-links"><Link href="/blog">Blog</Link><Link href="/login">Sign in</Link><Link href="/signup" className="nav-cta">Get started <span aria-hidden="true">→</span></Link></div></nav><div className="post-container"><Link href="/blog" className="back">← Back to blog</Link><header><p className="date">{formatDate(post.date)}</p><h1>{post.title}</h1><p className="description">{post.description}</p></header><article className="post-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }} /><section className="cta"><p className="kicker">READY TO GET ORGANIZED?</p><h2>Run your service business with confidence.</h2><Link href="/" className="cta-button">Try Remindi Free <span aria-hidden="true">→</span></Link></section></div></main>
    <style jsx>{styles}</style>
  </>
}

export function getStaticPaths() { const posts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/posts.json"), "utf8")); return { paths: posts.map(({ slug }) => ({ params: { slug } })), fallback: false } }
export function getStaticProps({ params }) { const posts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/posts.json"), "utf8")); const post = posts.find(({ slug }) => slug === params.slug); return { props: { post } } }

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,500;1,500&display=swap');
:global(*){box-sizing:border-box}:global(body){margin:0}.progress{position:fixed;z-index:10;top:0;left:0;height:3px;background:#29abe2}.post-page{min-height:100vh;background:#f5fafd;color:#0c1a27;font-family:Inter,Arial,sans-serif}.navbar{height:76px;display:flex;align-items:center;justify-content:space-between;max-width:1120px;margin:auto;padding:0 28px}.logo{font-size:25px;font-weight:700;letter-spacing:-1.5px;color:#0c1a27;text-decoration:none}.logo span{color:#29abe2}.nav-links{display:flex;align-items:center;gap:27px;font-size:13px}.nav-links a{color:#466073;text-decoration:none}.nav-links a:hover{color:#0c1a27}.nav-cta{background:#29abe2!important;color:#fff!important;border-radius:7px;padding:11px 15px;font-weight:600}.post-container{max-width:790px;margin:auto;padding:62px 28px 100px}.back{font-size:13px;color:#1688bb;text-decoration:none}.post-container header{border-bottom:1px solid #c9dce5;padding:58px 0 43px}.date{color:#77909e;font-size:11px;letter-spacing:1px;text-transform:uppercase}.post-container h1{font-size:clamp(40px,6vw,66px);letter-spacing:-3px;line-height:1.02;margin:17px 0 22px}.description{color:#607582;font-size:18px;line-height:1.65;margin:0}.post-content{font-family:Lora,Georgia,serif;font-size:18px;line-height:1.9;padding:47px 0 65px;color:#263c49}.post-content :global(h2){font-family:Inter,Arial,sans-serif;color:#0c1a27;font-size:30px;line-height:1.2;letter-spacing:-1px;margin:42px 0 13px}.post-content :global(h2:first-child){margin-top:0}.post-content :global(p){margin:0 0 24px}.post-content :global(a){color:#1688bb}.post-content :global(ul),.post-content :global(ol){padding-left:25px}.cta{background:#0c1a27;color:white;border-radius:15px;padding:35px 38px}.kicker{color:#8edcff;font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:2px;font-weight:700;margin:0 0 15px}.cta h2{font-size:30px;line-height:1.15;letter-spacing:-1px;margin:0}.cta-button{display:inline-block;background:#29abe2;color:#fff;text-decoration:none;border-radius:6px;padding:12px 16px;font:600 13px Inter,Arial,sans-serif;margin-top:25px}@media(max-width:640px){.navbar{padding:0 18px}.nav-links{gap:14px}.nav-links a:first-child{display:none}.nav-cta{padding:10px 11px}.post-container{padding:45px 18px 70px}.post-container header{padding-top:45px}.post-container h1{letter-spacing:-2px}.post-content{font-size:17px;padding-top:35px}.cta{padding:27px 24px}}
`
