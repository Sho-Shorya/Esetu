import React from "react";
import {
  ArrowLeft,
  ShieldCheck,
  Database,
  LockKeyhole,
  UserCheck,
  FileText,
  Phone,
  Scale,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
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
            <h1 className="text-lg sm:text-xl font-bold">Privacy Policy</h1>
            <p className="text-xs text-gray-500">e-Setu Policies</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-black text-white">
        <div className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-5">
            <ShieldCheck size={28} />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h2>

          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-7 max-w-3xl">
            This Privacy Policy explains how e-Setu collects, uses, shares,
            protects, and processes your personal information when you use our
            Platform and services.
          </p>

          <div
            className="mt-5 inline-flex items-center gap-2 px-4 py-2
                          rounded-full bg-white/10 text-xs sm:text-sm
                          text-gray-300"
          >
            <LockKeyhole size={15} />
            Your privacy and data security matter to us
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Quick Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <InfoCard
            icon={<Database size={21} />}
            label="Data Collection"
            value="Personal Data"
          />

          <InfoCard
            icon={<LockKeyhole size={21} />}
            label="Security"
            value="Protected"
          />

          <InfoCard
            icon={<UserCheck size={21} />}
            label="Your Rights"
            value="Access & Update"
          />

          <InfoCard
            icon={<Trash2 size={21} />}
            label="Account"
            value="Delete Anytime"
          />
        </div>

        {/* Introduction */}
        <PolicySection
          number="01"
          icon={<FileText size={20} />}
          title="Introduction"
        >
          <p>
            This Privacy Policy describes how <strong>8397067785</strong> and
            its affiliates (collectively referred to as "8397067785", "we",
            "our", or "us") collect, use, share, protect, or otherwise process
            your information and personal data through our website and Platform.
          </p>

          <p>
            Platform: <strong>https://esetu.vercel.app/login</strong>
          </p>

          <p>
            You may be able to browse certain sections of the Platform without
            registering with us. We do not offer any product or service under
            this Platform outside India, and your personal data will primarily
            be stored and processed in India.
          </p>

          <p>
            By visiting this Platform, providing your information, or availing
            any product or service offered on the Platform, you expressly agree
            to be bound by this Privacy Policy, the Terms of Use, and the
            applicable service/product terms and conditions.
          </p>

          <p>
            Your use of the Platform is governed by the laws of India, including
            applicable laws relating to data protection and privacy. If you do
            not agree with this Privacy Policy, please do not use or access our
            Platform.
          </p>
        </PolicySection>

        {/* Collection */}
        <PolicySection
          number="02"
          icon={<Database size={20} />}
          title="Collection of Information"
        >
          <p>
            We collect your personal data when you use our Platform, services,
            or otherwise interact with us during the course of our relationship.
          </p>

          <p>
            Information that we may collect includes, but is not limited to,
            information provided during sign-up, registration, or while using
            our Platform, such as:
          </p>

          <BulletList
            items={[
              "Name",
              "Date of birth",
              "Address",
              "Telephone or mobile number",
              "Email ID",
              "Information provided as proof of identity or address",
              "Other information voluntarily shared by you",
            ]}
          />

          <p>
            Certain sensitive personal data may be collected with your consent,
            such as bank account information, credit or debit card information,
            other payment instrument information, or biometric information where
            required to enable specific features opted for by you and where
            permitted under applicable laws.
          </p>

          <p>
            You always have the option not to provide certain information by
            choosing not to use a particular service or feature on the Platform.
          </p>

          <p>
            We may track your behaviour, preferences, and other information that
            you choose to provide on our Platform. This information may be
            compiled and analysed on an aggregated basis.
          </p>

          <p>
            We may also collect information related to your transactions on the
            Platform and on third-party business partner platforms.
          </p>

          <p>
            When a third-party business partner collects your personal data
            directly from you, you will be governed by their respective privacy
            policies. We are not responsible for the privacy practices or
            content of third-party privacy policies. We request you to read
            their privacy policies before disclosing information to them.
          </p>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 sm:p-5">
            <p className="font-bold text-red-700 mb-2">
              ⚠️ Important Security Notice
            </p>

            <p className="text-red-700">
              If you receive an email or call from a person or association
              claiming to be 8397067785 and requesting personal information such
              as debit/credit card PINs, net-banking passwords, or mobile
              banking passwords, never provide such information.
            </p>

            <p className="text-red-700 mt-2">
              If you have already revealed such information, report it
              immediately to an appropriate law enforcement agency.
            </p>
          </div>
        </PolicySection>

        {/* Usage */}
        <PolicySection
          number="03"
          icon={<UserCheck size={20} />}
          title="Use of Personal Data"
        >
          <p>
            We use your personal data to provide the services that you request
            and to operate and improve the Platform.
          </p>

          <p>We may use your information for purposes including:</p>

          <BulletList
            items={[
              "Assisting sellers and business partners in handling and fulfilling orders",
              "Enhancing customer experience",
              "Resolving disputes",
              "Troubleshooting problems",
              "Informing you about offers, products, services, and updates",
              "Customising your experience on the Platform",
              "Detecting and protecting against errors, fraud, and other criminal activity",
              "Enforcing our terms and conditions",
              "Conducting marketing research, analysis, and surveys",
              "Other purposes described to you at the time of collection",
            ]}
          />

          <p>
            To the extent we use your personal data for marketing purposes, we
            will provide you with the ability to opt out of such uses.
          </p>

          <p>
            Your access to certain products or services may be affected if the
            required permissions or information are not provided.
          </p>
        </PolicySection>

        {/* Sharing */}
        <PolicySection
          number="04"
          icon={<Scale size={20} />}
          title="Sharing of Personal Data"
        >
          <p>
            We may share your personal data internally within our group
            entities, corporate entities, and affiliates to provide you access
            to services and products offered by them.
          </p>

          <p>
            These entities and affiliates may market to you as a result of such
            sharing unless you explicitly opt out.
          </p>

          <p>We may disclose personal data to third parties such as:</p>

          <BulletList
            items={[
              "Sellers and business partners",
              "Third-party service providers",
              "Logistics partners",
              "Payment service providers",
              "Prepaid payment instrument issuers",
              "Third-party reward programs",
              "Other service providers selected or authorised by you",
            ]}
          />

          <p>
            Such disclosure may be required to provide you access to our
            services and products, comply with legal obligations, enforce our
            user agreement, facilitate marketing and advertising activities, or
            prevent, detect, mitigate, and investigate fraudulent or illegal
            activities.
          </p>

          <p>
            We may disclose personal and sensitive personal data to government
            agencies or authorised law enforcement agencies when required by law
            or when we reasonably believe that such disclosure is necessary to
            respond to subpoenas, court orders, or other legal processes.
          </p>

          <p>
            We may also disclose personal data where reasonably necessary to
            enforce our Terms of Use or Privacy Policy, respond to claims
            concerning third-party rights, or protect the rights, property, or
            personal safety of our users or the general public.
          </p>
        </PolicySection>

        {/* Security */}
        <PolicySection
          number="05"
          icon={<LockKeyhole size={20} />}
          title="Security Precautions"
        >
          <p>
            To protect your personal data from unauthorised access, disclosure,
            loss, or misuse, we adopt reasonable security practices and
            procedures.
          </p>

          <p>
            Once your information is in our possession, or whenever you access
            your account information, we follow security guidelines designed to
            protect your information against unauthorised access and provide the
            use of a secure server where applicable.
          </p>

          <p>
            However, transmission of information over the internet is not
            completely secure due to reasons beyond our control.
          </p>

          <p>
            By using the Platform, you acknowledge the security implications of
            transmitting data over the internet and World Wide Web. Complete
            security of internet transmission cannot always be guaranteed, and
            certain inherent risks may remain.
          </p>

          <p>
            Users are responsible for maintaining the security of their login
            credentials and password records.
          </p>
        </PolicySection>

        {/* Data Deletion */}
        <PolicySection
          number="06"
          icon={<Trash2 size={20} />}
          title="Data Deletion & Retention"
        >
          <p>
            You have the option to delete your account by visiting your profile
            and settings on our Platform. Account deletion may result in the
            loss of all information associated with your account.
          </p>

          <p>
            You may also contact us using the contact information provided below
            to request assistance with account deletion or related requests.
          </p>

          <p>
            In the event of a pending grievance, claim, pending shipment, or
            other ongoing service, we may refuse or delay deletion of the
            account where permitted or required by applicable law.
          </p>

          <p>
            Once the account is deleted, you will lose access to the account.
          </p>

          <p>
            We retain personal data for no longer than is required for the
            purpose for which it was collected or as required under applicable
            law.
          </p>

          <p>
            We may retain certain information where we believe it may be
            necessary to prevent fraud, future abuse, or for other legitimate
            purposes.
          </p>

          <p>
            We may continue to retain data in anonymised form for analytical and
            research purposes.
          </p>
        </PolicySection>

        {/* Rights */}
        <PolicySection
          number="07"
          icon={<UserCheck size={20} />}
          title="Your Rights"
        >
          <p>
            You may access, rectify, and update your personal data directly
            through the functionalities provided on the Platform.
          </p>
        </PolicySection>

        {/* Consent */}
        <PolicySection
          number="08"
          icon={<ShieldCheck size={20} />}
          title="Consent"
        >
          <p>
            By visiting our Platform or providing your information, you consent
            to the collection, use, storage, disclosure, and other processing of
            your information in accordance with this Privacy Policy.
          </p>

          <p>
            If you disclose personal data relating to other people, you
            represent that you have the authority to do so and permit us to use
            the information in accordance with this Privacy Policy.
          </p>

          <p>
            By providing your personal data through the Platform or partner
            platforms or establishments, you consent to us, including our
            corporate entities, affiliates, lending partners, technology
            partners, marketing channels, business partners, and other third
            parties, contacting you through SMS, instant messaging applications,
            calls, and/or email for the purposes specified in this Privacy
            Policy.
          </p>

          <p>
            You may withdraw consent that you have already provided by writing
            to the Grievance Officer using the contact information provided
            below.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5">
            <p className="font-semibold text-gray-900">
              Subject line for withdrawal requests:
            </p>

            <p className="mt-2 text-red-600 font-medium">
              "Withdrawal of consent for processing personal data"
            </p>
          </div>

          <p>We may verify such requests before acting upon them.</p>

          <p>
            Withdrawal of consent will not be retrospective and will be subject
            to the Terms of Use, this Privacy Policy, and applicable laws.
          </p>

          <p>
            If you withdraw consent given under this Privacy Policy, we reserve
            the right to restrict or deny services for which we consider the
            relevant information necessary.
          </p>
        </PolicySection>

        {/* Changes */}
        <PolicySection
          number="09"
          icon={<RefreshCcw size={20} />}
          title="Changes to this Privacy Policy"
        >
          <p>Please check this Privacy Policy periodically for changes.</p>

          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our information practices.
          </p>

          <p>
            We may alert or notify you about significant changes to the Privacy
            Policy in the manner required under applicable laws.
          </p>
        </PolicySection>

        {/* Grievance Officer */}
        <section className="mt-5 bg-black text-white rounded-3xl p-6 sm:p-8">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center mb-5">
            <Phone size={23} />
          </div>

          <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">
            Contact & Support
          </p>

          <h2 className="text-xl sm:text-2xl font-bold">Grievance Officer</h2>

          <div className="mt-6 space-y-4 text-sm sm:text-base">
            <ContactRow label="Company Name & Address" value="Esetu, hansi" />

            <ContactRow label="Phone" value="8397067785" />

            <ContactRow
              label="Working Hours"
              value="Monday - Friday, 9:00 - 18:00"
            />
          </div>

          <a
            href="tel:8397067785"
            className="inline-flex items-center gap-2 mt-7 px-5 py-3
                       rounded-xl bg-red-600 hover:bg-red-700
                       font-semibold text-sm transition active:scale-95"
          >
            <Phone size={17} />
            Contact Us
          </a>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 leading-5">
          By using the e-Setu Platform, you acknowledge that you have read and
          understood this Privacy Policy.
        </p>
      </main>
    </div>
  );
};

const InfoCard = ({ icon, label, value }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-red-600 mb-2">{icon}</div>

      <p className="text-xs text-gray-500">{label}</p>

      <p className="font-bold text-sm mt-1">{value}</p>
    </div>
  );
};

const PolicySection = ({ number, icon, title, children }) => {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 mb-5">
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

            <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
          </div>

          <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-7">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

const BulletList = ({ items }) => {
  return (
    <ul className="list-disc pl-5 space-y-2">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};

const ContactRow = ({ label, value }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-b border-white/10 pb-3">
      <span className="text-gray-500 sm:w-48 shrink-0">{label}</span>

      <span className="text-gray-200">{value}</span>
    </div>
  );
};

export default PrivacyPolicy;
