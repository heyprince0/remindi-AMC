// Shared WhatsApp (wa.me) reminder messages in English, Marathi and Hindi

export type WhatsAppLanguage = "en" | "mr" | "hi"

export const DEFAULT_WHATSAPP_LANGUAGE: WhatsAppLanguage = "en"

export const WHATSAPP_LANGUAGES: { value: WhatsAppLanguage; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "mr", label: "Marathi", native: "मराठी" },
  { value: "hi", label: "Hindi", native: "हिन्दी" },
]

export function normalizeWhatsAppLanguage(value: string | null | undefined): WhatsAppLanguage {
  return value === "mr" || value === "hi" || value === "en" ? value : DEFAULT_WHATSAPP_LANGUAGE
}

export interface ReminderMessageInput {
  lang: WhatsAppLanguage
  days: number
  customerName: string
  contractName: string
  senderName: string
  lastService: string
  nextService: string
}

const FALLBACK_SENDER: Record<WhatsAppLanguage, string> = {
  en: "your service provider",
  mr: "आपला सेवा प्रदाता",
  hi: "आपके सेवा प्रदाता",
}

export function buildReminderMessage(input: ReminderMessageInput): string {
  const { lang, days, customerName, contractName, lastService, nextService } = input
  const from = input.senderName || FALLBACK_SENDER[lang]

  // ───────────── MARATHI ─────────────
  if (lang === "mr") {
    if (days < 0) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*सेवा स्मरणपत्र - कृपया लक्ष द्या*\n\n` +
        `*${from}* सोबतची तुमची *${contractName}* ची AMC सेवा लवकरच येत आहे.\n\n` +
        `*सेवा तपशील:*\n` +
        `- मागील सेवा: ${lastService}\n` +
        `- नियोजित सेवा तारीख: ${nextService}\n\n` +
        `सेवेत खंड पडू नये म्हणून कृपया तुमची उपलब्धता लवकरात लवकर कळवा.\n\n` +
        `तुमची पुढील सेवा नियोजित करण्यासाठी आता आमच्याशी संपर्क साधा.\n\n` +
        `*${from}* निवडल्याबद्दल धन्यवाद.`
      )
    }
    if (days === 0) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*आज सेवा*\n\n` +
        `तुमची *${contractName}* ची AMC सेवा आज नियोजित आहे, याची ही आठवण.\n\n` +
        `*सेवा तपशील:*\n` +
        `- मागील सेवा: ${lastService}\n` +
        `- नियोजित सेवा तारीख: ${nextService}\n\n` +
        `आमचे तंत्रज्ञ आज तुमच्याकडे येतील. कृपया जागेवर कोणीतरी उपलब्ध असेल याची खात्री करा.\n\n` +
        `काही प्रश्न असल्यास बिनधास्त आमच्याशी संपर्क साधा.\n\n` +
        `*${from}* निवडल्याबद्दल धन्यवाद.`
      )
    }
    if (days <= 3) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*येणारी सेवा स्मरणपत्र - ${days} दिवस बाकी*\n\n` +
        `तुमची ${contractName} ची पुढील AMC सेवा ${days} दिवसांत येत आहे.\n\n` +
        `*सेवा तपशील:*\n` +
        `- मागील सेवा: ${lastService}\n` +
        `- येणारी सेवा तारीख: ${nextService}\n\n` +
        `कृपया तुमची उपलब्धता कळवा, जेणेकरून आम्ही तंत्रज्ञांची भेट त्यानुसार नियोजित करू शकू.\n\n` +
        `तुमची भेट निश्चित करण्यासाठी आमच्याशी संपर्क साधा.\n\n` +
        `*${from}* निवडल्याबद्दल धन्यवाद.`
      )
    }
    return (
      `प्रिय ${customerName},\n\n` +
      `*सेवा स्मरणपत्र - ${contractName}*\n\n` +
      `*${from}* कडून तुमच्या AMC कराराबद्दल ही एक मैत्रीपूर्ण आठवण.\n\n` +
      `*सेवा तपशील:*\n` +
      `- मागील सेवा: ${lastService}\n` +
      `- पुढील सेवा तारीख: ${nextService}\n\n` +
      `तुमच्या सेवा तारखेच्या जवळ आम्ही तुमच्याशी संपर्क साधू. काही प्रश्न असल्यास किंवा वेळ बदलायची असल्यास बिनधास्त आमच्याशी संपर्क साधा.\n\n` +
      `*${from}* निवडल्याबद्दल धन्यवाद.`
    )
  }

  // ───────────── HINDI ─────────────
  if (lang === "hi") {
    if (days < 0) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*सेवा अनुस्मारक - कृपया ध्यान दें*\n\n` +
        `*${from}* के साथ आपके *${contractName}* की AMC सेवा जल्द ही आने वाली है।\n\n` +
        `*सेवा विवरण:*\n` +
        `- पिछली सेवा: ${lastService}\n` +
        `- निर्धारित सेवा तिथि: ${nextService}\n\n` +
        `सेवा में किसी रुकावट से बचने के लिए कृपया अपनी उपलब्धता जल्द से जल्द बताएं।\n\n` +
        `अपनी अगली सेवा निर्धारित करने के लिए अभी हमसे संपर्क करें।\n\n` +
        `*${from}* को चुनने के लिए धन्यवाद।`
      )
    }
    if (days === 0) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*आज सेवा*\n\n` +
        `यह आपको याद दिलाने के लिए है कि आपके *${contractName}* की AMC सेवा आज निर्धारित है।\n\n` +
        `*सेवा विवरण:*\n` +
        `- पिछली सेवा: ${lastService}\n` +
        `- निर्धारित सेवा तिथि: ${nextService}\n\n` +
        `हमारे तकनीशियन आज आपके यहां आएंगे। कृपया सुनिश्चित करें कि परिसर में कोई उपलब्ध हो।\n\n` +
        `किसी भी प्रश्न के लिए बेझिझक हमसे संपर्क करें।\n\n` +
        `*${from}* को चुनने के लिए धन्यवाद।`
      )
    }
    if (days <= 3) {
      return (
        `प्रिय ${customerName},\n\n` +
        `*आगामी सेवा अनुस्मारक - ${days} दिन शेष*\n\n` +
        `आपके ${contractName} की अगली AMC सेवा ${days} दिन में आने वाली है।\n\n` +
        `*सेवा विवरण:*\n` +
        `- पिछली सेवा: ${lastService}\n` +
        `- आगामी सेवा तिथि: ${nextService}\n\n` +
        `कृपया अपनी उपलब्धता की पुष्टि करें ताकि हम तकनीशियन की विज़िट उसी अनुसार निर्धारित कर सकें।\n\n` +
        `अपनी अपॉइंटमेंट की पुष्टि के लिए हमसे संपर्क करें।\n\n` +
        `*${from}* को चुनने के लिए धन्यवाद।`
      )
    }
    return (
      `प्रिय ${customerName},\n\n` +
      `*सेवा अनुस्मारक - ${contractName}*\n\n` +
      `यह *${from}* की ओर से आपके AMC अनुबंध के बारे में एक मित्रवत अनुस्मारक है।\n\n` +
      `*सेवा विवरण:*\n` +
      `- पिछली सेवा: ${lastService}\n` +
      `- अगली सेवा तिथि: ${nextService}\n\n` +
      `हम आपकी सेवा तिथि के करीब आपसे संपर्क करेंगे। किसी भी प्रश्न या समय बदलने के लिए बेझिझक हमसे संपर्क करें।\n\n` +
      `*${from}* को चुनने के लिए धन्यवाद।`
    )
  }

  // ───────────── ENGLISH ─────────────
  if (days < 0) {
    return (
      `Dear ${customerName},\n\n` +
      `*Service Reminder - Action Required*\n\n` +
      `Your AMC service for *${contractName}* with *${from}* is coming soon.\n\n` +
      `*Service Details:*\n` +
      `- Last Service: ${lastService}\n` +
      `- Scheduled Service Date: ${nextService}\n\n` +
      `To avoid any service disruption, please confirm your availability at the earliest.\n\n` +
      `Contact us now to get your next service scheduled.\n\n` +
      `Thank you for choosing *${from}*.`
    )
  }
  if (days === 0) {
    return (
      `Dear ${customerName},\n\n` +
      `*Today Servicing*\n\n` +
      `This is a reminder that your AMC service for *${contractName}* is scheduled for today.\n\n` +
      `*Service Details:*\n` +
      `- Last Service: ${lastService}\n` +
      `- Scheduled Service Date: ${nextService}\n\n` +
      `Our technician will be visiting you today. Please ensure someone is available at the premises.\n\n` +
      `For any queries, feel free to reach out to us.\n\n` +
      `Thank you for choosing *${from}*.`
    )
  }
  if (days <= 3) {
    return (
      `Dear ${customerName},\n\n` +
      `*Upcoming Service Reminder - ${days} Day${days > 1 ? "s" : ""} Left*\n\n` +
      `Your next AMC service for ${contractName} is coming in ${days} day${days > 1 ? "s" : ""}.\n\n` +
      `*Service Details:*\n` +
      `- Last Service: ${lastService}\n` +
      `- Upcoming Service Date: ${nextService}\n\n` +
      `Please confirm your availability so we can schedule the technician visit accordingly.\n\n` +
      `Contact us to confirm your appointment.\n\n` +
      `Thank you for choosing *${from}*.`
    )
  }
  return (
    `Dear ${customerName},\n\n` +
    `*Service Reminder - ${contractName}*\n\n` +
    `This is a friendly reminder from *${from}* regarding your AMC contract.\n\n` +
    `*Service Details:*\n` +
    `- Last Service: ${lastService}\n` +
    `- Next Service Date: ${nextService}\n\n` +
    `We will reach out closer to your service date. For any queries or to reschedule, feel free to contact us.\n\n` +
    `Thank you for choosing *${from}*.`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer greeting / follow-up message (used on the Customers page)
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerMessageInput {
  lang: WhatsAppLanguage
  customerName: string
  senderName: string
  contractCount: number
}

export function buildCustomerMessage(input: CustomerMessageInput): string {
  const { lang, customerName, contractCount } = input
  const from = input.senderName || FALLBACK_SENDER[lang]

  // ───────────── MARATHI ─────────────
  if (lang === "mr") {
    const contractLine =
      contractCount > 0
        ? `तुमच्याकडे आमच्यासोबत सध्या ${contractCount} सक्रिय AMC करार आहे${contractCount > 1 ? "त" : ""}.`
        : `तुमच्या उपकरणांसाठी AMC करार सुरू करण्यात आम्हाला आनंद होईल.`

    return (
      `प्रिय ${customerName},\n\n` +
      `*${from}* कडून नमस्कार!\n\n` +
      `${contractLine}\n\n` +
      `तुम्हाला कोणतीही सेवा, देखभाल हवी असल्यास किंवा काही प्रश्न असल्यास, या संदेशाला उत्तर द्या किंवा थेट आम्हाला कॉल करा.\n\n` +
      `*${from}* निवडल्याबद्दल धन्यवाद.`
    )
  }

  // ───────────── HINDI ─────────────
  if (lang === "hi") {
    const contractLine =
      contractCount > 0
        ? `आपके पास हमारे साथ वर्तमान में ${contractCount} सक्रिय AMC अनुबंध ${contractCount > 1 ? "हैं" : "है"}।`
        : `हम आपके उपकरणों के लिए AMC अनुबंध स्थापित करने में मदद करना चाहेंगे।`

    return (
      `प्रिय ${customerName},\n\n` +
      `*${from}* की ओर से नमस्कार!\n\n` +
      `${contractLine}\n\n` +
      `अगर आपको कोई सेवा, रखरखाव चाहिए या कोई सवाल है, तो इस संदेश का जवाब दें या सीधे हमें कॉल करें।\n\n` +
      `*${from}* को चुनने के लिए धन्यवाद।`
    )
  }

  // ───────────── ENGLISH ─────────────
  const contractLine =
    contractCount > 0
      ? `You currently have ${contractCount} active AMC contract${contractCount > 1 ? "s" : ""} with us.`
      : `We'd love to help you set up an AMC contract for your equipment.`

  return (
    `Dear ${customerName},\n\n` +
    `Greetings from *${from}*!\n\n` +
    `${contractLine}\n\n` +
    `If you need any service, maintenance, or have any questions, feel free to reply to this message or call us directly.\n\n` +
    `Thank you for choosing *${from}*.`
  )
}
