"use client";

import { useState } from "react";
import {
  Package,
  Truck,
  ScanBarcode,
  Workflow,
  ShoppingCart,
  Upload,
  Bell,
  Camera,
  Search,
  ChevronDown,
  ExternalLink,
  FileText,
  Boxes,
  RotateCcw,
  Users,
  Settings,
  Shield,
  Zap,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FeatureSection {
  title: string;
  icon: any;
  description: string;
  features: string[];
  faqs?: FAQItem[];
}

export default function HelpSupportPage() {
  const [activeTab, setActiveTab] = useState("features");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const integrations = [
    {
      name: "Shopify",
      icon: ShoppingCart,
      description: "Seamless e-commerce integration",
      capabilities: [
        "Automatic order import via webhooks",
        "Real-time inventory sync",
        "Order fulfillment automation",
        "Tracking number updates",
        "Product sync and management",
        "Multi-location support",
      ],
      setup:
        "Connect via Shopify Admin API with webhook endpoints for orders, products, and inventory updates.",
    },
    {
      name: "ShipEngine",
      icon: Truck,
      description: "Multi-carrier shipping solution",
      capabilities: [
        "Compare rates across carriers (USPS, FedEx, UPS)",
        "Generate shipping labels automatically",
        "Track packages in real-time",
        "Batch label creation",
        "International shipping support",
        "Address validation",
      ],
      setup:
        "Configure with the ShipEngine API key and connect carrier accounts for live rates and label generation.",
    },
    {
      name: "Ably",
      icon: Bell,
      description: "Real-time notifications and updates",
      capabilities: [
        "Instant notifications for new orders",
        "Real-time task updates",
        "User-specific channels",
        "Role-based notifications",
        "Background job status updates",
        "Packing slip ready alerts",
      ],
      setup:
        "Configure Ably with the API key for real-time push notifications across all warehouse devices.",
    },
    {
      name: "Google Cloud Platform",
      icon: Upload,
      description: "File storage and management",
      capabilities: [
        "Image upload for orders/returns",
        "PDF packing slip storage",
        "Shipping label storage",
        "Secure file access",
        "Cost-effective storage (~$0.30/month)",
        "CDN delivery",
      ],
      setup:
        "Set up GCP bucket with service account credentials for file uploads and storage.",
    },
    {
      name: "Zebra TC22 Scanners",
      icon: ScanBarcode,
      description: "Mobile barcode scanning devices",
      capabilities: [
        "Keyboard wedge mode scanning",
        "Auto-focus inputs",
        "Fast scan-to-action workflow",
        "Multi-format barcode support",
        "Rugged mobile design",
        "DataWedge configuration",
      ],
      setup:
        "Configure DataWedge with Keystroke Output enabled, Send ENTER key ON, and enable required barcode decoders.",
    },
  ];

  const features: FeatureSection[] = [
    {
      title: "Order Management",
      icon: ShoppingCart,
      description: "Complete order lifecycle from import to fulfillment",
      features: [
        "Automatic Shopify order import",
        "Inventory allocation and reservation",
        "Multi-status order tracking (PENDING → ALLOCATED → PICKING → PICKED → PACKED → SHIPPED)",
        "Back order management with auto-fulfillment",
        "Split shipment support",
        "Order priority management",
        "Customer order portal",
        "Real-time order status updates",
      ],
      faqs: [
        {
          question: "How do orders get imported from Shopify?",
          answer:
            "Orders are automatically imported via Shopify webhooks. When a customer places an order, Shopify sends the order data to the WMS, creates the order record, and allocates inventory automatically.",
        },
        {
          question: "What happens if an item is out of stock?",
          answer:
            "The system creates a back order automatically. When inventory is received, the system generates work tasks to fulfill back orders and updates the order status accordingly.",
        },
      ],
    },
    {
      title: "Inventory Management",
      icon: Boxes,
      description: "Real-time inventory tracking and control",
      features: [
        "Multi-location inventory tracking",
        "Real-time quantity updates",
        "Inventory reservation system",
        "Cycle count campaigns",
        "Blind receiving workflows",
        "UPC/barcode scanning",
        "Low stock alerts",
        "Inventory adjustment logging",
        "Audit trail for all changes",
      ],
      faqs: [
        {
          question: "How does inventory reservation work?",
          answer:
            "When an order is allocated, inventory is reserved at specific locations. The quantity remains physically available but is marked as reserved until the order is picked and shipped.",
        },
        {
          question: "Can I track inventory across multiple warehouses?",
          answer:
            "Yes, the system supports multi-location tracking with location-specific inventory levels and reservation management.",
        },
      ],
    },
    {
      title: "Picking & Packing",
      icon: Package,
      description: "Efficient warehouse workflows",
      features: [
        "Wave-based pick list generation",
        "Mobile-optimized picking interface",
        "Barcode scanning for item verification",
        "Short pick handling",
        "Task reassignment and continuation",
        "Pick-to-pack workflow",
        "Box size recommendations",
        "Packing slip generation",
        "Multi-package order support",
      ],
      faqs: [
        {
          question: "What if a picker doesn't finish a pick list?",
          answer:
            "The system supports pick list continuation. Progress is saved, and the remaining items can be reassigned to another picker. All completed work is preserved with audit trails.",
        },
        {
          question: "How do I handle short picks?",
          answer:
            "Scan the barcode and enter the actual quantity picked. The system creates a back order for the short quantity and updates inventory accordingly.",
        },
      ],
    },
    {
      title: "Shipping & Labels",
      icon: Truck,
      description: "Multi-carrier shipping automation",
      features: [
        "Real-time rate comparison",
        "Automatic label generation",
        "Batch label creation",
        "Background job processing",
        "Multi-package shipments",
        "Tracking number management",
        "Carrier service selection",
        "Address validation",
        "Shopify fulfillment sync",
      ],
      faqs: [
        {
          question: "How long does label creation take?",
          answer:
            "Label creation is processed in the background. The success screen appears immediately (~0.5s), and packing slips generate asynchronously (~1.8s) with real-time updates via Ably.",
        },
        {
          question: "Can I create multiple labels at once?",
          answer:
            "Yes, you can batch create labels for multiple packages. Each package gets its own tracking number and label PDF.",
        },
      ],
    },
    {
      title: "Returns Management",
      icon: RotateCcw,
      description: "Complete return workflow from RMA to restock",
      features: [
        "RMA number auto-generation",
        "Customer return portal",
        "Barcode-enabled receiving",
        "Item condition assessment",
        "Disposition workflows (Restock, Dispose, Repair)",
        "Refund processing",
        "Shopify refund sync",
        "Return analytics",
        "Packing slip with RMA barcode",
      ],
      faqs: [
        {
          question: "How do customers initiate returns?",
          answer:
            "Customers enter their order number and email in the return portal, select items to return, provide a reason, and receive an RMA number with a printable packing slip containing a scannable barcode.",
        },
        {
          question: "What happens during warehouse receiving?",
          answer:
            "Staff scans the RMA barcode on the packing slip, the system displays expected items, and staff inspects each item for condition and determines disposition (restock, dispose, etc.).",
        },
      ],
    },
    {
      title: "Mobile & Scanning",
      icon: ScanBarcode,
      description: "Zebra TC22 and mobile device support",
      features: [
        "Keyboard wedge barcode scanning",
        "Auto-focus input fields",
        "Camera-based scanning fallback",
        "Responsive mobile UI",
        "Touch-optimized interfaces",
        "Offline capability considerations",
        "DataWedge integration",
        "Multi-format barcode support (CODE128, UPC, EAN)",
      ],
      faqs: [
        {
          question: "What do I need to configure on Zebra TC22?",
          answer:
            "In DataWedge, enable Keystroke Output with 'Send ENTER key: ON', set keystroke delay to 0ms, and enable the barcode decoders you need (CODE128, UPC, EAN).",
        },
        {
          question: "Can I use my phone to scan barcodes?",
          answer:
            "Yes, the system supports camera-based scanning as a fallback. The UI adapts to show a camera button on mobile devices.",
        },
      ],
    },
    {
      title: "Notifications & Real-time",
      icon: Bell,
      description: "Stay updated with instant notifications",
      features: [
        "New order alerts",
        "Task assignment notifications",
        "Back order fulfillment alerts",
        "Packing slip ready notifications",
        "Label generation updates",
        "User-specific channels",
        "Role-based notifications (STAFF, ADMIN)",
        "In-app notification center",
      ],
      faqs: [
        {
          question: "How do I receive notifications?",
          answer:
            "Notifications appear in real-time via Ably. You'll see toast messages and badge counts in the notification bell. All notifications are stored and can be viewed in the notification center.",
        },
      ],
    },
    {
      title: "Receiving & Purchase Orders",
      icon: FileText,
      description: "Inbound inventory management",
      features: [
        "Blind receiving sessions",
        "UPC scanning with quantity input",
        "Variance detection and approval",
        "Automatic back order fulfillment",
        "Multi-location receiving",
        "Batch receiving support",
        "Receiving history and audit trails",
      ],
    },
  ];

  const commonQuestions: FAQItem[] = [
    {
      question: "How do I get started with the system?",
      answer:
        "Start by connecting the Shopify store and ShipEngine account. Then configure the warehouse locations, add users with appropriate roles, and you're ready to start processing orders.",
    },
    {
      question: "What happens when inventory runs out mid-pick?",
      answer:
        "The system creates a back order for the short quantity. When new inventory arrives and is received, the system automatically generates work tasks to fulfill the back order.",
    },
    {
      question: "Can multiple people work on the same order?",
      answer:
        "Yes, through pick list continuation. If a picker doesn't finish, their progress is saved and remaining items can be assigned to another picker. All work is tracked with audit trails.",
    },
    {
      question: "How are shipping costs calculated?",
      answer:
        "ShipEngine provides real-time rates from multiple carriers. You can compare rates and select the best option for each shipment. The system considers package weight, dimensions, and destination.",
    },
    {
      question: "What's the typical order processing flow?",
      answer:
        "Order arrives from Shopify → Inventory allocated → Pick list generated → Items picked → Order packed → Shipping label created → Package shipped → Tracking sent to customer via Shopify.",
    },
    {
      question: "How do I handle split shipments?",
      answer:
        "The system supports multi-package shipments. During packing, you can create multiple packages for a single order, each with its own label and tracking number.",
    },
    {
      question: "What mobile devices are supported?",
      answer:
        "Zebra TC22 scanners are fully supported with keyboard wedge mode. The UI is also responsive and works on tablets and smartphones with camera-based scanning.",
    },
    {
      question: "How secure is the data?",
      answer:
        "All data is encrypted in transit and at rest. Role-based access control ensures users only see what they need. Comprehensive audit trails track all actions.",
    },
    {
      question: "Can I customize workflows?",
      answer:
        "Yes, workflows can be configured for the specific needs. Contact support for custom workflow implementations.",
    },
    {
      question: "What's included in the audit trail?",
      answer:
        "Every action is logged with timestamp, user, and details. This includes inventory changes, status updates, picks, packs, shipments, and more.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Help & Support
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Everything you need to know about the warehouse management system
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: "features", label: "Features", icon: Zap },
              { id: "integrations", label: "Integrations", icon: Workflow },
              { id: "faq", label: "FAQ", icon: Search },
              //   { id: "contact", label: "Contact Support", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Features Tab */}
        {activeTab === "features" && (
          <div className="space-y-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Comprehensive Warehouse Management
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200">
                    the WMS includes everything from order import to shipping,
                    with real-time tracking, mobile support, and seamless
                    integrations with major platforms.
                  </p>
                </div>
              </div>
            </div>

            {features.map((section, idx) => {
              const Icon = section.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {section.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {section.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mb-6">
                      {section.features.map((feature, featureIdx) => (
                        <div
                          key={featureIdx}
                          className="flex items-start space-x-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300 text-sm">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {section.faqs && section.faqs.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-zinc-800 pt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                          Common Questions
                        </h4>
                        {section.faqs.map((faq, faqIdx) => (
                          <div
                            key={faqIdx}
                            className="border border-gray-200 dark:border-zinc-800 rounded-lg"
                          >
                            <button
                              onClick={() =>
                                setExpandedFAQ(
                                  expandedFAQ === `${idx}-${faqIdx}`
                                    ? null
                                    : `${idx}-${faqIdx}`
                                )
                              }
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {faq.question}
                              </span>
                              <ChevronDown
                                className={`w-5 h-5 text-gray-400 transition-transform ${
                                  expandedFAQ === `${idx}-${faqIdx}`
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                            {expandedFAQ === `${idx}-${faqIdx}` && (
                              <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400">
                                {faq.answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === "integrations" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Third-Party Integrations
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                the WMS seamlessly integrates with industry-leading platforms to
                provide end-to-end warehouse automation.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                {integrations.map((integration, idx) => {
                  const Icon = integration.icon;
                  return (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-zinc-800 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {integration.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {integration.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        {integration.capabilities.map((capability, capIdx) => (
                          <div
                            key={capIdx}
                            className="flex items-start space-x-2"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {capability}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                          Setup
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {integration.setup}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost Breakdown Section */}
            {/* <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Integration Costs
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    ~$67/mo
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Total estimated cost (400 orders/month)
                  </div>
                  <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <div>Supabase: $25</div>
                    <div>Vercel: $20</div>
                    <div>GCP: $0.30</div>
                    <div>Ably: $19</div>
                    <div>Resend: $3</div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    50-90%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Cost savings vs. traditional WMS solutions
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-zinc-800 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    $0
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Per warehouse worker (unlimited users)
                  </div>
                </div>
              </div>
            </div> */}
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === "faq" && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Find answers to common questions about using the warehouse
                management system.
              </p>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-zinc-800">
              {commonQuestions.map((faq, idx) => (
                <div key={idx}>
                  <button
                    onClick={() =>
                      setExpandedFAQ(
                        expandedFAQ === `faq-${idx}` ? null : `faq-${idx}`
                      )
                    }
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white pr-8">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                        expandedFAQ === `faq-${idx}` ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expandedFAQ === `faq-${idx}` && (
                    <div className="px-6 pb-6 text-gray-600 dark:text-gray-400">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Support Tab */}
        {/* {activeTab === "contact" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Need Help?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Our support team is here to help you get the most out of the
                warehouse management system.
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      Email Support
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Get detailed help via email
                    </p>
                    <a
                      href="mailto:support@hq.wms"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      support@hq.wms
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      Documentation
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Detailed guides and API documentation
                    </p>
                    <a
                      href="#"
                      className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>View docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      System Status
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Check integration and service status
                    </p>
                    <a
                      href="#"
                      className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>View status</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
              <h2 className="text-2xl font-bold mb-4">Quick Tips</h2>
              <div className="space-y-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="font-semibold mb-2">🚀 Getting Started</h3>
                  <p className="text-sm text-white/90">
                    Connect Shopify → Configure ShipEngine → Set up locations →
                    Start processing orders
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="font-semibold mb-2">📱 Mobile Scanning</h3>
                  <p className="text-sm text-white/90">
                    Configure DataWedge on Zebra TC22: Enable Keystroke Output +
                    Send ENTER key ON
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="font-semibold mb-2">⚡ Performance</h3>
                  <p className="text-sm text-white/90">
                    Background jobs handle label generation (~0.5s response) and
                    packing slips (~1.8s)
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="font-semibold mb-2">🔔 Real-time Updates</h3>
                  <p className="text-sm text-white/90">
                    Ably provides instant notifications for orders, tasks, and
                    shipping updates
                  </p>
                </div>
              </div>
            </div>
          </div>
        )} */}
      </div>
    </div>
  );
}
