import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-primary hover:underline font-medium text-sm">← Back to Home</Link>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          <div className="border-b border-border pb-6">
            <h1 className="text-3xl font-bold text-foreground">Terms and Conditions</h1>
            <p className="text-muted-foreground mt-2 text-sm">Effective Date: April 14, 2026 &nbsp;·&nbsp; Last Updated: April 14, 2026</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">By accessing or using Remindi ("the Service") at remindi.online, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our Service.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">Remindi is an AMC (Annual Maintenance Contract) service management software designed for maintenance contractors in India. It allows users to manage clients, contracts, technicians, service schedules, alerts, and reports.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>You must notify us immediately at <a href="mailto:support@remindi.online" className="text-primary hover:underline">support@remindi.online</a> if you suspect unauthorized use.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload harmful, offensive, or misleading content</li>
              <li>Attempt to hack, reverse engineer, or disrupt the Service</li>
              <li>Share your account credentials with unauthorized persons</li>
              <li>Use the Service to spam or harass others</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Data Ownership</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>All client and business data you enter into Remindi belongs to you.</li>
              <li>We do not sell your data to third parties.</li>
              <li>You are responsible for the accuracy of data you enter.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Free Plan & Paid Plans</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Remindi offers both Free and Paid Plans with different features and usage limits.</li>
              <li>Paid Plans require payment of the applicable subscription fees.</li>
              <li>We may update our plans, pricing, or features from time to time. If significant changes are made, we will provide reasonable notice where required.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Service Availability</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>We aim to provide 99% uptime but do not guarantee uninterrupted service.</li>
              <li>We are not liable for losses caused by service downtime or technical issues.</li>
              <li>We reserve the right to modify or discontinue features at any time.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Intellectual Property</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
              <li>Remindi and its original content, features, and functionality are owned by Remindi and protected by applicable intellectual property laws.</li>
              <li>You may not copy, reproduce, or distribute any part of our Service without permission.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">Remindi shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service, including but not limited to loss of data, loss of business, or loss of revenue.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">We reserve the right to suspend or terminate your account at any time if you violate these Terms and Conditions, with or without prior notice.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">We may update these Terms at any time. Continued use of the Service after changes constitutes your acceptance of the new Terms. We will notify users of significant changes via email or in-app notification.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Pune, Maharashtra, India.</p>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-xl font-semibold text-foreground">13. Contact Us</h2>
            <p className="text-muted-foreground">For any questions regarding these Terms, contact us at:</p>
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
