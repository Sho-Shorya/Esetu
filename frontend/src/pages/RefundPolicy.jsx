import React from "react";
import {
  ArrowLeft,
  RefreshCcw,
  Clock,
  PackageX,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const RefundCancellation = () => {
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
          >
            <ArrowLeft size={21} />
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold">
              Refund & Cancellation
            </h1>
            <p className="text-xs text-gray-500">e-Setu Policies</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-5">
            <RefreshCcw size={27} />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Refund & Cancellation Policy
          </h2>

          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-7 max-w-2xl">
            Please read this policy carefully to understand the rules applicable
            to cancellations, refunds, damaged products and replacements on
            e-Setu.
          </p>
        </div>
      </section>

      {/* Policy Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Quick Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <Clock className="text-red-600 mb-2" size={21} />
            <p className="text-xs text-gray-500">Cancellation</p>
            <p className="font-bold text-sm mt-1">Within 1 day</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <PackageX className="text-red-600 mb-2" size={21} />
            <p className="text-xs text-gray-500">Damage Report</p>
            <p className="font-bold text-sm mt-1">Within 1 day</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <ShieldCheck className="text-red-600 mb-2" size={21} />
            <p className="text-xs text-gray-500">Product Issue</p>
            <p className="font-bold text-sm mt-1">Within 1 day</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <RefreshCcw className="text-red-600 mb-2" size={21} />
            <p className="text-xs text-gray-500">Refund Processing</p>
            <p className="font-bold text-sm mt-1">Within 2 days</p>
          </div>
        </div>

        {/* Introduction */}
        <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 mb-5">
          <p className="text-gray-600 leading-7 text-sm sm:text-base">
            This Refund and Cancellation Policy outlines how you can cancel or
            seek a refund for a product or service that you have purchased
            through the e-Setu Platform.
          </p>
        </section>

        {/* Policy Sections */}
        <div className="space-y-5">
          <PolicySection number="01" title="Cancellation of Orders">
            <p>
              Cancellations will only be considered if the request is made
              within <strong>1 day of placing the order.</strong>
            </p>

            <p>
              However, cancellation requests may not be entertained if the order
              has already been communicated to the seller/merchant listed on the
              Platform and the seller/merchant has initiated the shipping
              process, or if the product is already out for delivery.
            </p>

            <p>
              In such an event, you may choose to reject the product at the
              doorstep.
            </p>
          </PolicySection>

          <PolicySection number="02" title="Perishable Products">
            <p>
              e-Setu does not accept cancellation requests for perishable items
              such as flowers, eatables, and other products that may deteriorate
              quickly.
            </p>

            <p>
              However, a refund or replacement may be considered if the user
              establishes that the quality of the product delivered is not
              satisfactory.
            </p>
          </PolicySection>

          <PolicySection number="03" title="Damaged or Defective Products">
            <p>
              In case you receive a damaged or defective product, please report
              the issue to our customer service team within{" "}
              <strong>1 day of receiving the product.</strong>
            </p>

            <p>
              The request will be considered after the seller/merchant listed on
              the Platform has inspected the product and determined that it is
              damaged or defective.
            </p>
          </PolicySection>

          <PolicySection number="04" title="Product Not as Described">
            <p>
              If you believe that the product received is not as shown on the
              Platform or does not meet the description or your reasonable
              expectations, you must notify our customer service team within{" "}
              <strong>1 day of receiving the product.</strong>
            </p>

            <p>
              Our customer service team will review the complaint and take an
              appropriate decision based on the circumstances of the case.
            </p>
          </PolicySection>

          <PolicySection number="05" title="Manufacturer Warranty">
            <p>
              For complaints relating to products that are covered by a
              manufacturer's warranty, you should refer the issue directly to
              the respective manufacturer or authorized service provider, as
              applicable.
            </p>
          </PolicySection>

          <PolicySection number="06" title="Refund Processing">
            <p>
              In cases where a refund is approved by <strong>e-Setu</strong>,
              the refund will be processed within{" "}
              <strong>2 days of approval.</strong>
            </p>

            <p>
              The time taken for the amount to reflect in your account may also
              depend on your bank or payment service provider.
            </p>
          </PolicySection>
        </div>

        {/* Contact Card */}
        <section className="mt-6 bg-black text-white rounded-3xl p-6 sm:p-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">
            Need Help?
          </p>

          <h2 className="text-xl sm:text-2xl font-bold">
            Contact e-Setu Support
          </h2>

          <p className="text-gray-400 text-sm leading-6 mt-2">
            For cancellation, refund, damaged-product, defective-product, or
            product-related complaints, please contact e-Setu customer support
            within the applicable time period.
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

        {/* Footer Note */}
        <p className="text-center text-xs text-gray-400 mt-8 leading-5">
          By placing an order through the e-Setu Platform, you acknowledge that
          you have read and understood this Refund and Cancellation Policy.
        </p>
      </main>
    </div>
  );
};

const PolicySection = ({ number, title, children }) => {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8">
      <div className="flex gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-xl bg-red-50 text-red-600
                     flex items-center justify-center font-bold text-sm"
        >
          {number}
        </div>

        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold mb-4">{title}</h2>

          <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-7">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefundCancellation;
