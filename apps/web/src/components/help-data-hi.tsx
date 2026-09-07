import React from "react";
import {
  BarChartIcon,
  CheckCircleIcon,
  CompareIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  LockIcon,
  ScaleIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "@/components/icons";
import type { HelpArticle, FaqItem, HelpNavGroup } from "./help-data";

export const HELP_NAV_GROUPS_HI: HelpNavGroup[] = [
  {
    label: "शुरुआत करें",
    items: [
      {
        id: "getting-started",
        label: "शुरुआत करें",
        icon: HomeIcon,
        description: "प्लेटफ़ॉर्म अवलोकन, अपलोड कार्यप्रवाह और दस्तावेज़ स्थितियां",
      },
      {
        id: "ai-copilot",
        label: "डैशबोर्ड एवं एआई कोपायलट",
        icon: SparklesIcon,
        description: "दस्तावेज़-आधारित चैट, सुझाए गए संकेत और उद्धरण",
      },
      {
        id: "documents",
        label: "दस्तावेज़",
        icon: UploadCloudIcon,
        description: "संग्रहण, प्रसंस्करण चरण और दस्तावेज़ जीवनचक्र",
      },
      {
        id: "compare",
        label: "दस्तावेज़ तुलना",
        icon: CompareIcon,
        description: "अनुबंध रेडलाइनिंग, अंतर मेट्रिक्स और जोखिम प्रक्षेपवक्र",
      },
      {
        id: "reports",
        label: "रिपोर्ट्स",
        icon: BarChartIcon,
        description: "कार्यकारी खुफिया ब्रीफ, जोखिम स्कोरिंग और PDF निर्यात",
      },
    ],
  },
  {
    label: "लीगल एआई विशेषताएं",
    items: [
      {
        id: "analysis",
        label: "दस्तावेज़ विश्लेषण",
        icon: FileTextIcon,
        description: "24-खंड कानूनी विवरण, जोखिम, अनुबंध नियम और अनुपस्थित शर्तें",
      },
      {
        id: "ai-analysis",
        label: "एआई एवं विश्लेषण",
        icon: SparklesIcon,
        description: "जेमिनी मॉडल, तापमान और सख्त शून्य-भ्रम ग्राउंडिंग",
      },
      {
        id: "workspaces",
        label: "अधिवक्ता एवं क्लाइंट कार्यक्षेत्र",
        icon: CheckCircleIcon,
        description: "भूमिका नेविगेशन और उपलब्ध क्षमताएं",
      },
      {
        id: "legal-research",
        label: "कानूनी अनुसंधान",
        icon: ScaleIcon,
        description: "वैधानिक प्रावधान, पुराना कानून ↔ वर्तमान कानून संक्रमण और सर्वोच्च न्यायालय की नजीरें",
      },
    ],
  },
  {
    label: "सहायता एवं संदर्भ",
    items: [
      {
        id: "privacy",
        label: "गोपनीयता एवं सुरक्षा",
        icon: LockIcon,
        description: "टेनेंसी पृथक्करण, केवल अस्थाई मेमोरी में पासवर्ड और डेटा सुरक्षा",
      },
      {
        id: "troubleshooting",
        label: "समस्या निवारण",
        icon: ShieldAlertIcon,
        description: "अपलोड, अनलॉक, विश्लेषण और एपीआई समस्याओं का समाधान",
      },
      {
        id: "faq",
        label: "अक्सर पूछे जाने वाले प्रश्न",
        icon: HelpCircleIcon,
        description: "सामान्य प्रश्न और सत्यापित उत्तर",
      },
    ],
  },
];

export const HELP_FAQS_HI: FaqItem[] = [
  {
    id: "faq-1",
    question: "कौन से फ़ाइल प्रारूप समर्थित हैं?",
    category: "getting-started",
    answer: (
      <p>
        LegalAI वर्तमान में <strong>PDF (.pdf)</strong> (पासवर्ड-संरक्षित PDF सहित), <strong>Word दस्तावेज़ (.docx)</strong>, और <strong>सादा पाठ फ़ाइलें (.txt)</strong> का समर्थन करता है। अपलोड की गई फ़ाइलों का आकार 50 MB से कम होना चाहिए।
      </p>
    ),
    tags: ["file types", "pdf", "docx", "txt", "format", "upload", "size limit"],
  },
  {
    id: "faq-2",
    question: "मैं कानूनी दस्तावेज़ कैसे अपलोड करूँ?",
    category: "documents",
    answer: (
      <p>
        आप <strong>दस्तावेज़</strong> अनुभाग में जाकर या अपने <strong>डैशबोर्ड</strong> पर त्वरित अपलोड विजेट का उपयोग करके दस्तावेज़ अपलोड कर सकते हैं। अपनी फ़ाइल को निर्दिष्ट अपलोड क्षेत्र में खींचें और छोड़ें, या <strong>फ़ाइलें ब्राउज़ करें</strong> पर क्लिक करें। अपलोड होने के बाद, दस्तावेज़ स्वचालित रूप से संसाधित होना शुरू हो जाता है।
      </p>
    ),
    tags: ["upload", "documents", "dashboard", "browse", "drag and drop"],
  },
  {
    id: "faq-3",
    question: "क्या LegalAI पासवर्ड-संरक्षित PDF को प्रोसेस कर सकता है?",
    category: "getting-started",
    answer: (
      <p>
        हाँ। जब आप पासवर्ड-संरक्षित PDF अपलोड करते हैं, तो LegalAI एन्क्रिप्शन का पता लगाता है और <strong>पासवर्ड-संरक्षित PDF</strong> प्रॉम्प्ट प्रदर्शित करता है। सही पासवर्ड दर्ज करने के बाद, दस्तावेज़ अनलॉक हो जाता है और आपके कार्यक्षेत्र में <strong>तैयार</strong> स्थिति के साथ प्रोसेस हो जाता है।
      </p>
    ),
    tags: ["password", "protected", "pdf", "encryption", "unlock"],
  },
  {
    id: "faq-4",
    question: "क्या LegalAI मेरा PDF पासवर्ड संग्रहीत करता है?",
    category: "privacy",
    answer: (
      <p>
        <strong>नहीं।</strong> PDF पासवर्ड का उपयोग केवल अस्थायी डिक्रिप्शन और टेक्स्ट निष्कर्षण चरण के दौरान अस्थाई मेमोरी (RAM) में किया जाता है। पासवर्ड कभी भी डेटाबेस में संग्रहीत नहीं किया जाता, कभी लॉग नहीं किया जाता, और कभी भी किसी API प्रतिक्रिया में शामिल नहीं होता है।
      </p>
    ),
    tags: ["password", "security", "privacy", "storage", "pdf"],
  },
  {
    id: "faq-5",
    question: "क्या मैं अपने दस्तावेज़ के बारे में प्रश्न पूछ सकता हूँ?",
    category: "ai-copilot",
    answer: (
      <p>
        हाँ! <strong>एआई कोपायलट</strong> में (डैशबोर्ड पर या व्यक्तिगत चैट सत्रों में सुलभ), संदर्भ बार से किसी भी अपलोड किए गए दस्तावेज़ का चयन करें। इसके बाद आप प्राकृतिक भाषा में प्रश्न पूछ सकते हैं, सुझाए गए प्रॉम्प्ट्स पर क्लिक कर सकते हैं और उद्धृत स्रोत अनुभागों के साथ दस्तावेज़ पर आधारित उत्तर प्राप्त कर सकते हैं।
      </p>
    ),
    tags: ["chat", "ai", "copilot", "ask", "questions", "grounding"],
  },
  {
    id: "faq-6",
    question: "क्या मैं दो दस्तावेज़ों की तुलना कर सकता हूँ?",
    category: "compare",
    answer: (
      <p>
        हाँ। दो अनुबंध संस्करणों (जैसे मूल मसौदा बनाम संशोधित मसौदा) की तुलना करने के लिए <strong>तुलना करें</strong> पृष्ठ पर जाएँ। आप या तो नई फ़ाइलें अपलोड कर सकते हैं या कार्यक्षेत्र से मौजूदा दस्तावेज़ चुन सकते हैं। LegalAI जोड़े गए, हटाए गए और संशोधित खंडों की पहचान करता है, जोखिम प्रभाव का मूल्यांकन करता है, और तुलनात्मक रेडलाइन प्रस्तुत करता है।
      </p>
    ),
    tags: ["compare", "redline", "diff", "clauses", "versions"],
  },
  {
    id: "faq-7",
    question: "मैं एक ही दस्तावेज़ की दो बार तुलना क्यों नहीं कर सकता?",
    category: "compare",
    answer: (
      <p>
        तुलना की रूपरेखा अलग-अलग मसौदों या समझौतों के बीच सार्थक कानूनी अंतर का पता लगाने के लिए बनाई गई है। यदि दोनों स्लॉट एक ही दस्तावेज़ की ओर संकेत करते हैं, तो LegalAI संदेश प्रदर्शित करता है <em>&quot;कृपया तुलना करने के लिए दो अलग-अलग दस्तावेज़ चुनें।&quot;</em> और अनावश्यक गणना को रोकने के लिए तुलना बटन को निष्क्रिय रखता है।
      </p>
    ),
    tags: ["compare", "same document", "duplicate", "warning", "disabled"],
  },
  {
    id: "faq-8",
    question: "उच्च जोखिम (High Risk) का क्या अर्थ है?",
    category: "analysis",
    answer: (
      <p>
        <strong>उच्च जोखिम (High Risk)</strong> या <strong>गंभीर जोखिम (Critical Risk)</strong> वर्गीकरण ऐसे खंडों की उपस्थिति को इंगित करता है जो व्यावसायिक दायित्व को स्थानांतरित कर सकते हैं, असीमित क्षतिपूर्ति लगा सकते हैं, एकतरफा समाप्ति अधिकार दे सकते हैं, या वैधानिक सुरक्षा उपायों को छोड़ सकते हैं। निष्कर्षों की हमेशा एक पेशेवर वकील द्वारा समीक्षा की जानी चाहिए।
      </p>
    ),
    tags: ["risk", "high risk", "critical", "classification", "liability"],
  },
  {
    id: "faq-9",
    question: "क्या मैं रिपोर्ट निर्यात कर सकता हूँ?",
    category: "reports",
    answer: (
      <p>
        हाँ। <strong>रिपोर्ट्स</strong> पृष्ठ पर, प्रत्येक पूर्ण रिपोर्ट में <strong>PDF निर्यात करें</strong> बटन शामिल है जो आपके ब्राउज़र के स्वरूपित प्रिंट और PDF जनरेशन दृश्य को सक्रिय करता है। आप तुलना पृष्ठ से सीधे <strong>सारांश निर्यात करें</strong> का उपयोग करके तुलनात्मक पाठ सारांश भी निर्यात कर सकते हैं।
      </p>
    ),
    tags: ["export", "pdf", "reports", "print", "download"],
  },
  {
    id: "faq-10",
    question: "'प्रदान किए गए दस्तावेज़ में नहीं मिला' का क्या अर्थ है?",
    category: "ai-copilot",
    answer: (
      <p>
        LegalAI पूरी तरह से स्रोत-आधारित है। यदि आपका प्रश्न ऐसी शर्तों, प्रावधानों या संस्थाओं के बारे में पूछता है जो चयनित अनुबंध में कहीं भी मौजूद नहीं हैं, तो AI स्पष्ट रूप से कहता है कि जानकारी नहीं मिली। यह आपको AI भ्रम (hallucination) से बचाता है और यह सुनिश्चित करता है कि उत्तर केवल अनुबंध के तथ्यों पर निर्भर हैं।
      </p>
    ),
    tags: ["not found", "grounding", "chat", "evidence", "hallucination"],
  },
  {
    id: "faq-11",
    question: "क्या LegalAI किसी वकील का विकल्प है?",
    category: "workspaces",
    answer: (
      <p>
        <strong>नहीं।</strong> LegalAI दस्तावेज़ समीक्षा में तेज़ी लाने, संभावित जोखिमों को चिह्नित करने और तुलना को सुव्यवस्थित करने के लिए बनाया गया एक सहायक साधन है। AI द्वारा तैयार निष्कर्षों की समीक्षा एक योग्य कानूनी पेशेवर द्वारा की जानी चाहिए और इसे औपचारिक कानूनी प्रतिनिधित्व का विकल्प नहीं माना जाना चाहिए।
      </p>
    ),
    tags: ["disclaimer", "replacement", "lawyer", "advice", "attorney"],
  },
  {
    id: "faq-12",
    question: "यदि कोई जानकारी गलत लगे तो मुझे क्या करना चाहिए?",
    category: "troubleshooting",
    answer: (
      <p>
        आप एक नया, व्यापक मूल्यांकन चलाने के लिए विश्लेषण पृष्ठ पर <strong>दस्तावेज़ का पुनः विश्लेषण करें</strong> विकल्प का उपयोग कर सकते हैं। यदि कोई त्रुटि बनी रहती है, तो सत्यापित करें कि दस्तावेज़ <strong>तैयार</strong> स्थिति में है और <strong>समस्या निवारण</strong> गाइड से परामर्श लें।
      </p>
    ),
    tags: ["incorrect", "re-analyze", "troubleshooting", "error", "accuracy"],
  },
];

export const HELP_ARTICLES_HI: HelpArticle[] = [
  // 1. Getting Started
  {
    id: "what-is-legalai",
    category: "getting-started",
    title: "1. LegalAI क्या है?",
    summary: "LegalAI की मुख्य क्षमताओं, दस्तावेज़ समीक्षा इंजन और कार्यक्षेत्र का अवलोकन।",
    tags: ["overview", "ai", "legalai", "getting started", "features"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI कानूनी सलाहकारों, वकीलों और मुवक्किलों को उच्च गति और सटीकता के साथ कानूनी समझौतों की समीक्षा करने में सहायता के लिए डिज़ाइन किया गया एक उद्यम-स्तरीय AI कानूनी कोपायलट है:
        </p>
        <ul className="help-article-points">
          <li><strong>स्रोत-आधारित AI कोपायलट:</strong> अनुभागों और पृष्ठ संख्याओं के सटीक उद्धरणों के साथ किसी भी अनुबंध के बारे में प्रश्न पूछें।</li>
          <li><strong>संरचित 24-खंड कानूनी विश्लेषण:</strong> प्रमुख खंडों, दायित्वों, देनदारी सीमाओं और कमियों का स्वचालित निष्कर्षण।</li>
          <li><strong>नियतात्मक जोखिम स्कोरिंग:</strong> निकाले गए निष्कर्षों से सीधे प्राप्त विश्वसनीय जोखिम वर्गीकरण (गंभीर, उच्च, मध्यम, निम्न)।</li>
          <li><strong>दस्तावेज़ों की आमने-सामने तुलना:</strong> अनुबंध मसौदों के बीच जोड़े गए, हटाए गए और संशोधित खंडों को ट्रैक करें।</li>
          <li><strong>कार्यकारी कानूनी रिपोर्ट्स:</strong> आंतरिक समीक्षा या क्लाइंट प्रस्तुति के लिए निर्यात योग्य PDF सारांश।</li>
        </ul>
      </>
    ),
  },
  {
    id: "uploading-documents",
    category: "getting-started",
    title: "2. कानूनी दस्तावेज़ अपलोड करना",
    summary: "समर्थित प्रारूप, आकार सीमाएँ और प्रसंस्करण कार्यप्रवाह।",
    tags: ["upload", "documents", "pdf", "docx", "txt", "processing", "workspace"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI 50 MB तक के मानक कानूनी दस्तावेज़ प्रारूपों का समर्थन करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>PDF (.pdf):</strong> मानक PDF के साथ-साथ पासवर्ड-एन्क्रिप्टेड PDF।</li>
          <li><strong>Word दस्तावेज़ (.docx):</strong> Microsoft Word कानूनी मसौदे।</li>
          <li><strong>सादा पाठ (.txt):</strong> ASCII / UTF-8 स्वरूपित पाठ दस्तावेज़।</li>
        </ul>
        <div className="help-callout help-callout-info">
          <SparklesIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>प्रसंस्करण पाइपलाइन:</strong> अपलोड होने पर दस्तावेज़ पार्स, चंक और एम्बेड किए जाते हैं। प्रसंस्करण पूरा होने पर स्थिति <strong>तैयार</strong> में बदल जाती है, जिससे यह चैट, विश्लेषण और तुलना के लिए तुरंत उपलब्ध हो जाता है।
          </div>
        </div>
      </>
    ),
  },
  {
    id: "password-protected-pdfs",
    category: "getting-started",
    title: "3. पासवर्ड-संरक्षित PDF",
    summary: "एन्क्रिप्टेड दस्तावेज़ों का सुरक्षित संचालन और प्रसंस्करण।",
    tags: ["password", "protected", "pdf", "security", "unlock", "encryption"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI सुरक्षा से समझौता किए बिना पासवर्ड-संरक्षित PDF का सुरक्षित समर्थन करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>स्वचालित पहचान:</strong> एन्क्रिप्टेड PDF अपलोड होने पर सिस्टम पासवर्ड सुरक्षा का पता लगाता है और पासवर्ड दर्ज करने का अनुरोध करता है।</li>
          <li><strong>इन-मेमोरी अनलॉक:</strong> आपका पासवर्ड केवल डिक्रिप्शन और टेक्स्ट निष्कर्षण के दौरान अस्थायी मेमोरी में उपयोग किया जाता है। इसे कभी भी डिस्क या डेटाबेस पर नहीं लिखा जाता।</li>
          <li><strong>त्वरित स्थिति परिवर्तन:</strong> सही पासवर्ड दर्ज करने पर निष्कर्षण पूरा होता है और दस्तावेज़ <strong>तैयार</strong> स्थिति में प्रवेश करता है।</li>
          <li><strong>पुनः प्रयास सुरक्षा:</strong> यदि गलत पासवर्ड दर्ज किया जाता है, तो त्रुटि संदेश प्रदर्शित होता है और पुनः प्रयास की अनुमति मिलती है।</li>
        </ul>
      </>
    ),
  },
  {
    id: "document-statuses",
    category: "getting-started",
    title: "4. दस्तावेज़ स्थितियों को समझना",
    summary: "LegalAI में दस्तावेज़ जीवनचक्र की सभी स्थितियों की परिभाषाएँ।",
    tags: ["status", "uploading", "processing", "ready", "failed", "password_required"],
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>अपलोडिंग (UPLOADING)</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>फ़ाइल सुरक्षित सर्वर स्टोरेज में स्थानांतरित की जा रही है।</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>प्रक्रियाधीन (PROCESSING)</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>पाठ निष्कर्षण, कानूनी चंकिंग और अर्थ संबंधी एम्बेडिंग सक्रिय रूप से चल रहे हैं।</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>तैयार (READY)</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>निष्कर्षण पूर्ण। एआई चैट, विश्लेषण, तुलना और रिपोर्ट के लिए पूरी तरह तैयार।</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>पासवर्ड आवश्यक (PASSWORD REQUIRED)</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>एन्क्रिप्टेड PDF को डिक्रिप्ट करने के लिए उपयोगकर्ता के पासवर्ड इनपुट की प्रतीक्षा है।</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>विफल (FAILED)</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>फ़ाइल दूषित या अपठनीय थी। इसे हटाकर पुनः अपलोड किया जा सकता है।</span>
        </div>
      </div>
    ),
  },

  // 2. AI Copilot / Chat
  {
    id: "ai-copilot-asking",
    category: "ai-copilot",
    title: "प्रश्न पूछना एवं ग्राउंडिंग",
    summary: "AI Copilot के साथ संवाद कैसे करें और स्रोत उद्धरणों की व्याख्या कैसे करें।",
    tags: ["chat", "copilot", "grounding", "citations", "evidence", "disclaimer", "ai"],
    content: (
      <>
        <p className="help-article-desc">
          एआई कोपायलट आपको संवादात्मक रूप से अनुबंधों का परीक्षण करने की अनुमति देता है। यह संदर्भ बार में चयनित सक्रिय दस्तावेज़ पर आधारित है।
        </p>
        <ul className="help-article-points">
          <li><strong>सुझाए गए प्रश्न:</strong> त्वरित उत्तर प्राप्त करने के लिए पूर्व-निर्मित संकेतों (जैसे <em>&quot;समाप्ति की शर्तें क्या हैं?&quot;</em> या <em>&quot;देनदारी सीमाओं का सारांश दें&quot;</em>) पर क्लिक करें।</li>
          <li><strong>साक्ष्य एवं उद्धरण:</strong> उत्तर अनुबंध के विशिष्ट खंडों और पृष्ठ संख्याओं को उद्धरण के रूप में उजागर करते हैं।</li>
          <li><strong>&quot;प्रदान किए गए दस्तावेज़ में नहीं मिला&quot;:</strong> यदि कोई प्रश्न अनुबंध में अनुपस्थित विषयों के बारे में पूछता है, तो मॉडल अनुमान लगाने के बजाय स्पष्ट रूप से बताता है कि जानकारी अनुपस्थित है।</li>
          <li><strong>नई चैट एवं सत्र:</strong> एक नया सत्र शुरू करने के लिए साइडबार में <strong>नई चैट</strong> पर क्लिक करें। किसी चैट को हटाने से केवल बातचीत का इतिहास हटता है, अपलोड किया गया दस्तावेज़ सुरक्षित रहता है।</li>
        </ul>
        <div className="help-callout help-callout-warning">
          <ShieldAlertIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>कानूनी अस्वीकरण:</strong> AI-जनरेटेड जानकारी की समीक्षा एक योग्य कानूनी पेशेवर द्वारा की जानी चाहिए।
          </div>
        </div>
      </>
    ),
  },

  // 3. Document Analysis
  {
    id: "document-analysis-guide",
    category: "analysis",
    title: "24-खंड कानूनी विश्लेषण",
    summary: "व्यापक अनुबंध विश्लेषण और जोखिम मूल्यांकन का मार्गदर्शन।",
    tags: ["analysis", "clauses", "risks", "covenants", "gaps", "re-analyze"],
    content: (
      <>
        <p className="help-article-desc">
          दस्तावेज़ विश्लेषण 24 मानक कानूनी श्रेणियों में समझौतों का मूल्यांकन करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>अवलोकन एवं सारांश:</strong> अनुबंध प्रकार, शासी कानून, पक्ष, अवधि और कार्यकारी सारांश।</li>
          <li><strong>जोखिम मूल्यांकन:</strong> कानूनी देनदारियों को गंभीर, उच्च, मध्यम और निम्न गंभीरता में वर्गीकृत करता है।</li>
          <li><strong>खंड एवं शर्तें:</strong> गोपनीयता, क्षतिपूर्ति, देनदारी सीमा और वारंटी का शब्दशः विश्लेषण।</li>
          <li><strong>अनुबंध नियम एवं सुरक्षात्मक उपाय:</strong> सकारात्मक और नकारात्मक नियम, ऑडिट अधिकार और उपचार।</li>
          <li><strong>अनुपस्थित शर्तें एवं कमियां:</strong> अनुबंध में छूटे हुए सुरक्षात्मक खंडों (जैसे पारस्परिक क्षतिपूर्ति, फ़ोर्स मेज्योर) को चिह्नित करता है।</li>
          <li><strong>दस्तावेज़ का पुनः विश्लेषण:</strong> <strong>पुनः विश्लेषण करें</strong> पर क्लिक करने से ताज़ा जेमिनी मूल्यांकन शुरू होता है।</li>
        </ul>
      </>
    ),
  },

  // 4. Compare Documents
  {
    id: "compare-documents-guide",
    category: "compare",
    title: "अनुबंधों एवं संस्करणों की तुलना करना",
    summary: "आमने-सामने रेडलाइनिंग, जोखिम प्रक्षेपवक्र और दस्तावेज़ प्रतिस्थापन।",
    tags: ["compare", "redline", "diff", "replace", "clauses", "versions"],
    content: (
      <>
        <p className="help-article-desc">
          <strong>तुलना करें</strong> पृष्ठ आपको दो अनुबंधों (जैसे मूल मसौदा बनाम संशोधित मसौदा) की तुलना करने की सुविधा देता है:
        </p>
        <ul className="help-article-points">
          <li><strong>स्लॉट चयन एवं प्रतिस्थापन:</strong> नई फ़ाइलें अपलोड करें या मौजूदा दस्तावेज़ चुनें। प्रत्येक स्लॉट में एक स्वतंत्र <strong>[बदलें]</strong> बटन होता है।</li>
          <li><strong>अंतर वर्गीकरण:</strong> <strong>जोड़े गए</strong>, <strong>हटाए गए</strong>, <strong>संशोधित</strong> और <strong>अपरिवर्तित</strong> खंडों की पहचान।</li>
          <li><strong>जोखिम अंतर (Risk Delta):</strong> केवल सतही शब्द गणना के बजाय अनुबंध परिवर्तनों के व्यावसायिक और कानूनी प्रभाव को मापता है।</li>
          <li><strong>आमने-सामने रेडलाइन:</strong> अनुभाग शीर्षकों और पृष्ठ उद्धरणों के साथ अंशों की तुलना करता है।</li>
        </ul>
        <div className="help-callout help-callout-warning">
          <ShieldAlertIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>समान दस्तावेज़ प्रतिबंध:</strong> यदि दोनों स्लॉट में एक ही दस्तावेज़ शामिल है, तो तुलना शुरू नहीं की जा सकती।
          </div>
        </div>
      </>
    ),
  },

  // 5. Reports
  {
    id: "reports-guide",
    category: "reports",
    title: "कार्यकारी रिपोर्ट्स एवं जोखिम स्कोरिंग",
    summary: "खुफिया ब्रीफ तैयार करना, जोखिम स्तरों को समझना और PDF निर्यात करना।",
    tags: ["reports", "risk score", "critical", "high", "medium", "low", "export", "pdf"],
    content: (
      <>
        <p className="help-article-desc">
          <strong>रिपोर्ट्स</strong> अनुभाग प्रकाशन-तैयार कार्यकारी कानूनी खुफिया ब्रीफ तैयार करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>नियतात्मक जोखिम स्कोरिंग:</strong> समग्र जोखिम वर्गीकरण एक सूत्र पर आधारित है (गंभीर = 10 अंक, उच्च = 5 अंक, मध्यम = 2 अंक, निम्न = 1 अंक)।</li>
          <li><strong>वर्गीकरण स्तर:</strong>
            <ul style={{ marginTop: "4px", paddingLeft: "16px" }}>
              <li><strong style={{ color: "#ef4444" }}>गंभीर (CRITICAL):</strong> गंभीर देनदारी या संरचनात्मक जोखिम जिसके लिए तत्काल पुनः प्रारूपण की आवश्यकता है।</li>
              <li><strong style={{ color: "#f87171" }}>उच्च जोखिम (HIGH RISK):</strong> महत्वपूर्ण अनियंत्रित व्यावसायिक जोखिम या एकतरफा क्षतिपूर्ति।</li>
              <li><strong style={{ color: "#fbbf24" }}>मध्यम जोखिम (MEDIUM RISK):</strong> मानक व्यावसायिक प्रावधान जिनमें समायोजन या स्पष्टीकरण की आवश्यकता है।</li>
              <li><strong style={{ color: "#34d399" }}>निम्न जोखिम (LOW RISK):</strong> न्यूनतम वित्तीय या कानूनी जोखिम वाली मामूली अस्पष्टताएं।</li>
            </ul>
          </li>
          <li><strong>PDF निर्यात करें:</strong> स्वरूपित मुद्रण या PDF सहेजने के लिए <strong>PDF निर्यात करें</strong> पर क्लिक करें।</li>
          <li><strong>विश्लेषण देखें:</strong> गहन निरीक्षण के लिए सीधे पूर्ण 24-खंड विश्लेषण दृश्य पर जाएँ।</li>
        </ul>
      </>
    ),
  },

  // 6. Documents Management
  {
    id: "document-management-guide",
    category: "documents",
    title: "दस्तावेज़ जीवनचक्र एवं प्रबंधन",
    summary: "अपलोड प्रबंधित करना, विवरण देखना और विलोपन सीमाओं को समझना।",
    tags: ["documents", "management", "delete", "storage", "lifecycle", "account"],
    content: (
      <>
        <p className="help-article-desc">
          <strong>दस्तावेज़</strong> अनुभाग आपके अपलोड किए गए समझौतों के केंद्रीय भंडार के रूप में कार्य करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>दस्तावेज़ विवरण एवं संस्करण:</strong> निकाला गया पाठ, चंक गणना, फ़ाइल आकार और अपलोड टाइमस्टैम्प देखें।</li>
          <li><strong>विश्लेषण ट्रिगर करें:</strong> दस्तावेज़ पंक्ति या विवरण कार्ड से सीधे कानूनी विश्लेषण शुरू करें।</li>
          <li><strong>दस्तावेज़ हटाना:</strong> किसी दस्तावेज़ को हटाने से फ़ाइल स्टोरेज से हट जाती है और उसके चंक और एम्बेडिंग साफ़ हो जाते हैं। यह चैट सत्र हटाने से अलग है।</li>
        </ul>
      </>
    ),
  },

  // 7. AI & Analysis
  {
    id: "ai-analysis-guide",
    category: "ai-analysis",
    title: "एआई मॉडल, ग्राउंडिंग एवं विश्लेषण सेटिंग्स",
    summary: "जेमिनी मॉडल अनुमान, तापमान नियंत्रण और प्रॉम्प्ट ग्राउंडिंग को समझना।",
    tags: ["ai", "gemini", "temperature", "tokens", "grounding", "risk", "settings"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI सुसंगत कानूनी विश्लेषण के लिए शून्य-तापमान नियतात्मक मापदंडों के साथ कॉन्फ़िगर किए गए Gemini मॉडलों का उपयोग करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>दस्तावेज़-ग्राउंडिंग इंजन:</strong> प्रत्येक उत्तर सामान्य वेब यादों के बजाय सीधे पार्स किए गए अनुबंध पाठ से संश्लेषित होता है।</li>
          <li><strong>अनुमान तापमान:</strong> तथ्यात्मक सटीकता और गैर-भ्रम मूल्यांकन को प्राथमिकता देने के लिए 0.0–0.2 पर बनाए रखा गया है।</li>
          <li><strong>खंड निष्कर्षण:</strong> सटीक उद्धरण कानूनी व्याकरण, क्रॉस-संदर्भ और वैधानिक वाक्यांशों को सुरक्षित रखते हैं।</li>
        </ul>
      </>
    ),
  },

  // 8. Workspaces
  {
    id: "lawyer-client-workspaces",
    category: "workspaces",
    title: "अधिवक्ता बनाम क्लाइंट कार्यक्षेत्र",
    summary: "LegalAI में भूमिका-विशिष्ट नेविगेशन और उपलब्ध क्षमताएं।",
    tags: ["workspaces", "lawyer", "client", "roles", "navigation", "research", "dashboard"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI आपकी सौंपी गई भूमिका के आधार पर नेविगेशन अनुभव तैयार करता है:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px", color: "#60a5fa", fontSize: "14px" }}>अधिवक्ता कार्यक्षेत्र (Lawyer Workspace)</h4>
            <ul className="help-article-points" style={{ paddingLeft: "16px" }}>
              <li><strong>डैशबोर्ड:</strong> एकीकृत एआई कोपायलट और त्वरित दस्तावेज़ इनटेक।</li>
              <li><strong>दस्तावेज़:</strong> पूर्ण दस्तावेज़ रिपॉजिटरी प्रबंधन।</li>
              <li><strong>तुलना:</strong> अनुबंध संस्करणों की रेडलाइन तुलना।</li>
              <li><strong>विश्लेषण:</strong> पूर्ण 24-खंड कानूनी विवरण।</li>
              <li><strong>कानूनी अनुसंधान:</strong> वैधानिक और केस कानून अनुसंधान।</li>
              <li><strong>रिपोर्ट्स:</strong> कार्यकारी ब्रीफ और PDF निर्यात।</li>
            </ul>
          </div>
          <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px", color: "#c084fc", fontSize: "14px" }}>क्लाइंट कार्यक्षेत्र (Client Workspace)</h4>
            <ul className="help-article-points" style={{ paddingLeft: "16px" }}>
              <li><strong>डैशबोर्ड:</strong> अनुबंध खुफिया अवलोकन और एआई कोपायलट।</li>
              <li><strong>दस्तावेज़:</strong> क्लाइंट समझौतों को अपलोड और समीक्षा करें।</li>
              <li><strong>तुलना:</strong> वाणिज्यिक अनुबंध शर्तों की तुलना करें।</li>
              <li><strong>रिपोर्ट्स:</strong> कार्यकारी सारांश और जोखिम विवरण।</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },

  // 9. Legal Research
  {
    id: "legal-research-guide",
    category: "legal-research",
    title: "सत्यापित स्रोत-आधारित कानूनी अनुसंधान इंजन",
    summary: "वैधानिक प्रावधानों, पुराने कानून ↔ वर्तमान कानून संक्रमणों और सर्वोच्च न्यायालय के निर्णयों की खोज।",
    tags: ["legal research", "bns", "ipc", "crpc", "bnss", "judgments", "supreme court", "precedents", "statutes"],
    content: (
      <>
        <p className="help-article-desc">
          <strong>कानूनी अनुसंधान</strong> कार्यक्षेत्र भारतीय दंड कानूनों, दीवानी विवाद संहिताओं और सर्वोच्च न्यायालय की नज़ीरों में स्रोत-आधारित कानूनी बुद्धिमत्ता प्रदान करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>प्राकृतिक भाषा एवं हिंग्लिश खोज:</strong> प्राकृतिक प्रश्न दर्ज करें जैसे <em>&quot;IPC Section 300&quot;</em>, <em>&quot;Section 138 NI Act&quot;</em>, या <em>&quot;dhokhadhadi fraud 420&quot;</em> या <em>&quot;property kabja trespass&quot;</em>।</li>
          <li><strong>पुराना कानून ↔ वर्तमान कानून संक्रमण:</strong> औपनिवेशिक युग की संहिताओं (IPC 1860, CrPC 1973, IEA 1872) और नए अधिनियमों (BNS 2023, BNSS 2023, BSA 2023) के बीच आधिकारिक मैपिंग।</li>
          <li><strong>संभावित प्रासंगिक प्रावधान:</strong> वैधानिक प्रभावों और आवश्यक तत्वों के साथ बहु-कानून पहचान।</li>
          <li><strong>नज़ीर खोजक (Precedent Finder):</strong> समर्थन करने वाले निर्णयों को विपरीत निर्णयों से अलग करने वाला द्वि-स्तंभ वर्गीकरण।</li>
          <li><strong>शून्य-भ्रम गारंटी:</strong> बिना किसी काल्पनिक उद्धरण के आधिकारिक सुप्रीम कोर्ट और इंडिया कोड रजिस्ट्रियों के सीधे लिंक।</li>
        </ul>
      </>
    ),
  },

  // 10. Privacy & Security
  {
    id: "privacy-security-guide",
    category: "privacy",
    title: "गोपनीयता, टेनेंसी एवं डेटा सुरक्षा",
    summary: "LegalAI आपके कानूनी दस्तावेज़ों और संवेदनशील जानकारी की सुरक्षा कैसे करता है।",
    tags: ["privacy", "security", "tenancy", "rbac", "passwords", "storage", "account"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI सख्त पहुंच नियंत्रण और पृथक भंडारण लागू करता है:
        </p>
        <ul className="help-article-points">
          <li><strong>कार्यक्षेत्र टेनेंसी:</strong> दस्तावेज़ और चैट सत्र प्रमाणीकृत उपयोगकर्ता और कार्यक्षेत्र टेनेंसी द्वारा विभाजित होते हैं।</li>
          <li><strong>पासवर्ड संग्रहण नहीं:</strong> संरक्षित PDF के पासवर्ड केवल निष्कर्षण के दौरान अस्थाई मेमोरी में रखे जाते हैं और कभी भी सहेजे नहीं जाते।</li>
          <li><strong>सुरक्षित बैकएंड स्टोरेज:</strong> दस्तावेज़ एप्लिकेशन के कॉन्फ़िगर किए गए सुरक्षित रिपॉजिटरी में संग्रहीत होते हैं।</li>
          <li><strong>सतर्क जानकारी साझाकरण:</strong> हम समीक्षा के लिए आवश्यक न होने तक अनावश्यक व्यक्तिगत पहचान संख्याएं अपलोड करने से बचने की सलाह देते हैं।</li>
        </ul>
        <div className="help-callout help-callout-info">
          <CheckCircleIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>मानव सत्यापन:</strong> हालांकि LegalAI अत्याधुनिक ग्राउंडेड AI मॉडल का उपयोग करता है, समझौतों को अंतिम रूप देने से पहले मानव कानूनी निरीक्षण आवश्यक है।
          </div>
        </div>
      </>
    ),
  },

  // 11. Troubleshooting
  {
    id: "troubleshooting-guide",
    category: "troubleshooting",
    title: "सामान्य समस्याओं का निवारण",
    summary: "अपलोड, प्रसंस्करण और चैट समस्याओं के लिए चरण-दर-चरण समाधान।",
    tags: ["troubleshooting", "errors", "upload", "password", "api", "chat", "compare", "reports"],
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>PDF अपलोड नहीं हो रहा है?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            सत्यापित करें कि फ़ाइल 50 MB से कम है, एक मान्य .pdf/.docx/.txt प्रारूप है, और आपका इंटरनेट स्थिर है।
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>पासवर्ड-संरक्षित PDF अनलॉक करने में समस्या?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            सुनिश्चित करें कि आप सही उपयोगकर्ता पासवर्ड दर्ज कर रहे हैं। Caps Lock की जाँच करें और पुनः प्रयास करें।
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>विश्लेषण दिखाई नहीं दे रहा है?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            पुष्टि करें कि दस्तावेज़ <strong>तैयार</strong> स्थिति में पहुंच गया है। फिर विश्लेषण पृष्ठ पर <strong>दस्तावेज़ का विश्लेषण करें</strong> पर क्लिक करें।
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>कोपायलट चैट प्रतिक्रिया नहीं दे रहा है?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            सुनिश्चित करें कि दस्तावेज़ संदर्भ बार में सक्रिय रूप से चुना गया है और दस्तावेज़ की स्थिति तैयार है।
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>तुलना बटन अक्षम है?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            जाँचें कि दोनों दस्तावेज़ स्लॉट भरे हुए हैं, दोनों दस्तावेज़ तैयार हैं, और आपने दोनों स्लॉट में एक ही दस्तावेज़ नहीं चुना है।
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>रिपोर्ट तैयार नहीं हो रही है?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            रिपोर्ट के लिए पहले पूर्ण दस्तावेज़ विश्लेषण की आवश्यकता होती है। कार्यकारी रिपोर्ट तैयार करने से पहले मूल्यांकन पूरा करने के लिए <strong>विश्लेषण</strong> पर जाएँ।
          </p>
        </div>
      </div>
    ),
  },
];
