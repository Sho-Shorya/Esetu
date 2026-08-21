import React from "react";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  ShoppingBag,
  CreditCard,
  Receipt,
  Ban,
  Copyright,
  Globe,
  Server,
  Scale,
  UserCheck,
  UserX,
  RefreshCcw,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       hover:bg-gray-100 active:scale-95 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={21} />
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold">Terms & Conditions</h1>

            <p className="text-xs text-gray-500">e-Setu Policies</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-black text-white">
        <div className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
          <div
            className="w-14 h-14 rounded-2xl bg-red-600
                       flex items-center justify-center mb-5"
          >
            <FileText size={28} />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms & Conditions
          </h2>

          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-7 max-w-3xl">
            These Terms govern your access to and use of the e-Setu Platform,
            products, services, and related features.
          </p>

          <div
            className="mt-5 inline-flex items-center gap-2 px-4 py-2
                       rounded-full bg-white/10 text-xs sm:text-sm text-gray-300"
          >
            <RefreshCcw size={15} />
            Last Updated: 21 August 2026
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Quick Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <InfoCard
            icon={<ShoppingBag size={21} />}
            label="Platform"
            value="e-Setu"
          />

          <InfoCard
            icon={<UserCheck size={21} />}
            label="Users"
            value="Eligible Businesses"
          />

          <InfoCard
            icon={<Scale size={21} />}
            label="Governing Law"
            value="India"
          />

          <InfoCard
            icon={<MapPin size={21} />}
            label="Jurisdiction"
            value="Hansi, Haryana"
          />
        </div>

        {/* Introduction */}
        <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 mb-5">
          <p className="text-sm sm:text-base text-gray-600 leading-7">
            Welcome to <strong>e-Setu</strong>. These Terms & Conditions
            ("Terms") govern your access to and use of the e-Setu website,
            mobile application, and related services ("Platform").
          </p>

          <p className="mt-4 text-sm sm:text-base text-gray-600 leading-7">
            By registering, accessing, browsing, or using e-Setu, you agree to
            these Terms. If you do not agree with these Terms, please do not use
            the Platform.
          </p>
        </section>

        {/* Sections */}
        <div className="space-y-5">
          {/* 01 */}
          <PolicySection
            number="01"
            icon={<ShoppingBag size={20} />}
            title="About e-Setu"
          >
            <p>
              e-Setu is a digital ordering platform that enables eligible
              retailers and shopkeepers to browse products, place orders, track
              orders, view invoices, manage payment information, and access
              related services from e-Setu.
            </p>

            <Info label="Business / Platform Owner">
              [Your legal name / business name]
            </Info>

            <Info label="Business Address">
              Jagdish Colony, Hansi, Haryana, India
            </Info>

            <Info label="Contact">[Your business email / phone]</Info>
          </PolicySection>

          {/* 02 */}
          <PolicySection
            number="02"
            icon={<UserCheck size={20} />}
            title="Eligibility"
          >
            <p>
              The Platform is intended primarily for retailers, shopkeepers,
              businesses, and other eligible users purchasing products for
              legitimate business purposes.
            </p>

            <p>
              You agree to provide accurate and complete information during
              registration and to keep your account information updated.
            </p>
          </PolicySection>

          {/* 03 */}
          <PolicySection
            number="03"
            icon={<ShieldCheck size={20} />}
            title="Account Responsibility"
          >
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for activities performed through your
              account.
            </p>

            <p>
              You must immediately notify e-Setu if you believe your account has
              been accessed without authorization.
            </p>

            <p>
              You must not create an account using false information or
              impersonate another person or business.
            </p>
          </PolicySection>

          {/* 04 */}
          <PolicySection
            number="04"
            icon={<ShoppingBag size={20} />}
            title="Products and Orders"
          >
            <p>
              Product information, including names, descriptions, prices,
              availability, measurements, and quantities, may be updated from
              time to time.
            </p>

            <p>
              Placing an order constitutes a request to purchase the selected
              products. An order may be accepted, modified, rejected, or
              cancelled by e-Setu depending on product availability, pricing,
              operational circumstances, or other legitimate reasons.
            </p>

            <p>
              If a product is unavailable, e-Setu may contact the customer or
              modify the order as permitted by the applicable order process.
            </p>
          </PolicySection>

          {/* 05 */}
          <PolicySection
            number="05"
            icon={<CreditCard size={20} />}
            title="Prices and Payments"
          >
            <p>Prices displayed on the Platform are subject to change.</p>

            <p>
              Where online payment is available, payments may be processed
              through third-party payment gateways. e-Setu does not directly
              store customers' card, UPI, or other sensitive payment
              credentials.
            </p>

            <p>
              The payment gateway's own terms and policies may also apply to
              transactions.
            </p>

            <p>
              For cash/COD or credit transactions, payment must be made
              according to the payment terms communicated by e-Setu.
            </p>
          </PolicySection>

          {/* 06 */}
          <PolicySection
            number="06"
            icon={<Receipt size={20} />}
            title="Invoices and Payment Records"
          >
            <p>
              e-Setu may generate invoices, receipts, payment records, and
              account statements relating to orders.
            </p>

            <p>
              Users are responsible for reviewing their invoices and notifying
              e-Setu promptly if they identify an error.
            </p>
          </PolicySection>

          {/* 07 */}
          <PolicySection
            number="07"
            icon={<RefreshCcw size={20} />}
            title="Cancellation, Returns and Refunds"
          >
            <p>
              Order cancellation, product return, replacement, and refund
              eligibility will depend on the applicable product and e-Setu's
              policies.
            </p>

            <p>
              Where a refund is approved for an online payment, the refund will
              generally be processed through the payment method or payment
              gateway used for the original transaction, subject to the
              gateway's processing timelines.
            </p>
          </PolicySection>

          {/* 08 */}
          <PolicySection
            number="08"
            icon={<Ban size={20} />}
            title="Prohibited Use"
          >
            <p>You agree not to:</p>

            <ul className="list-disc pl-5 space-y-2">
              <li>Use e-Setu for unlawful or fraudulent activities.</li>

              <li>Provide false or misleading information.</li>

              <li>
                Attempt to gain unauthorized access to the Platform or another
                user's account.
              </li>

              <li>Interfere with the operation or security of the Platform.</li>

              <li>
                Use the Platform to violate applicable Indian laws or
                regulations.
              </li>

              <li>
                Resell, copy, modify, or exploit Platform content without
                authorization.
              </li>
            </ul>

            <p>
              Products subject to specific legal restrictions may only be sold
              or supplied where permitted by applicable law and e-Setu's
              policies.
            </p>
          </PolicySection>

          {/* 09 */}
          <PolicySection
            number="09"
            icon={<Copyright size={20} />}
            title="Intellectual Property"
          >
            <p>
              The e-Setu name, logo, software, interface, design, graphics,
              text, and other Platform content are owned by or licensed to
              e-Setu and are protected by applicable intellectual-property laws.
            </p>

            <p>
              You may not reproduce, distribute, modify, or commercially exploit
              Platform content without prior written permission.
            </p>
          </PolicySection>

          {/* 10 */}
          <PolicySection
            number="10"
            icon={<Globe size={20} />}
            title="Third-Party Services"
          >
            <p>
              The Platform may use third-party services such as payment
              gateways, hosting providers, mapping services, notification
              services, and other technology providers.
            </p>

            <p>
              Your use of those services may also be subject to their respective
              terms and privacy policies.
            </p>
          </PolicySection>

          {/* 11 */}
          <PolicySection
            number="11"
            icon={<Server size={20} />}
            title="Availability"
          >
            <p>
              We aim to keep e-Setu available and functioning properly, but we
              do not guarantee that the Platform will always be uninterrupted,
              error-free, or available at all times.
            </p>

            <p>
              The Platform may occasionally be unavailable because of
              maintenance, technical problems, network failures, or
              circumstances beyond our reasonable control.
            </p>
          </PolicySection>

          {/* 12 */}
          <PolicySection
            number="12"
            icon={<Scale size={20} />}
            title="Limitation of Liability"
          >
            <p>
              To the extent permitted by applicable law, e-Setu shall not be
              responsible for indirect, incidental, or consequential losses
              arising from the use or inability to use the Platform.
            </p>

            <p>
              Nothing in these Terms is intended to exclude or limit any
              liability that cannot legally be excluded or limited under
              applicable law.
            </p>
          </PolicySection>

          {/* 13 */}
          <PolicySection
            number="13"
            icon={<ShieldCheck size={20} />}
            title="Indemnification"
          >
            <p>
              You agree to indemnify and hold harmless e-Setu and its officers,
              employees, agents, and affiliates from claims, losses,
              liabilities, or expenses arising from your misuse of the Platform,
              violation of these Terms, violation of applicable law, or
              infringement of third-party rights.
            </p>
          </PolicySection>

          {/* 14 */}
          <PolicySection
            number="14"
            icon={<UserX size={20} />}
            title="Suspension or Termination"
          >
            <p>
              e-Setu may suspend or terminate an account where there is
              reasonable evidence of fraud, misuse, violation of these Terms, or
              violation of applicable law.
            </p>

            <p>Users may also stop using the Platform at any time.</p>

            <p>
              Any outstanding payment obligations that arose before termination
              will continue to apply.
            </p>
          </PolicySection>

          {/* 15 */}
          <PolicySection
            number="15"
            icon={<ShieldCheck size={20} />}
            title="Privacy"
          >
            <p>
              Your use of e-Setu is also governed by our Privacy Policy, which
              explains how we collect, use, store, and process personal and
              business information.
            </p>
          </PolicySection>

          {/* 16 */}
          <PolicySection
            number="16"
            icon={<RefreshCcw size={20} />}
            title="Changes to These Terms"
          >
            <p>
              We may update these Terms from time to time. Updated Terms will be
              published on the Platform with the revised "Last Updated" date.
            </p>

            <p>
              Continued use of e-Setu after changes are published constitutes
              acceptance of the updated Terms, to the extent permitted by
              applicable law.
            </p>
          </PolicySection>

          {/* 17 */}
          <PolicySection
            number="17"
            icon={<Scale size={20} />}
            title="Governing Law and Jurisdiction"
          >
            <p>
              These Terms are governed by the laws of <strong>India.</strong>
            </p>

            <p>
              Subject to applicable law, disputes relating to these Terms or the
              Platform shall be subject to the jurisdiction of the competent
              courts having jurisdiction over <strong>Hansi, Haryana.</strong>
            </p>
          </PolicySection>

          {/* 18 */}
          <PolicySection
            number="18"
            icon={<Phone size={20} />}
            title="Contact Us"
          >
            <Info label="Business">e-Setu</Info>

            <Info label="Address">Jagdish Colony, Hansi, Haryana, India</Info>

            <Info label="Email">shoryachhabra308@gmail.com</Info>

            <Info label="Phone">8397067785</Info>
          </PolicySection>
        </div>

        {/* Contact Card */}
        <section className="mt-6 bg-black text-white rounded-3xl p-6 sm:p-8">
          <div
            className="w-12 h-12 rounded-2xl bg-red-600
                       flex items-center justify-center mb-5"
          >
            <Phone size={23} />
          </div>

          <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">
            Need Help?
          </p>

          <h2 className="text-xl sm:text-2xl font-bold">Contact e-Setu</h2>

          <p className="text-gray-400 text-sm leading-6 mt-2">
            For questions regarding these Terms & Conditions, your account,
            orders, payments, or other Platform-related matters, please contact
            e-Setu.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <a
              href="tel:8397067785"
              className="inline-flex items-center gap-2 px-5 py-3
                         rounded-xl bg-red-600 hover:bg-red-700
                         font-semibold text-sm transition active:scale-95"
            >
              <Phone size={17} />
              Call e-Setu
            </a>

            <a
              href="mailto:shoryachhabra308@gmail.com"
              className="inline-flex items-center gap-2 px-5 py-3
                         rounded-xl bg-white/10 hover:bg-white/15
                         font-semibold text-sm transition active:scale-95"
            >
              <Mail size={17} />
              Email Us
            </a>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400 leading-5">
            By using e-Setu, you acknowledge that you have read and understood
            these Terms & Conditions.
          </p>

          <p className="text-xs text-gray-400 mt-2">
            © {new Date().getFullYear()} e-Setu. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

/* --------------------------------
   Quick Info Card
--------------------------------- */

const InfoCard = ({ icon, label, value }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-red-600 mb-2">{icon}</div>

      <p className="text-xs text-gray-500">{label}</p>

      <p className="font-bold text-sm mt-1">{value}</p>
    </div>
  );
};

/* --------------------------------
   Policy Section
--------------------------------- */

const PolicySection = ({ number, icon, title, children }) => {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8">
      <div className="flex gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-xl
                     bg-red-50 text-red-600
                     flex items-center justify-center"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-red-600">{number}</span>

            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {title}
            </h2>
          </div>

          <div
            className="space-y-3 text-sm sm:text-base
                       text-gray-600 leading-7"
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

/* --------------------------------
   Information Row
--------------------------------- */

const Info = ({ label, children }) => {
  return (
    <div
      className="flex flex-col sm:flex-row
                 sm:items-start gap-1 sm:gap-3
                 bg-gray-50 border border-gray-100
                 rounded-xl px-4 py-3"
    >
      <span className="font-semibold text-gray-800 shrink-0">{label}:</span>

      <span className="text-gray-600">{children}</span>
    </div>
  );
};

export default TermsAndConditions;
