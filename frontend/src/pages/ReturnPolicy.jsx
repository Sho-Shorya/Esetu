import React from "react";
import {
  ArrowLeft,
  RotateCcw,
  Clock,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ReturnPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       hover:bg-gray-100 active:scale-95 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={21} />
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold">Return Policy</h1>
            <p className="text-xs text-gray-500">e-Setu Policies</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-5">
            <RotateCcw size={27} />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Return Policy
          </h2>

          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-7 max-w-2xl">
            Learn about e-Setu's return, exchange, refund, and product
            eligibility requirements.
          </p>
        </div>
      </section>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Quick Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <InfoCard
            icon={<Clock size={21} />}
            label="Return Window"
            value="2 Days"
          />

          <InfoCard
            icon={<PackageCheck size={21} />}
            label="Product"
            value="Unused"
          />

          <InfoCard
            icon={<ShieldCheck size={21} />}
            label="Packaging"
            value="Original"
          />

          <InfoCard
            icon={<RotateCcw size={21} />}
            label="Exchange"
            value="If Defective"
          />
        </div>

        {/* Introduction */}
        <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 mb-5">
          <p className="text-gray-600 leading-7 text-sm sm:text-base">
            e-Setu offers refund or exchange within the first{" "}
            <strong>2 days from the date of purchase</strong>, subject to the
            eligibility conditions mentioned in this Return Policy.
          </p>

          <p className="text-gray-600 leading-7 text-sm sm:text-base mt-3">
            If 2 days have passed since your purchase, you will not be eligible
            for a return, exchange, or refund.
          </p>
        </section>

        {/* Policy Sections */}
        <div className="space-y-5">
          <PolicySection number="01" title="Return & Exchange Period">
            <p>
              We offer refunds or exchanges within the first{" "}
              <strong>2 days from the date of purchase.</strong>
            </p>

            <p>
              If <strong>2 days have passed</strong> since your purchase, you
              will not be offered a return, exchange, or refund of any kind.
            </p>
          </PolicySection>

          <PolicySection number="02" title="Eligibility for Return or Exchange">
            <p>
              In order to become eligible for a return or exchange, the
              following conditions must be satisfied:
            </p>

            <ul className="list-disc pl-5 space-y-2">
              <li>
                The purchased item should be <strong>unused</strong> and in the
                same condition as you received it.
              </li>

              <li>
                The item must have its <strong>original packaging.</strong>
              </li>

              <li>
                Items purchased during a{" "}
                <strong>sale or promotional offer</strong> may not be eligible
                for return or exchange.
              </li>

              <li>
                Products will only be replaced through an exchange request if
                they are found to be <strong>defective or damaged</strong>,
                subject to verification.
              </li>
            </ul>
          </PolicySection>

          <PolicySection number="03" title="Non-Returnable Products">
            <p>
              You agree that there may be certain categories of products or
              items that are exempt from returns, exchanges, or refunds.
            </p>

            <p>
              Such categories of products will be identified or communicated to
              you at the time of purchase.
            </p>
          </PolicySection>

          <PolicySection number="04" title="Return & Exchange Process">
            <p>
              For an accepted return or exchange request, the returned product
              or item must be received and inspected by e-Setu.
            </p>

            <p>
              Once your returned or exchanged product is received, we will
              notify you regarding the receipt of the returned product.
            </p>

            <p>
              The product will then undergo a <strong>quality check</strong> to
              determine whether it meets the applicable return or exchange
              requirements.
            </p>
          </PolicySection>

          <PolicySection number="05" title="Approval & Processing">
            <p>
              If the returned product passes our quality check and the return or
              exchange is approved, your request will be processed in accordance
              with the applicable e-Setu policies.
            </p>

            <p>
              If the product does not meet the eligibility requirements, the
              return or exchange request may be rejected.
            </p>
          </PolicySection>

          <PolicySection number="06" title="Important Notice">
            <p>
              Return, exchange, and refund eligibility may vary depending on the
              category and condition of the product purchased.
            </p>

            <p>
              By making a purchase through the e-Setu Platform, you acknowledge
              that you have read and understood this Return Policy.
            </p>
          </PolicySection>
        </div>

        {/* Support Card */}
        <section className="mt-6 bg-black text-white rounded-3xl p-6 sm:p-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">
            Need Help?
          </p>

          <h2 className="text-xl sm:text-2xl font-bold">
            Contact e-Setu Support
          </h2>

          <p className="text-gray-400 text-sm leading-6 mt-2">
            If you have questions regarding a return, exchange, refund, or
            product eligibility, please contact e-Setu customer support.
          </p>

          <a
            href="tel:8397067785"
            className="inline-flex items-center mt-5 px-5 py-3
                       rounded-xl bg-red-600 hover:bg-red-700
                       font-semibold text-sm transition active:scale-95"
          >
            Call 8397067785
          </a>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 leading-5">
          By making a purchase through e-Setu, you acknowledge that you have
          read and understood this Return Policy.
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

const PolicySection = ({ number, title, children }) => {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8">
      <div className="flex gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-xl
                     bg-red-50 text-red-600
                     flex items-center justify-center
                     font-bold text-sm"
        >
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold mb-4">{title}</h2>

          <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-7">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReturnPolicy;
