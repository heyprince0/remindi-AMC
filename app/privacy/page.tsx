import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-primary hover:underline font-medium text-sm">← Back to Home</Link>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          <div className="border-b border-border pb-6">
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-muted-foreground mt-2 text-sm">Effective Date: April 14, 2026 &nbsp;·&nbsp; Last Updated: April 14, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">Remindi ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use remindi.online and our Android App.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground font-medium">Information you provide:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Name, email address, phone number during registration</li>
              <li>Business name and location</li>
              <li>Client details, contract information, technician data you add to the platform</li>
            </ul>
            <p className="text-muted-foreground font-medium mt-3">Information collected automatically:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Device type, browser type, IP address</li>
              <li>Usage data such as pages visited and features used</li>
              <li>App usage analytics</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="text-muted-foreground">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Provide and improve the Remindi Service</li>
              <li>Send service reminders and alerts as part of the product</li>
              <li>Send important account and product notifications</li>
              <li>Respond to your support requests</li>
              <li>Analyze usage to improve features</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Data Storage</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Your data is stored securely on cloud servers.</li>
              <li>We implement industry-standard security measures including encryption and secure access controls.</li>
              <li>We do not store payment information on our servers.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">We do not sell, trade, or rent your personal data to third parties. We may share data only in the following cases:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>With service providers who help us operate the platform (e.g. hosting, analytics) under strict confidentiality agreements</li>
              <li>If required by law, court order, or government authority</li>
              <li>To protect the rights and safety of Remindi and its users</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Your Client's Data</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Any data you enter about your clients (names, phone numbers, addresses) is owned by you.</li>
              <li>You are responsible for obtaining appropriate consent from your clients before entering their data into Remindi.</li>
              <li>We process this data only to provide the Service to you.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">Remindi uses cookies to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Keep you logged in</li>
              <li>Remember your preferences</li>
              <li>Analyze how the Service is used</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">You can disable cookies in your browser settings, but some features may not work properly.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Android App</h2>
            <p className="text-muted-foreground">Our Android App may request the following permissions:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Notifications — to send service alerts</li>
              <li>Internet access — to sync your data</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">We do not access your contacts, camera, or location without your explicit permission.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>We retain your data as long as your account is active.</li>
              <li>If you delete your account, we will delete your data within 30 days.</li>
              <li>Some data may be retained longer if required by law.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">Remindi is not intended for use by anyone under the age of 18. We do not knowingly collect data from minors.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">11. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Access the data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="text-muted-foreground">To exercise these rights, contact us at <a href="mailto:support@remindi.online" className="text-primary hover:underline">support@remindi.online</a></p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service means you accept the updated policy.</p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-xl font-semibold text-foreground">13. Contact Us</h2>
            <p className="text-muted-foreground">If you have any questions about this Privacy Policy, contact us at:</p>
            <div className="space-y-1 text-muted-foreground">
              <p>📧 <a href="mailto:support@remindi.online" className="text-primary hover:underline">support@remindi.online</a></p>
              <p>🌐 <a href="https://remindi.online" className="text-primary hover:underline">remindi.online</a></p>
            </div>
          </section>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">© 2026 Remindi. All rights reserved.</p>
      </div>
    </div>
  )
}
