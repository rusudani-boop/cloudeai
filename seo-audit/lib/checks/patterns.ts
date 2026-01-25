/* ============================================================================
 * SEO & CONTENT ANALYSIS PATTERNS
 * Production-grade, comprehensive pattern detection
 * ========================================================================== */

export const PATTERNS = {
  /* ---------------------------------------------------------------------------
   * URL & LINK ANALYSIS
   * ------------------------------------------------------------------------- */

  // Empty/invalid href patterns (NOT including # - anchor links are valid!)
  EMPTY_HREFS: [
    '',
    'javascript:void(0)',
    'javascript:void(0);',
    'javascript:;',
    'javascript:',
    'about:blank',
  ],

  /**
   * Generic anchor texts - bad ONLY when they are the full anchor text.
   * Matching should be exact after trim + lowercase.
   */
  GENERIC_ANCHORS: [
    // English
    'click here',
    'read more',
    'here',
    'learn more',
    'more',
    'link',
    'this',
    'click',
    'go',
    'see more',
    'view more',
    'continue',
    'details',
    'info',
    'more info',
    'find out more',
    'discover more',
    'see all',
    'view all',
    'download',
    'start',
    'submit',
    'next',
    'previous',
    'back',
    'go back',
    // Georgian
    'წაიკითხეთ მეტი',
    'მეტი',
    'აქ',
    'ვრცლად',
    'დეტალები',
    'გაგრძელება',
    'იხილეთ',
    'ნახეთ',
    'გადასვლა',
    'სრულად',
    'დაწვრილებით',
    // Russian
    'подробнее',
    'читать далее',
    'здесь',
    'ещё',
    'больше',
  ],

  /* ---------------------------------------------------------------------------
   * AI / GENERIC CONTENT DETECTION
   * Split into HARD and SOFT signals for better scoring
   * ------------------------------------------------------------------------- */

  /**
   * HARD AI clichés - extremely rare in good human-written editorial content.
   * High confidence signal when found.
   */
  AI_HARD_PHRASES: [
    'in conclusion',
    'to conclude',
    'to summarize',
    'in summary',
    'overall, it is important to note',
    'as an ai language model',
    'this article explores',
    'this blog post will',
    'first and foremost',
    'last but not least',
    'it is important to note',
    'it is worth noting',
    'it is crucial to',
    'delve into',
    'delve deeper',
    'embark on',
    'embark upon',
    'navigate the complexities',
    'holistic approach',
    'comprehensive guide',
    'ultimate guide',
    'complete guide',
    'plays a vital role',
    'plays a crucial role',
    'plays an important role',
    'needless to say',
    'it goes without saying',
    'at the end of the day',
    'in this day and age',
  ],

  /**
   * SOFT AI / marketing phrases - common in AI, but also used by humans.
   * Use for scoring, never as binary signal.
   */
  AI_SOFT_PHRASES: [
    'leverage',
    'utilize',
    'facilitate',
    'implement',
    'seamless experience',
    'seamlessly',
    'effortlessly',
    'cutting-edge',
    'cutting edge',
    'data-driven',
    'best practices',
    'unlock the potential',
    'unlock your potential',
    'unleash',
    'unleash the power',
    'enhance your',
    'next level',
    'tailored solutions',
    'rapidly evolving',
    'ever-changing landscape',
    'streamline',
    'game-changer',
    'game changer',
    'robust',
    'scalable',
    'empower',
    'synergy',
    'paradigm',
    'ecosystem',
    'landscape',
    'harness',
    'revolutionize',
    'transform',
    'elevate',
    'optimize',
    'maximize',
    'amplify',
    'supercharge',
    'turbocharge',
    'skyrocket',
    'tap into',
    'dive into',
    'dive deeper',
    "in today's digital landscape",
    "in today's world",
    'when it comes to',
    'in the realm of',
    'in the world of',
    'rest assured',
    'without a doubt',
    'at the core of',
    'at the heart of',
    'as a matter of fact',
    'crucial aspect',
    'key aspect',
    'important aspect',
    'moreover',
    'furthermore',
    'additionally',
    'consequently',
  ],

  /**
   * Regex-based AI patterns for more complex matching
   */
  AI_REGEX_PATTERNS: [
    /take your .* to the next level/i,
    /in today['']s (fast[-\s]?paced|digital) world/i,
    /whether you are a (business|company|brand)/i,
    /unlock the (full )?potential of/i,
    /revolutionize (the way|how) you/i,
  ],

  // Combined AI phrases for backward compatibility
  AI_PHRASES: [
    // Hard phrases
    'in conclusion',
    'to conclude',
    'to summarize',
    'in summary',
    'it is important to note',
    'it is worth noting',
    'it is crucial to',
    'first and foremost',
    'last but not least',
    'delve into',
    'delve deeper',
    'dive into',
    'dive deeper',
    'embark on',
    'embark upon',
    'navigate the complexities',
    'navigate through',
    'holistic approach',
    'comprehensive guide',
    'ultimate guide',
    'complete guide',
    // Soft phrases
    'leverage',
    'utilize',
    'facilitate',
    'implement',
    "in today's digital landscape",
    "in today's world",
    'in this day and age',
    'game-changer',
    'game changer',
    'cutting-edge',
    'cutting edge',
    'unlock the potential',
    'unlock your potential',
    'unleash',
    'seamlessly',
    'effortlessly',
    'streamline',
    'crucial aspect',
    'key aspect',
    'important aspect',
    'plays a vital role',
    'plays a crucial role',
    'plays an important role',
    'robust',
    'scalable',
    'empower',
    'synergy',
    'paradigm',
    'ecosystem',
    'landscape',
    'harness',
    'revolutionize',
    'transform',
    'elevate',
    'optimize',
    'maximize',
    'amplify',
    'supercharge',
    'turbocharge',
    'skyrocket',
    'unleash the power',
    'tap into',
    'take your .* to the next level',
    'at the end of the day',
    'when it comes to',
    'in the realm of',
    'in the world of',
    'needless to say',
    'it goes without saying',
    'rest assured',
    'without a doubt',
    'at the core of',
    'at the heart of',
    'as a matter of fact',
  ],

  /* ---------------------------------------------------------------------------
   * CMS DETECTION (HIGH CONFIDENCE TOKENS)
   * ------------------------------------------------------------------------- */

  CMS: [
    { name: 'WordPress', patterns: ['wp-content', 'wp-includes', 'wp-json', '/wp-admin'] },
    { name: 'Shopify', patterns: ['cdn.shopify.com', 'shopify-section', 'myshopify.com'] },
    { name: 'Wix', patterns: ['wixsite.com', 'wix-code', 'wixstatic', 'parastorage.com'] },
    { name: 'Squarespace', patterns: ['squarespace.com', 'static.squarespace.com', 'sqsp.net'] },
    { name: 'Webflow', patterns: ['webflow', 'assets.website-files.com'] },
    { name: 'Drupal', patterns: ['drupal-settings-json', '/sites/default/', 'drupal.settings'] },
    { name: 'Joomla', patterns: ['joomla!', '/components/com_', '/media/system/js'] },
    { name: 'Magento', patterns: ['mage/', 'mage-init', 'requirejs/require'] },
    { name: 'PrestaShop', patterns: ['prestashop', '/modules/ps_'] },
    { name: 'BigCommerce', patterns: ['bigcommerce', 'cdn11.bigcommerce'] },
    { name: 'Ghost', patterns: ['ghost/content', 'ghost-theme', 'ghost/api'] },
    { name: 'HubSpot', patterns: ['hs-scripts.com', 'hubspotusercontent', 'hscollectedforms'] },
    { name: 'Contentful', patterns: ['contentful', 'ctfassets.net'] },
    { name: 'Sanity', patterns: ['sanity.io', 'cdn.sanity.io'] },
    { name: 'Tilda', patterns: ['tildacdn.com'] },
    { name: 'Blogger', patterns: ['blogger.com', 'blogspot.com'] },
    { name: 'Medium', patterns: ['medium.com', 'cdn-images-1.medium.com'] },
    { name: 'Weebly', patterns: ['weebly.com', 'editmysite.com'] },
    { name: 'Woocommerce', patterns: ['woocommerce', 'wc-ajax'] },
    { name: 'OpenCart', patterns: ['opencart', 'route=common'] },
    { name: 'TYPO3', patterns: ['typo3', 'typo3conf'] },
    { name: 'Craft CMS', patterns: ['craftcms', 'craft/app', 'craft/config'] },
    { name: 'Strapi', patterns: ['strapi'] },
    { name: 'Prismic', patterns: ['prismic.io'] },
    { name: 'DatoCMS', patterns: ['datocms'] },
    { name: 'Storyblok', patterns: ['storyblok.com'] },
  ],

  /* ---------------------------------------------------------------------------
   * JAVASCRIPT FRAMEWORKS / META-FRAMEWORKS
   * ------------------------------------------------------------------------- */

  FRAMEWORKS: [
    { name: 'Next.js', patterns: ['__NEXT_DATA__', '_next/static', 'next-route-announcer'] },
    { name: 'Nuxt.js', patterns: ['__NUXT__', '_nuxt/', 'nuxt-link'] },
    { name: 'Gatsby', patterns: ['___gatsby', 'gatsby-image', 'gatsby-resp-image'] },
    { name: 'React', patterns: ['data-reactroot', 'data-reactid', '__REACT_DEVTOOLS'] },
    { name: 'Vue.js', patterns: ['data-v-', '__vue__', '__VUE__'] },
    { name: 'Angular', patterns: ['ng-version', '_ngcontent', 'ng-reflect'] },
    { name: 'Svelte', patterns: ['__svelte', 'svelte-'] },
    { name: 'SvelteKit', patterns: ['sveltekit', '__sveltekit'] },
    { name: 'Astro', patterns: ['astro-island', 'data-astro'] },
    { name: 'Remix', patterns: ['__remix'] },
    { name: 'Ember', patterns: ['data-ember'] },
    { name: 'Laravel', patterns: ['laravel_session'] },
    { name: 'Ruby on Rails', patterns: ['data-turbolinks', 'rails-ujs'] },
    { name: 'Django', patterns: ['csrfmiddlewaretoken'] },
    { name: 'Bootstrap', patterns: ['cdn.jsdelivr.net/npm/bootstrap'] },
    { name: 'Tailwind CSS', patterns: ['tailwindcss'] },
    { name: 'Alpine.js', patterns: ['x-data', 'x-init', 'x-on:'] },
    { name: 'HTMX', patterns: ['hx-get', 'hx-post'] },
    { name: 'Stimulus', patterns: ['data-controller'] },
    { name: 'Turbo', patterns: ['data-turbo', 'turbo-frame'] },
    { name: 'Lit', patterns: ['lit-html', 'lit-element'] },
    { name: 'Preact', patterns: ['preact', '__preact'] },
    { name: 'Solid.js', patterns: ['solid-js', '_$HY'] },
    { name: 'Qwik', patterns: ['q:'] },
  ],

  /* ---------------------------------------------------------------------------
   * ANALYTICS & TRACKING
   * ------------------------------------------------------------------------- */

  ANALYTICS: [
    { name: 'Google Analytics', patterns: ['google-analytics.com', 'gtag(', 'analytics.js', 'ga.js'] },
    { name: 'Google Tag Manager', patterns: ['googletagmanager.com/gtm.js'] },
    { name: 'Facebook Pixel', patterns: ['connect.facebook.net', 'fbevents.js', 'fbq('] },
    { name: 'Hotjar', patterns: ['static.hotjar.com', 'hj('] },
    { name: 'Mixpanel', patterns: ['mixpanel.com'] },
    { name: 'Segment', patterns: ['segment.com', 'segment.io'] },
    { name: 'Amplitude', patterns: ['amplitude.com'] },
    { name: 'Heap', patterns: ['heapanalytics'] },
    { name: 'Plausible', patterns: ['plausible.io'] },
    { name: 'Matomo', patterns: ['matomo', 'piwik'] },
    { name: 'Clarity', patterns: ['clarity.ms'] },
    { name: 'Yandex Metrica', patterns: ['mc.yandex.ru', 'ym('] },
    { name: 'FullStory', patterns: ['fullstory'] },
    { name: 'PostHog', patterns: ['posthog'] },
  ],

  /* ---------------------------------------------------------------------------
   * ADVERTISING PLATFORMS
   * ------------------------------------------------------------------------- */

  ADVERTISING: [
    { name: 'Google Ads', patterns: ['googleads', 'googlesyndication', 'googleadservices', 'adsbygoogle'] },
    { name: 'Facebook Ads', patterns: ['facebook.com/tr'] },
    { name: 'LinkedIn Ads', patterns: ['linkedin.com/px', 'snap.licdn.com'] },
    { name: 'Twitter Ads', patterns: ['static.ads-twitter.com', 'twq('] },
    { name: 'TikTok Ads', patterns: ['analytics.tiktok.com', 'ttq('] },
    { name: 'Amazon Ads', patterns: ['amazon-adsystem'] },
    { name: 'AdRoll', patterns: ['d.adroll.com'] },
    { name: 'Criteo', patterns: ['criteo'] },
    { name: 'Taboola', patterns: ['taboola'] },
    { name: 'Outbrain', patterns: ['outbrain'] },
  ],

  /* ---------------------------------------------------------------------------
   * SOCIAL PLATFORM DETECTION (DOMAIN-BASED)
   * ------------------------------------------------------------------------- */

  SOCIAL_PLATFORMS: [
    { name: 'Facebook', pattern: 'facebook.com' },
    { name: 'Twitter/X', pattern: 'twitter.com' },
    { name: 'X', pattern: 'x.com' },
    { name: 'LinkedIn', pattern: 'linkedin.com' },
    { name: 'Instagram', pattern: 'instagram.com' },
    { name: 'YouTube', pattern: 'youtube.com' },
    { name: 'TikTok', pattern: 'tiktok.com' },
    { name: 'Pinterest', pattern: 'pinterest.com' },
    { name: 'Telegram', pattern: 't.me' },
    { name: 'WhatsApp', pattern: 'wa.me' },
    { name: 'Discord', pattern: 'discord.gg' },
    { name: 'Reddit', pattern: 'reddit.com' },
    { name: 'GitHub', pattern: 'github.com' },
    { name: 'Dribbble', pattern: 'dribbble.com' },
    { name: 'Behance', pattern: 'behance.net' },
    { name: 'Twitch', pattern: 'twitch.tv' },
    { name: 'Threads', pattern: 'threads.net' },
    { name: 'Mastodon', pattern: 'mastodon' },
    { name: 'Bluesky', pattern: 'bsky.app' },
    { name: 'Medium', pattern: 'medium.com' },
    { name: 'Substack', pattern: 'substack.com' },
  ],

  /* ---------------------------------------------------------------------------
   * HTML QUALITY
   * ------------------------------------------------------------------------- */

  DEPRECATED_ELEMENTS: [
    'acronym',
    'applet',
    'basefont',
    'bgsound',
    'big',
    'blink',
    'center',
    'font',
    'frame',
    'frameset',
    'marquee',
    'menuitem',
    'nobr',
    'noembed',
    'noframes',
    'plaintext',
    'strike',
    'tt',
    'xmp',
  ],

  /* ---------------------------------------------------------------------------
   * ARIA ROLES
   * ------------------------------------------------------------------------- */

  ARIA_ROLES: [
    'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell',
    'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo',
    'definition', 'dialog', 'directory', 'document', 'feed', 'figure', 'form',
    'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox',
    'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option',
    'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row',
    'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
    'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist',
    'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
    'treegrid', 'treeitem',
  ],

  /* ---------------------------------------------------------------------------
   * SCHEMA.ORG REQUIREMENTS BY TYPE
   * ------------------------------------------------------------------------- */

  SCHEMA_REQUIREMENTS: {
    Product: {
      required: ['name', 'image'],
      recommended: ['description', 'offers', 'review', 'aggregateRating', 'brand', 'sku', 'gtin'],
      needsOneOf: ['offers', 'review', 'aggregateRating'],
    },
    Article: {
      required: ['headline', 'datePublished', 'author'],
      recommended: ['image', 'dateModified', 'publisher', 'description'],
    },
    BlogPosting: {
      required: ['headline', 'datePublished', 'author'],
      recommended: ['image', 'dateModified', 'publisher', 'description'],
    },
    NewsArticle: {
      required: ['headline', 'datePublished', 'author', 'dateModified'],
      recommended: ['image', 'publisher', 'description'],
    },
    Organization: {
      required: ['name'],
      recommended: ['url', 'logo', 'contactPoint', 'sameAs', 'address'],
    },
    LocalBusiness: {
      required: ['name', 'address'],
      recommended: ['telephone', 'url', 'openingHours', 'image', 'priceRange', 'geo'],
    },
    FAQPage: {
      required: ['mainEntity'],
    },
    BreadcrumbList: {
      required: ['itemListElement'],
    },
    WebSite: {
      recommended: ['name', 'url', 'potentialAction'],
    },
    Person: {
      required: ['name'],
      recommended: ['url', 'image', 'jobTitle', 'sameAs'],
    },
    Event: {
      required: ['name', 'startDate', 'location'],
      recommended: ['endDate', 'description', 'image', 'offers', 'performer', 'organizer'],
    },
    Recipe: {
      required: ['name', 'image'],
      recommended: ['author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions', 'nutrition'],
    },
    Review: {
      required: ['itemReviewed', 'author'],
      recommended: ['reviewRating', 'datePublished', 'reviewBody'],
    },
    VideoObject: {
      required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
      recommended: ['duration', 'contentUrl', 'embedUrl', 'interactionStatistic'],
    },
    HowTo: {
      required: ['name', 'step'],
      recommended: ['description', 'image', 'totalTime', 'supply', 'tool'],
    },
    Course: {
      required: ['name', 'provider'],
      recommended: ['description', 'offers', 'hasCourseInstance'],
    },
    JobPosting: {
      required: ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'],
      recommended: ['employmentType', 'baseSalary', 'validThrough'],
    },
    SoftwareApplication: {
      required: ['name'],
      recommended: ['offers', 'operatingSystem', 'applicationCategory', 'aggregateRating'],
    },
  } as Record<string, { required?: string[]; recommended?: string[]; needsOneOf?: string[] }>,

  /* ---------------------------------------------------------------------------
   * LANGUAGE CODES (ISO 639-1)
   * ------------------------------------------------------------------------- */

  VALID_LANG_CODES: [
    'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
    'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
    'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
    'da', 'de', 'dv', 'dz',
    'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
    'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
    'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
    'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
    'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
    'ja', 'jv',
    'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
    'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
    'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
    'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
    'oc', 'oj', 'om', 'or', 'os',
    'pa', 'pi', 'pl', 'ps', 'pt',
    'qu',
    'rm', 'rn', 'ro', 'ru', 'rw',
    'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
    'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
    'ug', 'uk', 'ur', 'uz',
    've', 'vi', 'vo',
    'wa', 'wo',
    'xh',
    'yi', 'yo',
    'za', 'zh', 'zu',
  ],

  /* ---------------------------------------------------------------------------
   * STOP WORDS FOR KEYWORD DENSITY
   * Using Set for O(1) lookup performance
   * ------------------------------------------------------------------------- */

  STOP_WORDS: new Set([
    // English
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
    'don', 'should', 'now', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would', 'could',
    'might', 'must', 'shall', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
    'herself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who',
    'whom', 'if', 'as',
    // Georgian
    'და', 'რომ', 'არის', 'იყო', 'ეს', 'ის', 'თუ', 'რა', 'როგორ', 'ან', 'მაგრამ',
    // Russian
    'и', 'в', 'во', 'на', 'с', 'по', 'что', 'это', 'как', 'или', 'но',
    // German
    'und', 'oder', 'aber', 'mit', 'ohne', 'der', 'die', 'das', 'ein', 'eine',
  ]),

  /* ---------------------------------------------------------------------------
   * TRUST SIGNALS PATTERNS
   * ------------------------------------------------------------------------- */

  TRUST_PATTERNS: {
    terms: ['/terms', '/tos', '/terms-of-service', '/terms-and-conditions', '/პირობები'],
    cookie: ['/cookie', '/cookies', '/cookie-policy', '/ქუქი'],
    ssl: ['ssl', 'secure', 'https', 'encrypted', 'protected'],
    payment: ['visa', 'mastercard', 'paypal', 'stripe', 'amex', 'apple pay', 'google pay'],
    review: ['trustpilot', 'reviews', 'testimonials', 'rating', 'stars', 'გამოხმაურება'],
    certification: ['certified', 'accredited', 'verified', 'iso', 'gdpr', 'hipaa', 'pci'],
  },
};
