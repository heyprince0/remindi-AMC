import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free Quotation Generator for Contractors India — Remindi",
  description:
    "Create a professional GST quotation PDF in minutes. Free tool for Indian contractors — Elevator, HVAC, Fire Safety, Plumbing, Electrical and more. No signup needed. Used by 500+ contractors.",
  keywords: [
    "free quotation generator India",
    "GST quotation format for contractor",
    "AMC quotation PDF download",
    "free quotation maker India",
    "quotation format for AMC contract",
    "elevator AMC quotation",
    "HVAC quotation format India",
    "contractor quotation PDF free",
    "professional quotation generator",
    "Indian contractor billing tool",
  ],
  alternates: {
    canonical: "https://www.remindi.online/free-quotation-generator",
  },
  openGraph: {
    title: "Free Quotation Generator for Contractors India — Remindi",
    description:
      "Create a professional GST quotation PDF in minutes. No signup needed. Used by 500+ Indian contractors.",
    url: "https://www.remindi.online/free-quotation-generator",
    siteName: "Remindi",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "https://www.remindi.online/og-quotation.png", // create a 1200x630 screenshot of the tool and upload it
        width: 1200,
        height: 630,
        alt: "Remindi Free Quotation Generator for Indian Contractors",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Quotation Generator for Contractors India — Remindi",
    description:
      "Create a professional GST quotation PDF in minutes. Free for Indian contractors.",
    images: ["https://www.remindi.online/og-quotation.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
}

export default function FreeQuotationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* JSON-LD Structured Data — Google reads this for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            // 1. WebApplication schema — marks this as a tool
            {
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Free Quotation Generator for Indian Contractors",
              url: "https://www.remindi.online/free-quotation-generator",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires JavaScript",
              description:
                "Create a professional GST-ready quotation PDF in minutes. Free for Indian contractors in Elevator, HVAC, Fire Safety, Plumbing, and more industries.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "INR",
              },
              creator: {
                "@type": "Organization",
                name: "Remindi",
                url: "https://www.remindi.online",
              },
            },
            // 2. FAQPage schema — makes FAQ appear directly in Google search results
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Is this quotation generator free?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes, 100% free. No signup or credit card needed. You can create and download unlimited quotation PDFs at no cost.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I add GST to my quotation?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Toggle GST on and 9% SGST + 9% CGST are auto-calculated and shown in your quotation PDF.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is my business data saved?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Your business info is saved on your own device using local storage. We do not store your quotation data on our servers.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I add my company logo to the quotation?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Upload your company logo in the Company section and it appears on both the live preview and the downloaded PDF.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is Remindi?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Remindi is an AMC (Annual Maintenance Contract) management platform built for Indian contractors. It helps you manage service contracts, technicians, reminders, and invoices — all in one place.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Can I create invoices too?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Visit remindi.online/free-invoice-generator for a free invoice generator for Indian contractors.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Which types of contractors can use this quotation generator?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "This tool is built for all Indian service contractors — Elevator / Lift, HVAC / AC, Fire Safety, Plumbing, Electrical, CCTV / Security, Pest Control, Water Purifier / RO, and more.",
                  },
                },
              ],
            },
            // 3. BreadcrumbList — helps Google show page path in search results
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Remindi",
                  item: "https://www.remindi.online",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Free Quotation Generator",
                  item: "https://www.remindi.online/free-quotation-generator",
                },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  )
}
