import Head from "next/head"
import Link from "next/link"
import fs from "fs"
import path from "path"

const formatDate = (date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${date}T00:00:00`))

export default function BlogIndex({ posts }) {
  const [featured, ...remaining] = posts
  return <>
    <Head>
      <title>Remindi Blog – AMC Management Insights</title>
      <meta name="description" content="Practical insights for service contractors managing AMC contracts, customers, technicians, and recurring work." />
      <meta property="og:title" content="Remindi Blog – AMC Management Insights" />
      <meta property="og:description" content="Practical insights for service contractors." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://remindi.online/blog" />
    </Head>
    <main className="blog-page">
      <nav className="navbar" aria-label="Main navigation"><Link href="/" className="logo">remindi<span>.</span></Link><div className="nav-links"><Link href="/blog">Blog</Link><Link href="/login">Sign in</Link><Link href="/signup" className="nav-cta">Get started <span aria-hidden="true">→</span></Link></div></nav>
      <div className="container">
        <header className="hero"><p className="kicker">THE REMINDI BLOG</p><h1>Better systems for<br /><em>better service.</em></h1><p>Ideas, guides, and practical advice to help service contractors run a more organized, profitable business.</p></header>
        {featured && <section className="featured" aria-labelledby="featured-title"><div className="feature-label">Featured article <span>{formatDate(featured.date)}</span></div><h2 id="featured-title"><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2><p>{featured.description}</p><Link href={`/blog/${featured.slug}`} className="read-button">Read the article <span aria-hidden="true">↗</span></Link></section>}
        <section className="articles" aria-labelledby="more-title"><div className="section-heading"><p className="kicker">FROM THE JOURNAL</p><h2 id="more-title">More to explore</h2></div><div className="article-grid">{remaining.map((post) => <article className="article-card" key={post.slug}><p className="date">{formatDate(post.date)}</p><h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3><p>{post.description}</p><Link href={`/blog/${post.slug}`} className="text-link">Read more <span aria-hidden="true">→</span></Link></article>)}</div></section>
      </div>
    </main>
    <style jsx>{styles}</style>
  </>
}

export function getStaticProps() { const posts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/posts.json"), "utf8")).sort((a, b) => new Date(b.date) - new Date(a.date)); return { props: { posts } } }

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,500;1,500&display=swap');
:global(*){box-sizing:border-box}:global(body){margin:0}:global(a){transition:color .2s,background .2s}.blog-page{min-height:100vh;background:#f5fafd;color:#0c1a27;font-family:Inter,Arial,sans-serif}.navbar{height:76px;display:flex;align-items:center;justify-content:space-between;max-width:1120px;margin:auto;padding:0 28px}.logo{font-size:25px;font-weight:700;letter-spacing:-1.5px;color:#0c1a27;text-decoration:none}.logo span{color:#29abe2}.nav-links{display:flex;align-items:center;gap:27px;font-size:13px}.nav-links a{color:#466073;text-decoration:none}.nav-links a:hover{color:#0c1a27}.nav-cta{background:#29abe2!important;color:white!important;border-radius:7px;padding:11px 15px;font-weight:600}.container{max-width:1120px;margin:auto;padding:74px 28px 100px}.hero{max-width:700px}.kicker{color:#1688bb;font-size:11px;letter-spacing:2px;font-weight:700;margin:0 0 20px}.hero h1{font-size:clamp(45px,7vw,78px);letter-spacing:-4px;line-height:.98;margin:0}.hero h1 em{font-family:Lora,Georgia,serif;font-weight:500;color:#29abe2}.hero>p:last-child{color:#5d7180;font-size:18px;line-height:1.65;max-width:540px;margin:27px 0 0}.featured{background:#0c1a27;color:#fff;border-radius:16px;margin-top:76px;padding:39px 44px 43px;position:relative;overflow:hidden}.featured:after{content:"";position:absolute;right:-70px;top:-90px;width:270px;height:270px;border:1px solid rgba(41,171,226,.3);border-radius:50%}.feature-label{color:#8edcff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600}.feature-label span{color:#7e909d;margin-left:14px}.featured h2{font-size:clamp(28px,4vw,45px);line-height:1.1;letter-spacing:-1.8px;max-width:700px;margin:25px 0 15px}.featured h2 a{color:#fff;text-decoration:none}.featured h2 a:hover{color:#8edcff}.featured>p{color:#b6c5cd;line-height:1.65;max-width:650px;margin:0}.read-button{display:inline-block;background:#29abe2;color:#fff;text-decoration:none;border-radius:6px;padding:12px 16px;font-size:13px;font-weight:600;margin-top:29px}.articles{padding-top:82px}.section-heading h2{font-size:31px;letter-spacing:-1px;margin:0}.article-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;margin-top:27px}.article-card{border-top:1px solid #c9dce5;padding:23px 0 10px}.date{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#77909e;margin:0 0 15px}.article-card h3{font-size:25px;line-height:1.18;letter-spacing:-.8px;margin:0 0 12px}.article-card h3 a{color:#0c1a27;text-decoration:none}.article-card h3 a:hover{color:#1688bb}.article-card>p:not(.date){color:#607582;line-height:1.6;max-width:470px;margin:0}.text-link{color:#1688bb;font-size:13px;font-weight:600;display:inline-block;margin-top:21px;text-decoration:none}.text-link:hover{color:#0c1a27}@media(max-width:640px){.navbar{padding:0 18px}.nav-links{gap:14px}.nav-links a:first-child{display:none}.nav-cta{padding:10px 11px}.container{padding:53px 18px 70px}.hero h1{letter-spacing:-2.5px}.featured{margin-top:52px;padding:28px 25px 31px}.articles{padding-top:60px}.article-grid{grid-template-columns:1fr;gap:35px}}
`
