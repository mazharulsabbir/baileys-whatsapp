export const FEATURES = [
  {
    title: 'WhatsApp Web, hosted for you',
    description:
      'Connect with QR from the dashboard. Sessions stay encrypted on disk per tenant — no sharing numbers across customers.',
    icon: 'link' as const,
  },
  {
    title: 'SSLCommerz billing',
    description:
      'Subscribe in BDT with SSLCommerz. Successful IPN extends your entitlement automatically so access stays in sync.',
    icon: 'card' as const,
  },
  {
    title: 'REST integration API',
    description:
      'Send messages and check connection status from your CRM or ERP using scoped credentials and sensible rate limits.',
    icon: 'api' as const,
  },
  {
    title: 'Multi-tenant ready',
    description:
      'Architecture built around tenant isolation: separate auth paths, registry slots, and outbound webhooks per account.',
    icon: 'layers' as const,
  },
  {
    title: 'Dashboard control',
    description:
      'Connect, disconnect, and monitor QR flow from a simple web UI without touching servers or CLI.',
    icon: 'gauge' as const,
  },
  {
    title: 'Odoo connector path',
    description:
      'Pair this stack with connector modules so conversations and templates can live next to your business data.',
    icon: 'puzzle' as const,
  },
];

export const CUSTOMERS = [
  { name: 'Northwind Traders', sector: 'Retail' },
  { name: 'Blue Harbor Logistics', sector: 'Logistics' },
  { name: 'Kinari Commerce', sector: 'E‑commerce' },
  { name: 'Urban Clinic Group', sector: 'Healthcare' },
  { name: 'Brightfield Agency', sector: 'Marketing' },
  { name: 'Atlas Manufacturing', sector: 'Industrial' },
];

export const REVIEWS = [
  {
    quote:
      'We replaced a brittle script with this stack and finally had billing + WhatsApp in one place. QR onboarding took minutes.',
    author: 'Samira Rahman',
    role: 'Head of Operations',
    company: 'Kinari Commerce',
    rating: 5,
  },
  {
    quote:
      'The integration API is straightforward — our Odoo partner wired outbound messages without babysitting the socket.',
    author: 'Daniel Ortiz',
    role: 'IT Manager',
    company: 'Blue Harbor Logistics',
    rating: 5,
  },
  {
    quote:
      'SSLCommerz checkout just works for our Bangladesh pricing. Support tickets dropped once IPN entitlement was automatic.',
    author: 'Mehnaz Chowdhury',
    role: 'Founder',
    company: 'Brightfield Agency',
    rating: 5,
  },
];

export const STATS = [
  { label: 'Typical go-live', value: '< 1 day', hint: 'from account to first send' },
  { label: 'Checkout', value: 'SSLCommerz', hint: 'BDT, IPN-activated entitlements' },
  { label: 'Integration', value: 'REST + keys', hint: 'scoped credentials per tenant' },
];

export const FAQ = [
  {
    q: 'Is this the official WhatsApp API?',
    a: 'This stack uses WhatsApp Web (Baileys) for session-based messaging. It is not the Cloud API, and you should follow WhatsApp’s terms and your own compliance requirements.',
  },
  {
    q: 'How does billing work?',
    a: 'You subscribe on the pricing page with SSLCommerz. When payment is confirmed, our server applies your entitlement so the dashboard and API unlock for the paid period.',
  },
  {
    q: 'Can I use this with Odoo or a custom app?',
    a: 'Yes. Use the integration API and credentials from the dashboard, or connect an Odoo-style connector module on your side to send and track messages.',
  },
  {
    q: 'Where is my session stored?',
    a: 'Session data is written to your configured auth directory per tenant. Treat that directory as sensitive and back it up according to your security policy.',
  },
];
